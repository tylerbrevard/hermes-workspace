import { useEffect, useMemo, useState } from 'react'
import { apiPath } from '@/lib/base-path'

type OpsSeverity = 'ok' | 'info' | 'warn' | 'error'

type DependencyProbe = {
  id: string
  label: string
  kind: string
  target: string
  status: OpsSeverity
  detail: string
  latencyMs: number | null
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

function panelClass() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/92'
}

function statusClass(status: OpsSeverity | RecommendationCapability['status']) {
  if (status === 'ok' || status === 'live') return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200'
  if (status === 'warn' || status === 'partial') return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200'
  if (status === 'error') return 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200'
  return 'border-primary-200 bg-primary-100 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
}

function bytes(value: number) {
  if (value > 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`
  if (value > 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

export function OpsIntelligenceScreen() {
  const [snapshot, setSnapshot] = useState<OpsIntelligenceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capabilityFilter, setCapabilityFilter] = useState<'all' | 'live' | 'partial'>('all')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(apiPath('/api/ops-intelligence'))
      const payload = (await response.json()) as OpsIntelligenceSnapshot & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Failed to load Ops Intelligence')
      setSnapshot(payload)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Ops Intelligence')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const riskyScripts = useMemo(
    () => snapshot?.scripts.filter((script) => script.approvalRequired).slice(0, 8) ?? [],
    [snapshot],
  )

  const filteredCapabilities = useMemo(() => {
    const capabilities = snapshot?.capabilities ?? []
    const q = search.trim().toLowerCase()
    return capabilities.filter((capability) => {
      if (capabilityFilter !== 'all' && capability.status !== capabilityFilter) return false
      if (!q) return true
      return [capability.label, capability.proof, capability.next, capability.status]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [capabilityFilter, search, snapshot])
  const filteredProductionChecks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return snapshot?.productionChecks ?? []
    return (snapshot?.productionChecks ?? []).filter((item) =>
      [item.label, item.detail, item.nextAction, ...item.evidence]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [search, snapshot])
  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return snapshot?.reports ?? []
    return (snapshot?.reports ?? []).filter((report) =>
      [report.name, report.domain, report.path].join(' ').toLowerCase().includes(q),
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
              Dependency probes, incident classification, script ownership, route coverage, reports, and the 50 recommendation rollout tracker.
            </p>
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
            Last scan {snapshot?.checkedAt ? new Date(snapshot.checkedAt).toLocaleString() : 'unknown'}
          </span>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['Dependencies OK', snapshot?.summary.dependenciesOk ?? 0, 'healthy probes'],
          ['Incidents', snapshot?.summary.incidents ?? 0, 'classified buckets'],
          ['Scripts Mapped', snapshot?.summary.scriptsMapped ?? 0, 'owned paths'],
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
            <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">{detail}</div>
          </div>
        ))}
      </section>

      <section className={panelClass()}>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Production Readiness</h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Read-only checks for launchd, scheduler state, Tailscale, DB path drift, automation memory, secrets, git state, backups, context, Chrome, health freshness, patch queue, and report bundles.
            </p>
          </div>
          <div className="text-sm text-primary-600 dark:text-neutral-400">
            {snapshot?.summary.capabilitiesLive ?? 0} live recommendations · {snapshot?.summary.capabilitiesPartial ?? 0} partial
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredProductionChecks.map((item) => (
            <article key={item.id} className={`rounded-xl border px-3 py-3 text-sm ${statusClass(item.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">{item.label}</div>
                <div className="text-xs uppercase">{item.status}</div>
              </div>
              <div className="mt-2 text-xs opacity-85">{item.detail}</div>
              {item.evidence.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {item.evidence.slice(0, 3).map((entry) => (
                    <div key={entry} className="truncate text-xs opacity-75">{entry}</div>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 text-xs font-medium">{item.nextAction}</div>
            </article>
          ))}
          {!loading && filteredProductionChecks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary-200 px-3 py-5 text-sm text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
              No production checks match the current search.
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={panelClass()}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Dependency Sentinel</h2>
              <p className="text-sm text-primary-600 dark:text-neutral-400">
                Fast probes that explain why automations will fail before they run.
              </p>
            </div>
            {loading ? <span className="text-sm text-primary-500">Loading...</span> : null}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {(snapshot?.dependencies ?? []).map((probe) => (
              <div key={probe.id} className={`rounded-xl border px-3 py-2 text-sm ${statusClass(probe.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{probe.label}</span>
                  <span className="text-xs uppercase">{probe.status}</span>
                </div>
                <div className="mt-1 truncate text-xs opacity-80">{probe.detail}</div>
                <div className="mt-1 text-xs opacity-70">
                  {probe.kind} · {probe.latencyMs ?? 0}ms
                </div>
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
              <div key={incident.code} className={`rounded-xl border px-3 py-2 text-sm ${statusClass(incident.severity)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{incident.label}</span>
                  <span className="text-xs">{incident.count}</span>
                </div>
                <div className="mt-1 text-xs opacity-80">{incident.latestEvidence}</div>
                <div className="mt-2 text-xs font-medium">{incident.nextAction}</div>
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
            Dependency, side-effect, approval, and preflight mapping for live scripts.
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
                  <tr key={script.path} className="border-t border-primary-200 dark:border-neutral-800">
                    <td className="px-3 py-2 font-medium">{script.name}</td>
                    <td className="px-3 py-2">{script.domain}</td>
                    <td className="px-3 py-2 text-primary-600 dark:text-neutral-400">{script.dependencies.join(', ') || 'local'}</td>
                    <td className="px-3 py-2 text-primary-600 dark:text-neutral-400">{script.sideEffects.join(', ') || 'read'}</td>
                    <td className="px-3 py-2">{script.approvalRequired ? 'yes' : 'no'}</td>
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
              <div key={script.path} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
                <div className="font-semibold">{script.name}</div>
                <div className="mt-1 text-xs opacity-80">{script.sideEffects.join(', ')}</div>
                <div className="mt-2 text-xs">Preflight: {script.preflight.join('; ') || 'manual review'}</div>
              </div>
            ))}
          </div>

          <h2 className="mt-6 text-base font-semibold">Route Coverage</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(snapshot?.routeCoverage ?? []).map((route) => (
              <div key={route.path} className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
                <div className="font-medium">{route.label}</div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                  route {route.desktopRoute ? 'yes' : 'no'} · mobile {route.mobileMenu ? 'yes' : 'no'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={panelClass()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Recommendation Rollout Tracker</h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              The 50 requested ideas are tracked here with current proof and next implementation step.
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
            <article key={capability.id} className={`rounded-xl border px-3 py-3 text-sm ${statusClass(capability.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">
                  {capability.id}. {capability.label}
                </div>
                <div className="text-xs uppercase">{capability.status}</div>
              </div>
              <div className="mt-2 text-xs opacity-80">Proof: {capability.proof}</div>
              <div className="mt-1 text-xs opacity-80">Next: {capability.next}</div>
            </article>
          ))}
        </div>
      </section>

      <section className={panelClass()}>
        <h2 className="text-base font-semibold">Latest Report Artifacts</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {filteredReports.slice(0, 12).map((report) => (
            <div key={report.path} className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="font-medium">{report.name}</div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {report.domain} · {bytes(report.sizeBytes)} · {new Date(report.modifiedAt).toLocaleString()}
              </div>
              <div className="mt-1 truncate text-xs text-primary-500 dark:text-neutral-500">{report.path}</div>
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
    </main>
  )
}
