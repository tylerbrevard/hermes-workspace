import { describe, expect, it } from 'vitest'

import {
  DASHBOARD_WORKFLOW_PRESETS,
  buildDashboardDiagnostics,
  buildDashboardNextAction,
  buildDashboardStatusBrief,
  calculateDashboardHealthScore,
} from './lib/command-center'

describe('dashboard operator helpers', () => {
  it('keeps dashboard health score bounded and penalty based', () => {
    expect(
      calculateDashboardHealthScore({
        actionItemCount: 0,
        degradedSourceCount: 0,
        dashboardStale: false,
        sessionsStale: false,
        sessionsUnavailable: false,
        lilyWorkerOnline: true,
      }),
    ).toBe(100)

    expect(
      calculateDashboardHealthScore({
        actionItemCount: 8,
        degradedSourceCount: 8,
        dashboardStale: true,
        sessionsStale: true,
        sessionsUnavailable: true,
        lilyWorkerOnline: false,
      }),
    ).toBe(0)
  })

  it('builds a compact copy-ready status brief', () => {
    const brief = buildDashboardStatusBrief({
      healthScore: 73,
      topAction: 'Refresh gateway',
      latestSessionTitle: 'Hermes workspace pass',
      sourceHealth: '1 daily source degraded',
      overviewFreshness: '5m ago',
      sessionsFreshness: 'just now',
    })

    expect(brief).toContain('Hermes Workspace status: 73/100.')
    expect(brief).toContain('Next action: Refresh gateway.')
    expect(brief).toContain('Current workstream: Hermes workspace pass.')
    expect(brief).toContain('Sources: 1 daily source degraded.')
  })

  it('keeps dashboard workflow presets stable', () => {
    expect(DASHBOARD_WORKFLOW_PRESETS).toEqual([
      'Morning',
      'Meeting',
      'Focus',
      'Closeout',
    ])
  })

  it('ranks dashboard next action from blockers, stale sources, or current workstream', () => {
    expect(
      buildDashboardNextAction({
        actionItems: [
          {
            label: 'Gateway data stale',
            detail: 'Last probe was old.',
            severity: 'warn',
            action: 'Refresh gateway',
          },
        ],
        dashboardStale: false,
        sessionsStale: false,
      }),
    ).toMatchObject({
      label: 'Gateway data stale',
      action: 'Refresh gateway',
      severity: 'warn',
    })

    expect(
      buildDashboardNextAction({
        actionItems: [],
        dashboardStale: true,
        sessionsStale: false,
      }),
    ).toMatchObject({
      label: 'Refresh live evidence',
      action: 'Refresh all',
      severity: 'warn',
    })

    expect(
      buildDashboardNextAction({
        actionItems: [],
        dashboardStale: false,
        sessionsStale: false,
        latestSessionTitle: 'Hermes workspace pass',
      }),
    ).toMatchObject({
      label: 'Resume Hermes workspace pass',
      action: 'Resume',
      severity: 'ok',
    })
  })

  it('exports safe dashboard diagnostics with hidden widgets and severity map', () => {
    const diagnostics = JSON.parse(
      buildDashboardDiagnostics({
        healthScore: 88,
        actionItems: [
          {
            id: 'overview-stale',
            label: 'Gateway data stale',
            severity: 'warn',
          },
        ],
        dashboardStale: true,
        sessionsStale: false,
        overviewFreshness: '5m ago',
        sessionsFreshness: 'just now',
        hiddenWidgets: ['logs_tail'],
        degradedSourceCount: 1,
      }),
    )

    expect(diagnostics).toMatchObject({
      route: '/workspace/dashboard',
      healthScore: 88,
      actionItemCount: 1,
      topAction: 'Gateway data stale',
      hiddenWidgets: ['logs_tail'],
      degradedSourceCount: 1,
      secretsIncluded: false,
    })
    expect(diagnostics.severities).toEqual([
      {
        id: 'overview-stale',
        label: 'Gateway data stale',
        severity: 'warn',
      },
    ])
    expect(JSON.stringify(diagnostics)).not.toContain('token')
  })
})
