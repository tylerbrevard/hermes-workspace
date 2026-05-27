import {
  BubbleChatAddIcon,
  CheckmarkCircle02Icon,
  ConsoleIcon,
  Copy01Icon,
  Edit02Icon,
  Moon02Icon,
  PuzzleIcon,
  Settings02Icon,
  Sun02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AchievementsCard } from './components/achievements-card'
import { ActiveModelKpi } from './components/active-model-kpi'
import { AnalyticsChartCard } from './components/analytics-chart-card'
import { AttentionMarquee } from './components/attention-marquee'
import { CacheEfficiencyCard } from './components/cache-efficiency-card'
import { CostLedgerCard } from './components/cost-ledger-card'
import { DashboardCommandStrip } from './components/dashboard-command-strip'
import { EditModePanel } from './components/edit-mode-panel'
import { HeroMetrics } from './components/hero-metrics'
import { LogsTailCard } from './components/logs-tail-card'
import { OperatorTipCard } from './components/operator-tip-card'
import { OpsStrip } from './components/ops-strip'
import { ProviderMixCard } from './components/provider-mix-card'
import { SessionsIntelligenceCard } from './components/sessions-intelligence-card'
import { SkillsUsageCard } from './components/skills-usage-card'
import { TokenMixHourCard } from './components/token-mix-hour-card'
import { TopModelsCard } from './components/top-models-card'
import { VelocityCard } from './components/velocity-card'
import { WidgetShell } from './components/widget-shell'
import {
  DASHBOARD_WORKFLOW_PRESETS,
  buildDashboardDiagnostics,
  buildDashboardNextAction,
  buildDashboardStatusBrief,
  calculateDashboardHealthScore,
} from './lib/command-center'
import { normalizeDashboardSessionsPayload } from './lib/sessions-query'
import { useDashboardLayout } from './lib/use-dashboard-layout'
import { buildWeeklyWorkspaceUtilizationReport } from './lib/weekly-utilization-report'
import type { SessionRowData } from './components/sessions-intelligence-card'
import type { AnalyticsPeriod } from './components/analytics-chart-card'
import type { ReactNode } from 'react'
import type { ClaudeSession } from '@/server/claude-api'
import type { DashboardOverview } from '@/server/dashboard-aggregator'
import type { PhoneCockpitSnapshot } from '@/server/phone-cockpit'
import { apiPath } from '@/lib/base-path'
import { getUnavailableReason } from '@/lib/feature-gates'
import {
  formatWorkspaceFreshness,
  isWorkspaceSourceStale,
} from '@/lib/source-freshness'
import { cn } from '@/lib/utils'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'
import { openHamburgerMenu } from '@/components/mobile-hamburger-menu'
import { useFeatureAvailable } from '@/hooks/use-feature-available'

// `IconSvgObject` isn't exported from @hugeicons/react; reuse the
// inferred type from a real icon import for prop typing.
type HugeIcon = typeof Settings02Icon

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function themeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

function alpha(color: string, amount: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(amount * 100)))
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

function readDashboardPalette() {
  return {
    accent: themeColor('--theme-accent', '#6366f1'),
    accentSecondary: themeColor('--theme-accent-secondary', '#8b5cf6'),
    success: themeColor('--theme-success', '#22c55e'),
    warning: themeColor('--theme-warning', '#f59e0b'),
    danger: themeColor('--theme-danger', '#ef4444'),
    muted: themeColor('--theme-muted', '#6b7280'),
    border: themeColor('--theme-border', '#333333'),
    card: themeColor('--theme-card', '#1a1a2e'),
    text: themeColor('--theme-text', '#e5e7eb'),
  }
}

function useDashboardPalette() {
  const [palette, setPalette] = useState(readDashboardPalette)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const refresh = () => setPalette(readDashboardPalette())
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class'],
    })
    return () => observer.disconnect()
  }, [])

  return palette
}

// ── Glass Card ───────────────────────────────────────────────────

function GlassCard({
  title,
  titleRight,
  accentColor,
  noPadding,
  className,
  children,
}: {
  title?: string
  titleRight?: ReactNode
  accentColor?: string
  noPadding?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border transition-colors',
        className,
      )}
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
      }}
    >
      {accentColor && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)`,
          }}
        />
      )}
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            {title}
          </h3>
          {titleRight}
        </div>
      )}
      <div className={cn('flex-1', noPadding ? '' : 'px-5 pb-4 pt-3')}>
        {children}
      </div>
      <div className="border-t border-[var(--theme-border)] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Source workspace · freshness live · owner Hermes · last success recent
      </div>
    </div>
  )
}

function EnhancedBadge({ label = 'Enhanced API' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        border: `1px solid ${themeColor('--theme-accent-border', 'rgba(245, 158, 11, 0.28)')}`,
        background: themeColor(
          '--theme-accent-subtle',
          'rgba(245, 158, 11, 0.12)',
        ),
        color: themeColor('--theme-accent', '#f59e0b'),
      }}
    >
      {label}
    </span>
  )
}

function UnavailableWidget({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <GlassCard
      title={title}
      titleRight={<EnhancedBadge />}
      accentColor={themeColor('--theme-warning', '#f59e0b')}
      className="h-full"
    >
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-card2)] px-4 text-center">
        <p className="text-sm text-muted">{description}</p>
      </div>
    </GlassCard>
  )
}

type ActionRequiredItem = {
  id: string
  severity: 'error' | 'warn' | 'info'
  label: string
  detail: string
  action: string
  onClick: () => void
}

type LilyDashboardConfig = {
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

function ActionRequiredRail({ items }: { items: Array<ActionRequiredItem> }) {
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

function LilyReadinessCard({
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

function DailySignalsCard({
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

function WeeklyUtilizationReportCard({
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

function DashboardOperationsBand({
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
  overviewUpdatedAt: string | null
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
    <GlassCard
      title="Dashboard Control Plane"
      accentColor="var(--theme-accent)"
    >
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
              Details band
            </summary>
            <div className="mt-2 grid gap-2 text-xs text-muted md:grid-cols-2">
              <span>
                Cost guard: paid-call guard active; model fallback ready.
              </span>
              <span>Repair CTA: stale gateway or sessions open Terminal.</span>
              <span>
                Empty states: unavailable sources show recovery guidance.
              </span>
              <span>
                Per-card controls: use Edit layout to hide or pin widgets per
                workflow mode.
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
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
            >
              Open source details
            </button>
            <button
              type="button"
              onClick={onOpenTasks}
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
            >
              Pin weekly action to Tasks
            </button>
            <button
              type="button"
              onClick={() => setWarningAcknowledged(true)}
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
            >
              {warningAcknowledged
                ? 'Warnings acknowledged'
                : 'Acknowledge warnings'}
            </button>
            <button
              type="button"
              onClick={onOpenOpsIntelligence}
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-ink"
            >
              What changed since last visit
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
              Last five workspace events
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

function useDailyChecklist(storageKey: string, labels: Array<string>) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const key = `${storageKey}:${todayKey}`
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(window.localStorage.getItem(key) || '{}') as Record<
        string,
        boolean
      >
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, JSON.stringify(checked))
  }, [checked, key])

  return {
    checked,
    toggle: (label: string) =>
      setChecked((current) => ({ ...current, [label]: !current[label] })),
    complete: labels.filter((label) => checked[label]).length,
  }
}

function ChecklistRows({
  storageKey,
  labels,
}: {
  storageKey: string
  labels: Array<string>
}) {
  const checklist = useDailyChecklist(storageKey, labels)
  return (
    <div className="mt-3 space-y-1.5">
      {labels.map((label) => (
        <label
          key={label}
          className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-1 text-xs text-muted transition-colors hover:bg-[var(--theme-card2)]"
        >
          <input
            type="checkbox"
            checked={Boolean(checklist.checked[label])}
            onChange={() => checklist.toggle(label)}
            className="size-3.5 accent-[var(--theme-accent)]"
          />
          <span className={cn(checklist.checked[label] && 'line-through')}>
            {label}
          </span>
        </label>
      ))}
      <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {checklist.complete}/{labels.length} complete
      </div>
    </div>
  )
}

function DashboardFlowRail({
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
  onOpenWaitingTasks,
  onOpenMeetings,
  onOpenLily,
  onOpenOperations,
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
  onOpenWaitingTasks: () => void
  onOpenMeetings: () => void
  onOpenLily: () => void
  onOpenOperations: () => void
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
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
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
              Refresh live evidence before acting on stale operational data.
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

      <GlassCard title="Daily Loops" accentColor="var(--theme-warning)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Morning startup
            </div>
            <ChecklistRows
              storageKey="dashboard.morningChecklist"
              labels={[
                'Check blockers',
                'Review meetings',
                'Pick first workstream',
              ]}
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              End of day
            </div>
            <ChecklistRows
              storageKey="dashboard.closeoutChecklist"
              labels={[
                'Capture loose tasks',
                'Review waiting items',
                'Set tomorrow',
              ]}
            />
            <button
              type="button"
              onClick={onOpenWaitingTasks}
              className="mt-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-accent)] transition hover:text-ink"
            >
              Open waiting list
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SecondaryAction
                label="LILY"
                icon={BubbleChatAddIcon}
                onClick={onOpenLily}
                title="Open LILY"
              />
              <SecondaryAction
                label="Operations"
                icon={ConsoleIcon}
                onClick={onOpenOperations}
                title="Open Operations"
              />
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Metric Tile ──────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  icon,
  accentColor,
}: {
  label: string
  value: string
  sub?: string
  icon: string
  accentColor: string
}) {
  return (
    <GlassCard accentColor={accentColor}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums text-ink">
            {value}
          </div>
          {sub && <div className="text-[11px] text-muted">{sub}</div>}
        </div>
        <div
          className="flex size-8 items-center justify-center rounded-lg text-base"
          style={{ background: `${accentColor}15` }}
        >
          {icon}
        </div>
      </div>
    </GlassCard>
  )
}

// ── Activity Chart ───────────────────────────────────────────────

function ActivityChart({
  sessions,
  palette,
}: {
  sessions: Array<ClaudeSession>
  palette: ReturnType<typeof readDashboardPalette>
}) {
  const chartData = useMemo(() => {
    const dayMap = new Map<string, { sessions: number; messages: number }>()
    const now = Date.now() / 1000
    for (let i = 13; i >= 0; i--) {
      const d = new Date((now - i * 86400) * 1000)
      const key = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      dayMap.set(key, { sessions: 0, messages: 0 })
    }
    for (const s of sessions) {
      if (!s.started_at) continue
      const d = new Date(s.started_at * 1000)
      const key = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const entry = dayMap.get(key)
      if (entry) {
        entry.sessions += 1
        entry.messages += s.message_count ?? 0
      }
    }
    const all = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }))
    let firstActive = all.findIndex((d) => d.sessions > 0 || d.messages > 0)
    if (firstActive > 0) firstActive = Math.max(0, firstActive - 1)
    return firstActive > 0 ? all.slice(firstActive) : all
  }, [sessions])

  return (
    <GlassCard
      title="Activity"
      titleRight={<span className="text-[10px] text-muted">14 days</span>}
      accentColor={palette.accent}
      className="h-full"
    >
      <div className="h-[200px] w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 32, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="g-sessions" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={palette.accent}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={palette.accent}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="g-messages" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={palette.success}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={palette.success}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={palette.border}
              opacity={0.45}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: palette.muted }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: palette.success }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: palette.accent }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: palette.card,
                border: `1px solid ${palette.border}`,
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: palette.muted, fontSize: '10px' }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="messages"
              stroke={palette.success}
              fill="url(#g-messages)"
              strokeWidth={1.5}
              dot={false}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="sessions"
              stroke={palette.accent}
              fill="url(#g-sessions)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-5 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: palette.accent }}
          />
          Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: palette.success }}
          />
          Messages
        </span>
      </div>
    </GlassCard>
  )
}

// ── Skills Widget ────────────────────────────────────────────────

function SkillsWidget({
  palette,
  onOpen,
  usage,
}: {
  palette: ReturnType<typeof readDashboardPalette>
  onOpen: () => void
  usage: DashboardOverview['skillsUsage']
}) {
  const skillsAvailable = useFeatureAvailable('skills')
  const skillsQuery = useQuery({
    queryKey: ['claude-skills'],
    queryFn: async () => {
      const res = await fetch(
        '/api/skills?tab=installed&limit=200&summary=search',
      )
      if (!res.ok) return []
      const data = await res.json()
      return (data?.skills ?? []) as Array<Record<string, unknown>>
    },
    staleTime: 30_000,
    enabled: skillsAvailable,
  })

  const skills = skillsQuery.data ?? []

  if (!skillsAvailable) {
    return (
      <UnavailableWidget
        title="Skills"
        description={getUnavailableReason('skills')}
      />
    )
  }

  // Summary view per Hermes Agent feedback: 'don’t enumerate, summarise.'
  // Prefer real usage signal from /api/analytics/usage when present
  // (counts what the agent *actually used*, not just what's installed).
  const installed = skills.length
  const enabled = skills.filter((s) => s.enabled !== false).length
  const usedThisWindow = usage?.distinctSkills ?? null
  const topUsed = usage?.topSkills[0]
  const topInstalled = skills.find((s) => s.enabled !== false) ?? skills.at(0)
  const topName = topUsed?.skill ?? String(topInstalled?.name ?? '—')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex w-full flex-col gap-1.5 overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors hover:bg-[var(--theme-card)]/80"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${palette.warning}, ${palette.warning}50, transparent)`,
        }}
      />
      <div className="flex items-center justify-between">
        <h3
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-muted)' }}
        >
          Skills
        </h3>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--theme-muted)' }}
        >
          manage →
        </span>
      </div>
      <div
        className="font-mono text-2xl font-bold tabular-nums leading-none"
        style={{ color: 'var(--theme-text)' }}
      >
        {installed}
      </div>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.1em]"
        style={{ color: 'var(--theme-muted)' }}
      >
        {installed === 0
          ? 'no skills installed'
          : usedThisWindow !== null && usedThisWindow > 0
            ? `${enabled} enabled · ${usedThisWindow} used · top: ${topName}`
            : `${enabled} enabled · top: ${topName}`}
      </div>
    </button>
  )
}

// ── Secondary action (smaller, monochrome) ─────────────────────

function SecondaryAction({
  label,
  icon,
  onClick,
  disabled,
  title,
}: {
  label: string
  icon: HugeIcon
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={title ?? label}
      className="group inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em] transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.015] hover:bg-[var(--theme-card)]/70 hover:text-[var(--theme-text)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-muted)',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--theme-card) 80%, transparent), transparent)',
      }}
    >
      <HugeiconsIcon
        icon={icon}
        size={14}
        strokeWidth={1.6}
        className="transition-colors group-hover:text-[var(--theme-accent)]"
      />
      <span>{label}</span>
    </button>
  )
}

// ── Quick Action ─────────────────────────────────────────────────

function QuickAction({
  label,
  icon,
  onClick,
  accentColor,
  disabled,
  badge,
}: {
  label: string
  icon: string
  onClick: () => void
  accentColor: string
  disabled?: boolean
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative overflow-hidden flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height]',
        'border-[var(--theme-border)] bg-[var(--theme-card)] text-left',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-[var(--theme-accent-border)] hover:scale-[1.01] active:scale-[0.99]',
      )}
    >
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm"
        style={{ background: `${accentColor}18` }}
      >
        {icon}
      </div>
      <span
        className="min-w-0 flex-1 text-xs font-semibold"
        style={{ color: 'var(--theme-text)' }}
      >
        {label}
      </span>
      {badge ? (
        <span className="ml-auto shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700">
          {badge}
        </span>
      ) : null}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />
    </button>
  )
}

// ── Session Row (minimal) ────────────────────────────────────────

function SessionRow({
  session,
  maxTokens,
  onClick,
  palette,
}: {
  session: ClaudeSession
  maxTokens: number
  onClick: () => void
  palette: ReturnType<typeof readDashboardPalette>
}) {
  const tokens = (session.input_tokens ?? 0) + (session.output_tokens ?? 0)
  const msgs = session.message_count ?? 0
  const tools = session.tool_call_count ?? 0
  const barWidth = maxTokens > 0 ? Math.max(1, (tokens / maxTokens) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-[var(--theme-card2)] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[13px] font-medium text-ink truncate flex-1 group-hover:text-ink">
          {session.title || session.id}
        </span>
        <span className="text-[10px] tabular-nums text-muted shrink-0">
          {session.started_at ? timeAgo(session.started_at) : ''}
        </span>
      </div>
      <div className="mb-1.5 flex items-center gap-2 text-[10px] text-neutral-500">
        {session.model && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
            style={{
              background: alpha(palette.accent, 0.1),
              color: palette.accent,
            }}
          >
            {session.model}
          </span>
        )}
        <span>{msgs} msgs</span>
        {tools > 0 && <span>{tools} tools</span>}
        {tokens > 0 && <span>{formatNumber(tokens)} tok</span>}
      </div>
      <div className="h-[3px] rounded-full w-full bg-[var(--theme-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] duration-700"
          style={{
            width: `${barWidth}%`,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.accentSecondary})`,
          }}
        />
      </div>
    </button>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────

export function DashboardScreen() {
  const navigate = useNavigate()
  const skillsAvailable = useFeatureAvailable('skills')
  const sessionsQuery = useQuery({
    // Use a dedicated query key — NOT chatQueryKeys.sessions — to avoid
    // cache collisions with the chat sidebar which fetches fewer sessions
    // and overwrites the dashboard's larger dataset.
    // Also use the workspace proxy (/api/sessions) rather than the server-side
    // listSessions() — the latter calls the gateway via CLAUDE_API which is
    // only available server-side and returns nothing when called from the client.
    // Do not gate this direct proof behind /api/gateway-status. That probe can
    // be stale/loading while /api/sessions already works, which made the
    // dashboard show a bogus “Enhanced API required” warning even though
    // sessions were healthy.
    queryKey: ['dashboard', 'sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions?limit=200&offset=0')
      if (!res.ok) {
        throw new Error(`Sessions API returned HTTP ${res.status}`)
      }
      const data = await res.json()
      return normalizeDashboardSessionsPayload(data)
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  })

  const sessionsResult = sessionsQuery.data

  // Raw rows from the sessions endpoint. Used both for hero stats
  // (count/tokens) and for the SessionsIntelligenceCard below.
  const rawSessions = sessionsResult?.sessions ?? []
  const sessionsUnavailable = Boolean(sessionsResult?.unavailable)
  const sessionsUnavailableMessage =
    sessionsResult?.message ?? getUnavailableReason('sessions')

  // Adapter shape kept for the legacy fallbacks that still reference
  // ClaudeSession (HeroMetrics fallback path, etc.).
  const sessions = useMemo(
    () =>
      rawSessions.map((s) => ({
        id: (s.key ?? s.id) as string,
        started_at: s.startedAt ? (s.startedAt as number) / 1000 : undefined,
        message_count: (s.message_count as number | undefined) ?? 0,
        tool_call_count: (s.tool_call_count as number | undefined) ?? 0,
        input_tokens: (s.tokenCount as number | undefined) ?? 0,
        output_tokens: 0,
      })) as Array<ClaudeSession>,
    [rawSessions],
  )

  // Enriched rows for the Sessions Intelligence card. Keeps the rich
  // fields (`derivedTitle`, `kind`, `status`, `source`, `updatedAt`,
  // etc.) the legacy adapter dropped.
  const sessionRows: Array<SessionRowData> = useMemo(
    () =>
      [...rawSessions]
        .sort(
          (a, b) =>
            ((b.updatedAt as number | undefined) ??
              (b.startedAt as number | undefined) ??
              0) -
            ((a.updatedAt as number | undefined) ??
              (a.startedAt as number | undefined) ??
              0),
        )
        .slice(0, 12)
        .map((s) => ({
          key: String(s.key ?? s.id ?? ''),
          title:
            (s.derivedTitle as string | undefined) ||
            (s.title as string | undefined) ||
            (s.preview as string | undefined) ||
            String(s.key ?? ''),
          kind: String(s.kind ?? 'chat'),
          status: String(s.status ?? ''),
          source: (s.source as string | undefined) ?? null,
          model: (s.model as string | undefined) ?? null,
          messageCount:
            (s.messageCount as number | undefined) ??
            (s.message_count as number | undefined) ??
            0,
          toolCallCount:
            (s.toolCallCount as number | undefined) ??
            (s.tool_call_count as number | undefined) ??
            0,
          tokenCount:
            (s.tokenCount as number | undefined) ??
            (s.totalTokens as number | undefined) ??
            0,
          startedAt: (s.startedAt as number | undefined) ?? null,
          updatedAt: (s.updatedAt as number | undefined) ?? null,
        })),
    [rawSessions],
  )

  const stats = useMemo(() => {
    let totalMessages = 0,
      totalToolCalls = 0,
      totalTokens = 0
    for (const s of sessions) {
      totalMessages += s.message_count ?? 0
      totalToolCalls += s.tool_call_count ?? 0
      totalTokens += (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
    }
    return {
      totalSessions: sessions.length,
      totalMessages,
      totalToolCalls,
      totalTokens,
    }
  }, [sessions])

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0))
        .slice(0, 6),
    [sessions],
  )

  const maxTokens = useMemo(() => {
    let max = 0
    for (const s of recentSessions) {
      const t = (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
      if (t > max) max = t
    }
    return max
  }, [recentSessions])

  // Skills count for the SkillsUsageCard sub-text. Cheap query, used
  // only for the "X of Y used" microcopy.
  const skillsCountQuery = useQuery({
    queryKey: ['dashboard', 'skills-count'],
    queryFn: async () => {
      const res = await fetch(
        '/api/skills?tab=installed&limit=200&summary=search',
      )
      if (!res.ok) return 0
      const data = (await res.json()) as {
        skills?: Array<unknown>
      }
      return data.skills?.length ?? 0
    },
    staleTime: 60_000,
    enabled: skillsAvailable,
  })
  const skillsInstalled = skillsCountQuery.data ?? 0

  // Per-user widget visibility + edit-mode state (localStorage backed).
  const layout = useDashboardLayout()

  // Period selector for analytics; persists across navigation via
  // localStorage so refreshes don't reset the operator's preference.
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => {
    if (typeof window === 'undefined') return 30
    const stored = window.localStorage.getItem('dashboard.analyticsPeriod')
    const n = Number(stored)
    if (n === 7 || n === 14 || n === 30) return n
    return 30
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dashboard.analyticsPeriod', String(period))
    }
  }, [period])

  // Aggregate dashboard overview — surfaces the data the native
  // Hermes dashboard exposes (status, platforms, cron, achievements,
  // model info, analytics) in a single round trip with per-section
  // graceful fallbacks. Each card renders only when its slice resolves.
  const overviewQuery = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview', period],
    queryFn: async () => {
      // achievements=5 (instead of 3) gives the Achievements rail
      // card enough vertical mass to fill the gap below Top Models.
      const res = await fetch(
        `/api/dashboard/overview?days=${period}&achievements=5`,
      )
      if (!res.ok) throw new Error(`overview ${res.status}`)
      return (await res.json()) as DashboardOverview
    },
    staleTime: 5_000,
    refetchInterval: 30_000,
  })
  const lilyQuery = useQuery<LilyDashboardConfig>({
    queryKey: ['dashboard', 'lily-config'],
    queryFn: async () => {
      const res = await fetch('/api/lily/config')
      const payload = (await res
        .json()
        .catch(() => ({}))) as LilyDashboardConfig
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `lily config ${res.status}`)
      }
      return payload
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  })
  const phoneCockpitQuery = useQuery<PhoneCockpitSnapshot>({
    queryKey: ['dashboard', 'phone-cockpit'],
    queryFn: async () => {
      const res = await fetch(apiPath('/api/phone-cockpit'), {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`phone cockpit ${res.status}`)
      return (await res.json()) as PhoneCockpitSnapshot
    },
    staleTime: 15_000,
    refetchInterval: 45_000,
    retry: 1,
  })
  const overview = overviewQuery.data ?? null
  const lilyConfig = lilyQuery.data ?? null
  const phoneCockpit = phoneCockpitQuery.data ?? null
  const overviewUpdatedAt = overview?.status?.updatedAt ?? null
  const dashboardStale =
    !overviewQuery.isFetching &&
    (overviewQuery.isError ||
      isWorkspaceSourceStale(overviewUpdatedAt, 120_000))
  const sessionsFreshness =
    sessionRows[0]?.updatedAt ?? sessionRows[0]?.startedAt ?? null
  const sessionsStale =
    !sessionsQuery.isFetching &&
    (sessionsQuery.isError ||
      sessionsUnavailable ||
      (sessionRows.length > 0 &&
        isWorkspaceSourceStale(sessionsFreshness, 15 * 60_000)))
  const actionRequiredItems = useMemo<Array<ActionRequiredItem>>(() => {
    const items: Array<ActionRequiredItem> = []
    if (overviewQuery.isError) {
      items.push({
        id: 'overview-error',
        severity: 'error',
        label: 'Overview failed',
        detail: 'Dashboard overview could not refresh.',
        action: 'Retry overview',
        onClick: () => void overviewQuery.refetch(),
      })
    } else if (isWorkspaceSourceStale(overviewUpdatedAt, 120_000)) {
      items.push({
        id: 'overview-stale',
        severity: 'warn',
        label: 'Gateway data stale',
        detail: `Last successful gateway probe was ${formatWorkspaceFreshness(overviewUpdatedAt)}.`,
        action: 'Refresh gateway',
        onClick: () => void overviewQuery.refetch(),
      })
    }
    if (sessionsQuery.isError || sessionsUnavailable) {
      items.push({
        id: 'sessions-unavailable',
        severity: 'error',
        label: 'Sessions unavailable',
        detail: sessionsQuery.isError
          ? getUnavailableReason('sessions')
          : sessionsUnavailableMessage,
        action: 'Retry sessions',
        onClick: () => void sessionsQuery.refetch(),
      })
    } else if (
      sessionRows.length > 0 &&
      isWorkspaceSourceStale(sessionsFreshness, 15 * 60_000)
    ) {
      items.push({
        id: 'sessions-stale',
        severity: 'warn',
        label: 'Session ledger stale',
        detail: `Newest session update was ${formatWorkspaceFreshness(sessionsFreshness)}.`,
        action: 'Refresh sessions',
        onClick: () => void sessionsQuery.refetch(),
      })
    }
    if (!overview?.modelInfo && !overviewQuery.isFetching) {
      items.push({
        id: 'model-offline',
        severity: 'warn',
        label: 'Model offline',
        detail: 'Gateway overview did not return an active model.',
        action: 'Probe model',
        onClick: () => void overviewQuery.refetch(),
      })
    }
    for (const incident of overview?.incidents ?? []) {
      items.push({
        id: incident.id,
        severity: incident.severity,
        label: incident.label,
        detail: incident.detail,
        action: incident.href ? 'Open source' : 'Refresh',
        onClick: () => {
          if (incident.href) {
            window.location.assign(incident.href)
          } else {
            void overviewQuery.refetch()
          }
        },
      })
    }
    if (lilyQuery.isError) {
      items.push({
        id: 'lily-config-error',
        severity: 'warn',
        label: 'LILY config failed',
        detail: 'Dashboard could not verify LILY voice readiness.',
        action: 'Retry LILY',
        onClick: () => void lilyQuery.refetch(),
      })
    } else if (
      lilyConfig?.voiceWorker?.status &&
      lilyConfig.voiceWorker.status !== 'online'
    ) {
      items.push({
        id: 'lily-worker-not-online',
        severity: 'warn',
        label: 'LILY worker not online',
        detail:
          lilyConfig.voiceWorker.detail ||
          'Voice worker is not reporting online readiness.',
        action: 'Open LILY',
        onClick: () => navigate({ to: '/lily', search: {} }),
      })
    }
    return items.sort((a, b) => {
      const rank = { error: 0, warn: 1, info: 2 }
      return rank[a.severity] - rank[b.severity]
    })
  }, [
    navigate,
    lilyConfig?.voiceWorker?.detail,
    lilyConfig?.voiceWorker?.status,
    lilyQuery,
    overview?.incidents,
    overview?.modelInfo,
    overviewQuery,
    overviewUpdatedAt,
    sessionRows.length,
    sessionsFreshness,
    sessionsQuery,
    sessionsUnavailable,
    sessionsUnavailableMessage,
  ])

  const weeklyUtilizationReport = useMemo(
    () =>
      buildWeeklyWorkspaceUtilizationReport({
        generatedAt: new Date(),
        sessions: sessionRows,
        overviewUpdatedAt,
        activeModel:
          overview?.modelInfo?.model ?? overview?.modelInfo?.provider ?? null,
        gatewayStatus: overview?.status?.gatewayState ?? null,
        phoneSignalCount:
          (phoneCockpit?.attention.length ?? 0) +
          (phoneCockpit?.meetingPrep.openActionItems.length ?? 0) +
          (phoneCockpit?.inbox.focused.length ?? 0) +
          (phoneCockpit?.tasks.urgent ?? 0),
        actionItems: actionRequiredItems.map((item) => ({
          label: item.label,
          detail: item.detail,
        })),
      }),
    [
      actionRequiredItems,
      overview?.modelInfo?.model,
      overview?.modelInfo?.provider,
      overview?.status?.gatewayState,
      overviewUpdatedAt,
      phoneCockpit?.attention.length,
      phoneCockpit?.inbox.focused.length,
      phoneCockpit?.meetingPrep.openActionItems.length,
      phoneCockpit?.tasks.urgent,
      sessionRows,
    ],
  )

  const degradedSourceCount = Object.values(phoneCockpit?.sources ?? {}).filter(
    (source) => !source.ok,
  ).length
  const dashboardHealthScore = calculateDashboardHealthScore({
    actionItemCount: actionRequiredItems.length,
    degradedSourceCount,
    dashboardStale,
    sessionsStale,
    sessionsUnavailable,
    lilyWorkerOnline: lilyConfig?.voiceWorker?.status === 'online',
  })
  const dashboardStatusBrief = buildDashboardStatusBrief({
    healthScore: dashboardHealthScore,
    topAction: actionRequiredItems[0]?.label ?? 'No operator blockers',
    latestSessionTitle: sessionRows[0]?.title ?? 'No recent workstream',
    sourceHealth:
      degradedSourceCount === 0
        ? 'all daily sources reporting'
        : `${degradedSourceCount} daily source${degradedSourceCount === 1 ? '' : 's'} degraded`,
    overviewFreshness: formatWorkspaceFreshness(overviewUpdatedAt),
    sessionsFreshness: formatWorkspaceFreshness(sessionsFreshness),
  })
  const dashboardNextAction = useMemo(
    () =>
      buildDashboardNextAction({
        actionItems: actionRequiredItems,
        dashboardStale,
        sessionsStale,
        latestSessionTitle: sessionRows[0]?.title ?? null,
      }),
    [actionRequiredItems, dashboardStale, sessionRows, sessionsStale],
  )
  const palette = useDashboardPalette()

  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true
    const dt = document.documentElement.getAttribute('data-theme') || ''
    return !dt.endsWith('-light')
  })

  const refreshDashboardSources = () => {
    void overviewQuery.refetch()
    void sessionsQuery.refetch()
    void lilyQuery.refetch()
    void phoneCockpitQuery.refetch()
  }

  const runDashboardNextAction = () => {
    const topAction = actionRequiredItems[0]
    if (topAction) {
      topAction.onClick()
      return
    }
    if (dashboardStale || sessionsStale) {
      refreshDashboardSources()
      return
    }
    const key = sessionRows[0]?.key
    if (key) {
      navigate({
        to: '/chat/$sessionKey',
        params: { sessionKey: key },
      })
      return
    }
    navigate({
      to: '/chat/$sessionKey',
      params: { sessionKey: 'new' },
    })
  }

  return (
    <div className="min-h-full">
      {/* Floating mobile nav: hamburger left, theme toggle right */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 h-12"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={openHamburgerMenu}
          className="flex items-center justify-center w-11 h-11 rounded-xl active:bg-white/10 transition-colors touch-manipulation"
        >
          <svg
            width="20"
            height="16"
            viewBox="0 0 20 16"
            fill="none"
            className="opacity-70"
            style={{ color: 'var(--color-ink, #111)' }}
          >
            <path
              d="M1 1.5H19M1 8H19M1 14.5H13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => {
            const LIGHT_DARK_PAIRS: Record<string, string> = {
              'claude-nous': 'claude-nous-light',
              'claude-nous-light': 'claude-nous',
              'claude-official': 'claude-official-light',
              'claude-official-light': 'claude-official',
              'claude-classic': 'claude-classic-light',
              'claude-classic-light': 'claude-classic',
              'claude-slate': 'claude-slate-light',
              'claude-slate-light': 'claude-slate',
            }
            const cur =
              document.documentElement.getAttribute('data-theme') ||
              'claude-official'
            const nextDataTheme =
              LIGHT_DARK_PAIRS[cur] ||
              (isDark ? 'claude-official-light' : 'claude-official')
            import('@/lib/theme').then(({ setTheme }) => {
              setTheme(nextDataTheme as any)
            })
            const nextMode = nextDataTheme.endsWith('-light') ? 'light' : 'dark'
            applyTheme(nextMode)
            updateSettings({ theme: nextMode })
            setIsDark(nextMode === 'dark')
          }}
          className="flex items-center justify-center w-11 h-11 rounded-xl active:bg-white/10 transition-colors touch-manipulation"
          style={{ color: 'var(--theme-muted)' }}
        >
          <HugeiconsIcon
            icon={isDark ? Sun02Icon : Moon02Icon}
            size={20}
            strokeWidth={1.5}
          />
        </button>
      </div>
      <div className="px-4 pt-14 md:pt-4 py-4 md:px-8 md:py-6 lg:px-10 space-y-5 pb-28">
        {/* ── Header: brand lockup left, action cluster right.
           Iteration 010: dropped redundant "Dashboard" eyebrow (the
           page IS the dashboard); promoted "Hermes Workspace" to
           the primary heading at a larger weight. Logo bumped from
           36px → 44px and gets a soft accent glow + ring so the
           lockup commands the left side instead of feeling like
           filler before the action cluster. Kept anchored left
           (not centered) on purpose: ops dashboards put brand left
           + actions right because that's the spatial hierarchy
           operators expect (Linear, Vercel, Datadog all do this). */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span
              className="relative inline-flex shrink-0 items-center justify-center rounded-xl border"
              style={{
                width: 44,
                height: 44,
                borderColor:
                  'color-mix(in srgb, var(--theme-accent) 35%, var(--theme-border))',
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card)), var(--theme-card))',
                boxShadow:
                  '0 0 0 4px color-mix(in srgb, var(--theme-accent) 6%, transparent)',
              }}
            >
              <img
                src="/claude-avatar.webp"
                alt="Hermes Workspace logo"
                className="size-8 rounded-md"
                style={{ background: 'transparent' }}
              />
            </span>
            {/* Iter 011: dropped the 'Operator console · vX.Y.Z'
              eyebrow. The gateway version is already on the OpsStrip
              (♦ GATEWAY V0.12.0), so the eyebrow was duplicating it.
              Single bold lockup feels cleaner; vertical centering on
              the lockup matches the height of the action cluster on
              the right so they don't visually drift. */}
            <div className="flex flex-col justify-center">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{
                  color: 'var(--theme-text)',
                  letterSpacing: '-0.015em',
                  lineHeight: 1.1,
                }}
              >
                Hermes Workspace
              </h1>
            </div>
          </div>
          {/* Action row: hierarchy per Hermes Agent review.
           New Chat is primary (full button + accent), Terminal +
           Skills are secondary, Settings collapses to icon-only. */}
          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:max-w-xl">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                dashboardStale
                  ? 'border-amber-300/40 bg-amber-300/10 text-amber-500'
                  : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-500',
              )}
              title={`Overview refreshed ${formatWorkspaceFreshness(overviewUpdatedAt)}`}
            >
              {dashboardStale
                ? `Stale ${formatWorkspaceFreshness(overviewUpdatedAt)}`
                : `Fresh ${formatWorkspaceFreshness(overviewUpdatedAt)}`}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                sessionsStale
                  ? 'border-amber-300/40 bg-amber-300/10 text-amber-500'
                  : 'border-cyan-300/30 bg-cyan-300/10 text-cyan-500',
              )}
              title={`Sessions refreshed ${formatWorkspaceFreshness(sessionsFreshness)}`}
            >
              Sessions {sessionsStale ? 'stale' : 'live'}
            </span>
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: '/chat/$sessionKey',
                  params: { sessionKey: 'new' },
                })
              }
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg px-3.5 py-2 text-sm font-semibold uppercase tracking-[0.05em] transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: `linear-gradient(135deg, ${palette.accent}, ${palette.accentSecondary})`,
                color: 'var(--theme-on-accent, white)',
                boxShadow: `0 6px 18px -8px ${palette.accent}aa, inset 0 1px 0 0 rgba(255,255,255,0.18)`,
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.15), transparent 60%)',
                }}
              />
              <HugeiconsIcon
                icon={BubbleChatAddIcon}
                size={16}
                strokeWidth={1.8}
              />
              <span>New Chat</span>
            </button>
            <SecondaryAction
              label="Terminal"
              icon={ConsoleIcon}
              onClick={() => navigate({ to: '/terminal' })}
            />
            <SecondaryAction
              label="Skills"
              icon={PuzzleIcon}
              onClick={() => navigate({ to: '/skills' })}
              disabled={!skillsAvailable}
            />
            {/* Edit toggle: enters "layout edit mode" where each widget
              shows an X button and a banner appears for re-adding
              hidden widgets. Persisted to localStorage. */}
            <button
              type="button"
              aria-label={
                layout.editMode ? 'Done editing layout' : 'Edit layout'
              }
              title={layout.editMode ? 'Done editing layout' : 'Edit layout'}
              onClick={layout.toggleEdit}
              className="inline-flex size-9 items-center justify-center rounded-lg border transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.05] hover:bg-[var(--theme-card)]/70"
              style={{
                borderColor: layout.editMode
                  ? 'var(--theme-accent)'
                  : 'var(--theme-border)',
                background: layout.editMode
                  ? 'color-mix(in srgb, var(--theme-accent) 14%, transparent)'
                  : 'linear-gradient(135deg, color-mix(in srgb, var(--theme-card) 80%, transparent), transparent)',
                color: layout.editMode
                  ? 'var(--theme-accent)'
                  : 'var(--theme-muted)',
              }}
            >
              <HugeiconsIcon
                icon={layout.editMode ? CheckmarkCircle02Icon : Edit02Icon}
                size={15}
                strokeWidth={1.7}
              />
            </button>
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              onClick={() => navigate({ to: '/settings', search: {} })}
              className="inline-flex size-9 items-center justify-center rounded-lg border transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.05] hover:bg-[var(--theme-card)]/70 hover:text-[var(--theme-text)]"
              style={{
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-muted)',
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--theme-card) 80%, transparent), transparent)',
              }}
            >
              <HugeiconsIcon
                icon={Settings02Icon}
                size={15}
                strokeWidth={1.7}
              />
            </button>
          </div>
        </div>

        {/* ── Attention marquee ──
           Iteration 008: lifted *out* of the OpsStrip into its own
           dedicated row above it. Fixed Eric's 'feels cluttered'
           concern by giving the ticker its own visual chamber
           (warning gradient, separated border) so it doesn't blend
           into the gateway/version/cron line below it. */}
        {(overview?.incidents.length ?? 0) > 0 ? (
          <AttentionMarquee overview={overview ?? null} />
        ) : null}

        {/* ── Ops strip (gateway + version drift + platforms + cron pulse). ── */}
        <OpsStrip
          status={overview?.status ?? null}
          cron={overview?.cron ?? null}
          platforms={overview?.platforms ?? []}
        />

        {dashboardStale ? (
          <section className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-amber-50">
                  Gateway data needs refresh
                </h2>
                <p className="mt-1 text-xs text-amber-100/80">
                  Overview source last reported{' '}
                  {formatWorkspaceFreshness(overviewUpdatedAt)}. Refresh live
                  evidence before acting on stale operational data.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: '/terminal' })}
                className="min-h-10 rounded-lg border border-amber-200/40 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-50 hover:bg-amber-200/10"
              >
                Open terminal
              </button>
            </div>
          </section>
        ) : null}

        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Dashboard action queue
        </h2>

        <DashboardCommandStrip
          nextAction={dashboardNextAction}
          hiddenCount={layout.counts.hidden}
          onRunNext={runDashboardNextAction}
          onEditHiddenWidgets={() => layout.setEditMode(true)}
        />

        <DashboardOperationsBand
          actionItems={actionRequiredItems}
          dashboardStale={dashboardStale}
          sessionsStale={sessionsStale}
          overviewUpdatedAt={overviewUpdatedAt}
          sessionsFreshness={sessionsFreshness}
          onOpenTasks={() =>
            navigate({ to: '/tasks', search: { filter: 'today' } })
          }
          onOpenTerminal={() => navigate({ to: '/terminal' })}
          onOpenOpsIntelligence={() => navigate({ to: '/ops-intelligence' })}
        />

        <DashboardFlowRail
          actionItems={actionRequiredItems}
          latestSession={sessionRows[0] ?? null}
          overviewUpdatedAt={overviewUpdatedAt}
          sessionsFreshness={sessionsFreshness}
          dashboardStale={dashboardStale}
          sessionsStale={sessionsStale}
          healthScore={dashboardHealthScore}
          statusBrief={dashboardStatusBrief}
          onOpenTasks={() =>
            navigate({ to: '/tasks', search: { filter: 'active' } })
          }
          onOpenTodayTasks={() =>
            navigate({ to: '/tasks', search: { filter: 'today' } })
          }
          onOpenWaitingTasks={() =>
            navigate({ to: '/tasks', search: { filter: 'waiting' } })
          }
          onOpenMeetings={() => navigate({ to: '/meetings' })}
          onOpenLily={() => navigate({ to: '/lily', search: {} })}
          onOpenOperations={() => navigate({ to: '/operations' })}
          onNewChat={() =>
            navigate({
              to: '/chat/$sessionKey',
              params: { sessionKey: 'new' },
            })
          }
          onResume={() => {
            const key = sessionRows[0]?.key
            if (key) {
              navigate({
                to: '/chat/$sessionKey',
                params: { sessionKey: key },
              })
            }
          }}
          onRefreshAll={() => {
            void overviewQuery.refetch()
            void sessionsQuery.refetch()
            void lilyQuery.refetch()
            void phoneCockpitQuery.refetch()
          }}
        />

        <ActionRequiredRail items={actionRequiredItems} />

        <DailySignalsCard
          snapshot={phoneCockpit}
          loading={phoneCockpitQuery.isFetching}
          error={phoneCockpitQuery.isError}
          onOpenPhone={() =>
            navigate({ to: '/phone', search: { capture: 'note' } })
          }
          onOpenMeetings={() => navigate({ to: '/meetings' })}
          onRefresh={() => void phoneCockpitQuery.refetch()}
        />

        <WeeklyUtilizationReportCard report={weeklyUtilizationReport} />

        <LilyReadinessCard
          config={lilyConfig}
          loading={lilyQuery.isFetching}
          error={lilyQuery.isError}
          onOpen={() => navigate({ to: '/lily', search: {} })}
          onRefresh={() => void lilyQuery.refetch()}
        />

        {/* ── Hero Metrics: 3 analytics tiles + Active Model KPI in slot 4 ── */}
        <HeroMetrics
          analytics={overview?.analytics ?? null}
          fallback={{
            sessions: stats.totalSessions,
            messages: stats.totalMessages,
            toolCalls: stats.totalToolCalls,
            tokens: stats.totalTokens,
          }}
          extraTile={
            <ActiveModelKpi
              modelInfo={overview?.modelInfo ?? null}
              analytics={overview?.analytics ?? null}
              lastProbeAt={overview?.status?.lastHeartbeatAt ?? null}
              loading={overviewQuery.isFetching}
              error={
                overviewQuery.isError
                  ? 'Dashboard overview probe failed.'
                  : null
              }
              onRetry={() => void overviewQuery.refetch()}
            />
          }
        />

        {/* ── Edit-mode banner (only renders when toggled). ── */}
        <EditModePanel layout={layout} />

        {/* ── Analytics chart (left) + Top models / Provider mix / Cache
           efficiency stacked on the right. The right-side stack now
           occupies the full vertical of the chart so we don't get the
           floating-card empty-space Eric flagged in iter 008. ── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {layout.isVisible('analytics_chart') ? (
            <div className="lg:col-span-8">
              <WidgetShell id="analytics_chart" layout={layout}>
                <AnalyticsChartCard
                  analytics={overview?.analytics ?? null}
                  insights={overview?.insights ?? []}
                  period={period}
                  onPeriodChange={setPeriod}
                  loading={overviewQuery.isFetching}
                />
              </WidgetShell>
            </div>
          ) : null}
          {layout.isVisible('top_models') ||
          layout.isVisible('provider_mix') ||
          layout.isVisible('cache_efficiency') ||
          layout.isVisible('velocity') ||
          layout.isVisible('cost_ledger') ? (
            <div
              className={
                layout.isVisible('analytics_chart')
                  ? 'flex flex-col gap-3 lg:col-span-4'
                  : 'flex flex-col gap-3 lg:col-span-12'
              }
            >
              {layout.isVisible('top_models') ? (
                <WidgetShell id="top_models" layout={layout}>
                  <TopModelsCard analytics={overview?.analytics ?? null} />
                </WidgetShell>
              ) : null}
              {layout.isVisible('cache_efficiency') ? (
                <WidgetShell id="cache_efficiency" layout={layout}>
                  <CacheEfficiencyCard
                    analytics={overview?.analytics ?? null}
                  />
                </WidgetShell>
              ) : null}
              {layout.isVisible('provider_mix') ? (
                <WidgetShell id="provider_mix" layout={layout}>
                  <ProviderMixCard analytics={overview?.analytics ?? null} />
                </WidgetShell>
              ) : null}
              {layout.isVisible('velocity') ? (
                <WidgetShell id="velocity" layout={layout}>
                  <VelocityCard analytics={overview?.analytics ?? null} />
                </WidgetShell>
              ) : null}
              {layout.isVisible('cost_ledger') ? (
                <WidgetShell id="cost_ledger" layout={layout}>
                  <CostLedgerCard analytics={overview?.analytics ?? null} />
                </WidgetShell>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Primary content: Sessions Intelligence (replaces 14d Activity) + side rail ──
           Iteration 006 layout per Eric:
           - Attention now rides the OpsStrip marquee, not the rail.
           - Achievements moved up to sit beside Top Models would push the chart out
             of place; instead it now lives at the *top* of the side rail since the
             rail itself is right of the chart, which produces the same visual order.
           - Logs default off; still toggleable from edit mode for power users. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Iter 013 main column order: Operator Tip first (compact),
            then Sessions Intelligence (the bottom anchor that grows
            to fill the column to match the side rail height), then
            optional Logs Tail at the bottom for power users in edit
            mode. The column itself is `min-h-full flex` so the
            child Sessions card's `flex-1` actually expands. */}
          <div className="flex min-h-full flex-col gap-3 lg:col-span-8">
            {layout.isVisible('operator_tip') ? (
              <WidgetShell id="operator_tip" layout={layout}>
                <OperatorTipCard overview={overview ?? null} />
              </WidgetShell>
            ) : null}
            {layout.isVisible('sessions_intelligence') ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <WidgetShell id="sessions_intelligence" layout={layout}>
                  {sessionsQuery.isError || sessionsUnavailable ? (
                    <UnavailableWidget
                      title="Recent Sessions"
                      description={
                        sessionsQuery.isError
                          ? getUnavailableReason('sessions')
                          : sessionsUnavailableMessage
                      }
                    />
                  ) : (
                    <SessionsIntelligenceCard sessions={sessionRows} />
                  )}
                </WidgetShell>
              </div>
            ) : null}
            {layout.isVisible('logs_tail') ? (
              <WidgetShell id="logs_tail" layout={layout}>
                <LogsTailCard logs={overview?.logs ?? null} />
              </WidgetShell>
            ) : null}
          </div>
          {/* Side rail. Achievements is now first (sits beside Top Models
            visually since the rail is right of the chart row + sessions),
            then Skills, then the rhythm card. Mix & rhythm is the unique
            chart in this column — keeping it.
            `min-h-full` + the trailing `flex-1` rhythm card together
            stretch the rail to match Sessions Intelligence height so
            we don't get the dangling gap Eric flagged in iter 007. */}
          <div className="flex min-h-full flex-col gap-3 lg:col-span-4">
            <WidgetShell id="achievements" layout={layout}>
              <AchievementsCard achievements={overview?.achievements ?? null} />
            </WidgetShell>
            <WidgetShell id="skills_usage" layout={layout}>
              <SkillsUsageCard
                usage={overview?.skillsUsage ?? null}
                installedCount={skillsInstalled}
                onOpen={() => navigate({ to: '/skills' })}
              />
            </WidgetShell>
            {/* `flex-1` here pushes the rhythm card to consume any
              remaining vertical space so the rail's bottom aligns
              with Sessions Intelligence. The card itself uses
              h-full + flex-1 to honor the stretch. */}
            <div className="flex min-h-0 flex-1 flex-col">
              <WidgetShell id="mix_rhythm" layout={layout}>
                <TokenMixHourCard
                  analytics={overview?.analytics ?? null}
                  sessions={sessionRows}
                />
              </WidgetShell>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
