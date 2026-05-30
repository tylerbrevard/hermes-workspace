import { describe, expect, it } from 'vitest'
import {
  buildFailureSparkline,
  buildJobDependencyMap,
  buildJobIncidentReport,
  buildJobsCockpitTiles,
  classifyJobFailureFamily,
  filterJobOutputs,
  filterJobs,
  getAffectedSystems,
  getJobCompletionSla,
  getJobHealth,
  getJobLifecycleState,
  getJobOwnerSource,
  getJobRetryPolicy,
  getJobRunMetadata,
  getLastFailedJob,
  getNextScheduledJob,
  getNoOpContractLabel,
  getOutputPreview,
  groupJobsByOwner,
  isDailyCheckJob,
  jobNeedsTyler,
  jobUsesPaidCall,
  serializeJobsCsv,
  sortJobsForAttention,
} from './jobs-screen-utils'
import type { ClaudeJob, JobOutput } from '@/lib/jobs-api'

function makeJob(overrides: Partial<ClaudeJob>): ClaudeJob {
  return {
    id: 'job-1',
    name: 'Daily backup',
    prompt: 'Run backup script',
    schedule: {},
    enabled: true,
    state: 'scheduled',
    ...overrides,
  }
}

describe('jobs screen workflow helpers', () => {
  it('classifies failed, paused, running, and completed jobs', () => {
    expect(getJobHealth(makeJob({ state: 'running' }))).toBe('running')
    expect(getJobHealth(makeJob({ enabled: false }))).toBe('paused')
    expect(
      getJobHealth(makeJob({ state: 'scheduled', last_run_success: false })),
    ).toBe('failed')
    expect(
      getJobHealth(makeJob({ state: 'scheduled', last_run_success: true })),
    ).toBe('completed')
  })

  it('filters jobs by saved view and search fields', () => {
    const now = new Date('2026-05-21T12:00:00Z').getTime()
    const jobs = [
      makeJob({
        id: 'active',
        name: 'Active digest',
        last_run_at: '2026-05-21T10:00:00Z',
      }),
      makeJob({ id: 'failed', name: 'Mailbox route', last_run_success: false }),
      makeJob({ id: 'paused', name: 'Paused export', enabled: false }),
      makeJob({
        id: 'old',
        name: 'Old report',
        last_run_at: '2026-04-01T10:00:00Z',
      }),
    ]

    expect(filterJobs(jobs, 'failing', '', now).map((job) => job.id)).toEqual([
      'failed',
    ])
    expect(
      filterJobs(jobs, 'active', '', now).map((job) => job.id),
    ).not.toContain('paused')
    expect(filterJobs(jobs, 'recent', '', now).map((job) => job.id)).toEqual([
      'active',
    ])
    expect(filterJobs(jobs, 'daily', '', now).map((job) => job.id)).toEqual([
      'active',
    ])
    expect(filterJobs(jobs, 'paused', '', now).map((job) => job.id)).toEqual([
      'paused',
    ])
    expect(filterJobs(jobs, 'stale', '', now).map((job) => job.id)).toEqual([
      'old',
    ])
    expect(
      filterJobs(jobs, 'all', 'mailbox', now).map((job) => job.id),
    ).toEqual(['failed'])
  })

  it('sorts failed jobs first in the default attention order', () => {
    const jobs = [
      makeJob({
        id: 'completed',
        name: 'Completed job',
        last_run_success: true,
        last_run_at: '2026-05-21T12:00:00Z',
      }),
      makeJob({
        id: 'pending',
        name: 'Pending job',
        next_run_at: '2026-05-21T13:00:00Z',
      }),
      makeJob({
        id: 'failed-old',
        name: 'Older failed job',
        last_run_success: false,
        last_run_at: '2026-05-20T12:00:00Z',
      }),
      makeJob({
        id: 'failed-new',
        name: 'Newer failed job',
        last_run_success: false,
        last_run_at: '2026-05-21T11:00:00Z',
      }),
    ]

    expect(sortJobsForAttention(jobs).map((job) => job.id)).toEqual([
      'failed-new',
      'failed-old',
      'pending',
      'completed',
    ])
    expect(filterJobs(jobs, 'all', '').map((job) => job.id)[0]).toBe(
      'failed-new',
    )
  })

  it('selects the next scheduled job and the most recent failed job', () => {
    const jobs = [
      makeJob({
        id: 'disabled-next',
        enabled: false,
        next_run_at: '2026-05-21T12:00:00Z',
      }),
      makeJob({
        id: 'later-next',
        next_run_at: '2026-05-21T14:00:00Z',
      }),
      makeJob({
        id: 'earliest-next',
        next_run_at: '2026-05-21T13:00:00Z',
      }),
      makeJob({
        id: 'old-failure',
        last_run_success: false,
        last_run_at: '2026-05-20T13:00:00Z',
      }),
      makeJob({
        id: 'new-failure',
        last_run_success: false,
        last_run_at: '2026-05-21T13:00:00Z',
      }),
    ]

    expect(getNextScheduledJob(jobs)?.id).toBe('earliest-next')
    expect(getLastFailedJob(jobs)?.id).toBe('new-failure')
  })

  it('groups jobs by owner with failed, running, and stale counts', () => {
    const now = new Date('2026-05-21T12:00:00Z').getTime()
    const jobs = [
      makeJob({ id: 'hermes', name: 'Hermes digest' }),
      makeJob({
        id: 'codex',
        name: 'Codex automation backup',
        last_run_success: false,
      }),
      makeJob({ id: 'workflow', name: 'Workflow sync', skills: ['mail'] }),
      makeJob({
        id: 'launchd',
        name: 'Launchd plist check',
        prompt: 'launchctl plist check',
        state: 'running',
      }),
      makeJob({
        id: 'manual',
        name: 'Manual one-off cleanup',
        last_run_at: '2026-04-01T12:00:00Z',
      }),
    ]

    expect(groupJobsByOwner(jobs, now)).toEqual([
      { owner: 'Hermes', total: 1, failed: 0, running: 0, stale: 0 },
      { owner: 'Codex', total: 1, failed: 1, running: 0, stale: 0 },
      { owner: 'workflow', total: 1, failed: 0, running: 0, stale: 0 },
      { owner: 'launchd', total: 1, failed: 0, running: 1, stale: 0 },
      { owner: 'manual', total: 1, failed: 0, running: 0, stale: 1 },
    ])
  })

  it('previews and searches job outputs for the logs drawer', () => {
    const outputs: Array<JobOutput> = [
      {
        filename: 'backup.log',
        timestamp: '2026-05-21T12:00:00Z',
        content: 'backup completed',
        size: 16,
      },
      {
        filename: 'mail.log',
        timestamp: '2026-05-21T12:05:00Z',
        content: 'graph timeout',
        size: 13,
      },
    ]

    expect(getOutputPreview(' one\n\n two\tthree ', 20)).toBe('one two three')
    expect(filterJobOutputs(outputs, 'graph')).toEqual([outputs[1]])
    expect(filterJobOutputs(outputs, 'backup.log')).toEqual([outputs[0]])
  })

  it('serializes the current job view as escaped CSV', () => {
    const csv = serializeJobsCsv([
      makeJob({
        name: 'Daily "quoted" backup',
        profile: 'ops',
        schedule_display: 'every day',
        last_run_success: true,
      }),
    ])

    expect(csv).toContain('"Daily ""quoted"" backup"')
    expect(csv).toContain('"ops"')
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('classifies operations metadata for failures, ownership, retry, cost, and incidents', () => {
    const failed = makeJob({
      name: 'Codex Graph export',
      profile: 'ops',
      state: 'failed',
      last_run_success: false,
      last_run_error: 'Graph API unauthorized token expired',
      next_run_at: '2026-05-21T13:00:00Z',
      deliver: ['obsidian'],
      repeat: { times: 3, completed: 1 },
      prompt: 'Use Claude to export the workflow report',
    })

    expect(classifyJobFailureFamily(failed)).toBe('auth')
    expect(getJobOwnerSource(failed)).toBe('Codex')
    expect(getJobLifecycleState(makeJob({ enabled: false }))).toBe('disabled')
    expect(jobNeedsTyler(failed)).toBe(true)
    expect(jobUsesPaidCall(failed)).toBe(true)
    expect(getJobRetryPolicy(failed)).toContain('Retry 1/3')
    expect(getJobCompletionSla(failed)).toContain('5-15m')
    expect(buildJobDependencyMap(failed)).toContain('ops -> obsidian')
    expect(buildFailureSparkline(failed)).toBe('▁▁▂▃▅▇█')
    expect(buildJobIncidentReport(failed)).toContain('Failure family: auth')
    expect(buildJobIncidentReport(failed)).toContain('Affected systems')
    expect(filterJobs([failed], 'blocked', '')).toEqual([failed])
    expect(filterJobs([failed], 'paid', '')).toEqual([failed])
  })

  it('detects daily check jobs for the saved daily view', () => {
    expect(
      isDailyCheckJob(
        makeJob({
          name: 'Morning status digest',
          schedule_display: 'every day at 8am',
        }),
      ),
    ).toBe(true)
    expect(isDailyCheckJob(makeJob({ name: 'One-off export' }))).toBe(false)
  })

  it('builds app-like cockpit tiles for job recovery and routing lanes', () => {
    const tiles = buildJobsCockpitTiles([
      makeJob({
        id: 'failed',
        state: 'failed',
        last_run_success: false,
        last_run_error: 'Graph API timeout',
        next_run_at: '2026-05-21T13:00:00Z',
      }),
      makeJob({
        id: 'blocked',
        state: 'failed',
        last_run_success: false,
        last_run_error: 'Needs Tyler token approval',
        prompt: 'Run Claude paid model task',
      }),
      makeJob({ id: 'running', state: 'running' }),
    ])

    expect(tiles).toMatchObject([
      { id: 'failed', label: 'Failure lane', value: '2', tone: 'danger' },
      { id: 'running', label: 'Running now', value: '1' },
      { id: 'next-due', label: 'Scheduled lane', value: '1' },
      { id: 'blocked', label: 'Needs Tyler', value: '1', tone: 'warning' },
      { id: 'paid', label: 'Paid calls', value: '1', filter: 'paid' },
    ])
  })

  it('summarizes affected systems, no-op contracts, and run metadata', () => {
    const job = makeJob({
      name: 'Outlook NO_REPLY meeting digest',
      prompt:
        'Export meeting tasks to Obsidian and stay silent when no changes',
      deliver: ['obsidian'],
      created_at: '2026-05-21T11:00:00Z',
      last_run_at: '2026-05-21T12:00:00Z',
      updated_at: '2026-05-21T12:08:00Z',
      next_run_at: '2026-05-21T13:00:00Z',
    })

    expect(getAffectedSystems(job)).toEqual([
      'Outlook',
      'Obsidian',
      'Tasks',
      'Meetings',
    ])
    expect(getNoOpContractLabel(job)).toBe('Silent')
    expect(getJobRunMetadata(job)).toMatchObject({
      lastDuration: '8m',
      changedSinceLastRun: expect.stringContaining('Metadata changed'),
    })
  })
})
