import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getCronJobs } from '../../../server/claude-dashboard-api'
import { parseLilyPrompt } from '../../../server/lily-services'
import { getTodayMeetings } from '../../../server/meetings-data'

type LilyContext = {
  summary?: {
    enabledJobs: number
    failingJobs: number
    warningJobs: number
    healthyJobs: number
    nextJob?: { name: string; when: string } | null
    nextJobs?: Array<{ name: string; when: string }>
    meetingsToday?: number
    nextMeeting?: { title: string; when: string } | null
    transientIssue?: {
      type: string
      jobs: number
      when: string
      summary: string
    } | null
  }
  recentFailures?: Array<{ name: string; error: string; when: string }>
}

type LilyParseResponse = {
  content?: string
  source?: string
  error?: string
}

type CronJob = {
  id?: string
  name?: string
  enabled?: boolean
  nextRun?: string
  next_run_at?: string | null
  state?: string
  statusBadge?: string
  consecutiveErrors?: number
  lastError?: string
  last_error?: string | null
  last_run_at?: string | null
  lastRun?: {
    status?: string
    error?: string
    completedAt?: string
  }
}

type MeetingRow = {
  subject?: string
  title?: string
  start?: { dateTime?: string }
  startDateTime?: string
  date?: string
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'past'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  return `in ${Math.round(hrs / 24)}d`
}

function formatMeetingTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    })
  } catch {
    return relativeTime(iso)
  }
}

function getJobNextRun(job: CronJob) {
  return job.nextRun || job.next_run_at || undefined
}

function getJobLastError(job: CronJob) {
  return job.lastRun?.error || job.lastError || job.last_error || undefined
}

function getJobLastRunAt(job: CronJob) {
  return job.lastRun?.completedAt || job.last_run_at || undefined
}

function isFailingJob(job: CronJob) {
  const state = job.state?.toLowerCase()
  if (job.lastRun?.status === 'success') return false
  if (job.statusBadge === 'error') return true
  if (state === 'failed' || state === 'error' || state === 'errored') return true
  if ((job.consecutiveErrors || 0) > 0) return true
  return Boolean(getJobLastError(job))
}

function isWarningJob(job: CronJob) {
  const state = job.state?.toLowerCase()
  return job.statusBadge === 'warning' || state === 'paused' || state === 'disabled'
}

function getMeetingStart(meeting: MeetingRow) {
  return meeting.start?.dateTime || meeting.startDateTime || meeting.date
}

async function loadLilyContext(): Promise<LilyContext> {
  const [cronJobs, meetings] = await Promise.all([
    getCronJobs().catch(() => []),
    Promise.resolve(getTodayMeetings(5) as MeetingRow[]),
  ])

  const enabledJobs = cronJobs.filter((job) => job.enabled)
  const failingJobs = enabledJobs.filter(isFailingJob)
  const warningJobs = enabledJobs.filter(isWarningJob)
  const healthyJobs = Math.max(
    0,
    enabledJobs.length - failingJobs.length - warningJobs.length,
  )

  const jobsWithNextRun = enabledJobs
    .filter((job) => getJobNextRun(job))
    .sort(
      (left, right) =>
        new Date(getJobNextRun(left) || 0).getTime() -
        new Date(getJobNextRun(right) || 0).getTime(),
    )

  const nextJobs = jobsWithNextRun.slice(0, 3).map((job) => ({
    name: job.name || 'Unnamed job',
    when: relativeTime(getJobNextRun(job) as string),
  }))

  let transientIssue: LilyContext['summary']['transientIssue'] = null
  if (failingJobs.length >= 3) {
    const failTimes = failingJobs
      .map(getJobLastRunAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
    if (failTimes.length >= 3) {
      const spread = Math.max(...failTimes) - Math.min(...failTimes)
      if (spread < 5 * 60_000) {
        transientIssue = {
          type: 'scheduler-restart',
          jobs: failingJobs.length,
          when: relativeTime(new Date(Math.max(...failTimes)).toISOString()),
          summary: 'Scheduler restart caused transient failures',
        }
      }
    }
  }

  const recentFailures = failingJobs.slice(0, 5).map((job) => ({
    name: job.name || 'Unnamed job',
    error: getJobLastError(job) || 'unknown error',
    when: getJobLastRunAt(job)
      ? relativeTime(getJobLastRunAt(job) as string)
      : 'unknown',
  }))

  const now = Date.now()
  const futureMeetings = meetings
    .filter((meeting) => {
      const start = getMeetingStart(meeting)
      return start ? new Date(start).getTime() > now : false
    })
    .sort(
      (left, right) =>
        new Date(getMeetingStart(left) || 0).getTime() -
        new Date(getMeetingStart(right) || 0).getTime(),
    )

  const nextMeeting =
    futureMeetings.length > 0
      ? {
          title:
            futureMeetings[0].subject ||
            futureMeetings[0].title ||
            'Untitled',
          when: formatMeetingTime(
            getMeetingStart(futureMeetings[0]) ||
              new Date().toISOString(),
          ),
        }
      : null

  return {
    summary: {
      enabledJobs: enabledJobs.length,
      failingJobs: failingJobs.length,
      warningJobs: warningJobs.length,
      healthyJobs,
      nextJob: nextJobs[0] || null,
      nextJobs,
      meetingsToday: meetings.length,
      nextMeeting,
      transientIssue,
    },
    recentFailures: recentFailures.length > 0 ? recentFailures : undefined,
  }
}

export const Route = createFileRoute('/api/ops/lily')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const context = await loadLilyContext()
          return json({ context, generatedAt: new Date().toISOString() })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Lily context',
            },
            { status: 502 },
          )
        }
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json().catch(() => null)) as {
            systemPrompt?: string
            prompt?: string
          } | null
          if (!body || typeof body !== 'object') {
            return json({ error: 'Invalid JSON body' }, { status: 400 })
          }
          const payload = (await parseLilyPrompt(body)) as LilyParseResponse
          return json(payload)
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error ? error.message : 'Lily request failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
