import { describe, expect, it } from 'vitest'
import {
  buildOperationsCockpitTiles,
  buildOperationsHealthRows,
  filterOperationsHealthRows,
  getOperationsPrimaryAction,
} from './operations-screen'
import type { OperationsAgent } from './hooks/use-operations'

function agent(
  patch: Partial<OperationsAgent> & Pick<OperationsAgent, 'id' | 'name'>,
): OperationsAgent {
  const { id, name, ...rest } = patch
  return {
    id,
    name,
    model: 'gpt-5',
    workspace: `/tmp/${patch.id}`,
    agentDir: `/tmp/${patch.id}`,
    meta: {
      emoji: '',
      description: '',
      systemPrompt: '',
      color: '#3b82f6',
      createdAt: '2026-05-26T00:00:00.000Z',
    },
    shortModel: 'GPT-5',
    status: 'idle',
    sessionKey: `agent:main:ops-${patch.id}`,
    sessions: [],
    latestSession: null,
    jobs: [],
    nextRunAt: null,
    lastActivityAt: null,
    activityLabel: 'No activity yet',
    progressValue: 18,
    progressStatus: 'queued',
    recentOutputs: [],
    needsSetup: false,
    ...rest,
  }
}

describe('operations health helpers', () => {
  it('builds cockpit tiles for active, failed, blocked, waiting, and freshness lanes', () => {
    const rows = buildOperationsHealthRows(
      [
        agent({
          id: 'active',
          name: 'Active',
          status: 'active',
          lastActivityAt: Date.parse('2026-05-26T19:55:00.000Z'),
        }),
        agent({
          id: 'failed',
          name: 'Failed',
          status: 'error',
          lastActivityAt: Date.parse('2026-05-26T19:50:00.000Z'),
        }),
        agent({
          id: 'waiting',
          name: 'Waiting',
          jobs: [
            {
              id: 'job-1',
              name: 'ops:waiting:queued',
              enabled: true,
              schedule: 'daily',
            } as OperationsAgent['jobs'][number],
          ],
          lastActivityAt: Date.parse('2026-05-24T19:50:00.000Z'),
        }),
      ],
      Date.parse('2026-05-26T20:00:00.000Z'),
    )

    expect(buildOperationsCockpitTiles(rows)).toMatchObject([
      { id: 'active', value: '1', filter: 'active', tone: 'good' },
      { id: 'failed', value: '1', filter: 'failed', tone: 'danger' },
      { id: 'blocked', value: '1', filter: 'needs Tyler', tone: 'warning' },
      { id: 'waiting', value: '1', filter: 'all', tone: 'warning' },
      { id: 'freshness', value: '2/3', filter: 'recently changed' },
    ])
  })

  it('builds health rows with setup, freshness, source, and model signals', () => {
    const rows = buildOperationsHealthRows(
      [
        agent({
          id: 'lily',
          name: 'LILY',
          model: '',
          needsSetup: true,
          lastActivityAt: Date.parse('2026-05-25T20:00:00.000Z'),
        }),
        agent({
          id: 'runner',
          name: 'Runner',
          status: 'active',
          jobs: [
            {
              id: 'job-1',
              name: 'ops:runner:daily-run',
              enabled: true,
              schedule: 'daily',
            } as OperationsAgent['jobs'][number],
          ],
          lastActivityAt: Date.parse('2026-05-26T19:55:00.000Z'),
        }),
      ],
      Date.parse('2026-05-26T20:00:00.000Z'),
    )

    expect(rows[0]).toMatchObject({
      needsTyler: true,
      blockedByMe: true,
      latestError: 'Model missing from profile config',
      stale: false,
      modelHealth: 'setup required',
    })
    expect(rows[1]).toMatchObject({
      status: 'active',
      sourceOwner: 'Hermes runtime',
      launchdStatus: 'cron owned',
      modelHealth: 'paid model guard',
    })
  })

  it('filters failed, needs setup, noisy, and recently changed rows', () => {
    const rows = buildOperationsHealthRows(
      [
        agent({ id: 'failed', name: 'Failed', status: 'error' }),
        agent({ id: 'setup', name: 'Setup', model: '', needsSetup: true }),
        agent({
          id: 'fresh',
          name: 'Fresh',
          model: 'local-model',
          lastActivityAt: Date.parse('2026-05-26T19:50:00.000Z'),
        }),
      ],
      Date.parse('2026-05-26T20:00:00.000Z'),
    )

    expect(
      filterOperationsHealthRows(rows, 'failed').map((row) => row.id),
    ).toEqual(['failed'])
    expect(
      filterOperationsHealthRows(rows, 'needs Tyler').map((row) => row.id),
    ).toEqual(['failed', 'setup'])
    expect(
      filterOperationsHealthRows(rows, 'needs setup').map((row) => row.id),
    ).toEqual(['setup'])
    expect(
      filterOperationsHealthRows(rows, 'noisy').map((row) => row.id),
    ).toEqual(['failed', 'setup'])
    expect(
      filterOperationsHealthRows(rows, 'recently changed').map((row) => row.id),
    ).toEqual(['fresh'])
  })

  it('selects the strongest first-viewport primary action', () => {
    const rows = buildOperationsHealthRows(
      [
        agent({ id: 'failed', name: 'Failed', status: 'error' }),
        agent({ id: 'active', name: 'Active', status: 'active' }),
      ],
      Date.parse('2026-05-26T20:00:00.000Z'),
    )

    expect(getOperationsPrimaryAction(rows)).toMatchObject({
      label: 'Inspect failing agent',
      filter: 'failed',
    })

    expect(getOperationsPrimaryAction(rows.slice(1))).toMatchObject({
      label: 'Inspect active agents',
      filter: 'active',
    })

    expect(getOperationsPrimaryAction([])).toMatchObject({
      label: 'Create agent',
      filter: 'all',
    })
  })
})
