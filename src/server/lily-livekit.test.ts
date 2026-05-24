import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  delete process.env.HERMES_RUNTIME_SECRETS_PATH
  delete process.env.LIVEKIT_URL
  delete process.env.LIVEKIT_API_KEY
  delete process.env.LIVEKIT_API_SECRET
  delete process.env.LILY_VOICE_WORKER_HEALTH_URL
  delete process.env.LIVEKIT_AGENT_HEALTH_URL
  vi.restoreAllMocks()
})

describe('getLilyVoiceWorkerHealth', () => {
  it('reports not configured when no worker health URL is set', async () => {
    process.env.HERMES_RUNTIME_SECRETS_PATH =
      '/tmp/lily-livekit-test-missing-secrets.json'
    const { getLilyVoiceWorkerHealth } = await import('./lily-livekit')

    const health = await getLilyVoiceWorkerHealth()

    expect(health.status).toBe('not_configured')
    expect(health.source).toBeNull()
    expect(health.detail).toContain('LILY_VOICE_WORKER_HEALTH_URL')
    expect(health.startCommand).toBe('pnpm lily:voice:worker')
    expect(health.defaultHealthUrl).toBe('http://127.0.0.1:8799/health')
    expect(health.docsPath).toBe('docs/lily-voice-worker.md')
  })

  it('normalizes a healthy worker response', async () => {
    process.env.LILY_VOICE_WORKER_HEALTH_URL = 'http://127.0.0.1:7777/health'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'ready' }))),
      ),
    )
    const { getLilyVoiceWorkerHealth } = await import('./lily-livekit')

    const health = await getLilyVoiceWorkerHealth()

    expect(health.status).toBe('online')
    expect(health.source).toBe('http://127.0.0.1:7777/health')
    expect(health.startCommand).toBe('pnpm lily:voice:worker')
  })

  it('reports offline for failing worker health checks', async () => {
    process.env.LILY_VOICE_WORKER_HEALTH_URL = 'http://127.0.0.1:7777/health'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 503 }))),
    )
    const { getLilyVoiceWorkerHealth } = await import('./lily-livekit')

    const health = await getLilyVoiceWorkerHealth()

    expect(health.status).toBe('offline')
    expect(health.detail).toContain('HTTP 503')
  })

  it('reports a listening LiveKit worker port without /health as unknown, not offline', async () => {
    process.env.LILY_VOICE_WORKER_HEALTH_URL = 'http://127.0.0.1:7777/health'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not found', { status: 404 }))),
    )
    const { getLilyVoiceWorkerHealth } = await import('./lily-livekit')

    const health = await getLilyVoiceWorkerHealth()

    expect(health.status).toBe('unknown')
    expect(health.detail).toContain('does not expose a /health route')
  })

  it('returns token expiry metadata with generated LiveKit credentials', async () => {
    process.env.LIVEKIT_URL = 'wss://livekit.example.test'
    process.env.LIVEKIT_API_KEY = 'key'
    process.env.LIVEKIT_API_SECRET = 'secret'
    const { createLilyLiveKitToken } = await import('./lily-livekit')

    const credentials = createLilyLiveKitToken('tyler')

    expect(credentials.serverUrl).toBe('wss://livekit.example.test')
    expect(credentials.expiresInSeconds).toBe(1200)
    expect(Date.parse(credentials.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('can mint a refresh token for the same LiveKit room', async () => {
    process.env.LIVEKIT_URL = 'wss://livekit.example.test'
    process.env.LIVEKIT_API_KEY = 'key'
    process.env.LIVEKIT_API_SECRET = 'secret'
    const { createLilyLiveKitToken } = await import('./lily-livekit')

    const initial = createLilyLiveKitToken('tyler')
    const refresh = createLilyLiveKitToken('tyler', initial.roomName)

    expect(refresh.roomName).toBe(initial.roomName)
  })
})
