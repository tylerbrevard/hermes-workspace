export type FreshnessValue = string | number | null | undefined
export type WorkspaceStatusTone = 'ok' | 'info' | 'warn' | 'error'
export type WorkspaceStatusSurface = 'dark' | 'light'

export type WorkspaceFreshnessOptions = {
  emptyLabel?: string
  invalidLabel?: string
  nowMs?: number
}

export function freshnessTimestampMs(value: FreshnessValue): number | null {
  if (!value) return null
  const ms = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function formatWorkspaceFreshness(
  value: FreshnessValue,
  options: WorkspaceFreshnessOptions = {},
): string {
  const {
    emptyLabel = 'never',
    invalidLabel = 'unknown',
    nowMs = Date.now(),
  } = options
  const ms = freshnessTimestampMs(value)
  if (ms === null) return value ? invalidLabel : emptyLabel

  const diff = Math.max(0, nowMs - ms)
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function isWorkspaceSourceStale(
  value: FreshnessValue,
  thresholdMs = 120_000,
  nowMs = Date.now(),
): boolean {
  const ms = freshnessTimestampMs(value)
  if (ms === null) return true
  return nowMs - ms > thresholdMs
}

export function workspaceFreshnessTone(
  value: FreshnessValue,
  thresholdMs = 120_000,
  nowMs = Date.now(),
): WorkspaceStatusTone {
  return isWorkspaceSourceStale(value, thresholdMs, nowMs) ? 'warn' : 'ok'
}

export function normalizeWorkspaceStatusTone(
  value:
    | WorkspaceStatusTone
    | 'healthy'
    | 'live'
    | 'partial'
    | 'warning'
    | 'critical'
    | 'high'
    | 'medium'
    | 'bad'
    | 'fail'
    | 'failed'
    | 'degraded'
    | 'stale'
    | undefined
    | null,
): WorkspaceStatusTone {
  if (value === 'ok' || value === 'healthy' || value === 'live') return 'ok'
  if (value === 'warn' || value === 'warning' || value === 'partial') {
    return 'warn'
  }
  if (
    value === 'error' ||
    value === 'critical' ||
    value === 'bad' ||
    value === 'fail' ||
    value === 'failed'
  ) {
    return 'error'
  }
  if (
    value === 'high' ||
    value === 'medium' ||
    value === 'degraded' ||
    value === 'stale'
  ) {
    return 'warn'
  }
  return 'info'
}

export function workspaceStatusToneRank(value: WorkspaceStatusTone): number {
  const rank: Record<WorkspaceStatusTone, number> = {
    error: 0,
    warn: 1,
    info: 2,
    ok: 3,
  }
  return rank[value]
}

export function workspaceStatusClass(
  value: WorkspaceStatusTone,
  surface: WorkspaceStatusSurface = 'light',
): string {
  if (surface === 'dark') {
    const darkClasses: Record<WorkspaceStatusTone, string> = {
      ok: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
      warn: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
      error: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
      info: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    }
    return darkClasses[value]
  }

  const lightClasses: Record<WorkspaceStatusTone, string> = {
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200',
    warn: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200',
    error:
      'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200',
    info: 'border-primary-200 bg-primary-100 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  }
  return lightClasses[value]
}
