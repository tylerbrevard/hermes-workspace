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
  filterJobOutputs,
  filterJobs,
  formatNextRun,
  formatRunTimestamp,
  getJobHealth,
  getLastRunStatus,
  getSourceLabel,
  serializeJobsCsv,
} from './jobs-screen-utils'
import type { JobSavedFilter } from './jobs-screen-utils'
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

const QUERY_KEY = ['claude', 'jobs'] as const
const PROFILES_QUERY_KEY = ['claude', 'job-profiles'] as const

function formatQueryFreshness(updatedAt: number): string {
  if (!updatedAt) return 'never'
  const diff = Date.now() - updatedAt
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function JobCard({
  job,
  onPause,
  onResume,
  onTrigger,
  onDelete,
  onEdit,
  onOpenLogs,
}: {
  job: ClaudeJob
  onPause: (id: string) => void
  onResume: (id: string) => void
  onTrigger: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (job: ClaudeJob) => void
  onOpenLogs: (job: ClaudeJob) => void
}) {
  const isPaused = job.state === 'paused' || !job.enabled
  const isCompleted = job.state === 'completed'
  const lastRunStatus = getLastRunStatus(job)
  const sourceLabel = getSourceLabel(job)
  const health = getJobHealth(job)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        'bg-[var(--theme-card)] border-[var(--theme-border)]',
        isPaused && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
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
          <p className="mb-2 line-clamp-2 text-xs text-[var(--theme-muted)]">
            {job.prompt}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--theme-muted)]">
            {job.profile && (
              <>
                <span className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--theme-text)]">
                  {job.profile}
                </span>
                <span>·</span>
              </>
            )}
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-1.5 py-0.5">
              Source: {sourceLabel}
            </span>
            <span>·</span>
            <span>{job.schedule_display || 'custom'}</span>
            <span>·</span>
            <span>Next: {formatNextRun(job.next_run_at)}</span>
            <span>·</span>
            <span>Last: {formatRunTimestamp(job.last_run_at)}</span>
            {job.skills && job.skills.length > 0 && (
              <>
                <span>·</span>
                <span>
                  {job.skills.length} skill{job.skills.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--theme-muted)]">
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
                className="rounded-md border border-red-300/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 hover:bg-red-500/15"
              >
                Run recovery
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onTrigger(job.id)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="Run job now"
            aria-label={`Run ${job.name || 'job'} now`}
          >
            <HugeiconsIcon
              icon={PlayIcon}
              size={14}
              className="text-[var(--theme-accent)]"
            />
          </button>
          <button
            onClick={() => (isPaused ? onResume(job.id) : onPause(job.id))}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={isPaused ? 'Resume scheduled job' : 'Pause scheduled job'}
            aria-label={`${isPaused ? 'Resume' : 'Pause'} ${job.name || 'job'}`}
          >
            <HugeiconsIcon
              icon={isPaused ? PlayIcon : PauseIcon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onEdit(job)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="Edit job schedule and prompt"
            aria-label={`Edit ${job.name || 'job'}`}
          >
            <HugeiconsIcon
              icon={PencilEdit02Icon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onOpenLogs(job)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="Open job logs"
            aria-label={`Open logs for ${job.name || 'job'}`}
          >
            <HugeiconsIcon
              icon={ViewIcon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onDelete(job.id)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="Delete scheduled job"
            aria-label={`Delete ${job.name || 'job'}`}
          >
            <HugeiconsIcon
              icon={Delete01Icon}
              size={14}
              style={{ color: 'var(--theme-danger)' }}
            />
          </button>
        </div>
      </div>
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
                    {getSourceLabel(job)} · Last run {formatRunTimestamp(job.last_run_at)}
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
                  Failed to load run outputs. Refresh the jobs list or retry later.
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
  const [savedFilter, setSavedFilter] = useState<JobSavedFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingJob, setEditingJob] = useState<ClaudeJob | null>(null)
  const [logsJob, setLogsJob] = useState<ClaudeJob | null>(null)

  const jobsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchJobs,
    refetchInterval: 30_000,
  })
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
  })
  const resumeMutation = useMutation({
    mutationFn: resumeJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job resumed')
    },
  })
  const triggerMutation = useMutation({
    mutationFn: triggerJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job triggered')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('Job deleted')
    },
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
    return filterJobs(jobsQuery.data ?? [], savedFilter, search)
  }, [jobsQuery.data, savedFilter, search])

  const statusCounts = useMemo(() => {
    const jobs = jobsQuery.data ?? []
    return jobs.reduce(
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
  }, [jobsQuery.data])

  const nextJob = useMemo(() => {
    let candidate: ClaudeJob | null = null
    for (const job of jobsQuery.data ?? []) {
      if (!job.enabled || !job.next_run_at) continue
      if (
        !candidate ||
        new Date(job.next_run_at).getTime() <
          new Date(candidate.next_run_at || 0).getTime()
      ) {
        candidate = job
      }
    }
    return candidate
      ? `${candidate.name || 'Unnamed job'} ${formatNextRun(candidate.next_run_at)}`
      : 'none'
  }, [jobsQuery.data])

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

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
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
              {jobsQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({jobsQuery.data.length})
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
                Export CSV
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Job
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
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
            Source: Hermes Agent `/api/claude-jobs` · Last fetched:{' '}
            <span className="text-[var(--theme-text)]">
              {formatQueryFreshness(jobsQuery.dataUpdatedAt)}
            </span>{' '}
            · Next scheduled run:{' '}
            <span className="text-[var(--theme-text)]">{nextJob}</span>
            {profilesQuery.isFetching ? (
              <span className="ml-2 rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[10px]">
                profiles refreshing
              </span>
            ) : null}
          </div>
        </header>

        <div className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['failing', 'Failing'],
              ['recent', 'Changed 7d'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSavedFilter(value as JobSavedFilter)}
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

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {jobsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading jobs...
            </div>
          ) : jobsQuery.isError ? (
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
                {search.trim() ? 'No jobs match this search' : 'No scheduled jobs'}
              </p>
              <p className="mt-1 text-xs">
                {search.trim()
                  ? 'Search covers name, prompt, and profile. Clear the filter or create a new job.'
                  : 'Create a cron-style job or heartbeat job to run recurring Hermes work.'}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Job
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onPause={(id) => {
                    if (confirm(`Pause job "${job.name || id}"?`)) pauseMutation.mutate(id)
                  }}
                  onResume={(id) => {
                    if (confirm(`Resume job "${job.name || id}"?`)) resumeMutation.mutate(id)
                  }}
                  onTrigger={(id) => triggerMutation.mutate(id)}
                  onEdit={(selectedJob) => setEditingJob(selectedJob)}
                  onOpenLogs={(selectedJob) => setLogsJob(selectedJob)}
                  onDelete={(id) => {
                    if (confirm(`Delete job "${job.name}"?`)) {
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
