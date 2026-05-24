import fs from 'node:fs'
import { once } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: Array<string> = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

async function loadWorker() {
  return import('../../scripts/lily-voice-worker.mjs')
}

function writeRuntimeSecrets(secrets: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lily-worker-secrets-'))
  tempDirs.push(dir)
  const filePath = path.join(dir, 'runtime-secrets.json')
  fs.writeFileSync(filePath, JSON.stringify(secrets, null, 2))
  return filePath
}

describe('lily-voice-worker runtime secrets', () => {
  it('uses the same runtime-secrets fallback source as Workspace', async () => {
    const secretsPath = writeRuntimeSecrets({
      LIVEKIT_URL: 'wss://livekit.example.test',
      LIVEKIT_API_KEY: 'livekit-key-from-file',
      LIVEKIT_API_SECRET: 'livekit-secret-from-file',
      LIVEKIT_AGENT_NAME: 'lily-file',
      LILY_STT_PROVIDER: 'openai',
      LILY_LLM_PROVIDER: 'hermes',
      LILY_TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
      HERMES_API_TOKEN: 'hermes-token-from-file',
    })
    const worker = await loadWorker()

    const runtimeEnv = worker.buildRuntimeEnv({
      HERMES_RUNTIME_SECRETS_PATH: secretsPath,
    })
    const config = worker.resolveWorkerConfig(runtimeEnv)
    const validation = worker.validateWorkerEnv(config, runtimeEnv)

    expect(config.agentName).toBe('lily-file')
    expect(config.providers.stt.provider).toBe('openai')
    expect(validation.ok).toBe(true)
    expect(validation.livekitConfigured).toBe(true)
  })

  it('does not report LiveKit media readiness for the HTTP pipeline scaffold', async () => {
    const worker = await loadWorker()
    const runtimeEnv = {
      LIVEKIT_URL: 'wss://livekit.example.test',
      LIVEKIT_API_KEY: 'livekit-key-from-file',
      LIVEKIT_API_SECRET: 'livekit-secret-from-file',
      LILY_STT_PROVIDER: 'openai',
      LILY_LLM_PROVIDER: 'hermes',
      LILY_TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
      HERMES_API_TOKEN: 'hermes-token-from-file',
    }
    const config = worker.resolveWorkerConfig(runtimeEnv)
    const health = worker.getHealthPayload(config, runtimeEnv)

    expect(health.httpPipelineReady).toBe(true)
    expect(health.mediaRoomReady).toBe(false)
    expect(health.status).toBe('not_ready')
  })

  it('does not report LiveKit media readiness unless the unstable media agent is explicitly enabled', async () => {
    const worker = await loadWorker()
    const runtimeEnv = {
      LIVEKIT_URL: 'wss://livekit.example.test',
      LIVEKIT_API_KEY: 'livekit-key-from-file',
      LIVEKIT_API_SECRET: 'livekit-secret-from-file',
      LILY_VOICE_WORKER_MODE: 'livekit',
      LILY_STT_PROVIDER: 'openai',
      LILY_LLM_PROVIDER: 'hermes',
      LILY_TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
      HERMES_API_TOKEN: 'hermes-token-from-file',
    }
    const config = worker.resolveWorkerConfig(runtimeEnv)
    const health = worker.getHealthPayload(config, runtimeEnv)

    expect(health.httpPipelineReady).toBe(true)
    expect(health.mediaRoomReady).toBe(false)
    expect(health.status).toBe('not_ready')
    expect(health.detail).toContain('LILY_ENABLE_LIVEKIT_AGENT=1')
  })

  it('reports LiveKit media readiness when explicitly enabled', async () => {
    const worker = await loadWorker()
    const runtimeEnv = {
      LIVEKIT_URL: 'wss://livekit.example.test',
      LIVEKIT_API_KEY: 'livekit-key-from-file',
      LIVEKIT_API_SECRET: 'livekit-secret-from-file',
      LILY_VOICE_WORKER_MODE: 'livekit',
      LILY_ENABLE_LIVEKIT_AGENT: '1',
      LILY_STT_PROVIDER: 'openai',
      LILY_LLM_PROVIDER: 'hermes',
      LILY_TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
      HERMES_API_TOKEN: 'hermes-token-from-file',
    }
    const config = worker.resolveWorkerConfig(runtimeEnv)
    const health = worker.getHealthPayload(config, runtimeEnv)

    expect(health.httpPipelineReady).toBe(true)
    expect(health.mediaRoomReady).toBe(true)
    expect(health.status).toBe('ready')
  })

  it('lets process env override runtime-secrets without leaking secret values', async () => {
    const secretsPath = writeRuntimeSecrets({
      LIVEKIT_URL: 'wss://livekit.example.test',
      LIVEKIT_API_KEY: 'livekit-key-from-file',
      LIVEKIT_API_SECRET: 'livekit-secret-from-file',
      LIVEKIT_AGENT_NAME: 'lily-file',
      LILY_LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
    })
    const worker = await loadWorker()

    const runtimeEnv = worker.buildRuntimeEnv({
      HERMES_RUNTIME_SECRETS_PATH: secretsPath,
      LIVEKIT_AGENT_NAME: 'lily-env',
      LILY_LLM_PROVIDER: 'hermes',
      HERMES_API_TOKEN: 'hermes-token-from-env',
    })
    const config = worker.resolveWorkerConfig(runtimeEnv)
    const healthJson = JSON.stringify(
      worker.getHealthPayload(config, runtimeEnv),
    )

    expect(config.agentName).toBe('lily-env')
    expect(config.providers.llm.provider).toBe('hermes')
    expect(healthJson).not.toContain('livekit-key-from-file')
    expect(healthJson).not.toContain('livekit-secret-from-file')
    expect(healthJson).not.toContain('openai-key-from-file')
  })

  it('fails closed when a configured provider is temporarily unavailable', async () => {
    const worker = await loadWorker()
    const config = worker.resolveWorkerConfig({
      LILY_STT_PROVIDER: 'openai',
      LILY_LLM_PROVIDER: 'openai',
      LILY_TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
    })
    const adapters = {
      stt: {
        name: 'openai',
        async transcribe() {
          return { provider: 'openai', transcript: 'LILY, confirm failure' }
        },
      },
      llm: {
        name: 'openai',
        async respond() {
          throw new Error('OpenAI LLM returned HTTP 429.')
        },
      },
      tts: {
        name: 'openai',
        async synthesize() {
          return {
            provider: 'openai',
            contentType: 'audio/mpeg',
            audioBase64: '',
            bytes: 0,
          }
        },
      },
    }

    await expect(
      worker.runVoicePipeline(
        { transcript: 'LILY, confirm failure' },
        config,
        adapters,
      ),
    ).rejects.toThrow('HTTP 429')
  })

  it('uses Hermes gateway access for the LLM provider without exposing bearer tokens', async () => {
    const worker = await loadWorker()
    const requests: Array<{ url: string; headers: Record<string, string> }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        headers: init?.headers as Record<string, string>,
      })
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hermes is ready.' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }) as typeof fetch

    try {
      const runtimeEnv = {
        LIVEKIT_URL: 'wss://livekit.example.test',
        LIVEKIT_API_KEY: 'livekit-key-from-file',
        LIVEKIT_API_SECRET: 'livekit-secret-from-file',
        HERMES_API_TOKEN: 'hermes-token-from-file',
        LILY_GATEWAY_URL: 'http://127.0.0.1:18789',
        OPENAI_API_KEY: 'openai-key-from-file',
        LILY_STT_PROVIDER: 'openai',
        LILY_LLM_PROVIDER: 'hermes',
        LILY_TTS_PROVIDER: 'openai',
        LILY_LLM_MODEL: 'hermes-agent',
      }
      const config = worker.resolveWorkerConfig(runtimeEnv)
      const validation = worker.validateWorkerEnv(config, runtimeEnv)
      const result = await worker.runVoicePipeline(
        { transcript: 'LILY, confirm Hermes gateway' },
        config,
        worker.createProviderAdapters(config, runtimeEnv),
      )
      const healthJson = JSON.stringify(
        worker.getHealthPayload(config, runtimeEnv),
      )

      expect(validation.ok).toBe(true)
      expect(result.degraded).toBe(false)
      expect(result.providers.llm).toBe('hermes')
      expect(result.response).toBe('Hermes is ready.')
      expect(requests[0].url).toBe('http://127.0.0.1:18789/v1/chat/completions')
      expect(requests[0].headers.authorization).toBe(
        'Bearer hermes-token-from-file',
      )
      expect(healthJson).not.toContain('hermes-token-from-file')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('requires bearer auth for pipeline access when bound off loopback', async () => {
    const worker = await loadWorker()
    const runtimeEnv = {
      LILY_STT_PROVIDER: 'openai',
      LILY_LLM_PROVIDER: 'hermes',
      LILY_TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key-from-file',
      HERMES_API_TOKEN: 'hermes-token-from-file',
    }
    const config = worker.resolveWorkerConfig({
      ...runtimeEnv,
      LILY_VOICE_WORKER_HOST: '0.0.0.0',
      LILY_VOICE_WORKER_TOKEN: 'worker-token',
    })
    const server = worker.createLilyVoiceServer(config, runtimeEnv)
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/chat/completions')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hermes auth check.' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (target.includes('/audio/speech')) {
        return new Response('audio-bytes', {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        })
      }
      return originalFetch(url, init)
    }) as typeof fetch

    try {
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Expected TCP server address')
      }
      const url = `http://127.0.0.1:${address.port}/pipeline`
      const blocked = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ transcript: 'LILY auth check' }),
      })
      const allowed = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-token',
        },
        body: JSON.stringify({ transcript: 'LILY auth check' }),
      })

      expect(blocked.status).toBe(401)
      expect(allowed.status).toBe(200)
    } finally {
      globalThis.fetch = originalFetch
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
