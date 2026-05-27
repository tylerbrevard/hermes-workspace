#!/usr/bin/env node
import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const startedAt = new Date()
const runOnce = process.argv.includes('--once')
const smokePipeline = process.argv.includes('--smoke-pipeline')

const providerKinds = ['stt', 'llm', 'tts']
const supportedProviders = {
  stt: new Set(['openai']),
  llm: new Set(['openai', 'hermes']),
  tts: new Set(['openai']),
}
const providerEnvNames = {
  stt: 'LILY_STT_PROVIDER',
  llm: 'LILY_LLM_PROVIDER',
  tts: 'LILY_TTS_PROVIDER',
}
const openaiModelEnvNames = {
  stt: 'LILY_STT_MODEL',
  llm: 'LILY_LLM_MODEL',
  tts: 'LILY_TTS_MODEL',
}
const openaiDefaultModels = {
  stt: 'whisper-1',
  llm: 'hermes-agent',
  tts: 'gpt-4o-mini-tts',
}
const fullWorkerEnv = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  ...Object.values(providerEnvNames),
]
const defaultProviderTimeoutMs = 20_000

const defaultServiceInstructions = [
  "You are LILY, Tyler's local Hermes voice agent.",
  'Keep spoken answers concise, operational, and safe to execute.',
  'When a request requires tools, summarize the next action instead of pretending it already happened.',
  'Never invent provider, device, or workspace state that the runtime did not supply.',
].join(' ')

function isLoopbackHost(host) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
    String(host || '').toLowerCase(),
  )
}

function readTextEnv(env, name, fallback = '') {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumberEnv(env, name, fallback) {
  const raw = env[name]
  const parsed =
    typeof raw === 'string' && raw.trim() ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function fetchWithTimeout(
  url,
  init = {},
  timeoutMs = defaultProviderTimeoutMs,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Provider request timed out after ${timeoutMs}ms.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function getRuntimeSecretsPath(env = process.env) {
  return (
    readTextEnv(env, 'HERMES_RUNTIME_SECRETS_PATH') ||
    path.join(os.homedir(), '.hermes', 'secrets', 'runtime-secrets.json')
  )
}

export function readRuntimeSecrets(env = process.env) {
  try {
    const raw = fs.readFileSync(getRuntimeSecretsPath(env), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function buildRuntimeEnv(env = process.env) {
  const secrets = readRuntimeSecrets(env)
  const merged = {}

  for (const [key, value] of Object.entries(secrets)) {
    if (typeof value === 'string' && value.trim()) {
      merged[key] = value.trim()
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.trim()) {
      merged[key] = value.trim()
    }
  }

  return merged
}

export function resolveWorkerConfig(env = buildRuntimeEnv()) {
  const port = Number.parseInt(
    readTextEnv(env, 'LILY_VOICE_WORKER_PORT', '8799'),
    10,
  )
  const providers = Object.fromEntries(
    providerKinds.map((kind) => [
      kind,
      {
        provider: readTextEnv(
          env,
          providerEnvNames[kind],
          kind === 'llm' ? 'hermes' : 'openai',
        ).toLowerCase(),
        model: readTextEnv(
          env,
          openaiModelEnvNames[kind],
          openaiDefaultModels[kind],
        ),
      },
    ]),
  )

  return {
    port: Number.isFinite(port) && port > 0 ? port : 8799,
    host: readTextEnv(env, 'LILY_VOICE_WORKER_HOST', '127.0.0.1'),
    authToken: readTextEnv(env, 'LILY_VOICE_WORKER_TOKEN', ''),
    agentName: readTextEnv(env, 'LIVEKIT_AGENT_NAME', 'lily'),
    mode: readTextEnv(env, 'LILY_VOICE_WORKER_MODE', 'pipeline'),
    instructions: readTextEnv(
      env,
      'LILY_SERVICE_INSTRUCTIONS',
      defaultServiceInstructions,
    ),
    providers,
  }
}

export function validateWorkerEnv(
  config = resolveWorkerConfig(),
  env = buildRuntimeEnv(),
) {
  const issues = []
  const warnings = []
  const missingFullWorkerEnv = fullWorkerEnv.filter(
    (name) => !env[name]?.trim(),
  )
  const livekitConfigured = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
  ].every((name) => Boolean(env[name]?.trim()))

  for (const kind of providerKinds) {
    const { provider } = config.providers[kind]
    if (!supportedProviders[kind].has(provider)) {
      issues.push({
        code: 'unsupported_provider',
        env: providerEnvNames[kind],
        detail: `${providerEnvNames[kind]}=${provider} is not supported. Use ${kind === 'llm' ? 'hermes or openai' : 'openai'}.`,
      })
      continue
    }
    if (provider === 'openai' && !env.OPENAI_API_KEY?.trim()) {
      issues.push({
        code: 'missing_provider_secret',
        env: 'OPENAI_API_KEY',
        detail: `${providerEnvNames[kind]}=openai requires OPENAI_API_KEY.`,
      })
    }
    if (
      kind === 'llm' &&
      provider === 'hermes' &&
      !env.HERMES_API_TOKEN?.trim() &&
      !env.CLAUDE_API_TOKEN?.trim()
    ) {
      issues.push({
        code: 'missing_provider_secret',
        env: 'HERMES_API_TOKEN',
        detail:
          'LILY_LLM_PROVIDER=hermes requires HERMES_API_TOKEN or CLAUDE_API_TOKEN.',
      })
    }
  }

  if (!livekitConfigured) {
    warnings.push({
      code: 'livekit_not_configured',
      detail:
        'LiveKit room transport is not fully configured; HTTP smoke endpoints still work.',
    })
  }
  if (missingFullWorkerEnv.length) {
    warnings.push({
      code: 'full_worker_env_incomplete',
      detail: 'Full LiveKit voice worker env is incomplete.',
      missing: missingFullWorkerEnv,
    })
  }

  return {
    ok: issues.length === 0,
    livekitConfigured,
    missingFullWorkerEnv,
    issues,
    warnings,
  }
}

function createOpenAiAdapters(config, env) {
  const apiKey = readTextEnv(env, 'OPENAI_API_KEY')
  const baseUrl = readTextEnv(
    env,
    'OPENAI_BASE_URL',
    'https://api.openai.com/v1',
  )
  const timeoutMs = readNumberEnv(
    env,
    'LILY_PROVIDER_TIMEOUT_MS',
    defaultProviderTimeoutMs,
  )

  return {
    stt: {
      name: 'openai',
      async transcribe(input) {
        if (!apiKey)
          throw new Error('OPENAI_API_KEY is required for OpenAI STT.')
        if (typeof input.transcript === 'string' && input.transcript.trim()) {
          return {
            provider: 'openai',
            transcript: input.transcript.trim(),
            passthrough: true,
          }
        }
        throw new Error(
          'OpenAI STT requires audio ingestion; provide transcript for HTTP smoke or add audio transport in the LiveKit worker.',
        )
      },
    },
    llm: {
      name: 'openai',
      async respond(input) {
        if (!apiKey)
          throw new Error('OPENAI_API_KEY is required for OpenAI LLM.')
        const response = await fetchWithTimeout(
          `${baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: config.providers.llm.model,
              messages: [
                { role: 'system', content: config.instructions },
                { role: 'user', content: input.transcript },
              ],
              temperature: 0.2,
            }),
          },
          timeoutMs,
        )
        if (!response.ok) {
          throw new Error(`OpenAI LLM returned HTTP ${response.status}.`)
        }
        const payload = await response.json()
        const text = payload?.choices?.[0]?.message?.content
        return {
          provider: 'openai',
          text: typeof text === 'string' && text.trim() ? text.trim() : '',
        }
      },
    },
    tts: {
      name: 'openai',
      async synthesize(input) {
        if (!apiKey)
          throw new Error('OPENAI_API_KEY is required for OpenAI TTS.')
        const response = await fetchWithTimeout(
          `${baseUrl}/audio/speech`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: config.providers.tts.model,
              voice: readTextEnv(env, 'LILY_TTS_VOICE', 'alloy'),
              input: input.text,
              format: 'mp3',
            }),
          },
          timeoutMs,
        )
        if (!response.ok) {
          throw new Error(`OpenAI TTS returned HTTP ${response.status}.`)
        }
        const audio = Buffer.from(await response.arrayBuffer())
        return {
          provider: 'openai',
          contentType: response.headers.get('content-type') || 'audio/mpeg',
          audioBase64: audio.toString('base64'),
          bytes: audio.byteLength,
        }
      },
    },
  }
}

function createHermesLlmAdapter(config, env) {
  const gatewayUrl = readTextEnv(
    env,
    'LILY_GATEWAY_URL',
    'http://127.0.0.1:18789',
  )
  const token =
    readTextEnv(env, 'HERMES_API_TOKEN') || readTextEnv(env, 'CLAUDE_API_TOKEN')
  const timeoutMs = readNumberEnv(
    env,
    'LILY_PROVIDER_TIMEOUT_MS',
    defaultProviderTimeoutMs,
  )

  return {
    name: 'hermes',
    async respond(input) {
      if (!token) {
        throw new Error(
          'HERMES_API_TOKEN or CLAUDE_API_TOKEN is required for Hermes LLM.',
        )
      }
      const response = await fetchWithTimeout(
        `${gatewayUrl.replace(/\/+$/, '')}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: config.providers.llm.model,
            messages: [
              { role: 'system', content: config.instructions },
              { role: 'user', content: input.transcript },
            ],
            temperature: 0.2,
          }),
        },
        timeoutMs,
      )
      if (!response.ok) {
        throw new Error(`Hermes LLM returned HTTP ${response.status}.`)
      }
      const payload = await response.json()
      const text = payload?.choices?.[0]?.message?.content
      return {
        provider: 'hermes',
        text: typeof text === 'string' && text.trim() ? text.trim() : '',
      }
    },
  }
}

export function createProviderAdapters(
  config = resolveWorkerConfig(),
  env = buildRuntimeEnv(),
) {
  const openaiAdapters = createOpenAiAdapters(config, env)
  const hermesLlmAdapter = createHermesLlmAdapter(config, env)
  return {
    stt:
      config.providers.stt.provider === 'openai'
        ? openaiAdapters.stt
        : (() => {
            throw new Error(
              `${providerEnvNames.stt}=${config.providers.stt.provider} is not supported.`,
            )
          })(),
    llm:
      config.providers.llm.provider === 'openai'
        ? openaiAdapters.llm
        : config.providers.llm.provider === 'hermes'
          ? hermesLlmAdapter
          : (() => {
              throw new Error(
                `${providerEnvNames.llm}=${config.providers.llm.provider} is not supported.`,
              )
            })(),
    tts:
      config.providers.tts.provider === 'openai'
        ? openaiAdapters.tts
        : (() => {
            throw new Error(
              `${providerEnvNames.tts}=${config.providers.tts.provider} is not supported.`,
            )
          })(),
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(`${body}\n`)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 64_000) {
        req.destroy(new Error('request body too large'))
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export async function runVoicePipeline(
  input,
  config = resolveWorkerConfig(),
  adapters = createProviderAdapters(config),
) {
  const stt = await adapters.stt.transcribe(input)
  const llm = await adapters.llm.respond({
    transcript: stt.transcript,
    instructions: config.instructions,
  })
  const tts = await adapters.tts.synthesize({ text: llm.text })

  return {
    ok: true,
    status: 'ready',
    mode: config.mode,
    degraded: false,
    providers: {
      stt: adapters.stt.name,
      llm: adapters.llm.name,
      tts: adapters.tts.name,
    },
    transcript: stt.transcript,
    response: llm.text,
    audio: tts,
  }
}

export function getHealthPayload(
  config = resolveWorkerConfig(),
  env = buildRuntimeEnv(),
) {
  const validation = validateWorkerEnv(config, env)
  const livekitAgentEnabled = env.LILY_ENABLE_LIVEKIT_AGENT === '1'
  const livekitMediaReady =
    validation.ok &&
    validation.livekitConfigured &&
    config.mode === 'livekit' &&
    livekitAgentEnabled

  const httpPipelineReady = validation.ok

  return {
    ok: httpPipelineReady,
    ready: httpPipelineReady,
    status: httpPipelineReady ? 'ready' : 'not_ready',
    worker: 'lily-voice-worker',
    agentName: config.agentName,
    mode: config.mode,
    detail: livekitMediaReady
      ? 'LILY LiveKit media worker is ready.'
      : validation.ok && config.mode === 'livekit' && !livekitAgentEnabled
        ? 'LILY LiveKit mode is configured, but the LiveKit media agent is safely gated behind LILY_ENABLE_LIVEKIT_AGENT=1. HTTP voice pipeline health is available.'
        : validation.ok
          ? 'LILY HTTP voice pipeline is ready, but LiveKit media-room worker mode is not enabled.'
          : 'LILY local voice worker configuration needs attention before production use.',
    httpPipelineReady: validation.ok,
    mediaRoomReady: livekitMediaReady,
    livekitConfigured: validation.livekitConfigured,
    missingFullWorkerEnv: validation.missingFullWorkerEnv,
    providers: config.providers,
    validation,
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    endpoints: {
      health: '/health',
      loopback: '/loopback',
      pipeline: '/pipeline',
    },
  }
}

function isWorkerRequestAuthorized(req, config) {
  if (!config.authToken && isLoopbackHost(config.host)) return true
  const authorization = req.headers.authorization || ''
  return (
    authorization === `Bearer ${config.authToken}` && Boolean(config.authToken)
  )
}

export function createLilyVoiceServer(
  config = resolveWorkerConfig(),
  env = buildRuntimeEnv(),
) {
  const adapters = createProviderAdapters(config, env)
  return createServer(async (req, res) => {
    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || `${config.host}:${config.port}`}`,
    )

    if (
      req.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/health')
    ) {
      sendJson(res, 200, getHealthPayload(config, env))
      return
    }

    if (
      req.method === 'POST' &&
      (url.pathname === '/loopback' || url.pathname === '/pipeline')
    ) {
      if (!isWorkerRequestAuthorized(req, config)) {
        sendJson(res, 401, {
          ok: false,
          status: 'unauthorized',
          detail:
            'Set LILY_VOICE_WORKER_TOKEN and send Authorization: Bearer <token> for non-loopback worker pipeline access.',
        })
        return
      }
      try {
        const raw = await readBody(req)
        const parsed = raw ? JSON.parse(raw) : {}
        const result = await runVoicePipeline(parsed, config, adapters)
        sendJson(res, 200, result)
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          status: 'bad_request',
          detail:
            error instanceof Error
              ? error.message
              : 'Unable to process voice pipeline payload.',
        })
      }
      return
    }

    sendJson(res, 404, {
      ok: false,
      status: 'not_found',
      detail: 'Use GET /health or POST /pipeline.',
    })
  })
}

async function main() {
  const runtimeEnv = buildRuntimeEnv()
  const config = resolveWorkerConfig(runtimeEnv)

  if (runOnce) {
    process.stdout.write(
      `${JSON.stringify(getHealthPayload(config, runtimeEnv), null, 2)}\n`,
    )
    process.exit(0)
  }

  if (smokePipeline) {
    const result = await runVoicePipeline(
      { transcript: 'LILY, confirm the voice pipeline.' },
      config,
      createProviderAdapters(config, runtimeEnv),
    )
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exit(0)
  }

  const server = createLilyVoiceServer(config, runtimeEnv)
  server.listen(config.port, config.host, () => {
    const healthUrl = `http://${config.host}:${config.port}/health`
    console.log(
      `[lily-voice-worker] ${config.agentName} ${config.mode} health: ${healthUrl}`,
    )
    console.log(
      `[lily-voice-worker] set LILY_VOICE_WORKER_HEALTH_URL=${healthUrl} for Hermes Workspace`,
    )
  })

  function shutdown(signal) {
    console.log(`[lily-voice-worker] received ${signal}; stopping`)
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : 'LILY voice worker failed.'}\n`,
    )
    process.exit(1)
  })
}
