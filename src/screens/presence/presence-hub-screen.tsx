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
    words: Array<string>
    active: boolean
  }>
  activeMeetingTitle?: string | null
  refreshedAt?: string
  error?: string
}

const PRESENCE_OPTIONS = [
  { value: 'Available', label: 'Avail' },
  { value: 'Busy', label: 'Busy' },
  { value: 'DoNotDisturb', label: 'DND' },
  { value: 'BeRightBack', label: 'BRB' },
  { value: 'Away', label: 'Away' },
  { value: 'Offline', label: 'Off' },
]

const PRESENCE_DEFAULT_MODE_KEY = 'hermes.presence.defaultMode'

type PresenceDefaultMode = 'graph' | 'manual' | 'device'

type PresenceCockpitAction =
  | 'refresh'
  | 'focus'
  | 'mismatches'
  | 'diagnostics'
  | 'copy'

type PresenceCockpitTone = 'good' | 'warning' | 'danger' | 'neutral'

type PresenceCockpitTile = {
  id: string
  label: string
  value: string
  detail: string
  tone: PresenceCockpitTone
  progress: number
  action: PresenceCockpitAction
}

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function cockpitToneClass(tone: PresenceCockpitTone) {
  if (tone === 'danger') {
    return 'border-red-300 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100'
  }
  if (tone === 'warning') {
    return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100'
  }
  if (tone === 'good') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100'
  }
  return 'border-primary-200 bg-primary-100/70 text-primary-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
}

function normalizePresence(value?: string) {
  const normalized = (value || '').toLowerCase().replace(/[^a-z]/g, '')
  if (
    normalized.includes('donotdisturb') ||
    normalized.includes('urgentinterruptionsonly')
  )
    return 'donotdisturb'
  if (normalized.includes('busy') || normalized.includes('inameeting'))
    return 'busy'
  if (normalized.includes('berightback') || normalized.includes('brb'))
    return 'berightback'
  if (normalized.includes('away')) return 'away'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('offline') || normalized.includes('unknown'))
    return 'offline'
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
  if (!value) return 'Sync unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sync unknown'
  return `Sync ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function buildVisiblePresenceSummary(data: PresenceData | null) {
  const availability =
    data?.presence?.displayName ||
    data?.presence?.availability ||
    data?.preview?.label ||
    'Unknown'
  const activity =
    data?.presence?.activity ||
    data?.syncDiagnostics?.teamsActivity ||
    data?.preview?.activity ||
    'No activity'
  const deviceWord =
    data?.syncDiagnostics?.deviceWord ||
    data?.syncDiagnostics?.expectedLabel ||
    data?.preview?.currentWord ||
    data?.preview?.word ||
    'none'
  const source =
    data?.syncDiagnostics?.presenceSource ||
    (data?.presence?.inferred ? 'fallback' : 'Graph')
  const trust =
    data?.presence?.authRequired || data?.presence?.error
      ? 'degraded'
      : data?.syncDiagnostics?.inSync
        ? 'in sync'
        : data?.syncDiagnostics?.driftReason === 'device_stale'
          ? 'device stale'
          : data?.syncDiagnostics?.driftReason
            ? 'drift detected'
            : 'checking'

  return {
    availability,
    activity,
    deviceWord,
    source,
    trust,
    freshness: formatFreshness(data?.refreshedAt),
  }
}

export function getPresenceSourceSeparation(data: PresenceData | null) {
  return {
    graph: data?.syncDiagnostics?.presenceSource || 'Graph',
    m5: data?.syncDiagnostics?.deviceName || 'M5',
    localDisplay:
      data?.preview?.currentWord ||
      data?.preview?.word ||
      'local display cache',
    workspaceCache: data?.refreshedAt || 'workspace cache unknown',
  }
}

export function getPresenceNextStep(data: PresenceData | null) {
  if (data?.presence?.authRequired) return 'Repair Graph auth.'
  const staleDevice = data?.devices?.find(
    (device) => (device.lastSeenMinutesAgo ?? 9999) > 5,
  )
  if (staleDevice) return `Restart sync: ${staleDevice.name}.`
  if (data?.syncDiagnostics?.driftReason) {
    return `Retry ${data.syncDiagnostics.driftReason.replace(/_/g, ' ')}.`
  }
  return 'Healthy.'
}

export function buildPresenceDiagnosticsExport(data: PresenceData | null) {
  return JSON.stringify(
    {
      presence: data?.presence ?? null,
      sources: getPresenceSourceSeparation(data),
      syncDiagnostics: data?.syncDiagnostics ?? null,
      devices: data?.devices ?? [],
      nextStep: getPresenceNextStep(data),
    },
    null,
    2,
  )
}

export function getPresenceUnavailableState(data: PresenceData | null) {
  if (data?.presence?.authRequired) return 'Graph auth required'
  if (!data?.devices?.length) return 'M5 unavailable'
  return 'available'
}

export function getPresencePrimaryAction(data: PresenceData | null) {
  if (data?.presence?.authRequired) {
    return {
      label: 'Auth',
      kind: 'teams-status',
      reason: 'Graph presence auth is unavailable.',
    }
  }
  if (
    data?.presence?.stale ||
    data?.syncDiagnostics?.driftReason ||
    (data?.devices || []).some(
      (device) => (device.lastSeenMinutesAgo ?? 9999) > 5,
    )
  ) {
    return {
      label: 'Sync',
      kind: 'teams-status',
      reason: getPresenceNextStep(data),
    }
  }
  return {
    label: 'Refresh',
    kind: 'refresh',
    reason: 'Current.',
  }
}

export function buildPresenceShareText(data: PresenceData | null) {
  const summary = buildVisiblePresenceSummary(data)
  return [
    `Tyler is ${summary.availability}`,
    summary.activity,
    `Display: ${summary.deviceWord}`,
    `Trust: ${summary.trust}`,
    summary.freshness,
  ].join(' · ')
}

export function buildPresenceCockpitTiles(
  data: PresenceData | null,
  counts?: {
    freshDeviceCount?: number
    staleDeviceCount?: number
    mismatchDeviceCount?: number
  },
): Array<PresenceCockpitTile> {
  const summary = buildVisiblePresenceSummary(data)
  const devices = data?.devices || []
  const totalDevices = devices.length
  const freshDeviceCount =
    counts?.freshDeviceCount ??
    devices.filter((device) => (device.lastSeenMinutesAgo ?? 9999) <= 5).length
  const staleDeviceCount =
    counts?.staleDeviceCount ??
    devices.filter((device) => (device.lastSeenMinutesAgo ?? 9999) > 5).length
  const mismatchDeviceCount = counts?.mismatchDeviceCount ?? 0
  const hasGraphIssue =
    Boolean(data?.presence?.authRequired) ||
    Boolean(data?.presence?.error) ||
    Boolean(data?.syncDiagnostics?.teamsError)
  const hasDrift =
    Boolean(data?.syncDiagnostics?.driftReason) ||
    data?.syncDiagnostics?.inSync === false
  const graphValue = data?.presence?.authRequired
    ? 'auth'
    : hasGraphIssue
      ? 'degraded'
      : 'healthy'
  const deviceFreshness = data?.syncDiagnostics?.deviceFreshness
  const deviceWord =
    summary.deviceWord === 'none' ? 'not set' : summary.deviceWord

  return [
    {
      id: 'availability',
      label: 'Availability',
      value: summary.availability,
      detail: summary.activity,
      tone:
        normalizePresence(summary.availability) === 'available'
          ? 'good'
          : normalizePresence(summary.availability) === 'offline'
            ? 'danger'
            : 'warning',
      progress:
        normalizePresence(summary.availability) === 'available' ? 100 : 62,
      action: 'copy',
    },
    {
      id: 'sync-trust',
      label: 'Sync trust',
      value: summary.trust,
      detail: getPresenceNextStep(data),
      tone: hasGraphIssue ? 'danger' : hasDrift ? 'warning' : 'good',
      progress: hasGraphIssue ? 18 : hasDrift ? 55 : 100,
      action: hasDrift || hasGraphIssue ? 'refresh' : 'copy',
    },
    {
      id: 'm5-devices',
      label: 'M5 devices',
      value: `${freshDeviceCount}/${totalDevices}`,
      detail:
        totalDevices > 0
          ? `${staleDeviceCount} stale · ${mismatchDeviceCount} mismatch`
          : 'No local display devices found',
      tone:
        totalDevices === 0
          ? 'danger'
          : staleDeviceCount > 0 || mismatchDeviceCount > 0
            ? 'warning'
            : 'good',
      progress:
        totalDevices > 0
          ? Math.round((freshDeviceCount / totalDevices) * 100)
          : 0,
      action:
        mismatchDeviceCount > 0
          ? 'mismatches'
          : staleDeviceCount > 0
            ? 'refresh'
            : 'diagnostics',
    },
    {
      id: 'graph-source',
      label: 'Graph source',
      value: graphValue,
      detail: data?.syncDiagnostics?.presenceSource || summary.source,
      tone: hasGraphIssue ? 'danger' : 'good',
      progress: hasGraphIssue ? 30 : 100,
      action: hasGraphIssue ? 'refresh' : 'diagnostics',
    },
    {
      id: 'display-word',
      label: 'Display word',
      value: deviceWord,
      detail:
        typeof deviceFreshness === 'number'
          ? `Seen ${deviceFreshness}m ago`
          : summary.freshness,
      tone:
        typeof deviceFreshness === 'number' && deviceFreshness > 5
          ? 'warning'
          : 'neutral',
      progress:
        typeof deviceFreshness === 'number'
          ? Math.max(8, Math.min(100, 100 - deviceFreshness * 8))
          : 50,
      action: 'focus',
    },
  ]
}

export function getPresenceRouteDiagnostics(
  data: PresenceData | null,
  error?: string | null,
) {
  return {
    teamsAuth: data?.presence?.authRequired
      ? 'auth required'
      : data?.presence?.error || data?.syncDiagnostics?.teamsError
        ? 'degraded'
        : 'ok',
    lastSync: data?.refreshedAt || 'unknown',
    sourceError:
      error ||
      data?.presence?.error ||
      data?.syncDiagnostics?.teamsError ||
      data?.error ||
      'none',
  }
}

export function normalizePresenceDefaultMode(
  value?: string | null,
): PresenceDefaultMode {
  return value === 'manual' || value === 'device' ? value : 'graph'
}

export function buildDndPresetPayload(minutes: number, now = new Date()) {
  const until = new Date(now.getTime() + minutes * 60_000)
  return {
    kind: 'set-presence',
    availability: 'DoNotDisturb',
    expiresAt: until.toISOString(),
  }
}

export function PresenceHubScreen() {
  const [data, setData] = useState<PresenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceFilter, setDeviceFilter] = useState<
    'all' | 'fresh' | 'stale' | 'mismatch'
  >('all')
  const [defaultMode, setDefaultMode] = useState<PresenceDefaultMode>(() => {
    if (typeof window === 'undefined') return 'graph'
    return normalizePresenceDefaultMode(
      window.localStorage.getItem(PRESENCE_DEFAULT_MODE_KEY),
    )
  })

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
      setError(
        err instanceof Error ? err.message : 'Failed to load presence hub',
      )
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

  useEffect(() => {
    window.localStorage.setItem(PRESENCE_DEFAULT_MODE_KEY, defaultMode)
  }, [defaultMode])

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
        } else if (
          expectedLabel &&
          device.currentWord &&
          expectedLabel !== device.currentWord
        ) {
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
      if (deviceFilter === 'mismatch' && sync?.state !== 'mismatch')
        return false
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

  const visibleSummary = useMemo(
    () => buildVisiblePresenceSummary(data),
    [data],
  )
  const sourceSeparation = useMemo(
    () => getPresenceSourceSeparation(data),
    [data],
  )
  const primaryAction = useMemo(() => getPresencePrimaryAction(data), [data])
  const staleDeviceCount = useMemo(
    () =>
      (data?.devices || []).filter(
        (device) => (device.lastSeenMinutesAgo ?? 9999) > 5,
      ).length,
    [data],
  )
  const mismatchDeviceCount = useMemo(
    () =>
      (data?.devices || []).filter(
        (device) => perDeviceSync.get(device.id)?.state === 'mismatch',
      ).length,
    [data?.devices, perDeviceSync],
  )
  const presenceCommandPosture = useMemo(() => {
    if (data?.presence?.authRequired) return 'Repair Graph auth'
    if (staleDeviceCount > 0) return `${staleDeviceCount} devices stale`
    if (mismatchDeviceCount > 0)
      return `${mismatchDeviceCount} display mismatches`
    if (data?.syncDiagnostics?.driftReason) {
      return `Resolve ${data.syncDiagnostics.driftReason.replace(/_/g, ' ')}`
    }
    return 'Presence routing ready'
  }, [
    data?.presence?.authRequired,
    data?.syncDiagnostics?.driftReason,
    mismatchDeviceCount,
    staleDeviceCount,
  ])
  const cockpitTiles = useMemo(
    () =>
      buildPresenceCockpitTiles(data, {
        freshDeviceCount,
        staleDeviceCount,
        mismatchDeviceCount,
      }),
    [data, freshDeviceCount, mismatchDeviceCount, staleDeviceCount],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, button, [contenteditable]')
      ) {
        return
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        void post({ kind: primaryAction.kind })
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void confirmAndPost('Set focus / do-not-disturb presence?', {
          kind: 'set-presence',
          availability: 'DoNotDisturb',
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [primaryAction.kind])

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

  async function confirmAndPost(
    message: string,
    body: Record<string, unknown>,
  ) {
    if (!window.confirm(message)) return
    await post(body)
  }

  async function copyPresenceStatus() {
    try {
      await navigator.clipboard.writeText(buildPresenceShareText(data))
    } catch {
      // Clipboard export is best-effort; status remains visible in the UI.
    }
  }

  function activatePresenceCockpit(action: PresenceCockpitAction) {
    if (action === 'refresh') {
      void load()
      return
    }
    if (action === 'focus') {
      void confirmAndPost('Set focus / do-not-disturb presence?', {
        kind: 'set-presence',
        availability: 'DoNotDisturb',
      })
      return
    }
    if (action === 'mismatches') {
      setDeviceFilter('mismatch')
      setDeviceSearch('')
      return
    }
    if (action === 'diagnostics') {
      void navigator.clipboard.writeText(buildPresenceDiagnosticsExport(data))
      return
    }
    void copyPresenceStatus()
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-1 pb-[calc(var(--tabbar-h,0px)+12px)] sm:gap-4 sm:px-2 sm:pb-6">
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
              Teams + M5 sync.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                primaryAction.kind === 'refresh'
                  ? void load()
                  : void post({ kind: primaryAction.kind })
              }
              disabled={loading || saving}
              title={primaryAction.reason}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {saving ? 'Syncing...' : primaryAction.label}
            </button>
            <button
              type="button"
              onClick={() => void copyPresenceStatus()}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Copy
            </button>
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
        <div className="mt-3 grid gap-2 md:mt-4 md:grid-cols-4">
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${statusTone(data?.presence?.availability)}`}
          >
            Status {data?.presence?.availability || 'unknown'}
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${syncTone(data?.syncDiagnostics?.inSync, data?.syncDiagnostics?.driftReason)}`}
          >
            M5 {freshDeviceCount}/{data?.devices?.length || 0}
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${data?.presence?.authRequired || data?.presence?.error ? syncTone(false, 'teams_unavailable') : syncTone(true)}`}
          >
            Graph{' '}
            {data?.presence?.authRequired
              ? 'auth required'
              : data?.presence?.error
                ? 'degraded'
                : 'healthy'}
          </span>
          <span className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {formatFreshness(data?.refreshedAt)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-primary-500 dark:text-neutral-400">
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Safe away · focus · available
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Graph {sourceSeparation.graph} · M5 {sourceSeparation.m5}
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Drift {data?.syncDiagnostics?.driftReason || 'none'}
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Mode {defaultMode}
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Devices {freshDeviceCount}/{data?.devices?.length || 0}
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Next {getPresenceNextStep(data)}
          </span>
        </div>
        <section
          aria-label="Presence cockpit"
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          {cockpitTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => activatePresenceCockpit(tile.action)}
              disabled={saving && tile.action === 'focus'}
              className={`group min-h-[9.5rem] rounded-2xl border p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60 ${cockpitToneClass(tile.tone)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70 [overflow-wrap:anywhere]">
                    {tile.label}
                  </p>
                  <p className="mt-2 break-words text-xl font-semibold leading-none tracking-normal [overflow-wrap:anywhere] sm:text-2xl">
                    {tile.value}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                  {tile.tone}
                </span>
              </div>
              <p className="mt-3 min-h-[2.5rem] text-sm leading-snug opacity-80">
                {tile.detail}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-current/10">
                <div
                  className="h-full rounded-full bg-current transition-[width]"
                  style={{
                    width: `${Math.min(100, Math.max(4, tile.progress))}%`,
                  }}
                />
              </div>
            </button>
          ))}
        </section>
        <section className="mt-4 rounded-2xl border border-primary-200 bg-primary-100/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-500">
                Presence command center
              </p>
              <h2 className="mt-1 text-sm font-semibold text-primary-900 dark:text-neutral-100">
                {presenceCommandPosture}
              </h2>
              <p className="mt-1 line-clamp-2 text-xs text-primary-500 dark:text-neutral-400">
                {visibleSummary.availability} · {visibleSummary.activity} ·
                display {visibleSummary.deviceWord}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ['Fresh', freshDeviceCount],
                ['Stale', staleDeviceCount],
                ['Mismatch', mismatchDeviceCount],
                ['Pools', data?.pools?.length || 0],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="min-w-[82px] rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-950/70"
                >
                  <span className="block text-[10px] uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-500">
                    {label}
                  </span>
                  <span className="mt-1 block text-lg font-semibold text-primary-900 dark:text-neutral-100">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() =>
                primaryAction.kind === 'refresh'
                  ? void load()
                  : void post({ kind: primaryAction.kind })
              }
              disabled={loading || saving}
              title={primaryAction.reason}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {primaryAction.label}
            </button>
            <button
              type="button"
              onClick={() =>
                void confirmAndPost('Set focus / do-not-disturb presence?', {
                  kind: 'set-presence',
                  availability: 'DoNotDisturb',
                })
              }
              disabled={saving}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Focus mode
            </button>
            <button
              type="button"
              onClick={() => {
                setDeviceFilter('mismatch')
                setDeviceSearch('')
              }}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Mismatches
            </button>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  buildPresenceDiagnosticsExport(data),
                )
              }
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Diagnostics
            </button>
          </div>
        </section>
        <div className="mt-4 rounded-2xl border border-primary-200 bg-primary-100/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/80">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Visible
          </div>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {visibleSummary.availability}
              </div>
              <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                {visibleSummary.activity}
              </div>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-3 lg:min-w-[520px]">
              <span
                className={`rounded-xl border px-3 py-2 ${statusTone(visibleSummary.availability)}`}
              >
                Teams {visibleSummary.availability}
              </span>
              <span className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                Display {visibleSummary.deviceWord}
              </span>
              <span
                className={`rounded-xl border px-3 py-2 ${syncTone(visibleSummary.trust === 'in sync', visibleSummary.trust.replace(/ /g, '_'))}`}
              >
                Trust {visibleSummary.trust}
              </span>
            </div>
          </div>
          <div className="mt-3 text-xs text-primary-500 dark:text-neutral-400">
            Source {visibleSummary.source} · {visibleSummary.freshness}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Controls unavailable</div>
          <div className="mt-1">{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-red-300 bg-red-100/60 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}
      {data?.presence?.authRequired || data?.presence?.error ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold">Teams degraded</div>
          <div className="mt-1">
            {data?.presence?.error ||
              'Fallback/cache shown until Graph access returns.'}
          </div>
        </div>
      ) : null}

      <section className={`${shellClassName()} md:hidden`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Glance
            </div>
            <div className="mt-2 text-xl font-semibold text-primary-900 dark:text-neutral-100">
              {visibleSummary.availability}
            </div>
            <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              {data?.activeMeetingTitle || visibleSummary.activity}
            </div>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${statusTone(visibleSummary.availability)}`}
          >
            {visibleSummary.trust}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() =>
              primaryAction.kind === 'refresh'
                ? void load()
                : void post({ kind: primaryAction.kind })
            }
            disabled={loading || saving}
            className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {primaryAction.label}
          </button>
          <button
            type="button"
            onClick={() => void copyPresenceStatus()}
            className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Copy
          </button>
        </div>
      </section>

      <div className="hidden gap-4 md:grid md:grid-cols-3">
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Devices
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.devices?.length || 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            M5
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Fresh
          </div>
          <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
            {freshDeviceCount}/{data?.devices?.length || 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {'Seen <5m'}
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Drift
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
                ? `Refresh ${new Date(data.refreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Awaiting refresh'}
          </div>
        </section>
      </div>

      <div className="hidden gap-4 md:grid xl:grid-cols-[1.1fr_0.95fr_0.95fr]">
        <section className={shellClassName()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Teams
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: data?.presence?.color || '#6b7280',
                  }}
                />
                <div>
                  <div className="text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {data?.presence?.displayName ||
                      data?.presence?.availability ||
                      'Unknown'}
                  </div>
                  <div className="text-sm text-primary-600 dark:text-neutral-400">
                    {data?.presence?.activity || 'No activity'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full border px-2 py-1 ${statusTone(data?.presence?.availability)}`}
                >
                  {data?.presence?.inferred ? 'Inferred' : 'Graph'}
                </span>
                {data?.presence?.stale ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    Stale
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-primary-500 dark:text-neutral-400">
                {data?.activeMeetingTitle
                  ? `Meeting: ${data.activeMeetingTitle}`
                  : 'No meeting'}
              </div>
            </div>
            <div className="flex max-w-full flex-wrap justify-end gap-2">
              {PRESENCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void confirmAndPost(
                      `Apply Teams presence override: ${option.value}?`,
                      {
                        kind: 'set-presence',
                        availability: option.value,
                      },
                    )
                  }
                  className="min-w-[96px] rounded-lg border border-primary-200 bg-primary-100/70 px-2 py-1.5 text-xs text-primary-800 transition-colors hover:bg-primary-200/80 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Sync
          </h2>
          <div className="mt-3 grid gap-3">
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Teams
              </div>
              <div className="mt-1 text-sm font-medium text-primary-900 dark:text-neutral-100">
                {data?.syncDiagnostics?.teamsAvailability ||
                  data?.presence?.availability ||
                  'Unknown'}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {data?.syncDiagnostics?.teamsActivity ||
                  data?.presence?.activity ||
                  'No activity'}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span
                  className={`rounded-full border px-2 py-1 ${statusTone(data?.syncDiagnostics?.teamsAvailability || data?.presence?.availability)}`}
                >
                  {data?.syncDiagnostics?.presenceSource || 'unknown source'}
                </span>
                {data?.presence?.authRequired ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    auth
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
                Status {data?.syncDiagnostics?.deviceStatus || 'unknown'} · word{' '}
                {data?.syncDiagnostics?.deviceWord || 'none'}
              </div>
              <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                Seen {data?.syncDiagnostics?.deviceFreshness ?? '?'}m ago
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Sync
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] ${syncTone(data?.syncDiagnostics?.inSync, data?.syncDiagnostics?.driftReason)}`}
                >
                  {data?.syncDiagnostics?.inSync ? 'Synced' : 'Drift'}
                </span>
                <span className="text-xs text-primary-600 dark:text-neutral-400">
                  {data?.syncDiagnostics?.driftReason?.replace(/_/g, ' ') ||
                    'no reason'}
                </span>
              </div>
              <div className="mt-2 text-xs text-primary-500 dark:text-neutral-400">
                Expected{' '}
                {data?.syncDiagnostics?.expectedLabel ||
                  data?.preview?.currentWord ||
                  data?.preview?.teamsStatus ||
                  'unknown'}
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
              Preview
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            Preview{' '}
            {data?.preview?.currentWord ||
              data?.preview?.teamsStatus ||
              data?.preview?.availability ||
              'unknown'}
            {data?.preview?.activity ? ` · ${data.preview.activity}` : ''}
          </div>
        </section>

        <section className="rounded-2xl border border-primary-200/70 bg-primary-50/55 p-4 backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-950/70">
          <details>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Manual
                  </h2>
                  <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                    Use only for real mismatch.
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
                    void confirmAndPost(
                      'Apply current Teams status to presence devices now?',
                      {
                        kind: 'teams-sync',
                      },
                    )
                  }
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Sync now
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void confirmAndPost(
                      'Rotate the active presence word pool now?',
                      {
                        kind: 'rotate-words',
                      },
                    )
                  }
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Rotate
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => post({ kind: 'teams-status' })}
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Preview
                </button>
              </div>
              <div className="mt-3 grid gap-2 rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                  Default mode
                  <select
                    value={defaultMode}
                    onChange={(event) =>
                      setDefaultMode(
                        normalizePresenceDefaultMode(event.currentTarget.value),
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm normal-case tracking-normal text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  >
                    <option value="graph">Graph</option>
                    <option value="manual">Manual</option>
                    <option value="device">Device</option>
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 120].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void confirmAndPost(
                          `Set do-not-disturb for ${minutes} minutes?`,
                          buildDndPresetPayload(minutes),
                        )
                      }
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    >
                      DND {minutes}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data?.pools?.map((pool) => (
                  <button
                    key={pool.id}
                    type="button"
                    disabled={saving || pool.active}
                    onClick={() =>
                      void confirmAndPost(
                        `Activate presence word pool "${pool.name}"?`,
                        {
                          kind: 'activate-pool',
                          poolId: pool.id,
                        },
                      )
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

      <section className={`${shellClassName()} hidden md:block`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              M5
            </h2>
            <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              Per-device sync + safe controls.
            </p>
          </div>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
            {loading
              ? 'Loading...'
              : `${visibleDevices.length}/${data?.devices?.length || 0} device(s)`}
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
                setDeviceFilter(
                  event.currentTarget.value as typeof deviceFilter,
                )
              }
              className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="all">All</option>
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
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(device.teamsStatus || device.status)}`}
                        >
                          {device.teamsStatus || device.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                        Word {device.currentWord || 'none'}
                      </div>
                      <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                        Seen {device.lastSeenMinutesAgo ?? '?'}m ago
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span
                          className={`rounded-full border px-2 py-1 ${statusTone(
                            (device.lastSeenMinutesAgo ?? 9999) <= 5
                              ? 'available'
                              : 'away',
                          )}`}
                        >
                          {(device.lastSeenMinutesAgo ?? 9999) <= 5
                            ? 'Fresh'
                            : 'Stale'}
                        </span>
                        {sync ? (
                          <span
                            className={`rounded-full border px-2 py-1 ${syncTone(sync.state === 'in-sync', sync.state === 'stale' ? 'device_stale' : sync.reason.replace(/ /g, '_'))}`}
                          >
                            {sync.state === 'in-sync'
                              ? 'In sync'
                              : sync.state === 'stale'
                                ? 'Refresh'
                                : 'Mismatch'}
                          </span>
                        ) : null}
                        {device.wordMode ? (
                          <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                            Mode {device.wordMode}
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
                          Exp {sync.expectedPresence || 'unknown'}
                          {sync.expectedLabel
                            ? ` · label ${sync.expectedLabel}`
                            : ''}{' '}
                          · {sync.reason}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(device.id)}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        ID
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
                        {expandedDeviceId === device.id ? 'Hide' : 'Manual'}
                      </button>
                      <div className="text-xs text-primary-500 dark:text-neutral-400">
                        Manual overrides are secondary.
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
              <div className="font-medium text-primary-700 dark:text-neutral-200">
                No M5 devices.
              </div>
              <div className="mt-1">Teams presence remains readable.</div>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Recheck
              </button>
            </div>
          ) : null}
          {!loading &&
          (data?.devices?.length || 0) > 0 &&
          visibleDevices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 px-4 py-8 text-center text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              <div className="font-medium text-primary-700 dark:text-neutral-200">
                No devices match.
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeviceFilter('all')
                  setDeviceSearch('')
                }}
                className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs font-medium text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
