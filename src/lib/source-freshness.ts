export type FreshnessValue = string | number | null | undefined

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
