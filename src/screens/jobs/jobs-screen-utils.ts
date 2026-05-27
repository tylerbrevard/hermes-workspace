import type { ClaudeJob, JobOutput } from '@/lib/jobs-api'

export type JobSavedFilter =
  | 'all'
  | 'active'
  | 'daily'
  | 'failing'
  | 'paused'
  | 'recent'
  | 'stale'
  | 'blocked'
  | 'paid'

export type JobFailureFamily =
  | 'auth'
  | 'network'
  | 'file lock'
  | 'DB'
  | 'API'
  | 'export'
  | 'unknown'

export type JobOwnerSource =
  | 'Codex'
  | 'Hermes'
  | 'launchd'
  | 'workflow'
  | 'manual'

export type JobLifecycleState = 'active' | 'paused' | 'stale' | 'disabled'
export type JobOwnerGroup = {
  owner: JobOwnerSource
  total: number
  failed: number
  running: number
  stale: number
}
export type JobRunMetadata = {
  nextRun: string
  lastRun: string
  lastDuration: string
  changedSinceLastRun: string
}
export type JobActionState = 'pause' | 'resume' | 'run' | 'delete' | null

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

export function classifyJobFailureFamily(job: ClaudeJob): JobFailureFamily {
  const text =
    `${job.last_run_error || ''}\n${job.error || ''}\n${job.prompt || ''}`.toLowerCase()
  if (/auth|credential|token|unauthorized|permission|approval/.test(text))
    return 'auth'
  if (/network|timeout|dns|socket|connection|econn/.test(text)) return 'network'
  if (/lock|locked|index\.lock|resource deadlock/.test(text)) return 'file lock'
  if (/sqlite|database|db|sql/.test(text)) return 'DB'
  if (/api|http \d{3}|graph|rate limit|429|500|502|503/.test(text)) return 'API'
  if (/export|obsidian|delivery|write failed/.test(text)) return 'export'
  return 'unknown'
}

export function getJobOwnerSource(job: ClaudeJob): JobOwnerSource {
  const text =
    `${job.name} ${job.prompt} ${job.profile || ''} ${job.jobId || ''}`.toLowerCase()
  if (/codex|automation/.test(text)) return 'Codex'
  if (/launchd|launchctl|plist/.test(text)) return 'launchd'
  if (
    job.skills?.length ||
    job.deliver?.length ||
    /workflow|pipeline/.test(text)
  ) {
    return 'workflow'
  }
  if (/manual|one[- ]off/.test(text)) return 'manual'
  return 'Hermes'
}

export function getJobLifecycleState(
  job: ClaudeJob,
  now = Date.now(),
): JobLifecycleState {
  if (!job.enabled) return 'disabled'
  if (job.state.toLowerCase() === 'paused') return 'paused'
  const observedAt = readJobTime(job.last_run_at) || readJobTime(job.updated_at)
  if (observedAt && now - observedAt > 7 * 86_400_000) return 'stale'
  return 'active'
}

export function jobNeedsTyler(job: ClaudeJob): boolean {
  const text =
    `${job.last_run_error || ''}\n${job.error || ''}\n${job.prompt || ''}`.toLowerCase()
  return /credential|auth|token|approval|needs tyler|waiting for tyler|permission/.test(
    text,
  )
}

export function jobUsesPaidCall(job: ClaudeJob): boolean {
  const text =
    `${job.name} ${job.prompt} ${job.profile || ''} ${job.schedule_display || ''}`.toLowerCase()
  return /openai|anthropic|claude|gpt|paid|llm|model|api call/.test(text)
}

export function isDailyCheckJob(job: ClaudeJob): boolean {
  const text =
    `${job.name} ${job.prompt} ${job.schedule_display || ''} ${job.profile || ''}`.toLowerCase()
  return /daily|morning|standup|digest|check|review|inbox|status/.test(text)
}

export function getJobRetryPolicy(job: ClaudeJob): string {
  if (job.repeat?.times) {
    return `Retry ${job.repeat.completed ?? 0}/${job.repeat.times}; next retry ${formatNextRun(job.next_run_at)}`
  }
  if (getJobHealth(job) === 'failed' && job.next_run_at) {
    return `Manual recovery or scheduled retry ${formatNextRun(job.next_run_at)}`
  }
  return `No explicit retry policy; next run ${formatNextRun(job.next_run_at)}`
}

export function getJobCompletionSla(job: ClaudeJob): string {
  const promptLength = job.prompt.length
  if (promptLength > 400 || job.skills?.length)
    return 'Expected duration: 15-30m'
  if (/backup|sync|export|digest|report/i.test(`${job.name} ${job.prompt}`)) {
    return 'Expected duration: 5-15m'
  }
  return 'Expected duration: <5m'
}

export function buildJobDependencyMap(job: ClaudeJob): string {
  const upstream = job.profile || job.profile_name || 'default profile'
  const downstream =
    job.deliver && job.deliver.length > 0
      ? job.deliver.join(', ')
      : 'workspace output'
  return `Upstream: ${upstream}; downstream: ${downstream}`
}

export function getJobRunMetadata(job: ClaudeJob): JobRunMetadata {
  const updatedAt = readJobTime(job.updated_at)
  const lastRunAt = readJobTime(job.last_run_at)
  const createdAt = readJobTime(job.created_at)
  const durationMs = updatedAt && lastRunAt ? Math.abs(updatedAt - lastRunAt) : 0
  const lastDuration =
    durationMs > 0 && durationMs < 12 * 3_600_000
      ? formatDuration(durationMs)
      : 'not reported'
  let changedSinceLastRun = 'No metadata changes after last run'
  if (!lastRunAt) {
    changedSinceLastRun = createdAt ? 'Created; never run' : 'Never run'
  } else if (updatedAt && updatedAt > lastRunAt + 60_000) {
    changedSinceLastRun = `Metadata changed ${formatRunTimestamp(job.updated_at)}`
  }
  return {
    nextRun: formatNextRun(job.next_run_at),
    lastRun: formatRunTimestamp(job.last_run_at),
    lastDuration,
    changedSinceLastRun,
  }
}

export function getNoOpContractLabel(job: ClaudeJob): string | null {
  const text = `${job.name} ${job.prompt} ${job.last_run_error || ''} ${job.error || ''}`.toLowerCase()
  if (/\bno_reply\b|\bno reply\b|\[silent\]|\bsilent\b/.test(text)) {
    return 'No-op contract: silent/no reply'
  }
  if (/\bno[- ]?op\b|nothing to do|no changes/.test(text)) {
    return 'No-op contract: report only on work'
  }
  return null
}

export function getAffectedSystems(job: ClaudeJob): Array<string> {
  const text =
    `${job.name} ${job.prompt} ${job.profile || ''} ${job.profile_name || ''} ${job.deliver?.join(' ') || ''} ${job.skills?.join(' ') || ''}`.toLowerCase()
  const systems: Array<[string, RegExp]> = [
    ['Outlook', /outlook|mailbox|email|graph/],
    ['ConnectWise', /connectwise|psa|ticket|change request|change management/],
    ['Obsidian', /obsidian|vault|wiki/],
    ['Files', /file|folder|workspace|backup/],
    ['Dashboard', /dashboard|overview|status brief/],
    ['Tasks', /task|todo|queue/],
    ['Meetings', /meeting|calendar|agenda/],
    ['LILY', /lily|voice|livekit/],
    ['MCP', /\bmcp\b|tool server/],
    ['Terminal', /terminal|shell|pty|launchctl/],
  ]
  const matched = systems
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label)
  return matched.length > 0 ? matched : ['Workspace']
}

export function buildFailureSparkline(job: ClaudeJob): string {
  if (job.last_run_success === false) return '▁▁▂▃▅▇█'
  if (job.last_run_success === true) return '█▇▆▅▃▂▁'
  return '▁▁▁▁▁▁▁'
}

export function buildJobIncidentReport(job: ClaudeJob): string {
  const runMetadata = getJobRunMetadata(job)
  return [
    `Job: ${job.name || job.id}`,
    `ID: ${job.id}`,
    `Owner/source: ${getJobOwnerSource(job)}`,
    `Health: ${getJobHealth(job)}`,
    `Lifecycle: ${getJobLifecycleState(job)}`,
    `Failure family: ${classifyJobFailureFamily(job)}`,
    `Affected systems: ${getAffectedSystems(job).join(', ')}`,
    `Next run: ${runMetadata.nextRun}`,
    `Last run: ${runMetadata.lastRun}`,
    `Last run duration: ${runMetadata.lastDuration}`,
    `Last success: ${job.last_run_success === true ? formatRunTimestamp(job.last_run_at) : 'unknown'}`,
    `Changed since last run: ${runMetadata.changedSinceLastRun}`,
    `No-op contract: ${getNoOpContractLabel(job) ?? 'none detected'}`,
    `Last output preview: ${getOutputPreview(job.last_run_error || job.error || 'No error text available')}`,
    getJobRetryPolicy(job),
    getJobCompletionSla(job),
    buildJobDependencyMap(job),
  ].join('\n')
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
  if (
    job.last_run_success === false ||
    ['failed', 'error', 'errored'].includes(state)
  ) {
    return 'failed'
  }
  if (job.last_run_success === true || state === 'completed') return 'completed'
  return 'pending'
}

export function getSourceLabel(job: ClaudeJob): string {
  if (job.profile || job.profile_name)
    return job.profile || job.profile_name || 'Hermes profile'
  if (job.jobId) return 'Gateway job'
  return 'Hermes cron'
}

function readJobTime(value?: string | null): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return '<1m'
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round(ms / 3_600_000)}h`
}

export function sortJobsForAttention(jobs: Array<ClaudeJob>): Array<ClaudeJob> {
  const healthRank: Record<ReturnType<typeof getJobHealth>, number> = {
    failed: 0,
    running: 1,
    pending: 2,
    paused: 3,
    completed: 4,
  }

  return [...jobs].sort((a, b) => {
    const healthDelta =
      healthRank[getJobHealth(a)] - healthRank[getJobHealth(b)]
    if (healthDelta !== 0) return healthDelta

    const activityDelta =
      Math.max(
        readJobTime(b.last_run_at),
        readJobTime(b.updated_at),
        readJobTime(b.created_at),
      ) -
      Math.max(
        readJobTime(a.last_run_at),
        readJobTime(a.updated_at),
        readJobTime(a.created_at),
      )
    if (activityDelta !== 0) return activityDelta

    const nextRunDelta = readJobTime(a.next_run_at) - readJobTime(b.next_run_at)
    if (nextRunDelta !== 0) return nextRunDelta

    return (a.name || a.id).localeCompare(b.name || b.id)
  })
}

export function getNextScheduledJob(
  jobs: Array<ClaudeJob>,
): ClaudeJob | null {
  return (
    jobs
      .filter((job) => job.enabled && readJobTime(job.next_run_at) > 0)
      .sort((a, b) => readJobTime(a.next_run_at) - readJobTime(b.next_run_at))[0] ??
    null
  )
}

export function getLastFailedJob(jobs: Array<ClaudeJob>): ClaudeJob | null {
  return (
    jobs
      .filter((job) => getJobHealth(job) === 'failed')
      .sort((a, b) => readJobTime(b.last_run_at) - readJobTime(a.last_run_at))[0] ??
    null
  )
}

export function groupJobsByOwner(
  jobs: Array<ClaudeJob>,
  now = Date.now(),
): Array<JobOwnerGroup> {
  const ownerOrder: Array<JobOwnerSource> = [
    'Hermes',
    'Codex',
    'workflow',
    'launchd',
    'manual',
  ]
  const groups = new Map<JobOwnerSource, JobOwnerGroup>()
  for (const owner of ownerOrder) {
    groups.set(owner, { owner, total: 0, failed: 0, running: 0, stale: 0 })
  }
  for (const job of jobs) {
    const owner = getJobOwnerSource(job)
    const group =
      groups.get(owner) ?? { owner, total: 0, failed: 0, running: 0, stale: 0 }
    const health = getJobHealth(job)
    group.total += 1
    if (health === 'failed') group.failed += 1
    if (health === 'running') group.running += 1
    if (getJobLifecycleState(job, now) === 'stale') group.stale += 1
    groups.set(owner, group)
  }
  return ownerOrder
    .map((owner) => groups.get(owner)!)
    .filter((group) => group.total > 0)
}

export function filterJobs(
  jobs: Array<ClaudeJob>,
  savedFilter: JobSavedFilter,
  search: string,
  now = Date.now(),
): Array<ClaudeJob> {
  const byView = jobs.filter((job) => {
    const health = getJobHealth(job)
    const lifecycle = getJobLifecycleState(job, now)
    if (savedFilter === 'active') return job.enabled && health !== 'paused'
    if (savedFilter === 'daily') return isDailyCheckJob(job)
    if (savedFilter === 'failing') return health === 'failed'
    if (savedFilter === 'paused') {
      return lifecycle === 'paused' || lifecycle === 'disabled'
    }
    if (savedFilter === 'stale') return lifecycle === 'stale'
    if (savedFilter === 'blocked') return jobNeedsTyler(job)
    if (savedFilter === 'paid') return jobUsesPaidCall(job)
    if (savedFilter === 'recent') {
      if (!job.last_run_at) return false
      return now - new Date(job.last_run_at).getTime() < 7 * 86_400_000
    }
    return true
  })
  if (!search.trim()) return sortJobsForAttention(byView)
  const q = search.toLowerCase()
  return sortJobsForAttention(
    byView.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.prompt.toLowerCase().includes(q) ||
        j.profile?.toLowerCase().includes(q) ||
        j.schedule_display?.toLowerCase().includes(q) ||
        j.jobId?.toLowerCase().includes(q),
    ),
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
