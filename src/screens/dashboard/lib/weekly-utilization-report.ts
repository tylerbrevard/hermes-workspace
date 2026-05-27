export type WeeklyUtilizationSession = {
  key: string
  title: string
  kind: string
  status: string
  tokenCount: number
  messageCount: number
  toolCallCount: number
  startedAt: number | null
  updatedAt: number | null
}

export type WeeklyUtilizationMetric = {
  label: string
  value: string
  detail?: string
}

export type WeeklyUtilizationAction = {
  label: string
  detail: string
}

export type WeeklyUtilizationInput = {
  generatedAt: Date
  sessions: Array<WeeklyUtilizationSession>
  overviewUpdatedAt?: string | number | null
  activeModel?: string | null
  gatewayStatus?: string | null
  openTaskCount?: number | null
  meetingCount?: number | null
  phoneSignalCount?: number | null
  actionItems: Array<WeeklyUtilizationAction>
}

export type WeeklyUtilizationReport = {
  title: string
  weekLabel: string
  metrics: Array<WeeklyUtilizationMetric>
  topSessions: Array<WeeklyUtilizationSession>
  recommendedActions: Array<WeeklyUtilizationAction>
  markdown: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function normalizeMs(value: number | null | undefined): number | null {
  if (!value || !Number.isFinite(value)) return null
  return value < 10_000_000_000 ? value * 1000 : value
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatFreshness(value?: string | number | null): string {
  if (!value) return 'unknown'
  const ms = typeof value === 'number' ? normalizeMs(value) : Date.parse(value)
  if (!ms || !Number.isFinite(ms)) return 'unknown'
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function safeTitle(session: WeeklyUtilizationSession): string {
  return session.title.trim() || session.key || 'Untitled session'
}

export function buildWeeklyWorkspaceUtilizationReport(
  input: WeeklyUtilizationInput,
): WeeklyUtilizationReport {
  const end = input.generatedAt
  const start = new Date(end.getTime() - WEEK_MS)
  const weeklySessions = input.sessions.filter((session) => {
    const ms = normalizeMs(session.updatedAt) ?? normalizeMs(session.startedAt)
    return ms !== null && ms >= start.getTime() && ms <= end.getTime()
  })
  const totalMessages = weeklySessions.reduce(
    (sum, session) => sum + Math.max(0, session.messageCount || 0),
    0,
  )
  const totalToolCalls = weeklySessions.reduce(
    (sum, session) => sum + Math.max(0, session.toolCallCount || 0),
    0,
  )
  const totalTokens = weeklySessions.reduce(
    (sum, session) => sum + Math.max(0, session.tokenCount || 0),
    0,
  )
  const topSessions = [...weeklySessions]
    .sort((a, b) => Math.max(0, b.tokenCount || 0) - Math.max(0, a.tokenCount || 0))
    .slice(0, 5)
  const recommendedActions =
    input.actionItems.length > 0
      ? input.actionItems.slice(0, 5)
      : [
          {
            label: 'Plan next week',
            detail: 'No urgent workspace recovery actions are currently queued.',
          },
        ]
  const metrics: Array<WeeklyUtilizationMetric> = [
    {
      label: 'Sessions',
      value: formatNumber(weeklySessions.length),
      detail: 'last 7 days',
    },
    {
      label: 'Messages',
      value: formatNumber(totalMessages),
      detail: 'captured session turns',
    },
    {
      label: 'Tool calls',
      value: formatNumber(totalToolCalls),
      detail: 'agent execution volume',
    },
    {
      label: 'Tokens',
      value: formatNumber(totalTokens),
      detail: 'reported session usage',
    },
    {
      label: 'Active model',
      value: input.activeModel || 'unknown',
      detail: `overview ${formatFreshness(input.overviewUpdatedAt)}`,
    },
    {
      label: 'Daily signals',
      value: formatNumber(input.phoneSignalCount ?? 0),
      detail: 'phone cockpit items',
    },
  ]
  const weekLabel = `${formatDate(start)} - ${formatDate(end)}`
  const markdown = [
    `# Weekly Workspace Utilization`,
    '',
    `**Week:** ${weekLabel}`,
    `**Generated:** ${formatFreshness(end.getTime())}`,
    '',
    '## Metrics',
    ...metrics.map((metric) =>
      `- **${metric.label}:** ${metric.value}${metric.detail ? ` (${metric.detail})` : ''}`,
    ),
    '',
    '## Top Sessions',
    ...(topSessions.length > 0
      ? topSessions.map(
          (session, index) =>
            `${index + 1}. ${safeTitle(session)} - ${formatNumber(session.tokenCount)} tokens, ${formatNumber(session.messageCount)} messages, ${formatNumber(session.toolCallCount)} tool calls`,
        )
      : ['- No sessions were reported in the last seven days.']),
    '',
    '## Recommended Actions',
    ...recommendedActions.map((action) => `- **${action.label}:** ${action.detail}`),
    '',
  ].join('\n')

  return {
    title: 'Weekly workspace utilization',
    weekLabel,
    metrics,
    topSessions,
    recommendedActions,
    markdown,
  }
}
