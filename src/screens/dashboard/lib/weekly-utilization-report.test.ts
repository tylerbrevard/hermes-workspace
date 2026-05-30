import { describe, expect, it } from 'vitest'
import { buildWeeklyWorkspaceUtilizationReport } from './weekly-utilization-report'

describe('buildWeeklyWorkspaceUtilizationReport', () => {
  it('summarizes the last seven days and produces copy-ready markdown', () => {
    const report = buildWeeklyWorkspaceUtilizationReport({
      generatedAt: new Date('2026-05-26T12:00:00.000Z'),
      overviewUpdatedAt: '2026-05-26T11:55:00.000Z',
      activeModel: 'gpt-5-codex',
      phoneSignalCount: 9,
      sessions: [
        {
          key: 'recent',
          title: 'Workspace implementation',
          kind: 'chat',
          status: 'active',
          tokenCount: 12000,
          messageCount: 20,
          toolCallCount: 8,
          startedAt: Date.parse('2026-05-25T12:00:00.000Z'),
          updatedAt: Date.parse('2026-05-25T12:30:00.000Z'),
        },
        {
          key: 'old',
          title: 'Old work',
          kind: 'chat',
          status: 'done',
          tokenCount: 90000,
          messageCount: 100,
          toolCallCount: 40,
          startedAt: Date.parse('2026-05-01T12:00:00.000Z'),
          updatedAt: Date.parse('2026-05-01T12:30:00.000Z'),
        },
      ],
      actionItems: [
        {
          label: 'Gateway data stale',
          detail: 'Refresh gateway overview before review.',
        },
      ],
    })

    expect(
      report.metrics.find((metric) => metric.label === 'Sessions')?.value,
    ).toBe('1')
    expect(
      report.metrics.find((metric) => metric.label === 'Tokens')?.value,
    ).toBe('12,000')
    expect(report.topSessions.map((session) => session.key)).toEqual(['recent'])
    expect(report.markdown).toContain('# Weekly Workspace Utilization')
    expect(report.markdown).toContain('Workspace implementation')
    expect(report.markdown).toContain('Gateway data stale')
  })
})
