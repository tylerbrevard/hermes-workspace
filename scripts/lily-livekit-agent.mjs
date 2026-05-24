#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { WorkerOptions, cli, defineAgent, voice } from '@livekit/agents'
import * as openai from '@livekit/agents-plugin-openai'
import * as silero from '@livekit/agents-plugin-silero'
import { buildRuntimeEnv, resolveWorkerConfig } from './lily-voice-worker.mjs'

const runtimeEnv = buildRuntimeEnv()
const workerConfig = resolveWorkerConfig(runtimeEnv)

function readEnv(name, fallback = '') {
  const value = runtimeEnv[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function gatewayBaseUrl() {
  return readEnv('LILY_GATEWAY_URL', 'http://127.0.0.1:18789').replace(
    /\/+$/,
    '',
  )
}

function hermesApiToken() {
  return readEnv('HERMES_API_TOKEN') || readEnv('CLAUDE_API_TOKEN') || 'hermes'
}

function liveKitInstructions() {
  return readEnv(
    'LILY_SERVICE_INSTRUCTIONS',
    [
      "You are LILY, Tyler's local Hermes voice agent.",
      'You are speaking out loud in a LiveKit voice room.',
      'Keep replies short, natural, operational, and useful.',
      'Use Hermes as your LLM backend and never invent workspace state.',
    ].join(' '),
  )
}

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect()
    const vad = await silero.VAD.load()

    const agent = new voice.Agent({
      instructions: liveKitInstructions(),
      vad,
    })

    const session = new voice.AgentSession({
      stt: new openai.STT({
        apiKey: readEnv('OPENAI_API_KEY'),
        model: readEnv('LILY_STT_MODEL', 'whisper-1'),
        language: 'en',
        detectLanguage: false,
        useRealtime: false,
        vad,
      }),
      llm: new openai.LLM({
        apiKey: hermesApiToken(),
        baseURL: `${gatewayBaseUrl()}/v1`,
        model: readEnv('LILY_LLM_MODEL', 'hermes-agent'),
        temperature: 0.2,
      }),
      tts: new openai.TTS({
        apiKey: readEnv('OPENAI_API_KEY'),
        model: readEnv('LILY_TTS_MODEL', 'gpt-4o-mini-tts'),
        voice: readEnv('LILY_TTS_VOICE', 'alloy'),
        speed: 1,
      }),
    })

    await session.start({
      agent,
      room: ctx.room,
    })
  },
})

if (import.meta.url === new URL(process.argv[1] || '', 'file:').href) {
  process.env.LIVEKIT_URL = readEnv('LIVEKIT_URL')
  process.env.LIVEKIT_API_KEY = readEnv('LIVEKIT_API_KEY')
  process.env.LIVEKIT_API_SECRET = readEnv('LIVEKIT_API_SECRET')

  cli.runApp(
    new WorkerOptions({
      agent: fileURLToPath(import.meta.url),
      wsURL: readEnv('LIVEKIT_URL'),
      apiKey: readEnv('LIVEKIT_API_KEY'),
      apiSecret: readEnv('LIVEKIT_API_SECRET'),
      host: readEnv('LILY_VOICE_WORKER_HOST', '127.0.0.1'),
      port: Number.parseInt(readEnv('LILY_VOICE_WORKER_PORT', '8799'), 10),
    }),
  )
}
