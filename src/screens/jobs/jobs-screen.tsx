'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Cancel01Icon,
  Clock01Icon,
  Copy01Icon,
  Delete01Icon,
  Download01Icon,
  PauseIcon,
  PencilEdit02Icon,
  PlayIcon,
  RefreshIcon,
  Search01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { CreateJobDialog } from './create-job-dialog'
import { EditJobDialog } from './edit-job-dialog'
import {
  buildFailureSparkline,
  buildJobIncidentReport,
  buildJobsCockpitTiles,
  classifyJobFailureFamily,
  filterJobOutputs,
  filterJobs,
  formatNextRun,
  formatRunTimestamp,
  getJobCompletionSla,
  getJobHealth,
  getJobLifecycleState,
  getJobOwnerSource,
  getJobRetryPolicy,
  getJobRunMetadata,
  getLastRunStatus,
  getNextScheduledJob,
  getNoOpContractLabel,
  getSourceLabel,
  isDailyCheckJob,
  jobNeedsTyler,
  jobUsesPaidCall,
  serializeJobsCsv,
  sortJobsForAttention,
} from './jobs-screen-utils'
import type { JobActionState, JobSavedFilter } from './jobs-screen-utils'
import type { ClaudeJob } from '@/lib/jobs-api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  createJob,
  deleteJob,
  fetchJobOutput,
  fetchJobProfiles,
  fetchJobs,
  pauseJob,
  resumeJob,
  triggerJob,
  updateJob,
} from '@/lib/jobs-api'
import { readJsonStorage, writeJsonStorage } from '@/lib/typed-storage'
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'

const QUERY_KEY = ['claude', 'jobs'] as const
const PROFILES_QUERY_KEY = ['claude', 'job-profiles'] as const
const JOBS_FILTER_STORAGE_KEY = 'hermes-jobs-saved-filter-v1'
const JOB_SAVED_FILTERS = [
  'all',
  'active',
  'daily',
  'failing',
  'paused',
  'recent',
  'stale',
  'blocked',
  'paid',
] as const

function isJobSavedFilter(value: unknown): value is JobSavedFilter {
  return (
    typeof value === 'string' &&
    JOB_SAVED_FILTERS.includes(value as JobSavedFilter)
  )
}

export function readPersistedJobSavedFilter(): JobSavedFilter {
  if (typeof window === 'undefined') return 'all'
  const legacy = window.localStorage.getItem(JOBS_FILTER_STORAGE_KEY)
  const parsed = readJsonStorage(
    JOBS_FILTER_STORAGE_KEY,
    'all',
    isJobSavedFilter,
  )
  if (!parsed.recovered) return parsed.value

  if (isJobSavedFilter(legacy)) {
    writeJsonStorage(JOBS_FILTER_STORAGE_KEY, legacy)
    return legacy
  }
  return 'all'
}

function writePersistedJobSavedFilter(value: JobSavedFilter) {
  writeJsonStorage(JOBS_FILTER_STORAGE_KEY, value)
}

function summarizeJobPrompt(
  prompt: string | undefined,
  fallback: string,
): string {
  const trimmed = (prompt || '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return fallback || 'No prompt summary.'
  const firstSentence = trimmed.match(/^[^.!?]{12,90}[.!?]/)?.[0]
  const summary = firstSentence || trimmed.slice(0, 84)
  return summary.length < trimmed.length
    ? `${summary.replace(/[.,;:\s]+$/, '')}...`
    : summary
}

function getJobsSmokeFixture(): Array<ClaudeJob> | null {
  if (typeof window === 'undefined') return null
  const fixture = new URLSearchParams(window.location.search).get(
    'smokeFixture',
  )
  if (fixture !== 'failed') {
    return null
  }
  return [
    {
      id: 'smoke-failed-job',
      name: 'Smoke failed job',
      prompt:
        'Daily smoke fixture for Jobs route recovery and failed-row rendering.',
      schedule: {},
      schedule_display: 'daily at 8:00 AM',
      enabled: true,
      state: 'failed',
      next_run_at: new Date(Date.now() + 3_600_000).toISOString(),
      last_run_at: new Date(Date.now() - 600_000).toISOString(),
      updated_at: new Date(Date.now() - 300_000).toISOString(),
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      last_run_success: false,
      last_run_error: 'Smoke fixture failure: Graph API timeout',
      profile: 'daily-checks',
      deliver: ['obsidian'],
      skills: ['mail'],
      repeat: { times: 3, completed: 1 },
    },
  ]
}

function formatQueryFreshness(updatedAt: number): string {
  if (!updatedAt) return 'never'
  const diff = Date.now() - updatedAt
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatJobOwnerLabel(owner: string): string {
  if (owner.toLowerCase() === 'workflow') return 'Flow'
  return owner
}

function getJobsTileTone(tone: ReturnType<typeof buildJobsCockpitTiles>[number]['tone']) {
  if (tone === 'danger') return 'red'
  if (tone === 'warning') return 'amber'
  if (tone === 'good') return 'green'
  return 'neutral'
}

function getJobsTileIcon(id: ReturnType<typeof buildJobsCockpitTiles>[number]['id']) {
  if (id === 'failed') return Cancel01Icon
  if (id === 'running') return PlayIcon
  if (id === 'next-due') return Clock01Icon
  if (id === 'blocked') return PauseIcon
  return Download01Icon
}

function JobCard({
  job,
  onPause,
  onResume,
  onTrigger,
  onDryRun,
  onDelete,
  onEdit,
  onOpenLogs,
  pendingAction,
}: {
  job: ClaudeJob
  onPause: (id: string) => void
  onResume: (id: string) => void
  onTrigger: (id: string) => void
  onDryRun: (job: ClaudeJob) => void
  onDelete: (id: string) => void
  onEdit: (job: ClaudeJob) => void
  onOpenLogs: (job: ClaudeJob) => void
  pendingAction: JobActionState
}) {
  const isPaused = job.state === 'paused' || !job.enabled
  const isCompleted = job.state === 'completed'
  const lastRunStatus = getLastRunStatus(job)
  const sourceLabel = getSourceLabel(job)
  const health = getJobHealth(job)
  const ownerSource = getJobOwnerSource(job)
  const failureFamily = classifyJobFailureFamily(job)
  const needsTyler = jobNeedsTyler(job)
  const paidCall = jobUsesPaidCall(job)
  const runMetadata = getJobRunMetadata(job)
  const noOpContract = getNoOpContractLabel(job)
  const isPending = pendingAction !== null
  const promptSummary = summarizeJobPrompt(job.prompt, job.name || 'Job')
  const outputPreview =
    job.last_run_error || job.error || 'No error text captured'

  return (
    <motion.div
      tabIndex={0}
      role="article"
      aria-label={`${job.name || 'Job'} job card`}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
          event.preventDefault()
          const next = event.currentTarget.nextElementSibling
          if (next instanceof HTMLElement) next.focus()
        }
        if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
          event.preventDefault()
          const previous = event.currentTarget.previousElementSibling
          if (previous instanceof HTMLElement) previous.focus()
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpenLogs(job)
        }
      }}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-xl border p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]',
        'bg-[var(--theme-card)] border-[var(--theme-border)]',
        isPaused && 'opacity-60',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{
                background: isPaused
                  ? 'var(--theme-muted)'
                  : isCompleted
                    ? 'var(--theme-accent)'
                    : 'var(--theme-text)',
              }}
            />
            <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
              {job.name || '(unnamed)'}
            </h3>
          </div>
          <p className="mb-2 line-clamp-1 text-xs text-[var(--theme-muted)]">
            {promptSummary}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--theme-muted)]">
            {job.profile && (
              <span className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--theme-text)]">
                {job.profile}
              </span>
            )}
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5">
              {sourceLabel}
            </span>
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5">
              {formatJobOwnerLabel(ownerSource)}
            </span>
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5">
              {runMetadata.nextRun}
            </span>
            {job.skills && job.skills.length > 0 && (
              <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5">
                {job.skills.length} skill{job.skills.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--theme-muted)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: lastRunStatus.color }}
            />
            <span>{lastRunStatus.label}</span>
            <span
              data-testid={`job-health-${health}`}
              className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
            >
              {health}
            </span>
            {health === 'failed' ? (
              <button
                type="button"
                onClick={() => onTrigger(job.id)}
                disabled={isPending}
                className="rounded-md border border-red-300/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 hover:bg-red-500/15"
              >
                {pendingAction === 'run' ? 'Running...' : 'Run recovery'}
              </button>
            ) : null}
            <span title={`Failure family: ${failureFamily}`}>
              {failureFamily}
            </span>
            <span title="7 day failure trend">
              {buildFailureSparkline(job)}
            </span>
            <span>{paidCall ? 'paid' : 'local'}</span>
            {needsTyler ? (
              <span className="rounded-md border border-amber-300/50 bg-amber-500/10 px-1.5 py-0.5 text-amber-500">
                Tyler
              </span>
            ) : null}
            {noOpContract ? (
              <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5 text-[var(--theme-text)]">
                {noOpContract}
              </span>
            ) : null}
          </div>
          {health === 'failed' ? (
            <p className="mt-1 line-clamp-1 text-[11px] text-red-400">
              {outputPreview}
            </p>
          ) : null}
          <details className="mt-2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1.5 text-[11px] text-[var(--theme-muted)]">
            <summary className="cursor-pointer text-[var(--theme-text)]">
              Details
            </summary>
            <div className="mt-1">{runMetadata.lastRun}</div>
            <div className="mt-1">{runMetadata.changedSinceLastRun}</div>
            <div className="mt-1 line-clamp-1" title={outputPreview}>
              {outputPreview}
            </div>
          </details>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
          <button
            onClick={() => onTrigger(job.id)}
            disabled={isPending}
            className="min-h-9 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={`Run ${job.name || 'job'} now`}
            aria-label="Run job"
          >
            <HugeiconsIcon
              icon={PlayIcon}
              size={14}
              className="text-[var(--theme-accent)]"
            />
          </button>
          <button
            onClick={() => onDryRun(job)}
            className="min-h-9 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--theme-hover)]"
            title={`Dry-run ${job.name || 'job'}`}
            aria-label="Dry-run"
          >
            Dry-run
          </button>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(buildJobIncidentReport(job))
              toast('Job incident report copied')
            }}
            className="min-h-9 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--theme-hover)]"
            title={`Copy incident for ${job.name || 'job'}`}
            aria-label="Copy incident"
          >
            Incident
          </button>
          <button
            onClick={() => (isPaused ? onResume(job.id) : onPause(job.id))}
            disabled={isPending}
            className="min-h-9 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={`${isPaused ? 'Resume' : 'Pause'} ${job.name || 'job'}`}
            aria-label={isPaused ? 'Resume job' : 'Pause job'}
          >
            <HugeiconsIcon
              icon={isPaused ? PlayIcon : PauseIcon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onEdit(job)}
            disabled={isPending}
            className="min-h-9 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={`Edit ${job.name || 'job'}`}
            aria-label="Edit job"
          >
            <HugeiconsIcon
              icon={PencilEdit02Icon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onOpenLogs(job)}
            className="min-h-9 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={`Open logs for ${job.name || 'job'}`}
            aria-label="Open logs"
          >
            <HugeiconsIcon
              icon={ViewIcon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onDelete(job.id)}
            disabled={isPending}
            className="min-h-9 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={`Delete ${job.name || 'job'}`}
            aria-label="Delete job"
          >
            <HugeiconsIcon
              icon={Delete01Icon}
              size={14}
              style={{ color: 'var(--theme-danger)' }}
            />
          </button>
        </div>
      </div>
      {isPending ? (
        <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-xs text-[var(--theme-muted)]">
          {pendingAction === 'run'
            ? 'Running job and refreshing status...'
            : pendingAction === 'pause'
              ? 'Pausing job and refreshing schedule...'
              : pendingAction === 'resume'
                ? 'Resuming job and refreshing schedule...'
                : 'Deleting job and refreshing list...'}
        </div>
      ) : null}
    </motion.div>
  )
}

function JobLogsDrawer({
  job,
  onClose,
}: {
  job: ClaudeJob | null
  onClose: () => void
}) {
  const [logSearch, setLogSearch] = useState('')
  const outputQuery = useQuery({
    queryKey: ['claude', 'jobs', job?.id, 'output'],
    queryFn: () => fetchJobOutput(job?.id || '', 25),
    enabled: Boolean(job?.id),
    staleTime: 30_000,
  })
  const outputs = outputQuery.data ?? []
  const visibleOutputs = useMemo(
    () => filterJobOutputs(outputs, logSearch),
    [outputs, logSearch],
  )
  const combinedLog = useMemo(
    () =>
      visibleOutputs
        .map(
          (output) =>
            `# ${output.filename} - ${formatRunTimestamp(output.timestamp)}\n${output.content}`,
        )
        .join('\n\n'),
    [visibleOutputs],
  )

  const copyLogs = useCallback(async () => {
    if (!combinedLog.trim()) return
    await navigator.clipboard.writeText(combinedLog)
    toast('Job logs copied')
  }, [combinedLog])

  const downloadLogs = useCallback(() => {
    if (!combinedLog.trim() || !job) return
    const blob = new Blob([combinedLog], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `hermes-job-${job.id}-logs.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [combinedLog, job])

  return (
    <AnimatePresence>
      {job ? (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Logs for ${job.name || 'job'}`}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="border-b border-[var(--theme-border)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Job logs
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold text-[var(--theme-text)]">
                    {job.name || '(unnamed)'}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    {getSourceLabel(job)} · Last run{' '}
                    {formatRunTimestamp(job.last_run_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                  title="Close logs"
                  aria-label="Close logs drawer"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={16}
                    className="text-[var(--theme-muted)]"
                  />
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <HugeiconsIcon
                    icon={Search01Icon}
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]"
                  />
                  <input
                    type="search"
                    value={logSearch}
                    onChange={(event) => setLogSearch(event.target.value)}
                    placeholder="Search logs"
                    className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-2 pl-8 pr-3 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void copyLogs()}
                  disabled={!combinedLog.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-2 text-xs text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Copy01Icon} size={14} />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={downloadLogs}
                  disabled={!combinedLog.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-2 text-xs text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Download01Icon} size={14} />
                  Download
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {outputQuery.isLoading ? (
                <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-muted)]">
                  Loading recent run outputs...
                </div>
              ) : outputQuery.isError ? (
                <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-muted)]">
                  Failed to load run outputs. Refresh the jobs list or retry
                  later.
                </div>
              ) : visibleOutputs.length > 0 ? (
                <div className="space-y-3">
                  {visibleOutputs.map((output) => (
                    <article
                      key={`${output.filename}-${output.timestamp}`}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--theme-border)] px-3 py-2 text-[10px] text-[var(--theme-muted)]">
                        <span>{formatRunTimestamp(output.timestamp)}</span>
                        <span className="truncate">{output.filename}</span>
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 py-3 text-xs leading-5 text-[var(--theme-text)]">
                        {output.content || 'No output content'}
                      </pre>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-muted)]">
                  {outputs.length > 0
                    ? 'No log output matches this search.'
                    : 'No run outputs are available for this job yet.'}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function JobsScreen() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [savedFilter, setSavedFilter] = useState<JobSavedFilter>(
    readPersistedJobSavedFilter,
  )
  const [showCreate, setShowCreate] = useState(false)
  const [editingJob, setEditingJob] = useState<ClaudeJob | null>(null)
  const [logsJob, setLogsJob] = useState<ClaudeJob | null>(null)
  const [pendingJobAction, setPendingJobAction] = useState<{
    id: string
    action: Exclude<JobActionState, null>
  } | null>(null)
  const fixtureJobs = useMemo(() => getJobsSmokeFixture(), [])

  const jobsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchJobs,
    enabled: !fixtureJobs,
    refetchInterval: 30_000,
  })
  const jobsData = fixtureJobs ?? jobsQuery.data ?? []
  const jobsDataUpdatedAt = fixtureJobs ? Date.now() : jobsQuery.dataUpdatedAt
  const profilesQuery = useQuery({
    queryKey: PROFILES_QUERY_KEY,
    queryFn: fetchJobProfiles,
    staleTime: 60_000,
  })
  const profiles = useMemo(
    () =>
      profilesQuery.data?.length
        ? profilesQuery.data
        : [{ name: 'default', active: true }],
    [profilesQuery.data],
  )

  const pauseMutation = useMutation({
    mutationFn: pauseJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job paused')
    },
    onSettled: () => setPendingJobAction(null),
  })
  const resumeMutation = useMutation({
    mutationFn: resumeJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job resumed')
    },
    onSettled: () => setPendingJobAction(null),
  })
  const triggerMutation = useMutation({
    mutationFn: triggerJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job triggered')
    },
    onSettled: () => setPendingJobAction(null),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job deleted')
    },
    onSettled: () => setPendingJobAction(null),
  })
  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job created')
      setShowCreate(false)
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Failed to create job', {
        type: 'error',
      })
    },
  })
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      jobId: string
      updates: {
        profile: string
        name: string
        schedule: string
        prompt: string
        deliver?: Array<string>
        skills?: Array<string>
        repeat?: number
      }
    }) => updateJob(payload.jobId, payload.updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job updated')
      setEditingJob(null)
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Failed to update job', {
        type: 'error',
      })
    },
  })

  const filteredJobs = useMemo(() => {
    return filterJobs(jobsData, savedFilter, search)
  }, [jobsData, savedFilter, search])

  const setPersistedSavedFilter = useCallback((value: JobSavedFilter) => {
    setSavedFilter(value)
    writePersistedJobSavedFilter(value)
  }, [])

  const statusCounts = useMemo(() => {
    return jobsData.reduce(
      (counts, job) => {
        counts[getJobHealth(job)] += 1
        return counts
      },
      {
        pending: 0,
        running: 0,
        failed: 0,
        completed: 0,
        paused: 0,
      },
    )
  }, [jobsData])

  const nextScheduledJob = useMemo(
    () => getNextScheduledJob(jobsData),
    [jobsData],
  )

  const attentionJobs = useMemo(
    () => sortJobsForAttention(jobsData).slice(0, 4),
    [jobsData],
  )

  const attentionSummary = useMemo(() => {
    return {
      failed: jobsData.filter((job) => getJobHealth(job) === 'failed').length,
      running: jobsData.filter((job) => getJobHealth(job) === 'running').length,
      nextDue: jobsData.filter((job) => job.enabled && job.next_run_at).length,
      blocked: jobsData.filter(jobNeedsTyler).length,
      paid: jobsData.filter(jobUsesPaidCall).length,
      stale: jobsData.filter((job) => getJobLifecycleState(job) === 'stale')
        .length,
      disabled: jobsData.filter(
        (job) => getJobLifecycleState(job) === 'disabled',
      ).length,
      recoverable: jobsData.filter(
        (job) =>
          getJobHealth(job) === 'failed' &&
          classifyJobFailureFamily(job) !== 'auth',
      ).length,
    }
  }, [jobsData])
  const cockpitTiles = useMemo(
    () => buildJobsCockpitTiles(jobsData),
    [jobsData],
  )
  const jobsListStale =
    !fixtureJobs &&
    jobsDataUpdatedAt > 0 &&
    Date.now() - jobsDataUpdatedAt > 120_000

  const exportJobsCsv = useCallback(() => {
    const blob = new Blob([serializeJobsCsv(filteredJobs)], {
      type: 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `hermes-jobs-${savedFilter}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [filteredJobs, savedFilter])

  const copyBulkIncidentReports = useCallback(async () => {
    const report = filteredJobs.map(buildJobIncidentReport).join('\n\n---\n\n')
    if (!report.trim()) return
    await navigator.clipboard.writeText(report)
    toast('Selected job incident reports copied')
  }, [filteredJobs])

  const handleCreate = useCallback(
    async (input: {
      profile: string
      name: string
      schedule: string
      prompt: string
      deliver?: Array<string>
      skills?: Array<string>
      repeat?: number
    }) => {
      await createMutation.mutateAsync(input)
    },
    [createMutation],
  )

  const confirmPauseJob = useCallback((job: ClaudeJob) => {
    const safeLabel = job.name || job.id
    const highImpact =
      getJobOwnerSource(job) === 'Codex' ||
      getJobOwnerSource(job) === 'Hermes' ||
      jobNeedsTyler(job) ||
      isDailyCheckJob(job)
    if (!highImpact) return confirm(`Pause job "${safeLabel}"?`)
    return (
      prompt(`Pause important job "${safeLabel}"? Type PAUSE to confirm.`) ===
      'PAUSE'
    )
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface text-ink">
      <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col gap-3 px-3 py-3 pb-[calc(var(--tabbar-h,80px)+0.75rem)] sm:gap-5 sm:px-6 sm:py-6 sm:pb-[calc(var(--tabbar-h,80px)+1.5rem)] lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Clock01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Jobs
              </h1>
              {jobsData.length > 0 && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({jobsData.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
                }
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                title="Refresh jobs from Hermes"
                aria-label="Refresh jobs from Hermes"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  className="text-[var(--theme-muted)]"
                />
              </button>
              <button
                type="button"
                onClick={exportJobsCsv}
                disabled={filteredJobs.length === 0}
                className="rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
              >
                CSV
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:mt-4 sm:grid-cols-5">
            {[
              ['Running', statusCounts.running, 'var(--theme-accent)'],
              ['Failed', statusCounts.failed, 'var(--theme-danger)'],
              ['Pending', statusCounts.pending, 'var(--theme-muted)'],
              ['Completed', statusCounts.completed, 'var(--theme-success)'],
              ['Paused', statusCounts.paused, 'var(--theme-warning)'],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: String(color) }}
                  />
                  <span className="text-[var(--theme-muted)]">{label}</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-[var(--theme-text)]">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-xs text-[var(--theme-muted)]">
            Fetched{' '}
            <span className="text-[var(--theme-text)]">
              {formatQueryFreshness(jobsDataUpdatedAt)}
            </span>{' '}
            · Next scheduled run:{' '}
            <span className="text-[var(--theme-text)]">
              {nextScheduledJob
                ? `${nextScheduledJob.name || 'Unnamed job'} ${formatNextRun(nextScheduledJob.next_run_at)}`
                : 'none'}
            </span>
            {profilesQuery.isFetching ? (
              <span className="ml-2 rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[10px]">
                profiles refreshing
              </span>
            ) : null}
            {jobsListStale ? (
              <button
                type="button"
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
                }
                className="ml-2 rounded-md border border-amber-300/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500"
              >
                Jobs source stale - refresh
              </button>
            ) : null}
          </div>
          <AppSurface className="mt-3">
            <AppSectionHeader
              title="Today"
              meta={
                attentionSummary.failed > 0
                  ? `${attentionSummary.failed} need recovery`
                  : attentionSummary.running > 0
                    ? `${attentionSummary.running} running`
                    : 'Quiet'
              }
              action={
                jobsListStale ? (
                  <AppStatusPill tone="amber">Stale</AppStatusPill>
                ) : (
                  <AppStatusPill tone="green">Fresh</AppStatusPill>
                )
              }
            />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {cockpitTiles.map((tile) => (
                <AppTile
                  key={tile.id}
                  title={tile.label}
                  value={tile.value}
                  detail={tile.detail}
                  icon={getJobsTileIcon(tile.id)}
                  tone={getJobsTileTone(tile.tone)}
                  actionLabel="Open"
                  className="min-h-[116px]"
                  onClick={() => setPersistedSavedFilter(tile.filter)}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AppStatusPill
                tone={attentionSummary.recoverable > 0 ? 'amber' : 'green'}
              >
                Recovery {attentionSummary.recoverable}
              </AppStatusPill>
              <AppStatusPill
                tone={attentionSummary.blocked > 0 ? 'amber' : 'green'}
              >
                Tyler {attentionSummary.blocked}
              </AppStatusPill>
              <AppStatusPill
                tone={attentionSummary.stale > 0 ? 'amber' : 'green'}
              >
                Stale {attentionSummary.stale}
              </AppStatusPill>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {(attentionJobs.length
                ? attentionJobs
                : filteredJobs.slice(0, 4)
              ).map((job) => {
                const health = getJobHealth(job)
                const failureFamily = classifyJobFailureFamily(job)
                const runMetadata = getJobRunMetadata(job)
                return (
                  <article
                    key={`cockpit-${job.id}`}
                    className="rounded-lg border border-[var(--theme-border)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                          health === 'failed'
                            ? 'border-red-300/40 bg-red-500/10 text-red-400'
                            : health === 'running'
                              ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
                              : 'border-[var(--theme-border)] text-[var(--theme-muted)]',
                        )}
                      >
                        {health}
                      </span>
                      <span className="text-[10px] text-[var(--theme-muted)]">
                        {buildFailureSparkline(job)}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-1 text-xs font-semibold text-[var(--theme-text)]">
                      {job.name || '(unnamed)'}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[var(--theme-muted)]">
                      {failureFamily} · next {runMetadata.nextRun} ·{' '}
                      {getSourceLabel(job)}
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingJobAction({ id: job.id, action: 'run' })
                          triggerMutation.mutate(job.id)
                        }}
                        disabled={pendingJobAction?.id === job.id}
                        className="rounded-md border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
                      >
                        {health === 'failed' ? 'Recover' : 'Run'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogsJob(job)}
                        className="rounded-md px-2 py-1 text-[10px] text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
                      >
                        Logs
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </AppSurface>
          <div className="mt-3 hidden gap-3 sm:grid lg:grid-cols-1">
            <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Next scheduled
                  </p>
                  <h2 className="mt-1 truncate text-sm font-semibold text-[var(--theme-text)]">
                    {nextScheduledJob?.name || 'No scheduled job queued'}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    {nextScheduledJob
                      ? `${formatNextRun(nextScheduledJob.next_run_at)} · ${getSourceLabel(nextScheduledJob)} · ${getJobCompletionSla(nextScheduledJob)}`
                      : 'Create or resume a job to restore the next-run queue.'}
                  </p>
                </div>
                {nextScheduledJob ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingJobAction({
                          id: nextScheduledJob.id,
                          action: 'run',
                        })
                        triggerMutation.mutate(nextScheduledJob.id)
                      }}
                      className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                      title={`Run ${nextScheduledJob.name || 'next scheduled job'} now`}
                      aria-label="Run next job"
                    >
                      <HugeiconsIcon
                        icon={PlayIcon}
                        size={15}
                        className="text-[var(--theme-accent)]"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingJob(nextScheduledJob)}
                      className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                      title={`Edit ${nextScheduledJob.name || 'next scheduled job'}`}
                      aria-label="Edit next job"
                    >
                      <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        size={15}
                        className="text-[var(--theme-muted)]"
                      />
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </header>

        <div className="rounded-2xl border border-primary-200 bg-primary-50/85 p-3 backdrop-blur-xl sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['daily', 'Daily'],
              ['failing', 'Failing'],
              ['stale', 'Stale'],
              ['paused', 'Paused'],
              ['recent', 'Changed 7d'],
              ['blocked', 'Tyler'],
              ['paid', 'Paid calls'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPersistedSavedFilter(value as JobSavedFilter)}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                  savedFilter === value
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]"
            />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-1.5 pl-8 pr-3 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
              }
              className="rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() =>
                toast('Pause selected requires explicit per-job confirmation')
              }
              className="rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => void copyBulkIncidentReports()}
              disabled={filteredJobs.length === 0}
              className="rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[var(--theme-text)] hover:bg-[var(--theme-hover)] disabled:opacity-50"
            >
              Incidents
            </button>
            <span className="rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[var(--theme-muted)]">
              Saved view
            </span>
          </div>
          {profilesQuery.isError ? (
            <p
              className="mt-2 text-xs"
              style={{ color: 'var(--theme-warning)' }}
            >
              Profile list failed to load. New jobs will default to the default
              profile until profiles refresh.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-primary-200 bg-primary-50/60 px-3 py-3 sm:px-4">
          {jobsQuery.isLoading && !fixtureJobs ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading jobs...
            </div>
          ) : jobsQuery.isError && !fixtureJobs ? (
            <div
              className="flex items-center justify-center py-12 text-sm"
              style={{ color: 'var(--theme-danger)' }}
            >
              Failed to load jobs:{' '}
              {jobsQuery.error instanceof Error
                ? jobsQuery.error.message
                : 'Unknown error'}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon
                icon={Clock01Icon}
                size={32}
                className="mb-3 opacity-40"
              />
              <p className="text-sm font-medium">
                {search.trim()
                  ? 'No jobs match this search'
                  : 'No scheduled jobs'}
              </p>
              <p className="mt-1 text-xs">
                {search.trim()
                  ? 'Clear filters or create a job.'
                  : 'Create a cron or heartbeat job.'}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  pendingAction={
                    pendingJobAction?.id === job.id
                      ? pendingJobAction.action
                      : null
                  }
                  onPause={(id) => {
                    if (confirmPauseJob(job)) {
                      setPendingJobAction({ id, action: 'pause' })
                      pauseMutation.mutate(id)
                    }
                  }}
                  onResume={(id) => {
                    if (confirm(`Resume job "${job.name || id}"?`)) {
                      setPendingJobAction({ id, action: 'resume' })
                      resumeMutation.mutate(id)
                    }
                  }}
                  onTrigger={(id) => {
                    setPendingJobAction({ id, action: 'run' })
                    triggerMutation.mutate(id)
                  }}
                  onDryRun={(selectedJob) =>
                    toast(
                      `Dry-run only: ${selectedJob.name || selectedJob.id} would use ${getJobRetryPolicy(selectedJob)}`,
                    )
                  }
                  onEdit={(selectedJob) => setEditingJob(selectedJob)}
                  onOpenLogs={(selectedJob) => setLogsJob(selectedJob)}
                  onDelete={(id) => {
                    if (confirm(`Delete job "${job.name}"?`)) {
                      setPendingJobAction({ id, action: 'delete' })
                      deleteMutation.mutate(id)
                    }
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        <CreateJobDialog
          open={showCreate}
          profiles={profiles}
          onOpenChange={setShowCreate}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
        />
        <EditJobDialog
          job={editingJob}
          open={editingJob !== null}
          profiles={profiles}
          onOpenChange={(open) => {
            if (!open) setEditingJob(null)
          }}
          onSubmit={async (updates) => {
            if (!editingJob) return
            await updateMutation.mutateAsync({
              jobId: editingJob.id,
              updates,
            })
          }}
          isSubmitting={updateMutation.isPending}
        />
        <JobLogsDrawer job={logsJob} onClose={() => setLogsJob(null)} />
      </div>
    </div>
  )
}
