import { startTransition, useEffect, useMemo, useState } from 'react'
import {
  Alert01Icon,
  Calendar03Icon,
  CheckListIcon,
  Shield01Icon,
  Task01Icon,
} from '@hugeicons/core-free-icons'
import type { HugeIcon } from '@/screens/dashboard/dashboard-ui'
import { SetupEmptyState } from '@/components/setup-empty-state'
import { apiPath, withBasePath } from '@/lib/base-path'
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'
import {
  ToolsActionDock,
  ToolsStatusRail,
} from '@/components/tools-action-dock'
import {
  formatWorkspaceFreshness,
  normalizeWorkspaceStatusTone,
  workspaceStatusClass,
} from '@/lib/source-freshness'

type ItOpsData = {
  overview?: {
    totalMeetings: number
    dateRange?: { from?: string | null; to?: string | null }
    attendance?: Array<{
      name: string
      total: number
      present: number
      absent: number
      absenceRate: number
    }>
    actionItems?: Array<{
      id: string
      meetingId: string
      meetingDate: string
      assignee: string
      task: string
      isDirectReport?: boolean
      isTyler?: boolean
    }>
    recurringIssues?: Array<{
      label: string
      count: number
      dates: Array<string>
      firstSeen?: string | null
      lastSeen?: string | null
    }>
    recentMeetings?: Array<{
      id: string
      date: string
      title: string
      attendees?: Array<string>
      absentDirectReports?: Array<string>
      actionItems?: Array<string>
      issues?: Array<string>
      decisions?: Array<string>
    }>
    generatedAt?: string
    warning?: string
  }
  analytics?: {
    ticketStats: {
      open: number
      closedToday: number
      avgResolutionHours: number
      slaCompliancePct: number
    }
    escalationCount: number
    teamPerformance: Array<{
      name: string
      role: string
      ticketsAssigned: number
      ticketsResolved: number
      avgResolutionHours: number
    }>
    trendData: Array<{
      date: string
      created: number
      resolved: number
    }>
    queueBreakdown: Array<{
      queue: string
      count: number
    }>
    priorityBreakdown?: Array<{
      priority: string
      count: number
    }>
    recentTickets?: Array<{
      id: string | number
      summary: string
      board: string
      status: string
      priority: string
      owner: string
      company: string
      dateEntered: string | null
      requiredDate: string | null
      url?: string | null
      ticketUrl?: string | null
      lastUpdatedBy?: string | null
      lastUpdated?: string | null
    }>
    briefing: string
    errors?: Array<string>
    fetchedAt: string
  }
  refreshedAt?: string
  error?: string
}

type ConnectWiseTicket = NonNullable<
  NonNullable<ItOpsData['analytics']>['recentTickets']
>[number]

type ConnectWiseAction = {
  ticket: ConnectWiseTicket
  kind:
    | 'sla-breach'
    | 'sla-risk'
    | 'approval'
    | 'unassigned'
    | 'priority'
    | 'stale'
  label: string
  detail: string
  severity: 'critical' | 'high' | 'medium'
  sort: number
}

type ExecutiveDashboardStats = {
  posture: 'Stable' | 'Watch' | 'Escalate'
  postureDetail: string
  openTickets: number
  closedToday: number
  slaCompliancePct: number
  avgResolutionHours: number
  exceptionCount: number
  slaActionCount: number
  approvalActionCount: number
  unassignedCount: number
  highPriorityCount: number
  topBoard: string
  topBoardCount: number
  tylerActionCount: number
  directReportActionCount: number
  tylerTouchedTicketCount: number
  standupCount: number
  recurringIssueCount: number
}

type ItOpsCommandAction = 'queue' | 'sla' | 'approvals' | 'tickets' | 'standups'

const IT_OPS_COMMAND_ICONS: Record<ItOpsCommandAction, HugeIcon> = {
  queue: Alert01Icon,
  sla: CheckListIcon,
  approvals: Shield01Icon,
  tickets: Task01Icon,
  standups: Calendar03Icon,
}

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function formatFreshness(value?: string | null) {
  return `Pull ${formatWorkspaceFreshness(value, {
    emptyLabel: 'unknown',
    invalidLabel: 'unknown',
  })}`
}

function stripTone(state: 'ok' | 'warn' | 'bad') {
  return workspaceStatusClass(normalizeWorkspaceStatusTone(state))
}

function compactText(value: string | null | undefined, limit = 42) {
  const text = (value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function hoursUntil(value?: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return (time - Date.now()) / 3_600_000
}

function hoursSince(value?: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return (Date.now() - time) / 3_600_000
}

function hasApprovalSignal(ticket: ConnectWiseTicket) {
  const text =
    `${ticket.summary} ${ticket.status} ${ticket.board}`.toLowerCase()
  return (
    text.includes('approval') ||
    text.includes('approve') ||
    text.includes('cab')
  )
}

function hasHighPrioritySignal(ticket: ConnectWiseTicket) {
  return /(critical|urgent|emergency|high|priority\s*1|p1|sev\s*1)/i.test(
    ticket.priority,
  )
}

export function buildConnectWiseActionQueue(
  tickets: Array<ConnectWiseTicket>,
  limit = 6,
) {
  const actions: Array<ConnectWiseAction> = []

  for (const ticket of tickets) {
    const dueInHours = hoursUntil(ticket.requiredDate)
    const ageHours = hoursSince(ticket.dateEntered)

    if (dueInHours !== null && dueInHours < 0) {
      actions.push({
        ticket,
        kind: 'sla-breach',
        label: 'SLA breach',
        detail: `Required ${Math.abs(Math.round(dueInHours))}h ago`,
        severity: 'critical',
        sort: -10_000 + dueInHours,
      })
      continue
    }

    if (dueInHours !== null && dueInHours <= 8) {
      actions.push({
        ticket,
        kind: 'sla-risk',
        label: 'SLA risk',
        detail: `Due in ${Math.max(0, Math.round(dueInHours))}h`,
        severity: 'high',
        sort: -8_000 + dueInHours,
      })
      continue
    }

    if (hasApprovalSignal(ticket)) {
      actions.push({
        ticket,
        kind: 'approval',
        label: 'Approval needed',
        detail: ticket.status || 'Review approval path',
        severity: 'high',
        sort: -6_000,
      })
      continue
    }

    if (ticket.owner === 'Unassigned') {
      actions.push({
        ticket,
        kind: 'unassigned',
        label: 'Assign owner',
        detail: `${ticket.board || 'Unknown board'} has no owner`,
        severity: 'high',
        sort: -5_000,
      })
      continue
    }

    if (hasHighPrioritySignal(ticket)) {
      actions.push({
        ticket,
        kind: 'priority',
        label: 'Priority watch',
        detail: ticket.priority || 'High priority',
        severity: 'medium',
        sort: -3_000,
      })
      continue
    }

    if (ageHours !== null && ageHours >= 72) {
      actions.push({
        ticket,
        kind: 'stale',
        label: 'Stale ticket',
        detail: `${Math.round(ageHours)}h old`,
        severity: 'medium',
        sort: -1_000 - ageHours,
      })
    }
  }

  return actions.sort((left, right) => left.sort - right.sort).slice(0, limit)
}

export function getItOpsSourceState(
  data: ItOpsData | null,
  error?: string | null,
) {
  if (error && /auth|unauthorized|token|connectwise/i.test(error)) {
    return 'auth-required'
  }
  if (!data?.analytics?.recentTickets?.length) return 'zero-ticket'
  if (data.analytics.errors?.length || data.overview?.warning)
    return 'stale-source'
  return 'healthy'
}

export function buildExecutiveDashboardStats(
  data: ItOpsData | null,
  actionQueue = buildConnectWiseActionQueue(
    data?.analytics?.recentTickets || [],
  ),
): ExecutiveDashboardStats {
  const tickets = data?.analytics?.recentTickets || []
  const stats = data?.analytics?.ticketStats
  const slaActionCount = actionQueue.filter(
    (action) => action.kind === 'sla-breach' || action.kind === 'sla-risk',
  ).length
  const approvalActionCount = actionQueue.filter(
    (action) => action.kind === 'approval',
  ).length
  const unassignedCount = tickets.filter(
    (ticket) => ticket.owner === 'Unassigned',
  ).length
  const highPriorityCount = tickets.filter(hasHighPrioritySignal).length
  const topBoard = [...(data?.analytics?.queueBreakdown || [])].sort(
    (left, right) => right.count - left.count,
  )[0]
  const actionItems = data?.overview?.actionItems || []
  const tylerActionCount = actionItems.filter((item) => item.isTyler).length
  const directReportActionCount = actionItems.filter(
    (item) => item.isDirectReport,
  ).length
  const tylerTouchedTicketCount = tickets.filter((ticket) =>
    /tyler/i.test(`${ticket.lastUpdatedBy || ''} ${ticket.owner || ''}`),
  ).length
  const exceptionCount = actionQueue.length
  const slaCompliancePct = stats?.slaCompliancePct ?? 0
  const posture: ExecutiveDashboardStats['posture'] =
    slaActionCount > 0 || slaCompliancePct < 90
      ? 'Escalate'
      : approvalActionCount > 0 || unassignedCount > 0 || exceptionCount > 0
        ? 'Watch'
        : 'Stable'

  return {
    posture,
    postureDetail:
      posture === 'Escalate'
        ? 'SLA/compliance pressure.'
        : posture === 'Watch'
          ? 'Review approvals, owners, aging.'
          : 'No executive blockers.',
    openTickets: stats?.open ?? 0,
    closedToday: stats?.closedToday ?? 0,
    slaCompliancePct,
    avgResolutionHours: stats?.avgResolutionHours ?? 0,
    exceptionCount,
    slaActionCount,
    approvalActionCount,
    unassignedCount,
    highPriorityCount,
    topBoard: topBoard?.queue || 'None',
    topBoardCount: topBoard?.count || 0,
    tylerActionCount,
    directReportActionCount,
    tylerTouchedTicketCount,
    standupCount: data?.overview?.totalMeetings ?? 0,
    recurringIssueCount: data?.overview?.recurringIssues?.length ?? 0,
  }
}

export function buildItOpsBriefing(data: ItOpsData | null) {
  return [
    '# IT Ops Briefing',
    '',
    `ConnectWise source: ${data?.analytics?.fetchedAt || 'unknown'}`,
    `Graph/standup source: ${data?.overview?.generatedAt || 'unknown'}`,
    `Open tickets: ${data?.analytics?.ticketStats.open ?? 0}`,
    `SLA compliance: ${data?.analytics?.ticketStats.slaCompliancePct ?? 0}%`,
    `Approvals: ${buildConnectWiseActionQueue(data?.analytics?.recentTickets || []).filter((action) => action.kind === 'approval').length}`,
  ].join('\n')
}

export function getNativePsaGuidance() {
  return 'Use native ConnectWise approval/workflow links first. Warn before any external or non-native workaround.'
}

export function getConnectWiseTicketUrl(ticket: ConnectWiseTicket) {
  return ticket.ticketUrl || ticket.url || null
}

export function getTicketSlaLabel(ticket: ConnectWiseTicket, now = Date.now()) {
  const due = ticket.requiredDate
    ? new Date(ticket.requiredDate).getTime()
    : NaN
  if (!Number.isFinite(due)) return 'No required date'
  const dueInHours = (due - now) / 3_600_000
  if (dueInHours < 0) return `Breach ${Math.abs(Math.round(dueInHours))}h`
  if (dueInHours <= 8) return `Due ${Math.max(0, Math.round(dueInHours))}h`
  return `Due ${Math.round(dueInHours / 24)}d`
}

export function getTicketApprovalBoundary(ticket: ConnectWiseTicket) {
  return hasApprovalSignal(ticket)
    ? 'Native ConnectWise approval'
    : 'Workspace-derived insight'
}

export function buildClientUpdate(ticket: ConnectWiseTicket) {
  return [
    `Client update for ticket #${ticket.id}`,
    '',
    `Summary: ${ticket.summary}`,
    `Status: ${ticket.status || 'unknown'}`,
    `Owner: ${ticket.owner || 'unassigned'}`,
    `Next step: We are tracking this through the native ConnectWise workflow and will update the ticket as work progresses.`,
  ].join('\n')
}

export function buildInternalTicketBrief(ticket: ConnectWiseTicket) {
  return [
    `#${ticket.id} ${ticket.summary}`,
    `Company: ${ticket.company || 'unknown'}`,
    `Board: ${ticket.board || 'unknown'}`,
    `Status: ${ticket.status || 'unknown'}`,
    `Priority: ${ticket.priority || 'unknown'}`,
    `Owner: ${ticket.owner || 'unassigned'}`,
    `SLA: ${getTicketSlaLabel(ticket)}`,
    `Boundary: ${getTicketApprovalBoundary(ticket)}`,
    getConnectWiseTicketUrl(ticket)
      ? `ConnectWise: ${getConnectWiseTicketUrl(ticket)}`
      : 'ConnectWise: open by ticket id in PSA',
  ].join('\n')
}

export function buildItOpsDiagnosticsExport(data: ItOpsData | null) {
  return JSON.stringify(
    {
      source: {
        connectWiseFetchedAt: data?.analytics?.fetchedAt || null,
        standupGeneratedAt: data?.overview?.generatedAt || null,
        refreshedAt: data?.refreshedAt || null,
        errors: data?.analytics?.errors || [],
        warning: data?.overview?.warning || null,
      },
      ticketStats: data?.analytics?.ticketStats || null,
      sourceState: getItOpsSourceState(data),
      nativePsaBoundary: getNativePsaGuidance(),
      actionQueue: buildConnectWiseActionQueue(
        data?.analytics?.recentTickets || [],
      ).map((action) => ({
        kind: action.kind,
        label: action.label,
        ticketId: action.ticket.id,
        severity: action.severity,
      })),
    },
    null,
    2,
  )
}

function actionTone(severity: ConnectWiseAction['severity']) {
  return workspaceStatusClass(normalizeWorkspaceStatusTone(severity))
}

function appToneForItOps(
  state: 'ok' | 'warn' | 'bad',
): 'green' | 'amber' | 'red' {
  if (state === 'ok') return 'green'
  if (state === 'warn') return 'amber'
  return 'red'
}

export function ItOpsScreen() {
  const [data, setData] = useState<ItOpsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ticketSearch, setTicketSearch] = useState('')
  const [boardFilter, setBoardFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [ticketMode, setTicketMode] = useState<
    'all' | 'approvals' | 'sla-risk' | 'unassigned' | 'recently-touched'
  >('all')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(apiPath('/api/ops/it-ops'))
      const payload = (await response.json()) as ItOpsData
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load IT Ops')
      }
      startTransition(() => {
        setData(payload)
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IT Ops')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const directReportActions = useMemo(
    () =>
      (data?.overview?.actionItems || []).filter(
        (item) => item.isDirectReport || item.isTyler,
      ),
    [data],
  )
  const connectWiseErrors = data?.analytics?.errors || []
  const ticketBoards = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          (data?.analytics?.recentTickets || [])
            .map((ticket) => ticket.board)
            .filter(Boolean),
        ),
      ).sort(),
    ],
    [data?.analytics?.recentTickets],
  )
  const ticketPriorities = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          (data?.analytics?.recentTickets || [])
            .map((ticket) => ticket.priority)
            .filter(Boolean),
        ),
      ).sort(),
    ],
    [data?.analytics?.recentTickets],
  )
  const visibleTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase()
    return (data?.analytics?.recentTickets || []).filter((ticket) => {
      const boardMatches = boardFilter === 'All' || ticket.board === boardFilter
      const priorityMatches =
        priorityFilter === 'All' || ticket.priority === priorityFilter
      if (!boardMatches) return false
      if (!priorityMatches) return false
      if (ticketMode === 'approvals' && !hasApprovalSignal(ticket)) return false
      if (
        ticketMode === 'sla-risk' &&
        !buildConnectWiseActionQueue([ticket]).some(
          (action) =>
            action.kind === 'sla-breach' || action.kind === 'sla-risk',
        )
      )
        return false
      if (ticketMode === 'unassigned' && ticket.owner !== 'Unassigned')
        return false
      if (
        ticketMode === 'recently-touched' &&
        !/tyler/i.test(`${ticket.lastUpdatedBy || ''} ${ticket.owner || ''}`)
      )
        return false
      if (!q) return true
      return [
        String(ticket.id),
        ticket.summary,
        ticket.board,
        ticket.status,
        ticket.priority,
        ticket.owner,
        ticket.company,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [
    boardFilter,
    data?.analytics?.recentTickets,
    priorityFilter,
    ticketSearch,
    ticketMode,
  ])
  const selectedTicket = useMemo(
    () =>
      (data?.analytics?.recentTickets || []).find(
        (ticket) => String(ticket.id) === selectedTicketId,
      ) || null,
    [data?.analytics?.recentTickets, selectedTicketId],
  )
  const actionQueue = useMemo(
    () => buildConnectWiseActionQueue(data?.analytics?.recentTickets || []),
    [data?.analytics?.recentTickets],
  )
  const slaActionCount = actionQueue.filter(
    (action) => action.kind === 'sla-breach' || action.kind === 'sla-risk',
  ).length
  const approvalActionCount = actionQueue.filter(
    (action) => action.kind === 'approval',
  ).length
  const executiveStats = useMemo(
    () => buildExecutiveDashboardStats(data, actionQueue),
    [actionQueue, data],
  )
  const sourceState = getItOpsSourceState(data, error)
  const commandTone =
    executiveStats.posture === 'Escalate'
      ? 'bad'
      : executiveStats.posture === 'Watch'
        ? 'warn'
        : 'ok'
  const commandTiles: Array<{
    id: string
    title: string
    value: string
    detail: string
    tone: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
    action: ItOpsCommandAction
  }> = [
    {
      id: 'queue',
      title: 'Queue',
      value: String(executiveStats.exceptionCount),
      detail: executiveStats.postureDetail,
      tone: appToneForItOps(commandTone),
      action: 'queue',
    },
    {
      id: 'sla',
      title: 'SLA',
      value: `${executiveStats.slaCompliancePct}%`,
      detail: `${executiveStats.slaActionCount} risk`,
      tone: executiveStats.slaActionCount > 0 ? 'red' : 'green',
      action: 'sla',
    },
    {
      id: 'approvals',
      title: 'Approvals',
      value: String(executiveStats.approvalActionCount),
      detail: 'Native PSA',
      tone: executiveStats.approvalActionCount > 0 ? 'amber' : 'green',
      action: 'approvals',
    },
    {
      id: 'tickets',
      title: 'Tickets',
      value: String(executiveStats.openTickets),
      detail: `${executiveStats.closedToday} closed`,
      tone: executiveStats.openTickets > 0 ? 'blue' : 'neutral',
      action: 'tickets',
    },
    {
      id: 'standups',
      title: 'Standups',
      value: String(executiveStats.standupCount),
      detail: `${executiveStats.directReportActionCount} DR actions`,
      tone: executiveStats.directReportActionCount > 0 ? 'amber' : 'green',
      action: 'standups',
    },
  ]

  function activateItOpsCommand(action: ItOpsCommandAction) {
    if (action === 'sla') {
      setTicketMode('sla-risk')
      return
    }
    if (action === 'approvals') {
      setTicketMode('approvals')
      return
    }
    if (action === 'standups') {
      window.location.href = withBasePath('/meetings')
      return
    }
    setTicketMode('all')
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, button, [contenteditable]')
      ) {
        return
      }
      if (!visibleTickets.length) return
      const selectedIndex = Math.max(
        0,
        visibleTickets.findIndex(
          (ticket) => String(ticket.id) === selectedTicketId,
        ),
      )
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
        event.preventDefault()
        const next =
          visibleTickets[Math.min(visibleTickets.length - 1, selectedIndex + 1)]
        setSelectedTicketId(String(next.id))
      }
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const next = visibleTickets[Math.max(0, selectedIndex - 1)]
        setSelectedTicketId(String(next.id))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTicketId, visibleTickets])

  function exportExceptionReport() {
    const lines = [
      '# ConnectWise Exception Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Source pull: ${data?.analytics?.fetchedAt || data?.refreshedAt || 'unknown'}`,
      '',
      '## Errors',
      ...(connectWiseErrors.length > 0
        ? connectWiseErrors.map((item) => `- ${item}`)
        : ['- none reported']),
      '',
      '## Visible Tickets',
      ...visibleTickets.map(
        (ticket) =>
          `- #${ticket.id} ${ticket.summary} | ${ticket.company} | ${ticket.board} | ${ticket.status} | ${ticket.priority} | ${ticket.owner}`,
      ),
      '',
      '## Action Queue',
      ...(actionQueue.length > 0
        ? actionQueue.map(
            (action) =>
              `- ${action.label}: #${action.ticket.id} ${action.ticket.summary} | ${action.detail}`,
          )
        : ['- none']),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'connectwise-exception-report.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copySelectedTicket(template: 'client' | 'internal') {
    if (!selectedTicket) return
    await navigator.clipboard
      .writeText(
        template === 'client'
          ? buildClientUpdate(selectedTicket)
          : buildInternalTicketBrief(selectedTicket),
      )
      .catch(() => {})
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-1 pb-[calc(var(--tabbar-h,0px)+12px)] sm:gap-4 sm:px-2 sm:pb-6">
      <div className={shellClassName()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Ops
            </div>
            <h1 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
              IT Ops / ConnectWise
            </h1>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Tickets, SLA, standups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
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
              onClick={exportExceptionReport}
              disabled={!data}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Report
            </button>
          </div>
        </div>
        <div className="mt-3 hidden gap-2 md:mt-4 md:grid md:grid-cols-4">
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(error ? 'bad' : connectWiseErrors.length > 0 ? 'warn' : 'ok')}`}
          >
            ConnectWise{' '}
            {error
              ? 'offline'
              : connectWiseErrors.length > 0
                ? 'degraded'
                : 'healthy'}
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone((data?.analytics?.ticketStats.open ?? 0) > 0 ? 'ok' : 'warn')}`}
          >
            Tickets {data?.analytics?.ticketStats.open ?? 0} open
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(data?.overview?.warning ? 'warn' : 'ok')}`}
          >
            Standups {data?.overview?.totalMeetings ?? 0} tracked
          </span>
          <span className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {formatFreshness(
              data?.analytics?.fetchedAt ||
                data?.overview?.generatedAt ||
                data?.refreshedAt,
            )}
          </span>
        </div>
        <ToolsActionDock
          className="mt-3 hidden sm:mt-4 md:block"
          label="ConnectWise quick actions"
          items={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: 'refresh',
              onClick: () => void load(),
              disabled: loading,
              tone: 'primary',
              meta: 'Sync',
            },
            {
              id: 'approvals',
              label: 'Approvals',
              icon: 'shield',
              onClick: () => setTicketMode('approvals'),
              tone: approvalActionCount > 0 ? 'warning' : 'good',
              meta: `${approvalActionCount} open`,
            },
            {
              id: 'SLA',
              label: 'SLA',
              icon: 'check',
              onClick: () => setTicketMode('sla-risk'),
              tone: slaActionCount > 0 ? 'danger' : 'good',
              meta: `${slaActionCount} risk`,
            },
            {
              id: 'report',
              label: 'Report',
              icon: 'download',
              onClick: exportExceptionReport,
              disabled: !data,
              meta: 'MD',
            },
            {
              id: 'task',
              label: 'Task',
              icon: 'task',
              href: withBasePath('/tasks?create=task&source=it-ops'),
              meta: 'Follow-up',
            },
          ]}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">IT Ops unavailable</div>
          <div className="mt-1">{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-red-300 bg-red-100/60 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {data?.overview?.warning ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {data.overview.warning}
        </div>
      ) : null}

      {!loading ? (
        <AppSurface>
          <AppSectionHeader
            title="IT Ops command center"
            meta="ConnectWise, SLA, approvals, standups"
            action={
              <AppStatusPill tone={appToneForItOps(commandTone)}>
                {executiveStats.posture}
              </AppStatusPill>
            }
          />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {commandTiles.map((tile) => (
              <AppTile
                key={tile.id}
                title={tile.title}
                value={tile.value}
                detail={tile.detail}
                icon={IT_OPS_COMMAND_ICONS[tile.action]}
                tone={tile.tone}
                actionLabel={
                  tile.action === 'standups'
                    ? 'Meetings'
                    : tile.action === 'sla'
                      ? 'SLA'
                      : tile.action === 'approvals'
                        ? 'Review'
                        : 'Open'
                }
                className="min-h-[118px]"
                onClick={() => activateItOpsCommand(tile.action)}
              />
            ))}
          </div>
        </AppSurface>
      ) : null}

      <section className={`${shellClassName()} hidden md:block`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Executive Dashboard
            </div>
            <h2 className="mt-1 text-base font-semibold text-primary-900 dark:text-neutral-100">
              IT director view
            </h2>
            <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              {executiveStats.postureDetail}
            </p>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${stripTone(
              executiveStats.posture === 'Escalate'
                ? 'bad'
                : executiveStats.posture === 'Watch'
                  ? 'warn'
                  : 'ok',
            )}`}
          >
            {executiveStats.posture}
          </span>
        </div>

        <ToolsStatusRail
          className="mt-4"
          label="ConnectWise executive stats"
          items={[
            {
              id: 'sla',
              label: 'SLA',
              value: `${executiveStats.slaCompliancePct}%`,
              tone: executiveStats.slaCompliancePct >= 90 ? 'good' : 'warning',
              progress: executiveStats.slaCompliancePct,
            },
            {
              id: 'exceptions',
              label: 'Exceptions',
              value: String(executiveStats.exceptionCount),
              tone: executiveStats.exceptionCount > 0 ? 'warning' : 'good',
              progress: Math.min(100, executiveStats.exceptionCount * 15),
            },
            {
              id: 'board',
              label: 'Board',
              value: String(executiveStats.topBoardCount),
              progress: Math.min(100, executiveStats.topBoardCount * 10),
            },
            {
              id: 'tyler',
              label: 'Tyler',
              value: String(executiveStats.tylerActionCount),
              tone: executiveStats.tylerActionCount > 0 ? 'warning' : 'good',
              progress: Math.min(100, executiveStats.tylerActionCount * 20),
            },
          ]}
        />
      </section>

      <section className={`${shellClassName()} md:hidden`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Glance
            </div>
            <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
              {slaActionCount + approvalActionCount}
            </div>
            <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              SLA / approval
            </div>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${stripTone(
              slaActionCount > 0
                ? 'bad'
                : approvalActionCount > 0
                  ? 'warn'
                  : 'ok',
            )}`}
          >
            {sourceState}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {actionQueue.slice(0, 3).map((action) => (
            <button
              key={`mobile-${action.kind}-${action.ticket.id}`}
              type="button"
              onClick={() => setSelectedTicketId(String(action.ticket.id))}
              className={`rounded-xl border px-3 py-2 text-left ${actionTone(action.severity)}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.12em]">
                {action.label}
              </div>
              <div className="mt-1 line-clamp-1 text-sm font-medium">
                #{action.ticket.id} {action.ticket.summary}
              </div>
            </button>
          ))}
          {actionQueue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/50 px-3 py-3 text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              No blockers.
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${shellClassName()} hidden md:block`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Queue
            </div>
            <h2 className="mt-1 text-base font-semibold text-primary-900 dark:text-neutral-100">
              Tickets + SLA
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-primary-600 dark:text-neutral-400">
              Ranked risk.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-lg font-semibold text-primary-900 dark:text-neutral-100">
                {actionQueue.length}
              </div>
              <div className="text-primary-600 dark:text-neutral-400">
                queued
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="text-lg font-semibold">{slaActionCount}</div>
              <div>risk</div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-lg font-semibold text-primary-900 dark:text-neutral-100">
                {approvalActionCount}
              </div>
              <div className="text-primary-600 dark:text-neutral-400">ok</div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {actionQueue.slice(0, 4).map((action) => (
            <article
              key={`${action.kind}-${action.ticket.id}`}
              className={`rounded-xl border px-3 py-3 ${actionTone(action.severity)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {action.label}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold">
                    #{action.ticket.id} {compactText(action.ticket.summary, 54)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[11px]">
                  {action.detail}
                </span>
              </div>
              <div className="mt-2 truncate text-xs opacity-80">
                {compactText(action.ticket.company, 24)} ·{' '}
                {compactText(action.ticket.board, 18)} ·{' '}
                {compactText(action.ticket.owner, 18)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(String(action.ticket.id))}
                  className="rounded-lg border border-current/20 px-2 py-1 text-xs font-medium"
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(String(action.ticket.id))
                  }
                  className="rounded-lg border border-current/20 px-2 py-1 text-xs font-medium"
                >
                  ID
                </button>
              </div>
            </article>
          ))}
          {actionQueue.length === 0 ? (
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              No ticket actions in this pull.
            </div>
          ) : null}
        </div>
      </section>

      <div className="hidden gap-4 md:grid xl:grid-cols-[1.15fr_0.85fr]">
        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Briefing
          </h2>
          <div className="mt-3 line-clamp-3 text-sm text-primary-800 dark:text-neutral-200">
            {data?.analytics?.briefing || 'No briefing.'}
          </div>
          {(data?.analytics?.errors || []).length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              {(data?.analytics?.errors || []).join(' | ')}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Boards
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.queueBreakdown || [])
                  .slice(0, 6)
                  .map((item) => (
                    <div
                      key={item.queue}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-primary-800 dark:text-neutral-200">
                        {item.queue}
                      </span>
                      <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                        {item.count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Priority
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.priorityBreakdown || [])
                  .slice(0, 6)
                  .map((item) => (
                    <div
                      key={item.priority}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-primary-800 dark:text-neutral-200">
                        {item.priority}
                      </span>
                      <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                        {item.count}
                      </span>
                    </div>
                  ))}
                {(data?.analytics?.priorityBreakdown || []).length === 0 ? (
                  <div className="text-sm text-primary-500 dark:text-neutral-400">
                    No priority data.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900 md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                  Tickets
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="search"
                    aria-label="Search ConnectWise tickets"
                    value={ticketSearch}
                    onChange={(event) =>
                      setTicketSearch(event.currentTarget.value)
                    }
                    placeholder="Search tickets"
                    className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                  <select
                    aria-label="Filter tickets by service board"
                    value={boardFilter}
                    onChange={(event) =>
                      setBoardFilter(event.currentTarget.value)
                    }
                    className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    {ticketBoards.map((board) => (
                      <option key={board} value={board}>
                        {board}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter tickets by priority"
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(event.currentTarget.value)
                    }
                    className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    {ticketPriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter ConnectWise ticket mode"
                    value={ticketMode}
                    onChange={(event) =>
                      setTicketMode(
                        event.currentTarget.value as typeof ticketMode,
                      )
                    }
                    className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    <option value="all">All</option>
                    <option value="approvals">Approval</option>
                    <option value="sla-risk">SLA risk</option>
                    <option value="unassigned">Unassigned</option>
                    <option value="recently-touched">Tyler touched</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {visibleTickets.slice(0, 5).map((ticket) => (
                  <div
                    key={String(ticket.id)}
                    data-testid="connectwise-ticket"
                    className={`rounded-lg border px-3 py-2 text-sm dark:border-neutral-800 ${
                      selectedTicketId === String(ticket.id)
                        ? 'border-primary-400 bg-primary-100/80 dark:bg-neutral-900'
                        : 'border-primary-200 bg-primary-50/70 dark:bg-neutral-950'
                    }`}
                  >
                    <div className="truncate font-medium text-primary-900 dark:text-neutral-100">
                      #{ticket.id} {compactText(ticket.summary, 62)}
                    </div>
                    <div className="mt-1 truncate text-xs text-primary-600 dark:text-neutral-400">
                      {compactText(ticket.company, 22)} ·{' '}
                      {compactText(ticket.board, 16)} ·{' '}
                      {compactText(ticket.status, 16)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`rounded-full border px-2 py-1 ${stripTone(
                          getTicketSlaLabel(ticket).startsWith('Breach')
                            ? 'bad'
                            : getTicketSlaLabel(ticket).startsWith('Due ')
                              ? 'warn'
                              : 'ok',
                        )}`}
                      >
                        {getTicketSlaLabel(ticket)}
                      </span>
                      <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                        {compactText(ticket.owner || 'Unassigned', 16)}
                      </span>
                      {hasApprovalSignal(ticket) ? (
                        <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                          PSA approval
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTicketId((current) =>
                          current === String(ticket.id)
                            ? null
                            : String(ticket.id),
                        )
                      }
                      className="mt-2 text-xs text-primary-600 underline-offset-2 hover:underline dark:text-neutral-400"
                    >
                      {selectedTicketId === String(ticket.id)
                        ? 'Hide'
                        : 'Details'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(String(ticket.id))
                      }
                      className="ml-3 mt-2 text-xs text-primary-600 underline-offset-2 hover:underline dark:text-neutral-400"
                    >
                      ID
                    </button>
                    {getConnectWiseTicketUrl(ticket) ? (
                      <a
                        href={getConnectWiseTicketUrl(ticket) || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-3 mt-2 inline-block text-xs text-primary-600 underline-offset-2 hover:underline dark:text-neutral-400"
                      >
                        PSA
                      </a>
                    ) : null}
                  </div>
                ))}
                {selectedTicket ? (
                  <div className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                      Detail
                    </div>
                    <div className="mt-2 font-medium text-primary-900 dark:text-neutral-100">
                      #{selectedTicket.id}{' '}
                      {compactText(selectedTicket.summary, 70)}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-primary-600 dark:text-neutral-400 sm:grid-cols-2">
                      <div>Company {selectedTicket.company || 'unknown'}</div>
                      <div>Owner {selectedTicket.owner || 'unknown'}</div>
                      <div>Board {selectedTicket.board || 'unknown'}</div>
                      <div>Status {selectedTicket.status || 'unknown'}</div>
                      <div>Priority {selectedTicket.priority || 'unknown'}</div>
                      <div>
                        Entered {selectedTicket.dateEntered || 'unknown'}
                      </div>
                      <div>
                        Required {selectedTicket.requiredDate || 'not set'}
                      </div>
                      <div>SLA {getTicketSlaLabel(selectedTicket)}</div>
                      <div>
                        Boundary {getTicketApprovalBoundary(selectedTicket)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copySelectedTicket('client')}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        Client
                      </button>
                      <button
                        type="button"
                        onClick={() => void copySelectedTicket('internal')}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        Internal
                      </button>
                      {getConnectWiseTicketUrl(selectedTicket) ? (
                        <a
                          href={
                            getConnectWiseTicketUrl(selectedTicket) || undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                        >
                          PSA
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {visibleTickets.length === 0 ? (
                  <SetupEmptyState
                    title="No tickets"
                    description="No action for this view."
                    nextAction="Refresh, then check credentials/filters."
                    detail=".config/hermes/tokens/connectwise_config.json"
                    action={
                      <button
                        type="button"
                        onClick={() => void load()}
                        className="rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                      >
                        Refresh
                      </button>
                    }
                  />
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Team
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.teamPerformance || [])
                  .slice(0, 4)
                  .map((member) => (
                    <div
                      key={member.name}
                      className="rounded-lg border border-primary-200 bg-primary-50/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <div className="font-medium text-primary-900 dark:text-neutral-100">
                        {member.name}
                      </div>
                      <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                        {member.ticketsAssigned} in · {member.ticketsResolved}{' '}
                        out · {member.avgResolutionHours}h
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Recurring
          </h2>
          <div className="mt-3 grid gap-2">
            {(data?.overview?.recurringIssues || [])
              .slice(0, 5)
              .map((issue) => (
                <div
                  key={issue.label}
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-primary-900 dark:text-neutral-100">
                      {compactText(issue.label, 42)}
                    </div>
                    <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {issue.count}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                    {issue.firstSeen || '—'} to {issue.lastSeen || '—'}
                  </div>
                </div>
              ))}
            {(data?.overview?.recurringIssues || []).length === 0 ? (
              <div className="text-sm text-primary-500 dark:text-neutral-400">
                No recurring clusters.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="hidden gap-4 md:grid xl:grid-cols-[1fr_1fr]">
        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Direct-report load
          </h2>
          <div className="mt-3 grid gap-2">
            {directReportActions.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-primary-900 dark:text-neutral-100">
                    {item.assignee}
                  </div>
                  <span className="text-xs text-primary-500 dark:text-neutral-400">
                    {item.meetingDate}
                  </span>
                </div>
                <div className="mt-1 text-sm text-primary-700 dark:text-neutral-300">
                  {compactText(item.task, 70)}
                </div>
              </div>
            ))}
            {directReportActions.length === 0 ? (
              <div className="text-sm text-primary-500 dark:text-neutral-400">
                No direct-report actions.
              </div>
            ) : null}
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Standups
          </h2>
          <div className="mt-3 grid gap-2">
            {(data?.overview?.recentMeetings || [])
              .slice(0, 4)
              .map((meeting) => (
                <div
                  key={meeting.id}
                  className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="font-medium text-primary-900 dark:text-neutral-100">
                    {compactText(meeting.title, 54)}
                  </div>
                  <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                    {meeting.date}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {(meeting.actionItems || []).length} actions
                    </span>
                    <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {(meeting.issues || []).length} issues
                    </span>
                    <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {(meeting.absentDirectReports || []).length} absent
                    </span>
                  </div>
                </div>
              ))}
            {(data?.overview?.recentMeetings || []).length === 0 ? (
              <div className="text-sm text-primary-500 dark:text-neutral-400">
                No recent standups.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
