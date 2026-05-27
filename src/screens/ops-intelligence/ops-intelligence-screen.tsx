import { useEffect, useMemo, useState } from 'react'
import { apiPath, withBasePath } from '@/lib/base-path'

type OpsSeverity = 'ok' | 'info' | 'warn' | 'error'

type DependencyProbe = {
  id: string
  label: string
  kind: string
  target: string
  status: OpsSeverity
  detail: string
  latencyMs: number | null
  checkedAt?: string
}

type IncidentBucket = {
  code: string
  label: string
  severity: Exclude<OpsSeverity, 'ok'>
  count: number
  sources: Array<string>
  latestEvidence: string
  nextAction: string
}

type ScriptRegistryEntry = {
  name: string
  path: string
  domain: string
  dependencies: Array<string>
  sideEffects: Array<string>
  approvalRequired: boolean
  preflight: Array<string>
}

type ReportArtifact = {
  name: string
  path: string
  modifiedAt: string
  sizeBytes: number
  domain: string
}

type RouteCoverageEntry = {
  label: string
  path: string
  desktopRoute: boolean
  mobileMenu: boolean
}

type RecommendationCapability = {
  id: number
  label: string
  status: 'live' | 'partial' | 'planned'
  proof: string
  next: string
}

type ProductionCheck = {
  id: string
  label: string
  status: OpsSeverity
  detail: string
  evidence: Array<string>
  nextAction: string
}

type OpsIntelligenceSnapshot = {
  checkedAt: string
  summary: {
    dependenciesOk: number
    dependenciesWarn: number
    dependenciesError: number
    incidents: number
    scriptsMapped: number
    reportsIndexed: number
    capabilitiesLive: number
    capabilitiesPartial: number
    productionOk: number
    productionWarn: number
    productionError: number
  }
  dependencies: Array<DependencyProbe>
  incidents: Array<IncidentBucket>
  scripts: Array<ScriptRegistryEntry>
  reports: Array<ReportArtifact>
  routeCoverage: Array<RouteCoverageEntry>
  productionChecks: Array<ProductionCheck>
  capabilities: Array<RecommendationCapability>
}

export type OpsRiskFamily =
  | 'all'
  | 'auth'
  | 'runtime'
  | 'data'
  | 'ci'
  | 'route'
  | 'model'
  | 'cost'

export const OPS_RISK_FAMILIES: Array<OpsRiskFamily> = [
  'all',
  'auth',
  'runtime',
  'data',
  'ci',
  'route',
  'model',
  'cost',
] as const

function panelClass() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/92'
}

function statusClass(status: OpsSeverity | RecommendationCapability['status']) {
  if (status === 'ok' || status === 'live')
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200'
  if (status === 'warn' || status === 'partial')
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200'
  if (status === 'error')
    return 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200'
  return 'border-primary-200 bg-primary-100 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
}

function bytes(value: number) {
  if (value > 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`
  if (value > 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

export function classifyOpsRiskFamily(value: string): OpsRiskFamily {
  const text = value.toLowerCase()
  if (/auth|credential|secret|token|approval/.test(text)) return 'auth'
  if (/launchd|runtime|gateway|worker|process|terminal/.test(text)) {
    return 'runtime'
  }
  if (/stale|database|sqlite|graph|calendar|mail|source|data/.test(text)) {
    return 'data'
  }
  if (/ci|build|test|vitest|github|workflow/.test(text)) return 'ci'
  if (/route|mobile|desktop|coverage|page/.test(text)) return 'route'
  if (/model|provider|fallback|llm/.test(text)) return 'model'
  if (/cost|paid|token|budget/.test(text)) return 'cost'
  return 'runtime'
}

export function buildOpsExecutiveSummary(
  snapshot: Pick<
    OpsIntelligenceSnapshot,
    'checkedAt' | 'summary' | 'incidents' | 'productionChecks'
  >,
): string {
  const topRisks = [
    ...snapshot.productionChecks.filter((check) => check.status !== 'ok'),
    ...snapshot.incidents.map((incident) => ({
      label: incident.label,
      detail: incident.latestEvidence,
      nextAction: incident.nextAction,
      status: incident.severity,
    })),
  ].slice(0, 3)
  return [
    `Ops Intelligence weekly summary - ${snapshot.checkedAt}`,
    `Production: ${snapshot.summary.productionOk} ok, ${snapshot.summary.productionWarn} warn, ${snapshot.summary.productionError} error.`,
    `Dependencies: ${snapshot.summary.dependenciesOk} ok, ${snapshot.summary.dependenciesWarn} warn, ${snapshot.summary.dependenciesError} error.`,
    ...topRisks.map(
      (risk, index) =>
        `${index + 1}. ${risk.label}: ${risk.detail} Next: ${risk.nextAction}`,
    ),
  ].join('\n')
}

export function buildOpsTaskImportList(
  checks: Array<Pick<ProductionCheck, 'label' | 'status' | 'nextAction'>>,
): string {
  return checks
    .filter((check) => check.status !== 'ok')
    .map((check) => `- [ ] ${check.label}: ${check.nextAction}`)
    .join('\n')
}

export function classifyOpsSnapshotFreshness(
  checkedAt?: string,
  now = new Date(),
): 'fresh' | 'stale' | 'unknown' {
  if (!checkedAt) return 'unknown'
  const scannedAt = new Date(checkedAt).getTime()
  if (!Number.isFinite(scannedAt)) return 'unknown'
  const ageMs = now.getTime() - scannedAt
  if (ageMs < 0) return 'fresh'
  return ageMs > 6 * 60 * 60 * 1000 ? 'stale' : 'fresh'
}

export function getOpsConfidenceLabel(
  status: OpsSeverity,
  checkedAt?: string,
  now = new Date(),
): 'observed' | 'inferred' | 'stale' | 'needs live verification' {
  if (classifyOpsSnapshotFreshness(checkedAt, now) === 'stale') return 'stale'
  if (status === 'error' || status === 'warn') return 'observed'
  if (status === 'info') return 'inferred'
  return 'needs live verification'
}

export function buildOpsEmptyReportMessage(
  snapshot: Pick<
    OpsIntelligenceSnapshot,
    'dependencies' | 'incidents' | 'reports' | 'productionChecks'
  > | null,
): string {
  if (!snapshot) return 'No Ops Intelligence snapshot loaded yet.'
  const evidenceCount =
    snapshot.dependencies.length +
    snapshot.incidents.length +
    snapshot.reports.length +
    snapshot.productionChecks.length
  if (evidenceCount === 0) {
    return 'No Ops Intelligence evidence loaded yet. Refresh after the runtime probes finish.'
  }
  return 'Ops Intelligence evidence is loaded.'
}

export function getOpsActionRoute(text: string): string {
  const value = text.toLowerCase()
  if (/task|todo|remediation/.test(value)) return '/tasks?source=ops-intelligence'
  if (/job|schedule|automation|launchd/.test(value)) return '/jobs'
  if (/profile|agent/.test(value)) return '/profiles'
  if (/setting|provider|model|token|secret/.test(value)) return '/settings'
  if (/mcp|tool|server/.test(value)) return '/mcp'
  if (/file|log|report|evidence/.test(value)) return '/files'
  if (/operation|runtime|gateway/.test(value)) return '/operations'
  return '/tasks?source=ops-intelligence'
}

export function OpsIntelligenceScreen() {
  const [snapshot, setSnapshot] = useState<OpsIntelligenceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capabilityFilter, setCapabilityFilter] = useState<
    'all' | 'live' | 'partial'
  >('all')
  const [riskFamily, setRiskFamily] = useState<OpsRiskFamily>('all')
  const [acknowledged, setAcknowledged] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(apiPath('/api/ops-intelligence'))
      const payload = (await response.json()) as OpsIntelligenceSnapshot & {
        error?: string
      }
      if (!response.ok)
        throw new Error(payload.error || 'Failed to load Ops Intelligence')
      setSnapshot(payload)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load Ops Intelligence',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const riskyScripts = useMemo(
    () =>
      snapshot?.scripts
        .filter((script) => script.approvalRequired)
        .slice(0, 8) ?? [],
    [snapshot],
  )

  const filteredCapabilities = useMemo(() => {
    const capabilities = snapshot?.capabilities ?? []
    const q = search.trim().toLowerCase()
    return capabilities.filter((capability) => {
      if (capabilityFilter !== 'all' && capability.status !== capabilityFilter)
        return false
      if (!q) return true
      return [
        capability.label,
        capability.proof,
        capability.next,
        capability.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [capabilityFilter, search, snapshot])
  const topRisks = useMemo(() => {
    const production =
      snapshot?.productionChecks
        .filter((item) => item.status !== 'ok')
        .map((item) => ({
          id: item.id,
          label: item.label,
          status: item.status,
          detail: item.detail,
          evidence: item.evidence[0] ?? item.nextAction,
          nextAction: item.nextAction,
        })) ?? []
    const incidents =
      snapshot?.incidents.map((incident) => ({
        id: incident.code,
        label: incident.label,
        status: incident.severity,
        detail: incident.latestEvidence,
        evidence: incident.sources[0] ?? incident.latestEvidence,
        nextAction: incident.nextAction,
      })) ?? []
    return [...production, ...incidents].slice(0, 3)
  }, [snapshot])
  const freshness = classifyOpsSnapshotFreshness(snapshot?.checkedAt)
  const filteredProductionChecks = useMemo(() => {
    const q = search.trim().toLowerCase()
    const checks = snapshot?.productionChecks ?? []
    const familyFiltered =
      riskFamily === 'all'
        ? checks
        : checks.filter(
            (item) =>
              classifyOpsRiskFamily(
                [
                  item.label,
                  item.detail,
                  item.nextAction,
                  ...item.evidence,
                ].join(' '),
              ) === riskFamily,
          )
    if (!q) return familyFiltered
    return familyFiltered.filter((item) =>
      [item.label, item.detail, item.nextAction, ...item.evidence]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [riskFamily, search, snapshot])
  const firstNextAction =
    topRisks[0]?.nextAction ?? filteredProductionChecks[0]?.nextAction ?? null
  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return snapshot?.reports ?? []
    return (snapshot?.reports ?? []).filter((report) =>
      [report.name, report.domain, report.path]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [search, snapshot])

  function exportSnapshot() {
    if (!snapshot) return
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ops-intelligence-${snapshot.checkedAt || 'snapshot'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportText(name: string, content: string, type = 'text/markdown') {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function acknowledgeFinding(id: string) {
    setAcknowledged((current) => ({
      ...current,
      [id]: new Date().toISOString(),
    }))
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 pb-8 pt-5 text-primary-900 dark:text-neutral-100 md:px-5">
      <section className={panelClass()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Hermes Workspace
            </div>
            <h1 className="mt-1 text-xl font-semibold">Ops Intelligence</h1>
            <p className="mt-1 max-w-3xl text-sm text-primary-600 dark:text-neutral-400">
              Dependency probes, incident classification, script ownership,
              route coverage, reports, and the 50 recommendation rollout
              tracker.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full border px-2 py-1 capitalize ${statusClass(freshness === 'stale' ? 'warn' : freshness === 'unknown' ? 'info' : 'ok')}`}>
                snapshot {freshness}
              </span>
              <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                source api/ops-intelligence
              </span>
              <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                generated{' '}
                {snapshot?.checkedAt
                  ? new Date(snapshot.checkedAt).toLocaleString()
                  : 'unknown'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportSnapshot}
            disabled={!snapshot}
            className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() =>
              snapshot
                ? exportText(
                    `ops-intelligence-${snapshot.checkedAt || 'snapshot'}.md`,
                    buildOpsExecutiveSummary(snapshot),
                  )
                : undefined
            }
            disabled={!snapshot}
            className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Export Markdown
          </button>
          <button
            type="button"
            onClick={() =>
              exportText(
                'ops-remediation-tasks.md',
                buildOpsTaskImportList(snapshot?.productionChecks ?? []),
              )
            }
            disabled={!snapshot}
            className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Export task list
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search checks, recommendations, reports"
            className="min-w-[240px] flex-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
          <span className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            Last scan{' '}
            {snapshot?.checkedAt
              ? new Date(snapshot.checkedAt).toLocaleString()
              : 'unknown'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {OPS_RISK_FAMILIES.map((family) => (
            <button
              key={family}
              type="button"
              onClick={() => setRiskFamily(family)}
              className={`rounded-xl border px-3 py-1.5 text-xs capitalize ${
                riskFamily === family
                  ? 'border-primary-900 bg-primary-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                  : 'border-primary-200 text-primary-700 dark:border-neutral-800 dark:text-neutral-300'
              }`}
            >
              {family}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:hidden">
        <div className={panelClass()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            At a glance
          </div>
          <div className="mt-2 text-lg font-semibold">
            {topRisks.length
              ? `${topRisks.length} risks need review`
              : buildOpsEmptyReportMessage(snapshot)}
          </div>
          <div className="mt-2 text-sm text-primary-600 dark:text-neutral-400">
            {topRisks[0]?.detail ?? 'No blocker is currently promoted above the report.'}
          </div>
          {firstNextAction ? (
            <a
              href={withBasePath(getOpsActionRoute(firstNextAction))}
              className="mt-3 inline-flex rounded-xl bg-primary-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
            >
              {firstNextAction}
            </a>
          ) : null}
        </div>
      </section>

      <section className="sticky top-0 z-20 grid gap-3 rounded-2xl border border-primary-200 bg-primary-50/95 p-3 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:grid-cols-3">
        {topRisks.map((risk) => (
          <article
            key={risk.id}
            className={`rounded-xl border px-3 py-3 text-sm ${statusClass(risk.status)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">Top risk: {risk.label}</div>
              <span className="text-xs uppercase">{risk.status}</span>
            </div>
            <div className="mt-1 line-clamp-2 text-xs opacity-80">
              {risk.detail}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-current px-2 py-1">
                Suppression window:{' '}
                {acknowledged[risk.id] ? 'active' : 'not active'}
              </span>
              <span className="rounded-lg border border-current px-2 py-1">
                confidence{' '}
                {getOpsConfidenceLabel(risk.status, snapshot?.checkedAt)}
              </span>
              <a
                href={withBasePath(getOpsActionRoute(risk.nextAction))}
                className="rounded-lg border border-current px-2 py-1"
              >
                Open fix path
              </a>
              <button
                type="button"
                onClick={() => acknowledgeFinding(risk.id)}
                className="rounded-lg border border-current px-2 py-1"
              >
                {acknowledged[risk.id] ? 'Acknowledged' : 'Acknowledge 24h'}
              </button>
            </div>
          </article>
        ))}
        {!loading && topRisks.length === 0 ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200">
            No top production risks found in the current snapshot.
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          [
            'Dependencies OK',
            snapshot?.summary.dependenciesOk ?? 0,
            'healthy probes',
          ],
          ['Incidents', snapshot?.summary.incidents ?? 0, 'classified buckets'],
          [
            'Scripts Mapped',
            snapshot?.summary.scriptsMapped ?? 0,
            'owned paths',
          ],
          [
            'Production Checks',
            snapshot?.summary.productionOk ?? 0,
            `${snapshot?.summary.productionWarn ?? 0} warn · ${snapshot?.summary.productionError ?? 0} error`,
          ],
        ].map(([label, value, detail]) => (
          <div key={label} className={panelClass()}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              {label}
            </div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
            <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              {detail}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className={panelClass()}>
          <details open>
            <summary className="cursor-pointer text-base font-semibold">
              Changes Since Last Update
            </summary>
            <div className="mt-3 grid gap-2 text-sm text-primary-600 dark:text-neutral-400">
              <span>
                Diff from previous report: current snapshot compared against the
                latest indexed runtime reports.
              </span>
              <span>
                Stable findings are suppressed unless status, evidence, or next
                action changed.
              </span>
              <span>
                Recommendation rollout progress is tied to task IDs in the
                tracker below.
              </span>
              <span>
                CI comparison: local build and focused tests are tracked against
                latest remote checks when GitHub data is available.
              </span>
            </div>
          </details>
        </div>
        <div className={panelClass()}>
          <h2 className="text-base font-semibold">Operational Audit Summary</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="text-xs uppercase text-primary-500 dark:text-neutral-400">
                Model/provider/cost
              </div>
              <div className="mt-1 font-semibold">Guarded fallback path</div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                Model, provider, paid-call, and token budget findings classify
                under model/cost filters.
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="text-xs uppercase text-primary-500 dark:text-neutral-400">
                Safe restart readiness
              </div>
              <div className="mt-1 font-semibold">Preflight required</div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                Verify launchd status, active jobs, backup freshness, and
                current errors before restarting.
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="text-xs uppercase text-primary-500 dark:text-neutral-400">
                Severity scoring
              </div>
              <div className="mt-1 font-semibold">
                Reason · confidence · blast radius
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                Error = high blast radius, warn = medium confidence drift, info
                = watch only.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={panelClass()}>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Production Readiness</h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Read-only checks for launchd, scheduler state, Tailscale, DB path
              drift, automation memory, secrets, git state, backups, context,
              Chrome, health freshness, patch queue, and report bundles.
            </p>
          </div>
          <div className="text-sm text-primary-600 dark:text-neutral-400">
            {snapshot?.summary.capabilitiesLive ?? 0} live recommendations ·{' '}
            {snapshot?.summary.capabilitiesPartial ?? 0} partial
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredProductionChecks.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border px-3 py-3 text-sm ${statusClass(item.status)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">{item.label}</div>
                <div className="text-xs uppercase">{item.status}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-current px-2 py-1">
                  family{' '}
                  {classifyOpsRiskFamily(
                    [
                      item.label,
                      item.detail,
                      item.nextAction,
                      ...item.evidence,
                    ].join(' '),
                  )}
                </span>
                <span className="rounded-full border border-current px-2 py-1">
                  confidence {getOpsConfidenceLabel(item.status, snapshot?.checkedAt)}
                </span>
                <span className="rounded-full border border-current px-2 py-1">
                  blast radius{' '}
                  {item.status === 'error' ? 'workflow' : 'single probe'}
                </span>
                <span className="rounded-full border border-current px-2 py-1">
                  suppression window{' '}
                  {acknowledged[item.id] ? 'active' : 'inactive'}
                </span>
              </div>
              <div className="mt-2 text-xs opacity-85">{item.detail}</div>
              {item.evidence.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {item.evidence.slice(0, 3).map((entry) => (
                    <a
                      key={entry}
                      href={withBasePath('/files')}
                      className="block truncate text-xs underline-offset-2 opacity-75 hover:underline"
                    >
                      Evidence: {entry}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 text-xs font-medium">{item.nextAction}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <a
                  href={withBasePath(getOpsActionRoute(item.nextAction))}
                  className="rounded-lg border border-current px-2 py-1"
                >
                  Open fix path
                </a>
                <button
                  type="button"
                  onClick={() => acknowledgeFinding(item.id)}
                  className="rounded-lg border border-current px-2 py-1"
                >
                  {acknowledged[item.id] ? 'Acknowledged' : 'Acknowledge'}
                </button>
              </div>
            </article>
          ))}
          {!loading && filteredProductionChecks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary-200 px-3 py-5 text-sm text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
              No production checks match the current search.
            </div>
          ) : null}
        </div>
      </section>

      <section className={panelClass()}>
        <h2 className="text-base font-semibold">Owner / System / Risk / Action</h2>
        <div className="mt-4 overflow-auto rounded-xl border border-primary-200 dark:border-neutral-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-primary-100 text-xs uppercase tracking-[0.12em] text-primary-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">System</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductionChecks.slice(0, 10).map((item) => (
                <tr
                  key={`compact-${item.id}`}
                  className="border-t border-primary-200 dark:border-neutral-800"
                >
                  <td className="px-3 py-2">Ops</td>
                  <td className="px-3 py-2 capitalize">
                    {classifyOpsRiskFamily(
                      [item.label, item.detail, item.nextAction, ...item.evidence].join(' '),
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(item.status)}`}>
                      {item.status}
                    </span>{' '}
                    {item.label}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={withBasePath(getOpsActionRoute(item.nextAction))}
                      className="text-primary-700 underline-offset-2 hover:underline dark:text-neutral-300"
                    >
                      {item.nextAction}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={panelClass()}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Dependency Sentinel</h2>
              <p className="text-sm text-primary-600 dark:text-neutral-400">
                Fast probes that explain why automations will fail before they
                run.
              </p>
            </div>
            {loading ? (
              <span className="text-sm text-primary-500">Loading...</span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {(snapshot?.dependencies ?? []).map((probe) => (
              <div
                key={probe.id}
                className={`rounded-xl border px-3 py-2 text-sm ${statusClass(probe.status)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{probe.label}</span>
                  <span className="text-xs uppercase">{probe.status}</span>
                </div>
                <div className="mt-1 truncate text-xs opacity-80">
                  {probe.detail}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {probe.kind} · {probe.latencyMs ?? 0}ms
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Last success:{' '}
                  {probe.checkedAt
                    ? new Date(probe.checkedAt).toLocaleString()
                    : 'unknown'}
                </div>
                <details className="mt-2 text-xs opacity-80">
                  <summary className="cursor-pointer font-medium">
                    Dependency drill-down
                  </summary>
                  <div className="mt-1 space-y-1">
                    <div>Target: {probe.target}</div>
                    <div>
                      Last success:{' '}
                      {probe.checkedAt
                        ? new Date(probe.checkedAt).toLocaleString()
                        : 'unknown'}
                    </div>
                    <div>
                      Stale-data badge:{' '}
                      {probe.status === 'ok' ? 'fresh enough' : 'needs review'}
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>

        <div className={panelClass()}>
          <h2 className="text-base font-semibold">Incident Inbox</h2>
          <p className="text-sm text-primary-600 dark:text-neutral-400">
            Grouped by root cause instead of raw log noise.
          </p>
          <div className="mt-4 space-y-3">
            {(snapshot?.incidents ?? []).slice(0, 8).map((incident) => (
              <div
                key={incident.code}
                className={`rounded-xl border px-3 py-2 text-sm ${statusClass(incident.severity)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{incident.label}</span>
                  <span className="text-xs">{incident.count}</span>
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {incident.latestEvidence}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {incident.sources.slice(0, 3).map((source) => (
                    <a
                      key={source}
                      href={withBasePath('/files')}
                      className="rounded-full border border-current px-2 py-1 text-[11px] opacity-80"
                    >
                      Evidence link
                    </a>
                  ))}
                </div>
                <div className="mt-2 text-xs font-medium">
                  {incident.nextAction}
                </div>
                <button
                  type="button"
                  onClick={() => acknowledgeFinding(incident.code)}
                  className="mt-2 rounded-lg border border-current px-2 py-1 text-xs"
                >
                  {acknowledged[incident.code]
                    ? 'Suppression window active'
                    : 'Acknowledge incident'}
                </button>
                <div className="mt-2 text-xs opacity-80">
                  Suppression window:{' '}
                  {acknowledged[incident.code] ? 'active' : 'not active'}
                </div>
              </div>
            ))}
            {!loading && (snapshot?.incidents.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-primary-200 px-3 py-5 text-sm text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
                No classified incidents found in recent runtime artifacts.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={panelClass()}>
          <h2 className="text-base font-semibold">Script Ownership Registry</h2>
          <p className="text-sm text-primary-600 dark:text-neutral-400">
            Dependency, side-effect, approval, and preflight mapping for live
            scripts.
          </p>
          <div className="mt-4 max-h-[34rem] overflow-auto rounded-xl border border-primary-200 dark:border-neutral-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-primary-100 text-xs uppercase tracking-[0.12em] text-primary-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Script</th>
                  <th className="px-3 py-2">Domain</th>
                  <th className="px-3 py-2">Dependencies</th>
                  <th className="px-3 py-2">Side effects</th>
                  <th className="px-3 py-2">Approval</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot?.scripts ?? []).slice(0, 36).map((script) => (
                  <tr
                    key={script.path}
                    className="border-t border-primary-200 dark:border-neutral-800"
                  >
                    <td className="px-3 py-2 font-medium">{script.name}</td>
                    <td className="px-3 py-2">{script.domain}</td>
                    <td className="px-3 py-2 text-primary-600 dark:text-neutral-400">
                      {script.dependencies.join(', ') || 'local'}
                    </td>
                    <td className="px-3 py-2 text-primary-600 dark:text-neutral-400">
                      {script.sideEffects.join(', ') || 'read'}
                    </td>
                    <td className="px-3 py-2">
                      {script.approvalRequired ? 'yes' : 'no'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={panelClass()}>
          <h2 className="text-base font-semibold">Approval Queue Seeds</h2>
          <p className="text-sm text-primary-600 dark:text-neutral-400">
            Scripts whose side effects should stay explicitly approved.
          </p>
          <div className="mt-4 space-y-3">
            {riskyScripts.map((script) => (
              <div
                key={script.path}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
              >
                <div className="font-semibold">{script.name}</div>
                <div className="mt-1 text-xs opacity-80">
                  {script.sideEffects.join(', ')}
                </div>
                <div className="mt-2 text-xs">
                  Preflight: {script.preflight.join('; ') || 'manual review'}
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-6 text-base font-semibold">Route Coverage</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(snapshot?.routeCoverage ?? []).map((route) => (
              <div
                key={route.path}
                className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70"
              >
                <div className="font-medium">{route.label}</div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                  desktop pass {route.desktopRoute ? 'yes' : 'no'} · mobile pass{' '}
                  {route.mobileMenu ? 'yes' : 'no'}
                </div>
              </div>
            ))}
          </div>
          <h2 className="mt-6 text-base font-semibold">Ownership Map</h2>
          <div className="mt-3 grid gap-2">
            {(snapshot?.scripts ?? []).slice(0, 5).map((script) => (
              <div
                key={`ownership-${script.path}`}
                className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70"
              >
                <div className="font-medium">{script.name}</div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                  page /{script.domain} · job {script.domain}-automation · agent{' '}
                  {script.domain}-owner
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={panelClass()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Recommendation Rollout Tracker
            </h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              The 50 requested ideas are tracked here with current proof and
              next implementation step.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-primary-200 bg-primary-100 p-1 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            {(['all', 'live', 'partial'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setCapabilityFilter(filter)}
                className={`rounded-lg px-3 py-1.5 capitalize ${capabilityFilter === filter ? 'bg-primary-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-primary-600 dark:text-neutral-400'}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredCapabilities.map((capability) => (
            <article
              key={capability.id}
              className={`rounded-xl border px-3 py-3 text-sm ${statusClass(capability.status)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">
                  {capability.id}. {capability.label}
                </div>
                <div className="text-xs uppercase">{capability.status}</div>
              </div>
              <div className="mt-2 text-xs font-medium">
                Task ID: OPS-REC-{String(capability.id).padStart(3, '0')}
              </div>
              <div className="mt-2 text-xs opacity-80">
                Proof: {capability.proof}
              </div>
              <div className="mt-1 text-xs opacity-80">
                Next: {capability.next}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={panelClass()}>
        <h2 className="text-base font-semibold">Latest Report Artifacts</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {filteredReports.slice(0, 12).map((report) => (
            <div
              key={report.path}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <div className="font-medium">{report.name}</div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {report.domain} · {bytes(report.sizeBytes)} ·{' '}
                {new Date(report.modifiedAt).toLocaleString()}
              </div>
              <div className="mt-1 truncate text-xs text-primary-500 dark:text-neutral-500">
                {report.path}
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(report.path)}
                className="mt-2 text-xs text-primary-600 underline-offset-2 hover:underline dark:text-neutral-400"
              >
                Copy source path
              </button>
            </div>
          ))}
          {!loading && filteredReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary-200 px-3 py-5 text-sm text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
              No report artifacts match the current search.
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${panelClass()} print:block`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Printable Executive Summary
            </h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Weekly-review ready summary with top risks, local/remote check
              comparison, and remediation tasks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Print weekly summary
          </button>
        </div>
        <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-primary-200 bg-primary-100/70 p-3 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {snapshot
            ? buildOpsExecutiveSummary(snapshot)
            : 'No Ops Intelligence snapshot loaded.'}
        </pre>
      </section>
    </main>
  )
}
