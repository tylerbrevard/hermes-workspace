import { describe, expect, it } from 'vitest'

import {
  buildOpsEmptyReportMessage,
  buildOpsExecutiveSummary,
  buildOpsTaskImportList,
  classifyOpsRiskFamily,
  classifyOpsSnapshotFreshness,
  getOpsActionRoute,
  getOpsConfidenceLabel,
} from './ops-intelligence-screen'

describe('ops intelligence helpers', () => {
  it('classifies risk families from finding text', () => {
    expect(classifyOpsRiskFamily('Graph token credential expired')).toBe('auth')
    expect(classifyOpsRiskFamily('launchd gateway process stale')).toBe(
      'runtime',
    )
    expect(classifyOpsRiskFamily('vitest build failed in CI')).toBe('ci')
    expect(classifyOpsRiskFamily('paid model budget warning')).toBe('model')
  })

  it('builds markdown executive summary and task import list', () => {
    const snapshot = {
      checkedAt: '2026-05-26T12:00:00.000Z',
      summary: {
        dependenciesOk: 2,
        dependenciesWarn: 1,
        dependenciesError: 0,
        incidents: 1,
        scriptsMapped: 3,
        reportsIndexed: 4,
        capabilitiesLive: 5,
        capabilitiesPartial: 6,
        productionOk: 7,
        productionWarn: 1,
        productionError: 1,
      },
      incidents: [
        {
          code: 'GRAPH_DNS_FAIL',
          label: 'Graph DNS',
          severity: 'error' as const,
          count: 1,
          sources: ['graph.log'],
          latestEvidence: 'Could not resolve graph.microsoft.com',
          nextAction: 'Check DNS',
        },
      ],
      productionChecks: [
        {
          id: 'ci',
          label: 'CI comparison',
          status: 'warn' as const,
          detail: 'Remote status unavailable',
          evidence: ['github'],
          nextAction: 'Open checks',
        },
      ],
    }

    const summary = buildOpsExecutiveSummary(snapshot)
    expect(summary).toContain('Ops Intelligence weekly summary')
    expect(summary).toContain('Production: 7 ok, 1 warn, 1 error.')
    expect(summary).toContain('CI comparison')

    expect(buildOpsTaskImportList(snapshot.productionChecks)).toBe(
      '- [ ] CI comparison: Open checks',
    )
  })

  it('classifies stale snapshots and confidence labels', () => {
    const now = new Date('2026-05-27T12:00:00.000Z')

    expect(
      classifyOpsSnapshotFreshness('2026-05-27T10:00:00.000Z', now),
    ).toBe('fresh')
    expect(
      classifyOpsSnapshotFreshness('2026-05-27T01:00:00.000Z', now),
    ).toBe('stale')
    expect(classifyOpsSnapshotFreshness(undefined, now)).toBe('unknown')

    expect(
      getOpsConfidenceLabel('warn', '2026-05-27T10:00:00.000Z', now),
    ).toBe('observed')
    expect(
      getOpsConfidenceLabel('ok', '2026-05-27T01:00:00.000Z', now),
    ).toBe('stale')
    expect(
      getOpsConfidenceLabel('info', '2026-05-27T10:00:00.000Z', now),
    ).toBe('inferred')
  })

  it('builds empty evidence copy and action routes', () => {
    expect(buildOpsEmptyReportMessage(null)).toContain('snapshot loaded')
    expect(
      buildOpsEmptyReportMessage({
        dependencies: [],
        incidents: [],
        reports: [],
        productionChecks: [],
      }),
    ).toContain('runtime probes')

    expect(getOpsActionRoute('Open automation job logs')).toBe('/jobs')
    expect(getOpsActionRoute('Fix provider token setting')).toBe('/settings')
    expect(getOpsActionRoute('Create remediation task')).toBe(
      '/tasks?source=ops-intelligence',
    )
  })
})
