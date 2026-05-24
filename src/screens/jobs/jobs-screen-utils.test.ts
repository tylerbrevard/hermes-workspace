import { describe, expect, it } from 'vitest'
import {
  filterJobOutputs,
  filterJobs,
  getJobHealth,
  getOutputPreview,
  serializeJobsCsv,
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
    expect(getJobHealth(makeJob({ state: 'scheduled', last_run_success: false }))).toBe('failed')
    expect(getJobHealth(makeJob({ state: 'scheduled', last_run_success: true }))).toBe('completed')
  })

  it('filters jobs by saved view and search fields', () => {
    const now = new Date('2026-05-21T12:00:00Z').getTime()
    const jobs = [
      makeJob({ id: 'active', name: 'Active digest', last_run_at: '2026-05-21T10:00:00Z' }),
      makeJob({ id: 'failed', name: 'Mailbox route', last_run_success: false }),
      makeJob({ id: 'paused', name: 'Paused export', enabled: false }),
      makeJob({ id: 'old', name: 'Old report', last_run_at: '2026-04-01T10:00:00Z' }),
    ]

    expect(filterJobs(jobs, 'failing', '', now).map((job) => job.id)).toEqual(['failed'])
    expect(filterJobs(jobs, 'active', '', now).map((job) => job.id)).not.toContain('paused')
    expect(filterJobs(jobs, 'recent', '', now).map((job) => job.id)).toEqual(['active'])
    expect(filterJobs(jobs, 'all', 'mailbox', now).map((job) => job.id)).toEqual(['failed'])
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
})
