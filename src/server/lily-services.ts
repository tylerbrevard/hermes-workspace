import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { promisify } from 'node:util'
import { openaiChat } from './openai-compat-api'

const execFileAsync = promisify(execFile)
const TIMEOUT_PARSE_MS = 90_000
const TIMEOUT_TTS_MS = 30_000
const TIMEOUT_TRANSCRIBE_MS = 60_000
const WHISPER_BIN = process.env.WHISPER_BIN || 'whisper'
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'small.en'

type LilyParseInput = {
  systemPrompt?: string
  prompt?: string
}

function cleanSpeakableText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getOpenAIApiKey() {
  const envKey = process.env.OPENAI_API_KEY?.trim()
  if (envKey) return envKey

  const secretCandidates = [
    process.env.HERMES_RUNTIME_SECRETS,
    join(process.env.HERMES_HOME || join(process.env.HOME || '', '.hermes'), 'secrets', 'runtime-secrets.json'),
    join(process.env.HOME || '', '.config', 'hermes', 'tokens', 'runtime-secrets.json'),
  ].filter(Boolean) as string[]

  for (const path of secretCandidates) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
      const key = parsed.openai_api_key || parsed.OPENAI_API_KEY
      if (typeof key === 'string' && key.trim()) return key.trim()
    } catch {
      // Try the next configured secret path.
    }
  }

  return null
}

async function callOpenAIDirect(systemPrompt: string | undefined, prompt: string) {
  const token = getOpenAIApiKey()
  if (!token) return null

  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt?.trim()) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LILY_OPENAI_MODEL || 'gpt-5.4',
      messages,
      max_tokens: 1024,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(TIMEOUT_PARSE_MS),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 240)}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  return typeof content === 'string' && content.trim() ? content.trim() : null
}

export async function parseLilyPrompt(input: LilyParseInput) {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  if (!prompt) throw new Error('Missing or empty "prompt" field')

  const messages = [
    ...(input.systemPrompt?.trim()
      ? [{ role: 'system', content: input.systemPrompt.trim() }]
      : []),
    { role: 'user', content: prompt },
  ]

  try {
    const content = await openaiChat(messages, {
      model: process.env.LILY_GATEWAY_MODEL || 'gpt-5.4',
      temperature: 0.4,
      signal: AbortSignal.timeout(TIMEOUT_PARSE_MS),
    })
    if (content.trim()) {
      return { content: content.trim(), source: 'hermes-gateway' }
    }
  } catch {
    // Fall through to direct OpenAI only when the local gateway is unavailable.
  }

  const direct = await callOpenAIDirect(input.systemPrompt, prompt)
  if (direct) return { content: direct, source: 'openai-direct' }
  throw new Error('All Lily text providers failed')
}

async function synthesizeWithMacSay(text: string) {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const aiffPath = join(tmpdir(), `lily-speak-${stamp}.aiff`)
  const wavPath = join(tmpdir(), `lily-speak-${stamp}.wav`)

  try {
    await execFileAsync('say', ['-o', aiffPath, text], { timeout: TIMEOUT_TTS_MS })
    await execFileAsync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', aiffPath, wavPath], {
      timeout: TIMEOUT_TTS_MS,
    })
    const audio = await readFile(wavPath)
    return { audio, contentType: 'audio/wav' }
  } finally {
    await unlink(aiffPath).catch(() => {})
    await unlink(wavPath).catch(() => {})
  }
}

export async function synthesizeLilySpeech(input: { text?: string; voice?: string }) {
  const clean = cleanSpeakableText(String(input.text || ''))
  if (!clean) throw new Error('No speakable text after cleanup')

  const token = getOpenAIApiKey()
  if (!token) return synthesizeWithMacSay(clean.slice(0, 4096))

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LILY_TTS_MODEL || 'tts-1',
      input: clean.slice(0, 4096),
      voice: input.voice || 'nova',
      response_format: 'mp3',
      speed: 1.05,
    }),
    signal: AbortSignal.timeout(TIMEOUT_TTS_MS),
  })

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      return synthesizeWithMacSay(clean.slice(0, 4096))
    }
    throw new Error(`OpenAI TTS ${response.status}`)
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'audio/mpeg',
  }
}

export async function transcribeLilyAudio(formData: FormData) {
  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof Blob)) {
    throw new Error('Missing "audio" file in form data')
  }

  const requestedName =
    typeof (audioFile as File).name === 'string'
      ? (audioFile as File).name
      : 'recording.webm'
  const ext = extname(requestedName) || '.webm'
  const basePath = join(tmpdir(), `lily-audio-${Date.now()}-${randomUUID().slice(0, 8)}`)
  const inputPath = `${basePath}${ext}`
  const outputPath = `${basePath}.txt`

  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    await writeFile(inputPath, audioBuffer)
    const { stdout } = await execFileAsync(
      WHISPER_BIN,
      [
        inputPath,
        '--model',
        WHISPER_MODEL,
        '--language',
        'en',
        '--output_format',
        'txt',
        '--output_dir',
        tmpdir(),
        '--fp16',
        'False',
      ],
      { timeout: TIMEOUT_TRANSCRIBE_MS },
    )

    let text = ''
    try {
      text = (await readFile(outputPath, 'utf8')).trim()
    } catch {
      text = stdout.replace(/^\[.*?\]\s*/gm, '').trim()
    }

    return { text }
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}
