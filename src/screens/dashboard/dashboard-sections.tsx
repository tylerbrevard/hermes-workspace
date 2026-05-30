import {
  BubbleChatAddIcon,
  CheckmarkCircle02Icon,
  ConsoleIcon,
  Copy01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import {
  GlassCard,
  SecondaryAction,
  formatNumber,
  themeColor,
} from './dashboard-ui'
import { DASHBOARD_WORKFLOW_PRESETS } from './lib/command-center'
import type { buildWeeklyWorkspaceUtilizationReport } from './lib/weekly-utilization-report'
import type { SessionRowData } from './components/sessions-intelligence-card'
import type { PhoneCockpitSnapshot } from '@/server/phone-cockpit'
import {
  formatWorkspaceFreshness,
  isWorkspaceSourceStale,
} from '@/lib/source-freshness'
import { cn } from '@/lib/utils'

export type ActionRequiredItem = {
  id: string
  severity: 'error' | 'warn' | 'info'
  label: string
  detail: string
  action: string
  onClick: () => void
}

export type LilyDashboardConfig = {
  ok?: boolean
  configured?: boolean
  agentName?: string
  serverUrl?: string
  voiceWorker?: {
    status?: 'online' | 'offline' | 'unknown' | 'not_configured'
    checkedAt?: string
    detail?: string
    source?: string | null
  }
  error?: string
}

export function ActionRequiredRail({
  items,
}: {
  items: Array<ActionRequiredItem>
}) {
  const visible = items.slice(0, 4)
  if (visible.length === 0) {
    return (
      <GlassCard accentColor={themeColor('--theme-success', '#22c55e')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Action Required
            </div>
            <div className="mt-1 text-sm font-medium text-ink">
              No broken connections or stale dashboard data detected.
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-500">
            Clear
          </span>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      title="Action Required"
      titleRight={
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          ranked recovery
        </span>
      }
      accentColor={themeColor('--theme-warning', '#f59e0b')}
    >
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
        {visible.map((item) => {
          const tone =
            item.severity === 'error'
              ? 'var(--theme-danger)'
              : item.severity === 'warn'
                ? 'var(--theme-warning)'
                : 'var(--theme-accent)'
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="group flex min-h-[92px] flex-col justify-between rounded-lg border bg-[var(--theme-card2)] px-3 py-2.5 text-left transition hover:border-[var(--theme-accent-border)]"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: tone }}
                  />
                  <span className="truncate text-xs font-semibold text-ink">
                    {item.label}
                  </span>
                  <span
                    className="ml-auto rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: `${tone}66`,
                      color: tone,
                      background:
                        'color-mix(in srgb, currentColor 10%, transparent)',
                    }}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted">
                  {item.detail}
                </p>
              </div>
              <span
                className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: tone }}
              >
                {item.action}
              </span>
            </button>
          )
        })}
      </div>
    </GlassCard>
  )
}

export function LilyReadinessCard({
  config,
  loading,
  error,
  onOpen,
  onRefresh,
}: {
  config: LilyDashboardConfig | null
  loading: boolean
  error: boolean
  onOpen: () => void
  onRefresh: () => void
}) {
  const worker = config?.voiceWorker
  const workerStatus = worker?.status ?? 'unknown'
  const liveKitReady = Boolean(config?.configured)
  const workerReady = workerStatus === 'online'
  const tone = error
    ? 'var(--theme-danger)'
    : liveKitReady && workerReady
      ? 'var(--theme-success)'
      : 'var(--theme-warning)'
  const statusText = error
    ? 'Config unavailable'
    : loading && !config
      ? 'Checking voice stack'
      : liveKitReady && workerReady
        ? 'Ready for hands-free mode'
        : liveKitReady
          ? 'LiveKit ready, worker needs attention'
          : 'LiveKit keys needed'

  return (
    <GlassCard title="LILY Voice" accentColor={tone}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{statusText}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
            {worker?.detail ||
              (liveKitReady
                ? `${config?.agentName || 'lily'} transport configured.`
                : 'Add LiveKit credentials before full media-room voice works.')}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
            <span className="rounded-full border border-[var(--theme-border)] px-2 py-1 text-muted">
              LiveKit {liveKitReady ? 'ready' : 'missing'}
            </span>
            <span className="rounded-full border border-[var(--theme-border)] px-2 py-1 text-muted">
              Worker {workerStatus.replace('_', ' ')}
            </span>
            {worker?.checkedAt ? (
              <span className="rounded-full border border-[var(--theme-border)] px-2 py-1 text-muted">
                {formatWorkspaceFreshness(worker.checkedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <SecondaryAction
            label="Open Lily"
            icon={BubbleChatAddIcon}
            onClick={onOpen}
          />
          <SecondaryAction
            label="Refresh"
            icon={ConsoleIcon}
            onClick={onRefresh}
            disabled={loading}
          />
        </div>
      </div>
    </GlassCard>
  )
}

function SourceFreshnessBadge({
  source,
}: {
  source?: PhoneCockpitSnapshot['sources'][keyof PhoneCockpitSnapshot['sources']]
}) {
  const fresh =
    Boolean(source?.ok) &&
    !isWorkspaceSourceStale(source?.checkedAt, 10 * 60_000)
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
        fresh
          ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-500'
          : 'border-amber-300/40 bg-amber-300/10 text-amber-500',
      )}
      title={source?.error || source?.label || 'Source freshness'}
    >
      {source?.ok ? formatWorkspaceFreshness(source.checkedAt) : 'degraded'}
    </span>
  )
}

function DailySignalTile({
  label,
  value,
  detail,
  source,
}: {
  label: string
  value: string
  detail: string
  source?: PhoneCockpitSnapshot['sources'][keyof PhoneCockpitSnapshot['sources']]
}) {
  return (
    <div className="flex min-h-[112px] flex-col justify-between rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {label}
          </div>
          <div className="mt-1 truncate text-xl font-bold tabular-nums text-ink">
            {value}
          </div>
        </div>
        <SourceFreshnessBadge source={source} />
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{detail}</p>
    </div>
  )
}

export function DailySignalsCard({
  snapshot,
  loading,
  error,
  onOpenPhone,
  onOpenMeetings,
  onRefresh,
}: {
  snapshot: PhoneCockpitSnapshot | null
  loading: boolean
  error: boolean
  onOpenPhone: () => void
  onOpenMeetings: () => void
  onRefresh: () => void
}) {
  const degradedSources = Object.values(snapshot?.sources ?? {}).filter(
    (source) => !source.ok,
  )
  const inboxValue =
    snapshot?.inbox.unread === null || snapshot?.inbox.unread === undefined
      ? '—'
      : String(snapshot.inbox.unread)
  const meetingStats = snapshot?.schedule.stats
  const openMeetingActions =
    snapshot?.meetingPrep.openActionItems.length ??
    meetingStats?.openActionItems ??
    0
  const desk = snapshot?.devices.office
  const deskLabel = desk?.status
    ? desk.status === 'online'
      ? 'Desk online'
      : `Desk ${desk.status}`
    : 'Desk unknown'
  const presence =
    snapshot?.presence.activity || snapshot?.presence.availability
  const sourceHealth = snapshot
    ? degradedSources.length === 0
      ? 'All sources reporting'
      : `${degradedSources.length} source${degradedSources.length === 1 ? '' : 's'} degraded`
    : loading
      ? 'Loading daily sources'
      : 'Daily sources unavailable'

  return (
    <GlassCard
      title="Daily Signals"
      titleRight={
        <span
          className={cn(
            'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
            error || degradedSources.length > 0
              ? 'border-amber-300/40 bg-amber-300/10 text-amber-500'
              : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-500',
          )}
        >
          {sourceHealth}
        </span>
      }
      accentColor={
        error || degradedSources.length > 0
          ? 'var(--theme-warning)'
          : 'var(--theme-success)'
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DailySignalTile
          label="Inbox Zero"
          value={inboxValue}
          detail={
            snapshot?.inbox.warning ||
            `${snapshot?.inbox.focused.length ?? 0} focused messages need review.`
          }
          source={snapshot?.sources.mail}
        />
        <DailySignalTile
          label="Meeting Actions"
          value={String(openMeetingActions)}
          detail={
            snapshot?.meetingPrep.warning ||
            `${meetingStats?.reviewedMeetings ?? 0}/${meetingStats?.totalMeetings ?? 0} meetings reviewed today.`
          }
          source={snapshot?.sources.meetingPrep ?? snapshot?.sources.calendar}
        />
        <DailySignalTile
          label="Teams & Desk"
          value={presence || 'Unknown'}
          detail={`${deskLabel}${desk?.displayMode ? ` · ${desk.displayMode}` : ''}${desk?.quietHours ? ' · quiet hours' : ''}`}
          source={snapshot?.sources.presence ?? snapshot?.sources.devices}
        />
        <DailySignalTile
          label="Data Health"
          value={
            degradedSources.length === 0 ? 'OK' : `${degradedSources.length}`
          }
          detail={
            degradedSources[0]?.error ||
            `Checked ${Object.keys(snapshot?.sources ?? {}).length} cockpit sources.`
          }
          source={snapshot?.sources.devices}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryAction
          label="Open Phone"
          icon={BubbleChatAddIcon}
          onClick={onOpenPhone}
        />
        <SecondaryAction
          label="Meetings"
          icon={ConsoleIcon}
          onClick={onOpenMeetings}
        />
        <SecondaryAction
          label="Refresh"
          icon={ConsoleIcon}
          onClick={onRefresh}
          disabled={loading}
        />
      </div>
    </GlassCard>
  )
}

export function WeeklyUtilizationReportCard({
  report,
}: {
  report: ReturnType<typeof buildWeeklyWorkspaceUtilizationReport>
}) {
  const [copied, setCopied] = useState(false)

  async function copyReport() {
    await navigator.clipboard.writeText(report.markdown)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <GlassCard
      title="Weekly Utilization"
      titleRight={
        <span className="rounded-full border border-[var(--theme-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          {report.weekLabel}
        </span>
      }
      accentColor="var(--theme-accent)"
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {report.metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {metric.label}
            </div>
            <div className="mt-1 truncate text-lg font-bold tabular-nums text-ink">
              {metric.value}
            </div>
            {metric.detail ? (
              <div className="mt-1 truncate text-[11px] text-muted">
                {metric.detail}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Heaviest sessions
          </div>
          <div className="mt-2 space-y-1.5">
            {report.topSessions.length > 0 ? (
              report.topSessions.slice(0, 3).map((session) => (
                <div
                  key={session.key}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 truncate text-ink">
                    {session.title}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatNumber(session.tokenCount)} tokens
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted">
                No sessions reported in the last seven days.
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Recommended next action
          </div>
          <div className="mt-2 text-sm font-medium text-ink">
            {report.recommendedActions[0]?.label}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
            {report.recommendedActions[0]?.detail}
          </div>
          <button
            type="button"
            onClick={() => void copyReport()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--theme-border)] px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-[var(--theme-card)]"
          >
            <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.7} />
            {copied ? 'Copied report' : 'Copy report'}
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

export function DashboardOperationsBand({
  actionItems,
  dashboardStale,
  sessionsStale,
  overviewUpdatedAt,
  sessionsFreshness,
  onOpenTasks,
  onOpenTerminal,
  onOpenOpsIntelligence,
}: {
  actionItems: Array<ActionRequiredItem>
  dashboardStale: boolean
  sessionsStale: boolean
  overviewUpdatedAt: string | number | null
  sessionsFreshness: string | number | null
  onOpenTasks: () => void
  onOpenTerminal: () => void
  onOpenOpsIntelligence: () => void
}) {
  const [workflowPreset, setWorkflowPreset] =
    useState<(typeof DASHBOARD_WORKFLOW_PRESETS)[number]>('Morning')
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)
  const blockedByMe = actionItems.filter((item) =>
    /tyler|credential|approval|manual/i.test(`${item.label} ${item.detail}`),
  )
  const waitingOnOthers = actionItems.filter(
    (item) => !blockedByMe.includes(item),
  )
  const recentEvents = [
    `Overview refreshed ${formatWorkspaceFreshness(overviewUpdatedAt)}`,
    `Sessions refreshed ${formatWorkspaceFreshness(sessionsFreshness)}`,
    `${actionItems.length} action item${actionItems.length === 1 ? '' : 's'} ranked`,
    dashboardStale ? 'Dashboard source stale' : 'Dashboard source fresh',
    sessionsStale ? 'Session source stale' : 'Session source fresh',
  ]

  return (
    <GlassCard title="Control" accentColor="var(--theme-accent)">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.45fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_WORKFLOW_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setWorkflowPreset(preset)}
                className={cn(
                  'min-h-9 rounded-lg border px-3 text-xs font-semibold',
                  workflowPreset === preset
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-card2)] text-[var(--theme-accent)]'
                    : 'border-[var(--theme-border)] text-muted',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <details className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Guardrails
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
              <span className="rounded-full border border-[var(--theme-border)] px-2 py-1">
                Cost guard
              </span>
              <span className="rounded-full border border-[var(--theme-border)] px-2 py-1">
                Model fallback
              </span>
              <span className="rounded-full border border-[var(--theme-border)] px-2 py-1">
                Terminal repair
              </span>
              <span className="rounded-full border border-[var(--theme-border)] px-2 py-1">
                Edit layout
              </span>
            </div>
          </details>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Blocked by me
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                {blockedByMe.length} item{blockedByMe.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Waiting on others
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                {waitingOnOthers.length} item
                {waitingOnOthers.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenTerminal}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
              aria-label="Open source details in Terminal"
              title="Open source details"
            >
              <HugeiconsIcon icon={ConsoleIcon} size={14} strokeWidth={1.7} />
              Source
            </button>
            <button
              type="button"
              onClick={onOpenTasks}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
              aria-label="Pin weekly action to Tasks"
              title="Pin weekly action to Tasks"
            >
              <HugeiconsIcon
                icon={BubbleChatAddIcon}
                size={14}
                strokeWidth={1.7}
              />
              Pin
            </button>
            <button
              type="button"
              onClick={() => setWarningAcknowledged(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
              aria-label={
                warningAcknowledged
                  ? 'Warnings acknowledged'
                  : 'Acknowledge warnings'
              }
              title={
                warningAcknowledged
                  ? 'Warnings acknowledged'
                  : 'Acknowledge warnings'
              }
            >
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={14}
                strokeWidth={1.7}
              />
              {warningAcknowledged
                ? 'Acked'
                : 'Ack'}
            </button>
            <button
              type="button"
              onClick={onOpenOpsIntelligence}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
              aria-label="Open changes since last visit"
              title="What changed since last visit"
            >
              Changes
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted md:hidden">
            <span>Needs Tyler</span>
            <span>Next meeting</span>
            <span>Urgent task</span>
            <span>Stale source</span>
            <span>Inbox</span>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Severity colors
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full border border-red-300/40 px-2 py-1 text-red-500">
                critical
              </span>
              <span className="rounded-full border border-amber-300/40 px-2 py-1 text-amber-500">
                warning
              </span>
              <span className="rounded-full border border-cyan-300/40 px-2 py-1 text-cyan-500">
                info
              </span>
              <span className="rounded-full border border-emerald-300/40 px-2 py-1 text-emerald-500">
                healthy
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Recent events
            </div>
            <ol className="mt-2 space-y-1 text-xs text-muted">
              {recentEvents.map((event) => (
                <li key={event}>{event}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

export function DashboardFlowRail({
  actionItems,
  latestSession,
  overviewUpdatedAt,
  sessionsFreshness,
  dashboardStale,
  sessionsStale,
  healthScore,
  statusBrief,
  onOpenTasks,
  onOpenTodayTasks,
  onOpenMeetings,
  onNewChat,
  onResume,
  onRefreshAll,
}: {
  actionItems: Array<ActionRequiredItem>
  latestSession: SessionRowData | null
  overviewUpdatedAt: string | null
  sessionsFreshness: string | number | null
  dashboardStale: boolean
  sessionsStale: boolean
  healthScore: number
  statusBrief: string
  onOpenTasks: () => void
  onOpenTodayTasks: () => void
  onOpenMeetings: () => void
  onNewChat: () => void
  onResume: () => void
  onRefreshAll: () => void
}) {
  const [statusCopied, setStatusCopied] = useState(false)
  const highestPriority = actionItems[0] ?? null
  const rankedActions = actionItems.slice(0, 3)
  const needsTylerCount = actionItems.length
  const latestTitle = latestSession?.title || 'No recent workstream'

  async function copyStatusBrief() {
    await navigator.clipboard.writeText(statusBrief)
    setStatusCopied(true)
    window.setTimeout(() => setStatusCopied(false), 1600)
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <GlassCard
        title="Start Here"
        titleRight={
          <span className="rounded-full border border-[var(--theme-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {needsTylerCount} need Tyler
          </span>
        }
        accentColor={
          needsTylerCount > 0 ? 'var(--theme-warning)' : 'var(--theme-success)'
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-ink">
              {highestPriority?.label ?? 'No operator blockers'}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
              {highestPriority?.detail ??
                'Gateway, sessions, and LILY checks have no immediate action.'}
            </p>
          </div>
          {rankedActions.length > 0 ? (
            <ol className="space-y-1.5">
              {rankedActions.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2.5 py-2 text-xs"
                >
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--theme-accent)]">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="min-w-0 text-left"
                  >
                    <span className="block line-clamp-1 font-medium text-ink">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block line-clamp-1 text-muted">
                      {item.detail}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <SecondaryAction
              label={highestPriority?.action ?? 'Open Tasks'}
              icon={CheckmarkCircle02Icon}
              onClick={highestPriority?.onClick ?? onOpenTasks}
              title="Open the highest priority task focus"
            />
            <SecondaryAction
              label="Meetings"
              icon={ConsoleIcon}
              onClick={onOpenMeetings}
              title="Open Meetings"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard
        title="Now"
        titleRight={
          <span
            className={cn(
              'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
              sessionsStale
                ? 'border-amber-300/40 bg-amber-300/10 text-amber-500'
                : 'border-cyan-300/30 bg-cyan-300/10 text-cyan-500',
            )}
          >
            sessions {formatWorkspaceFreshness(sessionsFreshness)}
          </span>
        }
        accentColor="var(--theme-accent)"
      >
        <div className="space-y-3">
          <div>
            <div className="line-clamp-1 text-sm font-semibold text-ink">
              {latestTitle}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              Resume the most recent workstream or start a clean chat.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <SecondaryAction
              label="Resume"
              icon={BubbleChatAddIcon}
              onClick={onResume}
              disabled={!latestSession}
              title="Resume latest workstream"
            />
            <SecondaryAction
              label="New Chat"
              icon={BubbleChatAddIcon}
              onClick={onNewChat}
              title="New Chat"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard
        title="Next"
        titleRight={
          <span
            className={cn(
              'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
              dashboardStale
                ? 'border-amber-300/40 bg-amber-300/10 text-amber-500'
                : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-500',
            )}
          >
            overview {formatWorkspaceFreshness(overviewUpdatedAt)}
          </span>
        }
        accentColor="var(--theme-success)"
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-ink">
              Verify and close loops
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              Refresh stale evidence first.
            </p>
            <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Health score
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-ink">
                {healthScore}/100
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <SecondaryAction
              label="Refresh All"
              icon={ConsoleIcon}
              onClick={onRefreshAll}
              title="Refresh All"
            />
            <SecondaryAction
              label="Open Tasks"
              icon={CheckmarkCircle02Icon}
              onClick={onOpenTodayTasks}
              title="Open Tasks"
            />
            <SecondaryAction
              label={statusCopied ? 'Copied brief' : 'Copy status brief'}
              icon={Copy01Icon}
              onClick={() => void copyStatusBrief()}
              title="Copy status brief"
            />
          </div>
        </div>
      </GlassCard>

    </div>
  )
}
