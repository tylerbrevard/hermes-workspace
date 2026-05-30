import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type RuntimeSecrets = {
  LIVEKIT_URL?: string
  LIVEKIT_API_KEY?: string
  LIVEKIT_API_SECRET?: string
  LIVEKIT_AGENT_NAME?: string
  OPENAI_API_KEY?: string
  OPENAI_REALTIME_MODEL?: string
  GEMINI_API_KEY?: string
  GOOGLE_API_KEY?: string
  GEMINI_LIVE_MODEL?: string
  LILY_GEMINI_VOICE?: string
  LILY_VOICE_PROVIDER?: string
  LILY_REALTIME_VOICE?: string
  LILY_VOICE_WORKER_PORT?: string
  LIVEKIT_AGENT_HEALTH_URL?: string
  LILY_VOICE_WORKER_HEALTH_URL?: string
  HERMES_API_TOKEN?: string
  CLAUDE_API_TOKEN?: string
}

export type LilyLiveKitConfig = {
  configured: boolean
  serverUrl: string
  agentName: string
  voiceProvider: LilyVoiceProvider
  gemini: LilyGeminiLiveConfig
  realtime: LilyRealtimeConfig
  voiceWorker: LilyVoiceWorkerHealth
}

export type LilyVoiceProvider =
  | 'gemini_live'
  | 'openai_realtime'
  | 'livekit'
  | 'chrome'
  | 'auto'

export type LilyRealtimeConfig = {
  configured: boolean
  model: string
  voice: string
}

export type LilyGeminiLiveConfig = {
  configured: boolean
  model: string
  voice: string
}

export type LilyVoiceWorkerHealth = {
  status: 'online' | 'offline' | 'unknown' | 'not_configured'
  checkedAt: string
  detail: string
  source: string | null
  startCommand: string
  defaultHealthUrl: string
  docsPath: string
  requiredEnv: Array<string>
}

const DEFAULT_AGENT_NAME = 'lily'
const DEFAULT_ROOM_PREFIX = 'lily'
const DEFAULT_WORKER_PORT = 8799
const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2'
const DEFAULT_REALTIME_VOICE = 'marin'
const DEFAULT_GEMINI_LIVE_MODEL =
  'gemini-2.5-flash-native-audio-preview-12-2025'
const DEFAULT_GEMINI_LIVE_VOICE = 'Kore'
const WORKER_START_COMMAND = 'pnpm lily:voice:worker'
const WORKER_DOCS_PATH = 'docs/lily-voice-worker.md'

function runtimeSecretsPath(): string {
  if (process.env.HERMES_RUNTIME_SECRETS_PATH?.trim()) {
    return process.env.HERMES_RUNTIME_SECRETS_PATH.trim()
  }
  return path.join(os.homedir(), '.hermes', 'secrets', 'runtime-secrets.json')
}

function readRuntimeSecrets(): RuntimeSecrets {
  try {
    const raw = fs.readFileSync(runtimeSecretsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as RuntimeSecrets)
      : {}
  } catch {
    return {}
  }
}

export function readLilyRuntimeSecret(name: keyof RuntimeSecrets): string {
  const fromEnv = process.env[name]
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  const fromFile = readRuntimeSecrets()[name]
  return typeof fromFile === 'string' ? fromFile.trim() : ''
}

export function getLilyRealtimeConfig(): LilyRealtimeConfig {
  return {
    configured: Boolean(readLilyRuntimeSecret('OPENAI_API_KEY')),
    model:
      readLilyRuntimeSecret('OPENAI_REALTIME_MODEL') || DEFAULT_REALTIME_MODEL,
    voice:
      readLilyRuntimeSecret('LILY_REALTIME_VOICE') || DEFAULT_REALTIME_VOICE,
  }
}

export function getLilyGeminiLiveConfig(): LilyGeminiLiveConfig {
  return {
    configured: Boolean(
      readLilyRuntimeSecret('GEMINI_API_KEY') ||
      readLilyRuntimeSecret('GOOGLE_API_KEY'),
    ),
    model:
      readLilyRuntimeSecret('GEMINI_LIVE_MODEL') || DEFAULT_GEMINI_LIVE_MODEL,
    voice:
      readLilyRuntimeSecret('LILY_GEMINI_VOICE') || DEFAULT_GEMINI_LIVE_VOICE,
  }
}

export function getLilyVoiceProvider(): LilyVoiceProvider {
  const raw = readLilyRuntimeSecret('LILY_VOICE_PROVIDER').toLowerCase()
  if (
    raw === 'gemini_live' ||
    raw === 'openai_realtime' ||
    raw === 'livekit' ||
    raw === 'chrome' ||
    raw === 'auto'
  ) {
    return raw
  }
  return 'auto'
}

export function getLilyLiveKitConfig(): LilyLiveKitConfig {
  const serverUrl = readLilyRuntimeSecret('LIVEKIT_URL')
  const apiKey = readLilyRuntimeSecret('LIVEKIT_API_KEY')
  const apiSecret = readLilyRuntimeSecret('LIVEKIT_API_SECRET')
  const agentName =
    readLilyRuntimeSecret('LIVEKIT_AGENT_NAME') || DEFAULT_AGENT_NAME

  return {
    configured: Boolean(serverUrl && apiKey && apiSecret),
    serverUrl,
    agentName,
    voiceProvider: getLilyVoiceProvider(),
    gemini: getLilyGeminiLiveConfig(),
    realtime: getLilyRealtimeConfig(),
    voiceWorker: withVoiceWorkerRuntimeFields({
      status: 'unknown',
      checkedAt: new Date().toISOString(),
      detail: 'Voice worker health has not been checked yet.',
      source: null,
    }),
  }
}

function readVoiceWorkerHealthUrl(): string {
  return (
    readLilyRuntimeSecret('LILY_VOICE_WORKER_HEALTH_URL') ||
    readLilyRuntimeSecret('LIVEKIT_AGENT_HEALTH_URL')
  )
}

function readVoiceWorkerPort(): number {
  const raw = readLilyRuntimeSecret('LILY_VOICE_WORKER_PORT')
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WORKER_PORT
}

function getDefaultVoiceWorkerHealthUrl(): string {
  return `http://127.0.0.1:${readVoiceWorkerPort()}/health`
}

function getVoiceWorkerRequiredEnv(): Array<string> {
  return [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'LILY_VOICE_WORKER_HEALTH_URL',
  ]
}

function withVoiceWorkerRuntimeFields(
  health: Omit<
    LilyVoiceWorkerHealth,
    'startCommand' | 'defaultHealthUrl' | 'docsPath' | 'requiredEnv'
  >,
): LilyVoiceWorkerHealth {
  return {
    ...health,
    startCommand: WORKER_START_COMMAND,
    defaultHealthUrl: getDefaultVoiceWorkerHealthUrl(),
    docsPath: WORKER_DOCS_PATH,
    requiredEnv: getVoiceWorkerRequiredEnv(),
  }
}

function normalizeVoiceWorkerHealth(
  payload: unknown,
  source: string,
): LilyVoiceWorkerHealth {
  const checkedAt = new Date().toISOString()
  if (typeof payload === 'string') {
    const normalizedText = payload.toLowerCase()
    const online =
      normalizedText === 'ok' ||
      normalizedText === 'online' ||
      normalizedText === 'ready' ||
      normalizedText === 'healthy'
    return withVoiceWorkerRuntimeFields({
      status: online ? 'online' : 'offline',
      checkedAt,
      detail: online
        ? 'LiveKit agent worker reports ready.'
        : 'Voice worker health endpoint responded but did not report ready.',
      source,
    })
  }
  if (!payload || typeof payload !== 'object') {
    return withVoiceWorkerRuntimeFields({
      status: 'online',
      checkedAt,
      detail: 'Voice worker health endpoint returned a successful response.',
      source,
    })
  }
  const raw = payload as Record<string, unknown>
  const state =
    typeof raw.status === 'string'
      ? raw.status
      : typeof raw.state === 'string'
        ? raw.state
        : typeof raw.health === 'string'
          ? raw.health
          : ''
  const normalized = state.toLowerCase()
  const online =
    normalized === 'ok' ||
    normalized === 'online' ||
    normalized === 'healthy' ||
    normalized === 'ready' ||
    raw.ok === true ||
    raw.ready === true
  const detail =
    typeof raw.detail === 'string'
      ? raw.detail
      : typeof raw.message === 'string'
        ? raw.message
        : online
          ? 'Voice worker reports ready.'
          : 'Voice worker health endpoint responded but did not report ready.'

  return withVoiceWorkerRuntimeFields({
    status: online ? 'online' : 'offline',
    checkedAt,
    detail,
    source,
  })
}

export async function getLilyVoiceWorkerHealth(): Promise<LilyVoiceWorkerHealth> {
  const healthUrl = readVoiceWorkerHealthUrl()
  const checkedAt = new Date().toISOString()
  if (!healthUrl) {
    return withVoiceWorkerRuntimeFields({
      status: 'not_configured',
      checkedAt,
      detail: `Start the local worker with "${WORKER_START_COMMAND}", then set LILY_VOICE_WORKER_HEALTH_URL=${getDefaultVoiceWorkerHealthUrl()} so Workspace can verify it.`,
      source: null,
    })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_500)
    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    }).finally(() => clearTimeout(timeout))
    const text = await response.text()
    if (!response.ok) {
      const normalizedText = text.trim().toLowerCase()
      if (response.status === 404 && normalizedText === 'not found') {
        return withVoiceWorkerRuntimeFields({
          status: 'unknown',
          checkedAt,
          detail:
            'Voice worker port is listening, but the active LiveKit worker does not expose a /health route. Check LaunchAgent logs for job-level failures.',
          source: healthUrl,
        })
      }
      return withVoiceWorkerRuntimeFields({
        status: 'offline',
        checkedAt,
        detail: `Voice worker health returned HTTP ${response.status}. Start it with "${WORKER_START_COMMAND}" or check ${WORKER_DOCS_PATH}.`,
        source: healthUrl,
      })
    }
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text.trim()
      }
    }
    return normalizeVoiceWorkerHealth(payload, healthUrl)
  } catch (error) {
    return withVoiceWorkerRuntimeFields({
      status: 'offline',
      checkedAt,
      detail:
        error instanceof Error
          ? `Voice worker health failed: ${error.message}. Start it with "${WORKER_START_COMMAND}" or check ${WORKER_DOCS_PATH}.`
          : `Voice worker health failed. Start it with "${WORKER_START_COMMAND}" or check ${WORKER_DOCS_PATH}.`,
      source: healthUrl,
    })
  }
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export function createLilyLiveKitToken(
  identity?: string,
  roomName?: string,
): {
  token: string
  roomName: string
  serverUrl: string
  agentName: string
  expiresAt: string
  expiresInSeconds: number
} {
  const serverUrl = readLilyRuntimeSecret('LIVEKIT_URL')
  const apiKey = readLilyRuntimeSecret('LIVEKIT_API_KEY')
  const apiSecret = readLilyRuntimeSecret('LIVEKIT_API_SECRET')
  const agentName =
    readLilyRuntimeSecret('LIVEKIT_AGENT_NAME') || DEFAULT_AGENT_NAME

  if (!serverUrl || !apiKey || !apiSecret) {
    throw new Error(
      'LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to ~/.hermes/secrets/runtime-secrets.json.',
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const safeIdentity =
    identity?.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64) ||
    `tyler-${crypto.randomUUID()}`
  const requestedRoomName = typeof roomName === 'string' ? roomName : ''
  const safeRequestedRoomName = requestedRoomName
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 96)
  const resolvedRoomName =
    safeRequestedRoomName || `${DEFAULT_ROOM_PREFIX}-${crypto.randomUUID()}`
  const header = { alg: 'HS256', typ: 'JWT' }
  const expiresInSeconds = 60 * 20
  const expiresAtUnix = now + expiresInSeconds
  const payload = {
    iss: apiKey,
    sub: safeIdentity,
    name: 'Tyler',
    nbf: now - 10,
    exp: expiresAtUnix,
    video: {
      room: resolvedRoomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    },
    metadata: JSON.stringify({
      agentName,
      source: 'hermes-workspace-lily',
    }),
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(unsigned)
    .digest()
  return {
    token: `${unsigned}.${base64Url(signature)}`,
    roomName: resolvedRoomName,
    serverUrl,
    agentName,
    expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
    expiresInSeconds,
  }
}
