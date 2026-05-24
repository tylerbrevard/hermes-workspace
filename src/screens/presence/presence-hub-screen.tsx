import { startTransition, useEffect, useMemo, useState } from 'react'

type TeamsPreview = {
  status?: string
  activity?: string
  availability?: string
  teamsStatus?: string
  label?: string
  word?: string
  currentWord?: string
}

type PresenceData = {
  presence?: {
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
  preview?: TeamsPreview
  syncDiagnostics?: {
    teamsAvailability?: string
    teamsActivity?: string
    presenceSource?: string
    teamsError?: string | null
    deviceName?: string | null
    deviceStatus?: string
    deviceWord?: string
    deviceFreshness?: number | null
    expectedLabel?: string | null
    inSync?: boolean
    driftReason?: string
  }
  devices: Array<{
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
  }>
  pools: Array<{
    id: string
    name: string
    words: string[]
    active: boolean
  }>
  activeMeetingTitle?: string | null
  refreshedAt?: string
  error?: string
}

const PRESENCE_OPTIONS = [
  'Available',
  'Busy',
  'DoNotDisturb',
  'BeRightBack',
  'Away',
  'Offline',
]

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function normalizePresence(value?: string) {
  const normalized = (value || '').toLowerCase().replace(/[^a-z]/g, '')
  if (normalized.includes('donotdisturb') || normalized.includes('urgentinterruptionsonly')) return 'donotdisturb'
  if (normalized.includes('busy') || normalized.includes('inameeting')) return 'busy'
  if (normalized.includes('berightback') || normalized.includes('brb')) return 'berightback'
  if (normalized.includes('away')) return 'away'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('offline') || normalized.includes('unknown')) return 'offline'
  return normalized || 'unknown'
}

function statusTone(status?: string) {
  const normalized = normalizePresence(status)
  if (normalized.includes('busy') || normalized.includes('donotdisturb')) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
  }
  if (normalized.includes('away') || normalized.includes('berightback')) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
  }
  if (normalized.includes('available')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  return 'border-primary-200 bg-primary-100/70 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
}

function syncTone(inSync?: boolean, driftReason?: string) {
  if (inSync) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  if (driftReason === 'device_stale' || driftReason === 'teams_unavailable') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
  }
  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
}

function formatFreshness(value?: string | null) {
  if (!value) return 'Last sync unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Last sync unknown'
  return `Last sync ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

export function PresenceHubScreen() {
  const [data, setData] = useState<PresenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'fresh' | 'stale' | 'mismatch'>('all')

  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/ops/presence')
      const payload = (await response.json()) as PresenceData
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load presence hub')
      }
      startTransition(() => {
        setData(payload)
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presence hub')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(() => {
      void load()
    }, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const activePool = useMemo(
    () => data?.pools?.find((pool) => pool.active) || null,
    [data],
  )

  const freshDeviceCount = useMemo(
    () =>
      (data?.devices || []).filter(
        (device) => (device.lastSeenMinutesAgo ?? 9999) <= 5,
      ).length,
    [data],
  )

  const perDeviceSync = useMemo(() => {
    const expectedPresence = normalizePresence(
      data?.preview?.teamsStatus ||
        data?.preview?.availability ||
        data?.presence?.availability,
    )
    return new Map(
      (data?.devices || []).map((device) => {
        const freshness = device.lastSeenMinutesAgo ?? 9999
        const deviceStatus = normalizePresence(
          device.teamsStatus || device.status || device.currentWord,
        )
        const expectedLabel =
          device.config?.labels?.[expectedPresence] ||
          device.config?.labels?.[data?.presence?.availability || ''] ||
          null
        let state: 'in-sync' | 'mismatch' | 'stale' = 'in-sync'
        let reason = 'in sync'
        if (freshness > 5) {
          state = 'stale'
          reason = 'device stale'
        } else if (deviceStatus !== expectedPresence) {
          state = 'mismatch'
          reason = 'status mismatch'
        } else if (expectedLabel && device.currentWord && expectedLabel !== device.currentWord) {
          state = 'mismatch'
          reason = 'label mismatch'
        }
        return [
          device.id,
          {
            state,
            reason,
            expectedPresence,
            expectedLabel,
          },
        ] as const
      }),
    )
  }, [data])

  const visibleDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase()
    return (data?.devices || []).filter((device) => {
      const sync = perDeviceSync.get(device.id)
      const isFresh = (device.lastSeenMinutesAgo ?? 9999) <= 5
      if (deviceFilter === 'fresh' && !isFresh) return false
      if (deviceFilter === 'stale' && isFresh) return false
      if (deviceFilter === 'mismatch' && sync?.state !== 'mismatch') return false
      if (!q) return true
      return [
        device.name,
        device.id,
        device.type,
        device.status,
        device.teamsStatus,
        device.currentWord,
        device.wordMode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [data?.devices, deviceFilter, deviceSearch, perDeviceSync])

  async function post(body: Record<string, unknown>) {
    setSaving(true)
    try {
      const response = await fetch('/api/ops/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Action failed')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmAndPost(message: string, body: Record<string, unknown>) {
    if (!window.confirm(message)) return
    await post(body)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 sm:px-2">
      <div className={shellClassName()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Presence
            </div>
            <h1 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
              Presence
            </h1>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Teams state and M5 display sync, with only the non-destructive control path exposed here.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading || saving}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <span className={`rounded-xl border px-3 py-2 text-xs ${statusTone(data?.presence?.availability)}`}>
            Presence {data?.presence?.availability || 'unknown'}
          </span>
          <span className={`rounded-xl border px-3 py-2 text-xs ${syncTone(data?.syncDiagnostics?.inSync, data?.syncDiagnostics?.driftReason)}`}>
            Devices {freshDeviceCount}/{data?.devices?.length || 0} fresh
          </span>
          <span className={`rounded-xl border px-3 py-2 text-xs ${data?.presence?.authRequired || data?.presence?.error ? syncTone(false, 'teams_unavailable') : syncTone(true)}`}>
            Graph {data?.presence?.authRequired ? 'auth required' : data?.presence?.error ? 'degraded' : 'healthy'}
          </span>
          <span className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {formatFreshness(data?.refreshedAt)}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Presence controls are unavailable</div>
          <div className="mt-1">{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-red-300 bg-red-100/60 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          >
            Retry presence load
          </button>
        </div>
      ) : null}
      {data?.presence?.authRequired || data?.presence?.error ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold">Teams presence is degraded</div>
          <div className="mt-1">
            {data?.presence?.error ||
              'Workspace is showing fallback or cached Teams state until Graph presence access is restored.'}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Device count
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.devices?.length || 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Registered M5 displays in the non-destructive control path
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Device freshness
          </div>
          <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
            {freshDeviceCount}/{data?.devices?.length || 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Devices seen within the last five minutes
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Sync drift
          </div>
          <div className="mt-2 text-base font-semibold text-primary-900 dark:text-neutral-100">
            {data?.syncDiagnostics?.inSync
              ? 'In sync'
              : data?.syncDiagnostics?.driftReason === 'device_stale'
                ? 'Device stale'
                : data?.syncDiagnostics?.driftReason === 'teams_unavailable'
                  ? 'Teams degraded'
                  : 'Drift detected'}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {data?.syncDiagnostics?.driftReason
              ? `Reason: ${data.syncDiagnostics.driftReason.replace(/_/g, ' ')}`
              : data?.refreshedAt
                ? `Last refresh ${new Date(data.refreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Awaiting first refresh'}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr_0.95fr]">
        <section className={shellClassName()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Teams status
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: data?.presence?.color || '#6b7280' }}
                />
                <div>
                  <div className="text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {data?.presence?.displayName || data?.presence?.availability || 'Unknown'}
                  </div>
                  <div className="text-sm text-primary-600 dark:text-neutral-400">
                    {data?.presence?.activity || 'No activity reported'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full border px-2 py-1 ${statusTone(data?.presence?.availability)}`}>
                  {data?.presence?.inferred ? 'Inferred presence' : 'Graph-backed presence'}
                </span>
                {data?.presence?.stale ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    Stale fallback
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-primary-500 dark:text-neutral-400">
                {data?.activeMeetingTitle
                  ? `Active meeting detected: ${data.activeMeetingTitle}`
                  : 'No active meeting detected right now'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESENCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void confirmAndPost(`Apply Teams presence override: ${option}?`, {
                      kind: 'set-presence',
                      availability: option,
                    })
                  }
                  className="rounded-lg border border-primary-200 bg-primary-100/70 px-2 py-1.5 text-xs text-primary-800 transition-colors hover:bg-primary-200/80 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Sync diagnostics
          </h2>
          <div className="mt-3 grid gap-3">
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Teams
              </div>
              <div className="mt-1 text-sm font-medium text-primary-900 dark:text-neutral-100">
                {data?.syncDiagnostics?.teamsAvailability || data?.presence?.availability || 'Unknown'}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {data?.syncDiagnostics?.teamsActivity || data?.presence?.activity || 'No activity reported'}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className={`rounded-full border px-2 py-1 ${statusTone(data?.syncDiagnostics?.teamsAvailability || data?.presence?.availability)}`}>
                  {data?.syncDiagnostics?.presenceSource || 'unknown source'}
                </span>
                {data?.presence?.authRequired ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    auth required
                  </span>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                M5
              </div>
              <div className="mt-1 text-sm font-medium text-primary-900 dark:text-neutral-100">
                {data?.syncDiagnostics?.deviceName || 'No device'}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                Status {data?.syncDiagnostics?.deviceStatus || 'unknown'} · word {data?.syncDiagnostics?.deviceWord || 'none'}
              </div>
              <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                Last seen {data?.syncDiagnostics?.deviceFreshness ?? '?'} minute(s) ago
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Sync
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-1 text-[11px] ${syncTone(data?.syncDiagnostics?.inSync, data?.syncDiagnostics?.driftReason)}`}>
                  {data?.syncDiagnostics?.inSync ? 'In sync' : 'Drift detected'}
                </span>
                <span className="text-xs text-primary-600 dark:text-neutral-400">
                  {data?.syncDiagnostics?.driftReason?.replace(/_/g, ' ') || 'no drift reason'}
                </span>
              </div>
              <div className="mt-2 text-xs text-primary-500 dark:text-neutral-400">
                Expected label {data?.syncDiagnostics?.expectedLabel || data?.preview?.currentWord || data?.preview?.teamsStatus || 'unknown'}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => post({ kind: 'teams-status' })}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Preview sync status
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            Preview result: {data?.preview?.currentWord || data?.preview?.teamsStatus || data?.preview?.availability || 'unknown'}
            {data?.preview?.activity ? ` · ${data.preview.activity}` : ''}
          </div>
        </section>

        <section className="rounded-2xl border border-primary-200/70 bg-primary-50/55 p-4 backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-950/70">
          <details>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Manual sync actions
                  </h2>
                  <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                    Secondary tools for when diagnostics show a real mismatch.
                  </div>
                </div>
                <div className="text-xs text-primary-500 dark:text-neutral-400">
                  {activePool?.name || 'No active pool'}
                </div>
              </div>
            </summary>
            <div className="mt-4 border-t border-primary-200/70 pt-4 dark:border-neutral-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void confirmAndPost('Apply current Teams status to presence devices now?', {
                      kind: 'teams-sync',
                    })
                  }
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Teams sync now
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void confirmAndPost('Rotate the active presence word pool now?', {
                      kind: 'rotate-words',
                    })
                  }
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Rotate word
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => post({ kind: 'teams-status' })}
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Refresh preview
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data?.pools?.map((pool) => (
                  <button
                    key={pool.id}
                    type="button"
                    disabled={saving || pool.active}
                    onClick={() =>
                      void confirmAndPost(`Activate presence word pool "${pool.name}"?`, {
                        kind: 'activate-pool',
                        poolId: pool.id,
                      })
                    }
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      pool.active
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'border border-primary-200 bg-primary-100/70 text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                    }`}
                  >
                    {pool.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-xs text-primary-500 dark:text-neutral-400">
                {activePool?.words?.join(' · ') || 'No words configured'}
              </div>
            </div>
          </details>
        </section>
      </div>

      <section className={shellClassName()}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              M5 devices
            </h2>
            <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              Per-device sync state plus non-destructive controls for brightness, fetch interval, and displayed label.
            </p>
          </div>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
            {loading ? 'Loading…' : `${visibleDevices.length}/${data?.devices?.length || 0} device(s)`}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              aria-label="Search M5 devices"
              value={deviceSearch}
              onChange={(event) => setDeviceSearch(event.currentTarget.value)}
              placeholder="Search devices"
              className="min-w-0 flex-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 sm:min-w-52 sm:flex-none"
            />
            <select
              aria-label="Filter M5 devices"
              value={deviceFilter}
              onChange={(event) =>
                setDeviceFilter(event.currentTarget.value as typeof deviceFilter)
              }
              className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="all">All devices</option>
              <option value="fresh">Fresh</option>
              <option value="stale">Stale</option>
              <option value="mismatch">Mismatched</option>
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {visibleDevices.map((device) => (
            <div
              key={device.id}
              data-testid="presence-device"
              className="rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              {(() => {
                const sync = perDeviceSync.get(device.id)
                return (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                      {device.name}
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(device.teamsStatus || device.status)}`}>
                      {device.teamsStatus || device.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                    Current word: {device.currentWord || 'none'}
                  </div>
                  <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                    Last seen {device.lastSeenMinutesAgo ?? '?'} minute(s) ago
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span
                      className={`rounded-full border px-2 py-1 ${statusTone(
                        (device.lastSeenMinutesAgo ?? 9999) <= 5 ? 'available' : 'away',
                      )}`}
                    >
                      {(device.lastSeenMinutesAgo ?? 9999) <= 5 ? 'Fresh' : 'Stale'}
                    </span>
                    {sync ? (
                      <span className={`rounded-full border px-2 py-1 ${syncTone(sync.state === 'in-sync', sync.state === 'stale' ? 'device_stale' : sync.reason.replace(/ /g, '_'))}`}>
                        {sync.state === 'in-sync'
                          ? 'In sync'
                          : sync.state === 'stale'
                            ? 'Needs refresh'
                            : 'Mismatch'}
                      </span>
                    ) : null}
                    {device.wordMode ? (
                      <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                        Mode: {device.wordMode}
                      </span>
                    ) : null}
                    {device.type ? (
                      <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                        {device.type}
                      </span>
                    ) : null}
                  </div>
                  {sync ? (
                    <div className="mt-2 text-xs text-primary-500 dark:text-neutral-400">
                      Expected {sync.expectedPresence || 'unknown'}{sync.expectedLabel ? ` · label ${sync.expectedLabel}` : ''} · {sync.reason}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(device.id)}
                    className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    Copy device id
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDeviceId((current) =>
                        current === device.id ? null : device.id,
                      )
                    }
                    className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    {expandedDeviceId === device.id ? 'Hide manual settings' : 'Show manual settings'}
                  </button>
                  <div className="text-xs text-primary-500 dark:text-neutral-400">
                    Manual overrides are secondary to the sync diagnostics above.
                  </div>
                </div>
              </div>
                )
              })()}
              {expandedDeviceId === device.id ? (
                <div className="mt-3 grid gap-2 rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-3">
                  <label className="text-xs text-primary-600 dark:text-neutral-400">
                    Brightness
                    <input
                      type="number"
                      min={1}
                      max={255}
                      defaultValue={device.config?.brightness ?? 128}
                      className="mt-1 w-full rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      onBlur={(event) =>
                        post({
                          kind: 'update-device-config',
                          deviceId: device.id,
                          brightness: Number(event.currentTarget.value),
                          fetchInterval: device.config?.fetchInterval ?? 30,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-primary-600 dark:text-neutral-400">
                    Fetch interval
                    <input
                      type="number"
                      min={5}
                      max={300}
                      defaultValue={device.config?.fetchInterval ?? 30}
                      className="mt-1 w-full rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      onBlur={(event) =>
                        post({
                          kind: 'update-device-config',
                          deviceId: device.id,
                          brightness: device.config?.brightness ?? 128,
                          fetchInterval: Number(event.currentTarget.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-primary-600 dark:text-neutral-400">
                    Manual label
                    <input
                      type="text"
                      defaultValue={device.currentWord || ''}
                      className="mt-1 w-full rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      onBlur={(event) =>
                        post({
                          kind: 'update-device-label',
                          deviceId: device.id,
                          status: device.teamsStatus || device.status,
                          word: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
              {device.config?.labels ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(device.config.labels).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-[10px] text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                    >
                      {key}: {value}
                    </span>
                  ))}
                </div>
              ) : null}
              {device.sensors || device.config?.tunnelUrl ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {typeof device.sensors?.temp === 'number' ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      Temp: {device.sensors.temp} C
                    </div>
                  ) : null}
                  {typeof device.sensors?.battery === 'number' ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      Battery: {device.sensors.battery}%
                    </div>
                  ) : null}
                  {typeof device.sensors?.rssi === 'number' ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      RSSI: {device.sensors.rssi}
                    </div>
                  ) : null}
                  {typeof device.sensors?.uptime === 'number' ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      Uptime: {Math.round(device.sensors.uptime / 60)}m
                    </div>
                  ) : null}
                  {device.config?.tunnelUrl ? (
                    <a
                      href={device.config.tunnelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                    >
                      Device tunnel
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {!loading && (data?.devices?.length || 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 px-4 py-8 text-center text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              <div className="font-medium text-primary-700 dark:text-neutral-200">No M5 devices are registered right now.</div>
              <div className="mt-1">Presence is still readable from Teams, but display sync has no target device.</div>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Recheck devices
              </button>
            </div>
          ) : null}
          {!loading && (data?.devices?.length || 0) > 0 && visibleDevices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 px-4 py-8 text-center text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              <div className="font-medium text-primary-700 dark:text-neutral-200">No devices match this view.</div>
              <button
                type="button"
                onClick={() => {
                  setDeviceFilter('all')
                  setDeviceSearch('')
                }}
                className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs font-medium text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              >
                Clear device filters
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
