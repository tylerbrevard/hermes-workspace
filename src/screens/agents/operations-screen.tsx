import { useEffect, useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  AiBrain03Icon,
  Alert01Icon,
  CheckListIcon,
  Clock01Icon,
  PlusSignIcon,
  RefreshIcon,
  SlidersHorizontalIcon,
  Task01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { seedAgentPresets } from './agent-presets'
import { OrchestratorCard } from './components/orchestrator-card'
import { OperationsAgentCard } from './components/operations-agent-card'
import { OperationsAgentDetail } from './components/operations-agent-detail'
import { OperationsNewAgentModal } from './components/operations-new-agent-modal'
import { OperationsSettingsModal } from './components/operations-settings-modal'
import { FullOutputsView } from './components/full-outputs-view'
import { useOperations } from './hooks/use-operations'
import type { CSSProperties } from 'react'
import type { OperationsAgent } from './hooks/use-operations'
import type { HugeIcon } from '@/screens/dashboard/dashboard-ui'
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'
import { Button } from '@/components/ui/button'
import { withBasePath } from '@/lib/base-path'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/screens/dashboard/lib/formatters'

export const THEME_STYLE: CSSProperties = {
  ['--theme-bg' as string]: 'var(--color-surface)',
  ['--theme-card' as string]: 'var(--color-primary-50)',
  ['--theme-card2' as string]: 'var(--color-primary-100)',
  ['--theme-border' as string]: 'var(--color-primary-200)',
  ['--theme-border2' as string]: 'var(--color-primary-400)',
  ['--theme-text' as string]: 'var(--color-ink)',
  ['--theme-muted' as string]: 'var(--color-primary-700)',
  ['--theme-muted-2' as string]: 'var(--color-primary-600)',
  ['--theme-accent' as string]: 'var(--color-accent-500)',
  ['--theme-accent-strong' as string]: 'var(--color-accent-600)',
  ['--theme-accent-soft' as string]:
    'color-mix(in srgb, var(--color-accent-500) 12%, transparent)',
  ['--theme-accent-soft-strong' as string]:
    'color-mix(in srgb, var(--color-accent-500) 18%, transparent)',
  ['--theme-shadow' as string]:
    'color-mix(in srgb, var(--color-primary-950) 14%, transparent)',
  ['--theme-danger' as string]: 'var(--color-red-600, #dc2626)',
  ['--theme-danger-soft' as string]:
    'color-mix(in srgb, var(--theme-danger) 12%, transparent)',
  ['--theme-danger-soft-strong' as string]:
    'color-mix(in srgb, var(--theme-danger) 18%, transparent)',
  ['--theme-danger-border' as string]:
    'color-mix(in srgb, var(--theme-danger) 35%, white)',
  ['--theme-warning' as string]: 'var(--color-amber-600, #d97706)',
  ['--theme-warning-soft' as string]:
    'color-mix(in srgb, var(--theme-warning) 12%, transparent)',
  ['--theme-warning-soft-strong' as string]:
    'color-mix(in srgb, var(--theme-warning) 18%, transparent)',
  ['--theme-warning-border' as string]:
    'color-mix(in srgb, var(--theme-warning) 35%, white)',
}

export type OperationsFleetFilter =
  | 'all'
  | 'active'
  | 'idle'
  | 'failed'
  | 'needs Tyler'
  | 'needs setup'
  | 'noisy'
  | 'recently changed'

export const OPERATIONS_FLEET_FILTERS: Array<OperationsFleetFilter> = [
  'all',
  'active',
  'idle',
  'failed',
  'needs Tyler',
  'needs setup',
  'noisy',
  'recently changed',
]

type OperationsHealthRow = {
  id: string
  name: string
  status: OperationsAgent['status']
  owner: string
  lastAction: string
  queue: string
  latestError: string
  needsTyler: boolean
  blockedByMe: boolean
  waitingOnOthers: boolean
  stale: boolean
  staleLabel: string
  capabilities: Array<string>
  assignment: string
  launchdStatus: string
  processStatus: string
  sourceOwner: 'Hermes runtime' | 'Codex wrapper' | 'workspace UI'
  incidentHistory: Array<string>
  modelHealth: string
  routeHref: string
}

type OperationsCockpitTile = {
  id: string
  label: string
  value: string
  detail: string
  filter: OperationsFleetFilter
  tone: 'good' | 'warning' | 'danger' | 'neutral'
  progress: number
}

const OPERATIONS_TILE_ICONS: Record<string, HugeIcon> = {
  active: Task01Icon,
  failed: Alert01Icon,
  blocked: CheckListIcon,
  waiting: Clock01Icon,
  freshness: RefreshIcon,
}

function compactOperationsLabel(value: string): string {
  return value
    .replace(/ops-maintenance/gi, 'Ops')
    .replace(/maintenance/gi, 'Maint')
    .replace(/^No action recorded$/i, 'No action')
    .replace(/\s+/g, ' ')
    .trim()
}

function statusTone(status: OperationsAgent['status'], needsSetup = false) {
  if (needsSetup) {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100'
  }
  if (status === 'error') {
    return 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100'
  }
  if (status === 'active') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100'
  }
  return 'border-primary-200 bg-primary-100/70 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
}

function tileToneClass(tone: OperationsCockpitTile['tone']) {
  if (tone === 'danger') {
    return 'border-red-300 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100'
  }
  if (tone === 'warning') {
    return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100'
  }
  if (tone === 'good') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100'
  }
  return 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)]'
}

function appToneForOperations(
  tone: OperationsCockpitTile['tone'],
): 'green' | 'amber' | 'red' | 'blue' | 'neutral' {
  if (tone === 'good') return 'green'
  if (tone === 'warning') return 'amber'
  if (tone === 'danger') return 'red'
  return 'neutral'
}

function buildLatestError(agent: OperationsAgent): string {
  const status = agent.latestSession?.status?.toString().trim() ?? ''
  if (agent.status === 'error') return status || 'Latest session reported error'
  if (agent.needsSetup) return 'Model missing from profile config'
  const failedJob = agent.jobs.find((job) => job.lastRun?.status === 'error')
  if (failedJob) {
    return (
      failedJob.lastRun?.error?.trim() ||
      failedJob.lastRun?.deliverySummary?.trim() ||
      `${failedJob.name} failed`
    )
  }
  return 'No current error'
}

export function buildOperationsCockpitTiles(
  rows: Array<OperationsHealthRow>,
): Array<OperationsCockpitTile> {
  const total = Math.max(1, rows.length)
  const active = rows.filter((row) => row.status === 'active').length
  const failed = rows.filter((row) => row.status === 'error').length
  const blocked = rows.filter((row) => row.needsTyler).length
  const waiting = rows.filter((row) => row.waitingOnOthers).length
  const stale = rows.filter((row) => row.stale).length

  return [
    {
      id: 'active',
      label: 'Active',
      value: String(active),
      detail: active > 0 ? 'Running' : 'Clear',
      filter: 'active',
      tone: active > 0 ? 'good' : 'neutral',
      progress: Math.round((active / total) * 100),
    },
    {
      id: 'failed',
      label: 'Failures',
      value: String(failed),
      detail:
        failed > 0 ? 'Inspect' : 'Clear',
      filter: 'failed',
      tone: failed > 0 ? 'danger' : 'good',
      progress: Math.round((failed / total) * 100),
    },
    {
      id: 'blocked',
      label: 'Tyler',
      value: String(blocked),
      detail:
        blocked > 0 ? 'Review' : 'Clear',
      filter: 'needs Tyler',
      tone: blocked > 0 ? 'warning' : 'good',
      progress: Math.round((blocked / total) * 100),
    },
    {
      id: 'waiting',
      label: 'Waiting',
      value: String(waiting),
      detail:
        waiting > 0 ? 'Queued' : 'Clear',
      filter: 'all',
      tone: waiting > 0 ? 'warning' : 'neutral',
      progress: Math.round((waiting / total) * 100),
    },
    {
      id: 'freshness',
      label: 'Fresh',
      value: `${Math.max(0, rows.length - stale)}/${rows.length}`,
      detail:
        stale > 0 ? `${stale} stale` : 'OK',
      filter: 'recently changed',
      tone: stale > 0 ? 'warning' : 'good',
      progress: Math.round(((rows.length - stale) / total) * 100),
    },
  ]
}

export function buildOperationsHealthRows(
  agents: Array<OperationsAgent>,
  now = Date.now(),
): Array<OperationsHealthRow> {
  return agents.map((agent) => {
    const lastSeen = agent.lastActivityAt ?? agent.latestSession?.updatedAt
    const lastSeenMs =
      typeof lastSeen === 'number'
        ? lastSeen
        : lastSeen
          ? Date.parse(String(lastSeen))
          : null
    const stale = !lastSeenMs || now - lastSeenMs > 24 * 60 * 60 * 1000
    const latestError = buildLatestError(agent)
    const modelLower = agent.model.toLowerCase()
    const paidModel = /gpt-4|gpt-5|opus|sonnet|claude|openai|anthropic/.test(
      modelLower,
    )
    const needsTyler = agent.needsSetup || agent.status === 'error'
    const blockedByMe =
      agent.needsSetup || /approval|token|credential/i.test(latestError)
    const waitingOnOthers =
      !blockedByMe &&
      (agent.jobs.some((job) => job.enabled && !job.lastRun) ||
        /waiting|queued/i.test(agent.latestSession?.status ?? ''))
    const capabilities = [
      agent.sessions.length ? 'session chat' : 'manual chat',
      agent.jobs.length ? 'scheduled jobs' : 'manual only',
      agent.workspace ? 'workspace scoped' : 'profile scoped',
    ]

    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      owner: agent.id === 'default' ? 'workspace' : agent.id,
      lastAction: agent.lastActivityAt
        ? formatRelativeTime(agent.lastActivityAt)
        : 'No action recorded',
      queue: `${agent.jobs.filter((job) => job.enabled).length} enabled / ${agent.jobs.length} total`,
      latestError,
      needsTyler,
      blockedByMe,
      waitingOnOthers,
      stale,
      staleLabel: stale ? 'stale data' : 'fresh enough',
      capabilities,
      assignment:
        agent.latestSession?.title ||
        agent.latestSession?.task ||
        'No current assignment',
      launchdStatus: agent.jobs.length ? 'cron owned' : 'no launchd job',
      processStatus:
        agent.status === 'active' ? 'session active' : 'no active process',
      sourceOwner: agent.jobs.length
        ? 'Hermes runtime'
        : agent.workspace
          ? 'Codex wrapper'
          : 'workspace UI',
      incidentHistory:
        latestError === 'No current error'
          ? ['No recent incidents']
          : [latestError, agent.latestSession?.status || 'Review profile logs'],
      modelHealth: agent.needsSetup
        ? 'setup required'
        : paidModel
          ? 'paid model guard'
          : 'local or low-cost model',
      routeHref: withBasePath(`/chat/${agent.sessionKey}`),
    }
  })
}

export function filterOperationsHealthRows(
  rows: Array<OperationsHealthRow>,
  filter: OperationsFleetFilter,
): Array<OperationsHealthRow> {
  if (filter === 'all') return rows
  if (filter === 'failed') return rows.filter((row) => row.status === 'error')
  if (filter === 'needs Tyler') return rows.filter((row) => row.needsTyler)
  if (filter === 'needs setup')
    return rows.filter((row) => row.latestError.includes('Model missing'))
  if (filter === 'noisy')
    return rows.filter(
      (row) => row.incidentHistory[0] !== 'No recent incidents',
    )
  if (filter === 'recently changed')
    return rows.filter((row) => row.stale === false)
  return rows.filter((row) => row.status === filter)
}

export function getOperationsPrimaryAction(rows: Array<OperationsHealthRow>): {
  label: string
  description: string
  filter: OperationsFleetFilter
  href?: string
} {
  if (rows.some((row) => row.status === 'error')) {
    return {
      label: 'Inspect failing agent',
      description: 'Fix current error.',
      filter: 'failed',
    }
  }
  if (rows.some((row) => row.needsTyler)) {
    return {
      label: 'Fix Tyler-blocked setup',
      description: 'Profile or credential.',
      filter: 'needs Tyler',
      href: withBasePath('/profiles'),
    }
  }
  if (rows.some((row) => row.status === 'active')) {
    return {
      label: 'Inspect active agents',
      description: 'Running work.',
      filter: 'active',
    }
  }
  return {
    label: 'Create agent',
    description: 'No urgent issue.',
    filter: 'all',
  }
}

export function OperationsScreen() {
  const search = useSearch({ from: '/operations' })
  useEffect(() => {
    seedAgentPresets()
  }, [])
  const [newAgentOpen, setNewAgentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'outputs'>('overview')
  const [fleetFilter, setFleetFilter] = useState<OperationsFleetFilter>('all')
  const [restartTarget, setRestartTarget] = useState<string | null>(null)
  const {
    agents,
    recentActivity,
    configQuery,
    sessionsQuery,
    cronJobsQuery,
    settings,
    saveSettings,
    defaultModel,
    createAgent,
    isCreatingAgent,
    saveAgent,
    isSavingAgent,
    deleteAgent,
    isDeletingAgent,
    refreshAll,
  } = useOperations()

  const isLoading =
    configQuery.isPending || sessionsQuery.isPending || cronJobsQuery.isPending
  const error =
    (configQuery.error instanceof Error && configQuery.error.message) ||
    (sessionsQuery.error instanceof Error && sessionsQuery.error.message) ||
    (cronJobsQuery.error instanceof Error && cronJobsQuery.error.message) ||
    null
  const settingsAgent =
    agents.find((agent) => agent.id === settingsAgentId) ?? null
  const fleetCounts = useMemo(
    () =>
      agents.reduce(
        (counts, agent) => {
          counts.total += 1
          counts[agent.status] += 1
          if (agent.needsSetup) counts.needsSetup += 1
          counts.jobs += agent.jobs.length
          return counts
        },
        { total: 0, active: 0, idle: 0, error: 0, needsSetup: 0, jobs: 0 },
      ),
    [agents],
  )
  const newestActivityAt = useMemo(() => {
    let newest: number | null = null
    for (const agent of agents) {
      if (agent.lastActivityAt && (!newest || agent.lastActivityAt > newest)) {
        newest = agent.lastActivityAt
      }
    }
    return newest
  }, [agents])
  const healthRows = useMemo(() => buildOperationsHealthRows(agents), [agents])
  const cockpitTiles = useMemo(
    () => buildOperationsCockpitTiles(healthRows),
    [healthRows],
  )
  const primaryAction = useMemo(
    () => getOperationsPrimaryAction(healthRows),
    [healthRows],
  )
  const filteredHealthRows = useMemo(
    () => filterOperationsHealthRows(healthRows, fleetFilter),
    [fleetFilter, healthRows],
  )
  const blockedByMe = useMemo(
    () => healthRows.filter((row) => row.blockedByMe),
    [healthRows],
  )
  const waitingOnOthers = useMemo(
    () => healthRows.filter((row) => row.waitingOnOthers),
    [healthRows],
  )

  useEffect(() => {
    if (search.create === 'agent') setNewAgentOpen(true)
  }, [search.create])

  function focusAdjacentHealthRow(
    current: HTMLElement,
    direction: 'next' | 'previous',
  ) {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('[data-operations-health-row]'),
    )
    const index = rows.indexOf(current)
    if (index === -1) return
    const nextIndex =
      direction === 'next'
        ? Math.min(rows.length - 1, index + 1)
        : Math.max(0, index - 1)
    rows[nextIndex]?.focus()
  }

  return (
    <main
      className="min-h-full bg-surface px-2 pb-[calc(var(--tabbar-h,0px)+12px)] pt-3 text-primary-900 md:px-5 md:pb-24 md:pt-8"
      style={THEME_STYLE}
    >
      <section className="mx-auto w-full max-w-[1320px] space-y-3 md:space-y-4">
        <header className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 shadow-sm md:flex-row md:flex-wrap md:items-center md:justify-between md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-accent)] shadow-sm">
              <HugeiconsIcon icon={AiBrain03Icon} size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-primary-900">
                Operations
              </h1>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              className="bg-[var(--theme-accent)] text-primary-950 hover:bg-[var(--theme-accent-strong)]"
              onClick={() => {
                if (primaryAction.href) {
                  window.location.href = primaryAction.href
                  return
                }
                if (primaryAction.label === 'Create agent') {
                  setNewAgentOpen(true)
                  return
                }
                setFleetFilter(primaryAction.filter)
              }}
            >
              {primaryAction.label}
            </Button>
            <div className="inline-flex rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setView('overview')}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height]',
                  view === 'overview'
                    ? 'bg-[var(--theme-accent)] text-primary-950'
                    : 'text-[var(--theme-muted)] hover:bg-[var(--theme-card2)]',
                )}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setView('outputs')}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height]',
                  view === 'outputs'
                    ? 'bg-[var(--theme-accent)] text-primary-950'
                    : 'text-[var(--theme-muted)] hover:bg-[var(--theme-card2)]',
                )}
              >
                Outputs
              </button>
            </div>
            <Button
              variant="secondary"
              className="border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
              onClick={() => setNewAgentOpen(true)}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.8} />
              New
            </Button>
            <Button
              variant="secondary"
              className="border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
              onClick={() => void refreshAll()}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              className="border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
              onClick={() => setSettingsOpen(true)}
            >
              <HugeiconsIcon
                icon={SlidersHorizontalIcon}
                size={16}
                strokeWidth={1.8}
              />
              Config
            </Button>
          </div>
          <div className="hidden w-full min-w-0 grid-cols-3 gap-2 text-xs md:grid lg:grid-cols-6">
            {[
              ['Agents', fleetCounts.total],
              ['Active', fleetCounts.active],
              ['Idle', fleetCounts.idle],
              ['Errors', fleetCounts.error],
              ['Setup', fleetCounts.needsSetup],
              ['Jobs', fleetCounts.jobs],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                data-testid={`operations-fleet-${String(label).toLowerCase().replace(/\s+/g, '-')}`}
                className="min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1.5"
              >
                <span className="block truncate text-[var(--theme-muted)]">
                  {label}
                </span>
                <p className="mt-0.5 text-base font-semibold text-[var(--theme-text)]">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden w-full min-w-0 flex-wrap gap-2 text-xs text-[var(--theme-muted)] md:flex">
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
              {primaryAction.description}
            </span>
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
              Last:{' '}
              {newestActivityAt
                ? formatRelativeTime(newestActivityAt)
                : 'none'}
            </span>
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
              Health:{' '}
              {error
                ? 'degraded'
                : fleetCounts.error > 0
                  ? `${fleetCounts.error} issue${fleetCounts.error === 1 ? '' : 's'}`
                  : 'ok'}
            </span>
          </div>
        </header>

        <AppSurface>
          <AppSectionHeader
            title="Agent command center"
            meta={primaryAction.description}
            action={
              <AppStatusPill
                tone={
                  error || fleetCounts.error > 0
                    ? 'red'
                    : fleetCounts.needsSetup > 0
                      ? 'amber'
                      : 'green'
                }
              >
                {error
                  ? 'Offline'
                  : fleetCounts.error > 0
                    ? 'Repair'
                    : fleetCounts.needsSetup > 0
                      ? 'Setup'
                      : 'Ready'}
              </AppStatusPill>
            }
          />
          <div
            aria-label="Agent operations cockpit"
            className="grid grid-cols-2 gap-2 lg:grid-cols-5"
          >
            {cockpitTiles.map((tile) => (
              <AppTile
                key={tile.id}
                title={tile.label}
                value={tile.value}
                detail={tile.detail}
                icon={OPERATIONS_TILE_ICONS[tile.id] ?? Task01Icon}
                tone={appToneForOperations(tile.tone)}
                actionLabel={tile.id === 'freshness' ? 'Check' : 'Open'}
                className="min-h-[118px]"
                onClick={() => setFleetFilter(tile.filter)}
              />
            ))}
          </div>
        </AppSurface>

        {isLoading ? (
          <section className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-6 py-12 text-center text-sm text-[var(--theme-muted)] shadow-[0_24px_80px_var(--theme-shadow)]">
            Loading Operations roster…
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-6 py-12 text-center text-sm text-[var(--theme-text)] shadow-[0_24px_80px_var(--theme-shadow)]">
            <p>{error}</p>
            <Button
              className="mt-4 bg-[var(--theme-accent)] text-primary-950 hover:bg-[var(--theme-accent-strong)]"
              onClick={() => void refreshAll()}
            >
              Retry Operations data
            </Button>
          </section>
        ) : view === 'outputs' ? (
          <FullOutputsView />
        ) : (
          <>
            <section className="grid min-w-0 gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <div className="min-w-0 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--theme-text)]">
                      Health
                    </h2>
                    <p className="mt-1 text-sm text-[var(--theme-muted)]">
                      State, queue, error.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)]"
                      onClick={() => void refreshAll()}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {OPERATIONS_FLEET_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setFleetFilter(filter)}
                      className={cn(
                        'rounded-xl border px-3 py-1.5 text-xs capitalize transition-colors',
                        fleetFilter === filter
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-primary-950'
                          : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-muted)]',
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {filteredHealthRows.map((row) => (
                    <article
                      key={row.id}
                      tabIndex={0}
                      data-operations-health-row
                      aria-label={`${row.name} operations health card`}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault()
                          focusAdjacentHealthRow(event.currentTarget, 'next')
                        }
                        if (event.key === 'ArrowUp') {
                          event.preventDefault()
                          focusAdjacentHealthRow(
                            event.currentTarget,
                            'previous',
                          )
                        }
                      }}
                      className="rounded-[22px] border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--theme-accent)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3
                            className="truncate text-sm font-semibold text-[var(--theme-text)]"
                            title={row.name}
                          >
                            {compactOperationsLabel(row.name)}
                          </h3>
                          <p
                            className="mt-1 truncate text-[11px] text-[var(--theme-muted)]"
                            title={`${row.owner} · ${row.sourceOwner}`}
                          >
                            {row.owner}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize',
                            statusTone(row.status),
                          )}
                        >
                          {row.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                            Queue
                          </span>
                          <span
                            className="mt-1 block truncate text-[var(--theme-text)]"
                            title={row.queue}
                          >
                            {row.queue}
                          </span>
                        </div>
                        <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                            Process
                          </span>
                          <span
                            className="mt-1 block truncate text-[var(--theme-text)]"
                            title={`${row.launchdStatus} · ${row.processStatus}`}
                          >
                            {row.launchdStatus === 'no launchd job' &&
                            row.processStatus === 'no active process'
                              ? 'offline'
                              : row.processStatus}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--theme-muted)]">
                        {row.latestError}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              'rounded-full border px-2 py-1 text-[10px] font-semibold',
                              statusTone(
                                row.status,
                                row.latestError.includes('Model missing'),
                              ),
                            )}
                          >
                            {row.staleLabel}
                          </span>
                          {row.needsTyler ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900">
                              Tyler
                            </span>
                          ) : null}
                        </div>
                        <a
                          href={row.routeHref}
                          className="inline-flex min-h-9 items-center rounded-full bg-[var(--theme-accent)] px-3 text-xs font-semibold text-primary-950 transition-transform active:scale-95"
                        >
                          Chat
                        </a>
                      </div>
                    </article>
                  ))}
                  {filteredHealthRows.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-8 text-center text-sm text-[var(--theme-muted)] md:col-span-2">
                      No matches.
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="grid min-w-0 gap-3">
                <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm md:hidden">
                  <h2 className="text-base font-semibold text-[var(--theme-text)]">
                    Mobile Commander
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setFleetFilter('failed')}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-left"
                    >
                      Failed {fleetCounts.error}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFleetFilter('needs setup')}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-left"
                    >
                      Blocked {blockedByMe.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFleetFilter('active')}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-left"
                    >
                      Active {fleetCounts.active}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestartTarget('workspace')}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-left"
                    >
                      Preflight
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
                  <h2 className="text-base font-semibold text-[var(--theme-text)]">
                    Tyler
                  </h2>
                  <div className="mt-3 space-y-2">
                    {blockedByMe.slice(0, 4).map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        <div className="font-medium">{row.name}</div>
                        <div className="mt-1 text-xs">{row.latestError}</div>
                      </div>
                    ))}
                    {blockedByMe.length === 0 ? (
                      <p className="text-sm text-[var(--theme-muted)]">
                        Clear.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm md:block">
                  <h2 className="text-base font-semibold text-[var(--theme-text)]">
                    Waiting
                  </h2>
                  <div className="mt-3 space-y-2">
                    {waitingOnOthers.slice(0, 4).map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-[var(--theme-text)]">
                          {row.name}
                        </div>
                        <div className="mt-1 text-xs text-[var(--theme-muted)]">
                          {row.assignment}
                        </div>
                      </div>
                    ))}
                    {waitingOnOthers.length === 0 ? (
                      <p className="text-sm text-[var(--theme-muted)]">
                        Clear.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm md:block">
                  <h2 className="text-base font-semibold text-[var(--theme-text)]">
                    Restart
                  </h2>
                  <div className="mt-3 grid gap-2">
                    {[
                      'gateway',
                      'workspace',
                      'LILY worker',
                      'selected agents',
                    ].map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => setRestartTarget(target)}
                        className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-left text-sm text-[var(--theme-text)]"
                      >
                        {target}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-xs text-[var(--theme-muted)]">
                    Preflight checks.
                    {restartTarget ? (
                      <span className="mt-1 block font-medium text-[var(--theme-text)]">
                        {restartTarget}
                      </span>
                    ) : null}
                  </div>
                </section>
              </aside>
            </section>

            <section className="hidden gap-4 md:grid lg:grid-cols-3">
              <details
                className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm"
              >
                <summary className="cursor-pointer text-base font-semibold text-[var(--theme-text)]">
                  Incidents
                </summary>
                <div className="mt-3 space-y-2">
                  {healthRows.slice(0, 6).map((row) => (
                    <div
                      key={`incident-${row.id}`}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-[var(--theme-text)]">
                        {row.name}
                      </div>
                      <div className="mt-1 text-xs text-[var(--theme-muted)]">
                        {row.incidentHistory.join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <details
                className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm"
              >
                <summary className="cursor-pointer text-base font-semibold text-[var(--theme-text)]">
                  Dependencies
                </summary>
                <div className="mt-3 space-y-2">
                  {healthRows.slice(0, 6).map((row) => (
                    <div
                      key={`dependency-${row.id}`}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-[var(--theme-text)]">
                        {row.name}
                      </div>
                      <div
                        className="mt-1 text-xs text-[var(--theme-muted)]"
                        title={`Jobs/scripts: ${row.queue} · assignment: ${row.assignment}`}
                      >
                        {row.queue}
                      </div>
                      <div
                        className="mt-1 text-xs text-[var(--theme-muted)]"
                        title={`Tools: ${row.capabilities.join(', ')}`}
                      >
                        {row.capabilities.length} tools
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <details
                className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm"
              >
                <summary className="cursor-pointer text-base font-semibold text-[var(--theme-text)]">
                  Output
                </summary>
                <div className="mt-3 space-y-2">
                  {healthRows.slice(0, 6).map((row) => (
                    <div
                      key={`diff-${row.id}`}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-[var(--theme-text)]">
                        {row.name}
                      </div>
                      <div className="mt-1 text-xs text-[var(--theme-muted)]">
                        {row.modelHealth}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>

            <motion.div
              className="hidden md:block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <OrchestratorCard totalAgents={agents.length} />
            </motion.div>

            <section className="hidden grid-cols-1 gap-3 md:grid sm:grid-cols-2 xl:grid-cols-3">
              {agents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-8 text-sm text-[var(--theme-muted)] shadow-[0_24px_80px_var(--theme-shadow)] sm:col-span-2 xl:col-span-3">
                  <p className="font-medium text-[var(--theme-text)]">
                    No agents
                  </p>
                  <p className="mt-1">
                    Create one to route work.
                  </p>
                  <Button
                    className="mt-4 bg-[var(--theme-accent)] text-primary-950 hover:bg-[var(--theme-accent-strong)]"
                    onClick={() => setNewAgentOpen(true)}
                  >
                    <HugeiconsIcon
                      icon={PlusSignIcon}
                      size={16}
                      strokeWidth={1.8}
                    />
                    Create
                  </Button>
                </div>
              ) : (
                agents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.22 }}
                  >
                    <OperationsAgentCard
                      agent={agent}
                      onOpenSettings={(agentId) => setSettingsAgentId(agentId)}
                    />
                  </motion.div>
                ))
              )}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: agents.length * 0.04, duration: 0.22 }}
                onClick={() => setNewAgentOpen(true)}
                className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-center shadow-sm transition-colors hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]"
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  size={32}
                  strokeWidth={1.7}
                  className="text-[var(--theme-muted)]"
                />
                <span className="mt-3 text-sm text-[var(--theme-muted)]">
                  Add
                </span>
              </motion.button>
            </section>

            <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm md:block">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--theme-text)]">
                    Activity
                  </h2>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => {
                    const agent = agents.find(
                      (entry) => entry.id === activity.agentId,
                    )
                    return (
                      <div
                        key={activity.id}
                        className="flex flex-col gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <p className="text-sm text-[var(--theme-text)]">
                          <span className="mr-2">
                            {agent?.meta.emoji ?? '🤖'}
                          </span>
                          <span className="font-medium">
                            {agent?.name ?? activity.agentId}:
                          </span>{' '}
                          {activity.summary}
                        </p>
                        <span className="shrink-0 text-sm text-[var(--theme-muted)]">
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-6 text-sm text-[var(--theme-muted)]">
                    Clear.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>

      <OperationsNewAgentModal
        open={newAgentOpen}
        defaultModel={defaultModel}
        onClose={() => setNewAgentOpen(false)}
        onCreate={createAgent}
        isSaving={isCreatingAgent}
      />

      <OperationsSettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />

      <OperationsAgentDetail
        open={Boolean(settingsAgent)}
        agent={settingsAgent}
        onClose={() => setSettingsAgentId(null)}
        onSave={saveAgent}
        onDelete={async (agentId) => {
          await deleteAgent(agentId)
          setSettingsAgentId((current) =>
            current === agentId ? null : current,
          )
        }}
        isSaving={isSavingAgent}
        isDeleting={isDeletingAgent}
      />
    </main>
  )
}
