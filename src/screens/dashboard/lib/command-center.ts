export type DashboardActionSeverity = 'error' | 'warn' | 'info'

export type DashboardNextActionSeverity = DashboardActionSeverity | 'ok'

export type DashboardActionSummary = {
  label: string
  detail: string
  severity: DashboardActionSeverity
  action: string
}

export type DashboardDiagnosticAction = {
  id: string
  label: string
  severity: DashboardActionSeverity
}

export const DASHBOARD_WORKFLOW_PRESETS = [
  'Morning',
  'Meeting',
  'Focus',
  'Closeout',
] as const

export function calculateDashboardHealthScore({
  actionItemCount,
  degradedSourceCount,
  dashboardStale,
  sessionsStale,
  sessionsUnavailable,
  lilyWorkerOnline,
}: {
  actionItemCount: number
  degradedSourceCount: number
  dashboardStale: boolean
  sessionsStale: boolean
  sessionsUnavailable: boolean
  lilyWorkerOnline: boolean
}): number {
  const penalties =
    Math.min(actionItemCount, 5) * 8 +
    Math.min(degradedSourceCount, 5) * 7 +
    (dashboardStale ? 12 : 0) +
    (sessionsStale ? 10 : 0) +
    (sessionsUnavailable ? 18 : 0) +
    (lilyWorkerOnline ? 0 : 8)

  return Math.max(0, Math.min(100, 100 - penalties))
}

export function buildDashboardStatusBrief({
  healthScore,
  topAction,
  latestSessionTitle,
  sourceHealth,
  overviewFreshness,
  sessionsFreshness,
}: {
  healthScore: number
  topAction: string
  latestSessionTitle: string
  sourceHealth: string
  overviewFreshness: string
  sessionsFreshness: string
}): string {
  return [
    `Hermes Workspace status: ${healthScore}/100.`,
    `Next action: ${topAction}.`,
    `Current workstream: ${latestSessionTitle}.`,
    `Sources: ${sourceHealth}.`,
    `Overview freshness: ${overviewFreshness}; sessions freshness: ${sessionsFreshness}.`,
  ].join('\n')
}

export function buildDashboardNextAction(input: {
  actionItems: Array<DashboardActionSummary>
  dashboardStale: boolean
  sessionsStale: boolean
  latestSessionTitle?: string | null
}): {
  label: string
  detail: string
  action: string
  severity: DashboardNextActionSeverity
} {
  const top = input.actionItems[0]
  if (top) {
    return {
      label: top.label,
      detail: top.detail,
      action: top.action,
      severity: top.severity,
    }
  }
  if (input.dashboardStale || input.sessionsStale) {
    return {
      label: 'Refresh live evidence',
      detail: 'One or more dashboard sources may be stale.',
      action: 'Refresh all',
      severity: 'warn',
    }
  }
  return {
    label: input.latestSessionTitle
      ? `Resume ${input.latestSessionTitle}`
      : 'Start a focused workstream',
    detail: input.latestSessionTitle
      ? 'No blockers are ranked above the current workstream.'
      : 'No recent workstream is available.',
    action: input.latestSessionTitle ? 'Resume' : 'New chat',
    severity: 'ok',
  }
}

export function buildDashboardDiagnostics(input: {
  healthScore: number
  actionItems: Array<DashboardDiagnosticAction>
  dashboardStale: boolean
  sessionsStale: boolean
  overviewFreshness: string
  sessionsFreshness: string
  hiddenWidgets: Array<string>
  degradedSourceCount: number
}): string {
  return JSON.stringify(
    {
      route: '/workspace/dashboard',
      healthScore: input.healthScore,
      actionItemCount: input.actionItems.length,
      topAction: input.actionItems[0]?.label ?? 'none',
      stale: {
        dashboard: input.dashboardStale,
        sessions: input.sessionsStale,
      },
      freshness: {
        overview: input.overviewFreshness,
        sessions: input.sessionsFreshness,
      },
      hiddenWidgets: input.hiddenWidgets,
      degradedSourceCount: input.degradedSourceCount,
      severities: input.actionItems.map((item) => ({
        id: item.id,
        label: item.label,
        severity: item.severity,
      })),
      secretsIncluded: false,
    },
    null,
    2,
  )
}
