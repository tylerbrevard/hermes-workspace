import type { ClaudeJob, JobOutput } from '@/lib/jobs-api'

export type JobSavedFilter = 'all' | 'active' | 'failing' | 'recent'

export function formatNextRun(nextRun?: string | null): string {
  if (!nextRun) return '-'
  try {
    const d = new Date(nextRun)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    if (diffMs < 0) return 'overdue'
    if (diffMs < 60_000) return 'in < 1m'
    if (diffMs < 3_600_000) return `in ${Math.round(diffMs / 60_000)}m`
    if (diffMs < 86_400_000) return `in ${Math.round(diffMs / 3_600_000)}h`
    return d.toLocaleDateString()
  } catch {
    return nextRun
  }
}

export function formatRunTimestamp(value?: string | null): string {
  if (!value) return 'Never run'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function getOutputPreview(content: string, maxLength = 200): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

export function getLastRunStatus(job: ClaudeJob): {
  label: string
  color: string
} {
  if (!job.last_run_at) {
    return {
      label: 'Never run',
      color: 'var(--theme-muted)',
    }
  }
  if (job.last_run_success === true) {
    return {
      label: 'Last run succeeded',
      color: 'var(--theme-success)',
    }
  }
  if (job.last_run_success === false) {
    return {
      label: 'Last run failed',
      color: 'var(--theme-danger)',
    }
  }
  return {
    label: 'Last run unknown',
    color: 'var(--theme-muted)',
  }
}

export function getJobHealth(
  job: ClaudeJob,
): 'paused' | 'running' | 'failed' | 'completed' | 'pending' {
  const state = job.state.toLowerCase()
  if (state === 'paused' || !job.enabled) return 'paused'
  if (state === 'running') return 'running'
  if (job.last_run_success === false || ['failed', 'error', 'errored'].includes(state)) {
    return 'failed'
  }
  if (job.last_run_success === true || state === 'completed') return 'completed'
  return 'pending'
}

export function getSourceLabel(job: ClaudeJob): string {
  if (job.profile || job.profile_name) return job.profile || job.profile_name || 'Hermes profile'
  if (job.jobId) return 'Gateway job'
  return 'Hermes cron'
}

export function filterJobs(
  jobs: Array<ClaudeJob>,
  savedFilter: JobSavedFilter,
  search: string,
  now = Date.now(),
): Array<ClaudeJob> {
  const byView = jobs.filter((job) => {
    const health = getJobHealth(job)
    if (savedFilter === 'active') return job.enabled && health !== 'paused'
    if (savedFilter === 'failing') return health === 'failed'
    if (savedFilter === 'recent') {
      if (!job.last_run_at) return false
      return now - new Date(job.last_run_at).getTime() < 7 * 86_400_000
    }
    return true
  })
  if (!search.trim()) return byView
  const q = search.toLowerCase()
  return byView.filter(
    (j) =>
      j.name.toLowerCase().includes(q) ||
      j.prompt.toLowerCase().includes(q) ||
      j.profile?.toLowerCase().includes(q) ||
      j.schedule_display?.toLowerCase().includes(q) ||
      j.jobId?.toLowerCase().includes(q),
  )
}

export function filterJobOutputs(
  outputs: Array<JobOutput>,
  search: string,
): Array<JobOutput> {
  if (!search.trim()) return outputs
  const q = search.toLowerCase()
  return outputs.filter(
    (output) =>
      output.filename.toLowerCase().includes(q) ||
      output.content.toLowerCase().includes(q) ||
      formatRunTimestamp(output.timestamp).toLowerCase().includes(q),
  )
}

export function serializeJobsCsv(jobs: Array<ClaudeJob>): string {
  const headers = [
    'name',
    'state',
    'enabled',
    'profile',
    'schedule',
    'next_run_at',
    'last_run_at',
    'last_run_success',
    'source',
  ]
  const rows = jobs.map((job) =>
    [
      job.name || '(unnamed)',
      job.state,
      String(job.enabled),
      job.profile || job.profile_name || '',
      job.schedule_display || '',
      job.next_run_at || '',
      job.last_run_at || '',
      String(job.last_run_success ?? ''),
      getSourceLabel(job),
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

