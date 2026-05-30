import { useQuery } from '@tanstack/react-query'
import { apiPath, withBasePath } from '@/lib/base-path'
import {
  normalizeWorkspaceStatusTone,
  workspaceStatusClass,
} from '@/lib/source-freshness'
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
  {
    id: 'auth',
    label: 'Auth',
    endpoint: '/api/auth-check',
    group: 'Core',
    required: true,
  },
  {
    id: 'ping',
    label: 'Gateway ping',
    endpoint: '/api/ping',
    group: 'Core',
    required: true,
  },
  {
    id: 'gateway',
    label: 'Capabilities',
    endpoint: '/api/gateway-status',
    group: 'Core',
    required: true,
  },
  {
    id: 'overview',
    label: 'Dashboard',
    endpoint: '/api/dashboard/overview?days=7&achievements=1',
    group: 'Workspace',
    required: true,
  },
  {
    id: 'phone',
    label: 'Phone',
    endpoint: '/api/phone-cockpit',
    group: 'Daily flow',
  },
  {
    id: 'lily',
    label: 'LILY',
    endpoint: '/api/lily/config',
    group: 'Daily flow',
  },
  {
    id: 'presence',
    label: 'Presence',
    endpoint: '/api/ops/presence',
    group: 'Ops',
  },
  {
    id: 'it-ops',
    label: 'IT Ops',
    endpoint: '/api/ops/it-ops',
    group: 'Ops',
  },
  {
    id: 'swarm',
    label: 'Swarm',
    endpoint: '/api/swarm-health',
    group: 'Agents',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    endpoint: '/api/hermes-tasks',
    group: 'Workspace',
  },
]

function summarizePayload(
  probe: HealthProbe,
  status: number,
  payload: unknown,
): string {
  if (status >= 400) {
    if (payload && typeof payload === 'object' && 'error' in payload) {
      return String((payload as { error?: unknown }).error || `HTTP ${status}`)
    }
    return `HTTP ${status}`
  }
  if (!payload || typeof payload !== 'object') return 'Responded.'
  const data = payload as Record<string, unknown>
  if (probe.id === 'auth') {
    return data.authenticated ? 'Auth ok.' : 'Auth missing.'
  }
  if (probe.id === 'gateway') {
    const gateway = data.gateway as Record<string, unknown> | undefined
    return gateway?.available ? 'Capabilities ok.' : 'Capabilities degraded.'
  }
  if (probe.id === 'overview') {
    const statusData = data.status as Record<string, unknown> | undefined
    return `Heartbeat ${statusData?.updatedAt || 'unknown'}.`
  }
  if (probe.id === 'phone') {
    const attention = Array.isArray(data.attention) ? data.attention.length : 0
    return `${attention} attention items.`
  }
  if (probe.id === 'lily') {
    const worker = data.voiceWorker as Record<string, unknown> | undefined
    return `Worker ${worker?.status || 'unknown'}.`
  }
  if (probe.id === 'swarm') {
    const summary = data.summary as Record<string, unknown> | undefined
    return `Auth errors ${summary?.totalAuthErrors24h ?? 0}.`
  }
  if (probe.id === 'tasks') {
    const tasks = Array.isArray(data.tasks) ? data.tasks.length : 0
    return `${tasks} tasks.`
  }
  return 'JSON ok.'
}

function severityFor(
  probe: HealthProbe,
  status: number,
  payload: unknown,
): HealthSeverity {
  if (status >= 500) return probe.required ? 'fail' : 'warn'
  if (status >= 400) return 'warn'
  if (!payload || typeof payload !== 'object') return 'ok'
  const data = payload as Record<string, unknown>
  if (probe.id === 'auth' && data.authRequired && !data.authenticated)
    return 'fail'
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

export function summarizeWorkspaceHealth(results: Array<HealthProbeResult>): {
  severity: HealthSeverity
  label: string
  failed: number
  warnings: number
  passed: number
} {
  const failed = results.filter((result) => result.severity === 'fail').length
  const warnings = results.filter((result) => result.severity === 'warn').length
  return {
    severity: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'ok',
    label:
      failed > 0
        ? `${failed} critical`
        : warnings > 0
          ? `${warnings} warn`
          : 'Healthy',
    failed,
    warnings,
    passed: results.length - failed - warnings,
  }
}

export function calculateWorkspaceHealthScore(
  results: Array<HealthProbeResult>,
) {
  if (results.length === 0) return 0
  const penalty = results.reduce((total, result) => {
    if (result.severity === 'fail') return total + 22
    if (result.severity === 'warn') return total + 9
    return total
  }, 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}

export function getWorkspaceHealthAction(
  probe: HealthProbeResult | HealthProbe,
) {
  const target = `${probe.id} ${probe.label} ${probe.endpoint}`.toLowerCase()
  if (/auth|gateway|capabilities/.test(target)) return '/settings'
  if (/phone|dashboard|tasks/.test(target)) return '/dashboard'
  if (/lily/.test(target)) return '/lily'
  if (/presence|it-ops|swarm/.test(target)) return '/ops-intelligence'
  return '/terminal'
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
  return workspaceStatusClass(
    normalizeWorkspaceStatusTone(severity === 'fail' ? 'error' : severity),
  )
}

export function WorkspaceHealthScreen() {
  const query = useQuery({
    queryKey: ['workspace-health'],
    queryFn: () => Promise.all(WORKSPACE_HEALTH_PROBES.map(runProbe)),
    refetchInterval: 60_000,
  })
  const results = query.data ?? []
  const summary = summarizeWorkspaceHealth(results)
  const healthScore = calculateWorkspaceHealthScore(results)
  const groups = Array.from(
    new Set(WORKSPACE_HEALTH_PROBES.map((probe) => probe.group)),
  )
  const actionQueue = results
    .filter((result) => result.severity !== 'ok')
    .sort((left, right) => {
      const weight = { fail: 0, warn: 1, ok: 2 } satisfies Record<
        HealthSeverity,
        number
      >
      return weight[left.severity] - weight[right.severity]
    })
  const slowestProbe = [...results].sort(
    (left, right) => right.latencyMs - left.latencyMs,
  )[0]
  const groupSummaries = groups.map((group) => {
    const groupResults = WORKSPACE_HEALTH_PROBES.filter(
      (probe) => probe.group === group,
    ).map((probe) => results.find((result) => result.id === probe.id))
    const failed = groupResults.filter(
      (result) => result?.severity === 'fail',
    ).length
    const warned = groupResults.filter(
      (result) => result?.severity === 'warn',
    ).length
    return {
      group,
      total: groupResults.length,
      failed,
      warned,
      passed: groupResults.filter((result) => result?.severity === 'ok').length,
      severity: failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'ok',
    } satisfies {
      group: string
      total: number
      failed: number
      warned: number
      passed: number
      severity: HealthSeverity
    }
  })

  return (
    <div className="min-h-full bg-primary-50 px-4 py-6 text-primary-900 dark:bg-neutral-950 dark:text-neutral-100 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Workspace runtime
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Workspace Health
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-primary-600 dark:text-neutral-400">
                Live probes for the workspace APIs, gateway handoff, daily
                tools, and agent surfaces.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
                  severityClass(summary.severity),
                )}
              >
                {query.isFetching && results.length === 0
                  ? 'Checking'
                  : summary.label}
              </span>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="rounded-xl bg-primary-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
                disabled={query.isFetching}
              >
                Sync
              </button>
            </div>
          </div>

          <section className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-primary-200 bg-primary-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-500">
                Health score
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-semibold tabular-nums">
                  {healthScore}
                </span>
                <span className="pb-2 text-sm text-primary-500 dark:text-neutral-500">
                  /100
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-primary-100 dark:bg-neutral-800">
                <div
                  className={cn(
                    'h-2 rounded-full',
                    summary.severity === 'fail'
                      ? 'bg-red-500'
                      : summary.severity === 'warn'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500',
                  )}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <div className="mt-3 text-sm text-primary-600 dark:text-neutral-400">
                {actionQueue[0]
                  ? `${actionQueue[0].label} needs review first.`
                  : results.length
                    ? 'All loaded probes are clean.'
                    : 'Waiting for first probe run.'}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {groupSummaries.map((item) => (
                <a
                  key={item.group}
                  href={withBasePath(
                    getWorkspaceHealthAction(
                      WORKSPACE_HEALTH_PROBES.find(
                        (probe) => probe.group === item.group,
                      ) ?? WORKSPACE_HEALTH_PROBES[0],
                    ),
                  )}
                  className={cn(
                    'rounded-2xl border p-3 text-sm',
                    severityClass(item.severity),
                  )}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-75">
                    {item.group}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">
                    {item.passed}/{item.total}
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {item.failed} fail · {item.warned} warn
                  </div>
                </a>
              ))}
            </div>
          </section>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Pass', summary.passed, 'ok'],
              ['Warn', summary.warnings, 'warn'],
              ['Fail', summary.failed, 'fail'],
            ] satisfies Array<[string, number, HealthSeverity]>
          ).map(([label, value, severity]) => (
            <div
              key={label}
              className={cn(
                'rounded-xl border px-3 py-3',
                severityClass(severity),
              )}
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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                  Action queue
                </h2>
                <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                  Failures and warnings routed to the page most likely to fix
                  them.
                </p>
              </div>
              {slowestProbe ? (
                <span className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                  Slowest {slowestProbe.label} · {slowestProbe.latencyMs}ms
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {actionQueue.slice(0, 4).map((result) => (
                <article
                  key={result.id}
                  className={cn(
                    'rounded-xl border p-3',
                    severityClass(result.severity),
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{result.label}</div>
                      <div className="mt-1 font-mono text-[11px] opacity-75">
                        {result.endpoint}
                      </div>
                    </div>
                    <span className="rounded-full border border-current px-2 py-0.5 text-[10px] uppercase">
                      {result.severity}
                    </span>
                  </div>
                  <div className="mt-2 text-sm opacity-85">
                    {result.evidence}
                  </div>
                  <a
                    href={withBasePath(getWorkspaceHealthAction(result))}
                    className="mt-3 inline-flex rounded-lg border border-current px-2 py-1 text-xs font-semibold"
                  >
                    Open fix surface
                  </a>
                </article>
              ))}
              {!query.isFetching && actionQueue.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100 md:col-span-2">
                  No failures or warnings in the current health snapshot.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Quick routes
            </h2>
            <div className="mt-3 grid gap-2 text-sm">
              {[
                ['Terminal', '/terminal', 'Run shell checks'],
                ['Ops Intel', '/ops-intelligence', 'Review incidents'],
                ['Apple Health', '/apple-health', 'Personal health data'],
                ['Settings', '/settings', 'Auth and provider repair'],
              ].map(([label, route, detail]) => (
                <a
                  key={route}
                  href={withBasePath(route)}
                  className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <span className="font-semibold">{label}</span>
                  <span className="mt-1 block text-xs text-primary-600 dark:text-neutral-400">
                    {detail}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {groups.map((group) => (
          <section
            key={group}
            className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              {group}
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WORKSPACE_HEALTH_PROBES.filter(
                (probe) => probe.group === group,
              ).map((probe) => {
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
                      <span
                        className={cn(
                          'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                          severityClass(severity),
                        )}
                      >
                        {result?.status ?? 'pending'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-primary-600 dark:text-neutral-400">
                      {result?.evidence ?? 'Waiting.'}
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
