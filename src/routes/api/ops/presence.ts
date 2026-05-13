import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { fetchClawosJson } from '../../../server/clawos-internal'

type TeamsPresence = {
  availability?: string
  activity?: string
  displayName?: string
  color?: string
  inferred?: boolean
  stale?: boolean
  authRequired?: boolean
  fallback?: boolean
  timestamp?: string
  error?: string
}

type TeamsPreview = {
  status?: string
  activity?: string
  availability?: string
  teamsStatus?: string
  label?: string
  word?: string
  currentWord?: string
}

type DeviceRow = {
  id: string
  name: string
  status: string
  type?: string
  teamsStatus?: string
  currentWord?: string
  wordMode?: string
  lastUpdate?: string
  lastSeenMinutesAgo?: number
  sensors?: {
    temp?: number
    rssi?: number
    uptime?: number
    battery?: number
  }
  config?: {
    brightness?: number
    fetchInterval?: number
    labels?: Record<string, string>
    tunnelUrl?: string
  }
}

type WordPool = {
  id: string
  name: string
  words: string[]
  active: boolean
}

function normalizePresence(value?: string) {
  const normalized = (value || '').toLowerCase().replace(/[^a-z]/g, '')
  if (normalized.includes('donotdisturb') || normalized.includes('urgentinterruptionsonly')) {
    return 'donotdisturb'
  }
  if (normalized.includes('busy') || normalized.includes('inameeting')) {
    return 'busy'
  }
  if (normalized.includes('berightback') || normalized.includes('brb')) {
    return 'berightback'
  }
  if (normalized.includes('away')) return 'away'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('offline') || normalized.includes('unknown')) return 'offline'
  return normalized || 'unknown'
}

function buildSyncDiagnostics(
  presence: TeamsPresence,
  devices: DeviceRow[],
) {
  const freshestDevice = [...devices].sort(
    (left, right) =>
      (left.lastSeenMinutesAgo ?? Number.POSITIVE_INFINITY) -
      (right.lastSeenMinutesAgo ?? Number.POSITIVE_INFINITY),
  )[0]
  const teamsAvailability = presence.availability || 'Unknown'
  const normalizedTeams = normalizePresence(teamsAvailability)
  const deviceStatus = freshestDevice?.teamsStatus || freshestDevice?.status || ''
  const normalizedDeviceStatus = normalizePresence(deviceStatus)
  const deviceWord = freshestDevice?.currentWord || ''
  const lastSeenMinutesAgo = freshestDevice?.lastSeenMinutesAgo
  const expectedLabel =
    freshestDevice?.config?.labels?.[normalizedTeams] ||
    freshestDevice?.config?.labels?.[teamsAvailability] ||
    null
  const presenceSource = presence.error
    ? 'error'
    : presence.authRequired
      ? 'auth-required'
      : presence.stale
        ? 'stale'
        : presence.inferred || presence.fallback
          ? 'inferred'
          : 'graph'

  let driftReason = 'in_sync'
  let inSync = true

  if (presence.error) {
    inSync = false
    driftReason = 'teams_unavailable'
  } else if ((lastSeenMinutesAgo ?? Number.POSITIVE_INFINITY) > 5) {
    inSync = false
    driftReason = 'device_stale'
  } else if (normalizedDeviceStatus !== normalizedTeams) {
    inSync = false
    driftReason = 'status_mismatch'
  } else if (expectedLabel && deviceWord && expectedLabel !== deviceWord) {
    inSync = false
    driftReason = 'label_mismatch'
  }

  return {
    teamsAvailability,
    teamsActivity: presence.activity || '',
    presenceSource,
    teamsError: presence.error || null,
    deviceName: freshestDevice?.name || null,
    deviceStatus,
    deviceWord,
    deviceFreshness: lastSeenMinutesAgo ?? null,
    expectedLabel,
    inSync,
    driftReason,
  }
}

export const Route = createFileRoute('/api/ops/presence')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const [presence, devicesPayload, poolsPayload, todayPayload, preview] =
            await Promise.all([
              fetchClawosJson<TeamsPresence>('/api/teams-presence'),
              fetchClawosJson<{ devices: DeviceRow[] }>('/api/iot/m5-devices'),
              fetchClawosJson<{ pools: WordPool[] }>('/api/iot/m5-words'),
              fetchClawosJson<{ meetings: Array<{ date?: string; title?: string }> }>(
                '/api/meetings/today',
                { searchParams: { days: 1 } },
              ),
              fetchClawosJson<TeamsPreview>('/api/iot/m5-words', {
                searchParams: { action: 'teams-status' },
              }),
            ])

          const now = Date.now()
          const activeMeeting = (todayPayload.meetings || []).find((meeting) => {
            const start = meeting.date ? new Date(meeting.date).getTime() : NaN
            if (!Number.isFinite(start)) return false
            const end = start + 60 * 60 * 1000
            return start <= now && end >= now
          })

          return json({
            presence,
            preview,
            devices: devicesPayload.devices || [],
            pools: poolsPayload.pools || [],
            syncDiagnostics: buildSyncDiagnostics(
              presence,
              devicesPayload.devices || [],
            ),
            activeMeetingTitle: activeMeeting?.title || null,
            refreshedAt: new Date().toISOString(),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load presence hub data',
            },
            { status: 502 },
          )
        }
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as Record<string, unknown>
          const kind = typeof body.kind === 'string' ? body.kind : ''

          if (kind === 'set-presence') {
            const availability =
              typeof body.availability === 'string' ? body.availability : ''
            const result = await fetchClawosJson('/api/teams-presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ availability }),
            })
            return json(result)
          }

          if (kind === 'update-device-config') {
            const deviceId =
              typeof body.deviceId === 'string' ? body.deviceId : ''
            const brightness =
              typeof body.brightness === 'number' ? body.brightness : undefined
            const fetchInterval =
              typeof body.fetchInterval === 'number'
                ? body.fetchInterval
                : undefined
            const result = await fetchClawosJson('/api/iot/m5-devices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update-config',
                deviceId,
                brightness,
                fetchInterval,
              }),
            })
            return json(result)
          }

          if (kind === 'update-device-label') {
            const deviceId =
              typeof body.deviceId === 'string' ? body.deviceId : ''
            const status = typeof body.status === 'string' ? body.status : ''
            const word = typeof body.word === 'string' ? body.word : ''
            const result = await fetchClawosJson('/api/iot/m5-devices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update-label',
                deviceId,
                status,
                word,
              }),
            })
            return json(result)
          }

          if (kind === 'activate-pool') {
            const poolId = typeof body.poolId === 'string' ? body.poolId : ''
            const result = await fetchClawosJson('/api/iot/m5-words', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'activate',
                poolId,
              }),
            })
            return json(result)
          }

          if (kind === 'rotate-words') {
            const result = await fetchClawosJson('/api/iot/m5-words', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'rotate' }),
            })
            return json(result)
          }

          if (kind === 'teams-sync') {
            const result = await fetchClawosJson('/api/iot/m5-words', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'teams-sync' }),
            })
            return json(result)
          }

          if (kind === 'teams-test') {
            const result = await fetchClawosJson('/api/iot/m5-words', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'teams-test' }),
            })
            return json(result)
          }

          if (kind === 'teams-status') {
            const result = await fetchClawosJson('/api/iot/m5-words', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'teams-status' }),
            })
            return json(result)
          }

          return json({ error: 'Unsupported operation' }, { status: 400 })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error ? error.message : 'Presence action failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
