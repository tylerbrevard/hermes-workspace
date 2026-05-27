import { useQuery } from '@tanstack/react-query'
import { apiPath } from '@/lib/base-path'
import { cn } from '@/lib/utils'

type HealthSeverity = 'ok' | 'warn' | 'fail'

type HealthProbe = {
  id: string
  label: string
  endpoint: string
  group: string
  required?: boolean
}

export type HealthProbeResult = HealthProbe & {
  severity: HealthSeverity
  status: number | null
  latencyMs: number
  evidence: string
}

export const WORKSPACE_HEALTH_PROBES: Array<HealthProbe> = [
  { id: 'auth', label: 'Auth session', endpoint: '/api/auth-check', group: 'Core', required: true },
  { id: 'ping', label: 'Hermes gateway ping', endpoint: '/api/ping', group: 'Core', required: true },
  { id: 'gateway', label: 'Gateway capabilities', endpoint: '/api/gateway-status', group: 'Core', required: true },
  { id: 'overview', label: 'Dashboard overview', endpoint: '/api/dashboard/overview?days=7&achievements=1', group: 'Workspace', required: true },
  { id: 'phone', label: 'Phone cockpit', endpoint: '/api/phone-cockpit', group: 'Daily flow' },
  { id: 'lily', label: 'LILY readiness', endpoint: '/api/lily/config', group: 'Daily flow' },
  { id: 'presence', label: 'Presence', endpoint: '/api/ops/presence', group: 'Ops' },
  { id: 'it-ops', label: 'ConnectWise / IT ops', endpoint: '/api/ops/it-ops', group: 'Ops' },
  { id: 'swarm', label: 'Swarm health', endpoint: '/api/swarm-health', group: 'Agents' },
  { id: 'tasks', label: 'Task ledger', endpoint: '/api/hermes-tasks', group: 'Workspace' },
]

function summarizePayload(probe: HealthProbe, status: number, payload: unknown): string {
  if (status >= 400) {
    if (payload && typeof payload === 'object' && 'error' in payload) {
      return String((payload as { error?: unknown }).error || `HTTP ${status}`)
    }
    return `HTTP ${status}`
  }
  if (!payload || typeof payload !== 'object') return 'Endpoint responded.'
  const data = payload as Record<string, unknown>
  if (probe.id === 'auth') {
    return data.authenticated ? 'Authenticated workspace session.' : 'Workspace auth not confirmed.'
  }
  if (probe.id === 'gateway') {
    const gateway = data.gateway as Record<string, unknown> | undefined
    return gateway?.available ? 'Gateway reports available capabilities.' : 'Gateway capabilities are degraded.'
  }
  if (probe.id === 'overview') {
    const statusData = data.status as Record<string, unknown> | undefined
    return `Overview heartbeat ${statusData?.updatedAt || 'unknown'}.`
  }
  if (probe.id === 'phone') {
    const attention = Array.isArray(data.attention) ? data.attention.length : 0
    return `Phone cockpit returned ${attention} attention items.`
  }
  if (probe.id === 'lily') {
    const worker = data.voiceWorker as Record<string, unknown> | undefined
    return `LILY worker ${worker?.status || 'unknown'}.`
  }
  if (probe.id === 'swarm') {
    const summary = data.summary as Record<string, unknown> | undefined
    return `Swarm auth errors ${summary?.totalAuthErrors24h ?? 0}.`
  }
  if (probe.id === 'tasks') {
    const tasks = Array.isArray(data.tasks) ? data.tasks.length : 0
    return `Task ledger returned ${tasks} tasks.`
  }
  return 'Endpoint responded with JSON evidence.'
}

function severityFor(probe: HealthProbe, status: number, payload: unknown): HealthSeverity {
  if (status >= 500) return probe.required ? 'fail' : 'warn'
  if (status >= 400) return 'warn'
  if (!payload || typeof payload !== 'object') return 'ok'
  const data = payload as Record<string, unknown>
  if (probe.id === 'auth' && data.authRequired && !data.authenticated) return 'fail'
  if (probe.id === 'gateway') {
    const gateway = data.gateway as Record<string, unknown> | undefined
    if (!gateway?.available) return 'fail'
  }
  if (probe.id === 'lily') {
    const worker = data.voiceWorker as Record<string, unknown> | undefined
    if (worker?.status && worker.status !== 'online') return 'warn'
  }
  return 'ok'
}

export function summarizeWorkspaceHealth(results: Array<HealthProbeResult>) {
  const failed = results.filter((result) => result.severity === 'fail').length
  const warnings = results.filter((result) => result.severity === 'warn').length
  return {
    severity: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'ok',
    label:
      failed > 0
        ? `${failed} critical check${failed === 1 ? '' : 's'} failing`
        : warnings > 0
          ? `${warnings} check${warnings === 1 ? '' : 's'} need attention`
          : 'All workspace checks healthy',
    failed,
    warnings,
    passed: results.length - failed - warnings,
  }
}

async function runProbe(probe: HealthProbe): Promise<HealthProbeResult> {
  const started = performance.now()
  try {
    const response = await fetch(apiPath(probe.endpoint), { cache: 'no-store' })
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }
    return {
      ...probe,
      status: response.status,
      latencyMs: Math.round(performance.now() - started),
      severity: severityFor(probe, response.status, payload),
      evidence: summarizePayload(probe, response.status, payload),
    }
  } catch (error) {
    return {
      ...probe,
      status: null,
      latencyMs: Math.round(performance.now() - started),
      severity: probe.required ? 'fail' : 'warn',
      evidence: error instanceof Error ? error.message : 'Probe failed.',
    }
  }
}

function severityClass(severity: HealthSeverity) {
  if (severity === 'ok') return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
  if (severity === 'warn') return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
  return 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
}

export function WorkspaceHealthScreen() {
  const query = useQuery({
    queryKey: ['workspace-health'],
    queryFn: () => Promise.all(WORKSPACE_HEALTH_PROBES.map(runProbe)),
    refetchInterval: 60_000,
  })
  const results = query.data ?? []
  const summary = summarizeWorkspaceHealth(results)
  const groups = Array.from(new Set(WORKSPACE_HEALTH_PROBES.map((probe) => probe.group)))

  return (
    <div className="min-h-full bg-primary-50 px-4 py-6 text-primary-900 dark:bg-neutral-950 dark:text-neutral-100 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Workspace Health
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Live evidence for the daily workspace flow
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]', severityClass(summary.severity))}>
              {query.isFetching && results.length === 0 ? 'Checking' : summary.label}
            </span>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="rounded-xl bg-primary-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
              disabled={query.isFetching}
            >
              Refresh checks
            </button>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['Passed', summary.passed, 'ok' as const],
            ['Warnings', summary.warnings, 'warn' as const],
            ['Critical', summary.failed, 'fail' as const],
          ].map(([label, value, severity]) => (
            <div
              key={label}
              className={cn('rounded-xl border px-3 py-3', severityClass(severity))}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">
                {label}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {value}
              </div>
            </div>
          ))}
        </div>

        {groups.map((group) => (
          <section
            key={group}
            className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              {group}
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WORKSPACE_HEALTH_PROBES.filter((probe) => probe.group === group).map((probe) => {
                const result = results.find((item) => item.id === probe.id)
                const severity = result?.severity ?? 'warn'
                return (
                  <div
                    key={probe.id}
                    className="rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{probe.label}</div>
                        <div className="mt-1 truncate font-mono text-[11px] text-primary-500 dark:text-neutral-500">
                          {probe.endpoint}
                        </div>
                      </div>
                      <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', severityClass(severity))}>
                        {result?.status ?? 'pending'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-primary-600 dark:text-neutral-400">
                      {result?.evidence ?? 'Waiting for live evidence.'}
                    </p>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-500">
                      {result ? `${result.latencyMs}ms` : 'pending'}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
