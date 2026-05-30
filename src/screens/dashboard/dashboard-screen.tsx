import {
  Alert01Icon,
  BubbleChatAddIcon,
  Calendar01Icon,
  CheckmarkCircle02Icon,
  ConsoleIcon,
  Edit02Icon,
  Moon02Icon,
  PuzzleIcon,
  RefreshIcon,
  Rocket01Icon,
  Settings02Icon,
  Sun02Icon,
  Task01Icon,
  UserGroupIcon,
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
import {
  ActionRequiredRail,
  DashboardOperationsBand,
  LilyReadinessCard,
  WeeklyUtilizationReportCard,
} from './dashboard-sections'
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
  GlassCard,
  SecondaryAction,
  UnavailableWidget,
  alpha,
  formatNumber,
  themeColor,
  timeAgo,
  useDashboardPalette,
} from './dashboard-ui'
import {
  DASHBOARD_WORKFLOW_PRESETS,
  buildDashboardDiagnostics,
  buildDashboardNextAction,
} from './lib/command-center'
import { normalizeDashboardSessionsPayload } from './lib/sessions-query'
import { useDashboardLayout } from './lib/use-dashboard-layout'
import { buildWeeklyWorkspaceUtilizationReport } from './lib/weekly-utilization-report'
import type {
  ActionRequiredItem,
  LilyDashboardConfig,
} from './dashboard-sections'
import type { readDashboardPalette } from './dashboard-ui'
import type { SessionRowData } from './components/sessions-intelligence-card'
import type { AnalyticsPeriod } from './components/analytics-chart-card'
import type { ClaudeSession } from '@/server/claude-api'
import type { DashboardOverview } from '@/server/dashboard-aggregator'
import type { PhoneCockpitSnapshot } from '@/server/phone-cockpit'
import { apiPath } from '@/lib/base-path'
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'
import { getUnavailableReason } from '@/lib/feature-gates'
import {
  formatWorkspaceFreshness,
  isWorkspaceSourceStale,
} from '@/lib/source-freshness'
import { cn } from '@/lib/utils'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'
import { openHamburgerMenu } from '@/components/mobile-hamburger-menu'
import { useFeatureAvailable } from '@/hooks/use-feature-available'

const SESSION_LEDGER_STALE_MS = 4 * 60 * 60_000

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
      <div className="h-[200px] min-w-0 w-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
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

function WorkspaceTodayGrid({
  actionItems,
  dashboardStale,
  sessionsStale,
  sessionsCount,
  tasksUrgent,
  nextMeetingTitle,
  latestSessionTitle,
  onRefresh,
  onNewChat,
  onOpenTasks,
  onOpenAgents,
  onOpenLily,
  onOpenTerminal,
}: {
  actionItems: Array<ActionRequiredItem>
  dashboardStale: boolean
  sessionsStale: boolean
  sessionsCount: number
  tasksUrgent: number | null
  nextMeetingTitle: string | null
  latestSessionTitle: string | null
  onRefresh: () => void
  onNewChat: () => void
  onOpenTasks: () => void
  onOpenAgents: () => void
  onOpenLily: () => void
  onOpenTerminal: () => void
}) {
  const topAction = actionItems[0]
  const healthTone = dashboardStale || sessionsStale ? 'amber' : 'green'
  const reviewCount = actionItems.length
  const urgentTasks = tasksUrgent ?? 0

  return (
    <div className="space-y-3">
      <AppSurface className="bg-[linear-gradient(145deg,color-mix(in_srgb,var(--theme-accent)_10%,var(--theme-card)),var(--theme-card)_54%,var(--theme-card2))]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <AppStatusPill tone={healthTone}>
                {dashboardStale || sessionsStale ? 'Needs check' : 'Live'}
              </AppStatusPill>
              {reviewCount > 0 ? (
                <AppStatusPill tone="amber">{reviewCount} review</AppStatusPill>
              ) : (
                <AppStatusPill tone="green">Clear</AppStatusPill>
              )}
              <AppStatusPill tone="blue">{sessionsCount} sessions</AppStatusPill>
            </div>
            <h2 className="max-w-3xl text-2xl font-black tracking-normal text-[var(--theme-text)] md:text-4xl">
              {topAction?.label ?? nextMeetingTitle ?? 'Today'}
            </h2>
            <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--theme-muted)]">
              {topAction?.detail ??
                latestSessionTitle ??
                'Start with chat, tasks, agents, or the live run console.'}
            </p>
          </div>
          <div className="flex gap-2 md:shrink-0">
            <button
              type="button"
              onClick={topAction?.onClick ?? onNewChat}
              className="min-h-12 flex-1 rounded-2xl bg-[var(--theme-accent)] px-4 text-sm font-bold text-[var(--theme-on-accent,white)] shadow-[0_18px_34px_-24px_var(--theme-accent)] transition-transform active:scale-[0.98] md:flex-none"
            >
              {topAction?.action ?? 'New Chat'}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh dashboard"
              className="inline-flex size-12 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] transition-transform active:scale-[0.96]"
            >
              <HugeiconsIcon icon={RefreshIcon} size={19} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </AppSurface>

      <AppSurface>
        <AppSectionHeader title="Quick Actions" meta="One tap to the next move" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <AppTile
            title="Chat"
            detail="Ask Hermes"
            icon={BubbleChatAddIcon}
            tone="blue"
            onClick={onNewChat}
            actionLabel="Start"
          />
          <AppTile
            title="Tasks"
            value={urgentTasks > 0 ? String(urgentTasks) : undefined}
            detail={urgentTasks > 0 ? 'Urgent' : 'Board clear'}
            icon={Task01Icon}
            tone={urgentTasks > 0 ? 'amber' : 'green'}
            onClick={onOpenTasks}
            actionLabel="Open"
          />
          <AppTile
            title="Agents"
            detail="Run crew"
            icon={UserGroupIcon}
            tone="purple"
            onClick={onOpenAgents}
            actionLabel="Manage"
          />
          <AppTile
            title="LILY"
            detail="Voice assistant"
            icon={Rocket01Icon}
            tone="blue"
            onClick={onOpenLily}
            actionLabel="Talk"
          />
          <AppTile
            title="Review"
            value={reviewCount > 0 ? String(reviewCount) : undefined}
            detail={reviewCount > 0 ? 'Needs attention' : 'Nothing here yet'}
            icon={Alert01Icon}
            tone={reviewCount > 0 ? 'amber' : 'green'}
            onClick={topAction?.onClick ?? onRefresh}
            actionLabel={reviewCount > 0 ? 'Fix' : 'Refresh'}
          />
          <AppTile
            title="Terminal"
            detail="Live console"
            icon={ConsoleIcon}
            tone="neutral"
            onClick={onOpenTerminal}
            actionLabel="Open"
          />
        </div>
      </AppSurface>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <AppTile
          title="Workspace"
          value={dashboardStale ? 'Stale' : 'Live'}
          detail="Gateway status"
          icon={CheckmarkCircle02Icon}
          tone={dashboardStale ? 'amber' : 'green'}
          onClick={onRefresh}
          className="min-h-[112px]"
        />
        <AppTile
          title="Sessions"
          value={sessionsStale ? 'Check' : 'Live'}
          detail={latestSessionTitle ?? 'No recent chat'}
          icon={BubbleChatAddIcon}
          tone={sessionsStale ? 'amber' : 'blue'}
          onClick={onNewChat}
          className="min-h-[112px]"
        />
        <AppTile
          title="Today"
          value={tasksUrgent !== null ? String(tasksUrgent) : '—'}
          detail="Urgent tasks"
          icon={Task01Icon}
          tone={urgentTasks > 0 ? 'amber' : 'neutral'}
          onClick={onOpenTasks}
          className="min-h-[112px]"
        />
        <AppTile
          title="Next"
          detail={nextMeetingTitle ?? 'No meeting now'}
          icon={Calendar01Icon}
          tone="neutral"
          className="min-h-[112px]"
        />
      </div>
    </div>
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
  const overviewFetchedAt = overviewQuery.dataUpdatedAt || null
  const overviewFreshnessAt = overviewFetchedAt || overviewUpdatedAt
  const hasOverviewFreshness = overviewFreshnessAt !== null
  const dashboardStale =
    !overviewQuery.isFetching &&
    (overviewQuery.isError ||
      (hasOverviewFreshness &&
        isWorkspaceSourceStale(overviewFreshnessAt, 120_000)))
  const sessionsFreshness =
    sessionRows[0]?.updatedAt ?? sessionRows[0]?.startedAt ?? null
  const sessionsStale =
    !sessionsQuery.isFetching &&
    (sessionsQuery.isError ||
      sessionsUnavailable ||
      (sessionRows.length > 0 &&
        isWorkspaceSourceStale(sessionsFreshness, SESSION_LEDGER_STALE_MS)))
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
    } else if (
      !overviewQuery.isFetching &&
      hasOverviewFreshness &&
      isWorkspaceSourceStale(overviewFreshnessAt, 120_000)
    ) {
      items.push({
        id: 'overview-stale',
        severity: 'warn',
        label: 'Gateway data stale',
        detail: `Last successful gateway probe was ${formatWorkspaceFreshness(overviewFreshnessAt)}.`,
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
      !sessionsQuery.isFetching &&
      isWorkspaceSourceStale(sessionsFreshness, SESSION_LEDGER_STALE_MS)
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
    overviewFreshnessAt,
    hasOverviewFreshness,
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
        overviewUpdatedAt: overviewFreshnessAt,
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
      overviewFreshnessAt,
      phoneCockpit?.attention.length,
      phoneCockpit?.inbox.focused.length,
      phoneCockpit?.meetingPrep.openActionItems.length,
      phoneCockpit?.tasks.urgent,
      sessionRows,
    ],
  )

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

  const nextMeetingTitle =
    phoneCockpit?.schedule.nextMeeting?.title ??
    phoneCockpit?.schedule.meetings[0]?.title ??
    null
  const latestSessionTitle = sessionRows[0]?.title ?? null

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
              title={`Overview refreshed ${formatWorkspaceFreshness(overviewFreshnessAt)}`}
            >
              {dashboardStale
                ? `Stale ${formatWorkspaceFreshness(overviewFreshnessAt)}`
                : `Fresh ${formatWorkspaceFreshness(overviewFreshnessAt)}`}
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

        <WorkspaceTodayGrid
          actionItems={actionRequiredItems}
          dashboardStale={dashboardStale}
          sessionsStale={sessionsStale}
          sessionsCount={stats.totalSessions}
          tasksUrgent={phoneCockpit?.tasks.urgent ?? null}
          nextMeetingTitle={nextMeetingTitle}
          latestSessionTitle={latestSessionTitle}
          onRefresh={refreshDashboardSources}
          onNewChat={() =>
            navigate({
              to: '/chat/$sessionKey',
              params: { sessionKey: 'new' },
            })
          }
          onOpenTasks={() =>
            navigate({ to: '/tasks', search: { filter: 'today' } })
          }
          onOpenAgents={() => navigate({ to: '/operations' })}
          onOpenLily={() => navigate({ to: '/lily', search: {} })}
          onOpenTerminal={() => navigate({ to: '/terminal' })}
        />

        {dashboardStale ? (
          <section className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-amber-50">
                  Gateway stale
                </h2>
                <p className="mt-1 text-xs text-amber-100/80">
                  Last report {formatWorkspaceFreshness(overviewFreshnessAt)}.
                  Refresh before acting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: '/terminal' })}
                className="min-h-10 rounded-lg border border-amber-200/40 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-50 hover:bg-amber-200/10"
                aria-label="Open Terminal for source details"
                title="Open Terminal"
              >
                Terminal
              </button>
            </div>
          </section>
        ) : null}

        <h2 className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-muted md:block">
          Action queue
        </h2>

        <div className="hidden md:block">
          <DashboardCommandStrip
            nextAction={dashboardNextAction}
            hiddenCount={layout.counts.hidden}
            onRunNext={runDashboardNextAction}
            onEditHiddenWidgets={() => layout.setEditMode(true)}
          />
        </div>

        <div className="hidden md:block">
          <DashboardOperationsBand
            actionItems={actionRequiredItems}
            dashboardStale={dashboardStale}
            sessionsStale={sessionsStale}
            overviewUpdatedAt={overviewFreshnessAt}
            sessionsFreshness={sessionsFreshness}
            onOpenTasks={() =>
              navigate({ to: '/tasks', search: { filter: 'today' } })
            }
            onOpenTerminal={() => navigate({ to: '/terminal' })}
            onOpenOpsIntelligence={() => navigate({ to: '/ops-intelligence' })}
          />
        </div>

        <div className="hidden md:block">
          <ActionRequiredRail items={actionRequiredItems} />
        </div>

        <div className="hidden md:block">
          <WeeklyUtilizationReportCard report={weeklyUtilizationReport} />
        </div>

        <div className="hidden md:block">
          <LilyReadinessCard
            config={lilyConfig}
            loading={lilyQuery.isFetching}
            error={lilyQuery.isError}
            onOpen={() => navigate({ to: '/lily', search: {} })}
            onRefresh={() => void lilyQuery.refetch()}
          />
        </div>

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
        <div className="hidden grid-cols-1 gap-3 md:grid lg:grid-cols-12">
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
        <div className="hidden grid-cols-1 gap-3 md:grid lg:grid-cols-12">
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
