import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { fetchClawosJson } from '../../../server/clawos-internal'

type DashboardData = {
  connectwise?: {
    openTicketCount?: number | null
    available?: boolean
    configured?: boolean
    detail?: string | null
  }
  cronHealth?: {
    total?: number
    running?: number
    failed?: number
    failedNames?: string[]
  } | null
  healthSummary?: {
    overall?: string
    percent?: number
    issues?: string[]
    memoryUsage?: number | null
    gatewayOnline?: boolean
  } | null
  teamsPresence?: {
    availability?: string
    activity?: string
    stale?: boolean
  } | null
  aiCost?: {
    today?: number | null
    month?: number | null
  } | null
  meetings?: {
    todayCount?: number
    todayList?: Array<{
      subject?: string
      title?: string
      start?: string
      date?: string
    }>
  }
  weather?: {
    temp?: number | null
    condition?: string | null
    high?: number | null
    low?: number | null
  } | null
  wins?: {
    thisWeek?: number
  } | null
  openclaw?: {
    hasUpdate?: boolean
    latestName?: string | null
  } | null
}

type ExecutiveITData = {
  connectwise?: {
    available?: boolean
    summary?: {
      openTickets?: number
      slaAtRisk?: number
      boardCount?: number
      techCount?: number
      slaCompliance?: number | null
      avgResolutionTime?: number | null
    }
    tickets?: {
      byPriority?: Array<{ priority?: string; count?: number }>
      byTech?: Array<{ tech?: string; count?: number }>
      recent?: Array<{
        id: string | number
        summary: string
        status?: string
        priority?: string
        assignedTo?: string
      }>
    }
    fetchedAt?: string | null
    error?: string | null
  }
  microsoft365?: {
    planner?: {
      taskCount?: number
      overdueCount?: number
      dueThisWeekCount?: number
    }
    meetings?: {
      todayCount?: number
      nextMeeting?: { title?: string; date?: string } | null
    }
  }
  fetchedAt?: string
}

export const Route = createFileRoute('/api/ops/kindle')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const [dashboard, executive] = await Promise.all([
            fetchClawosJson<DashboardData>('/api/dashboard-data', {
              searchParams: { nocache: 1 },
            }),
            fetchClawosJson<ExecutiveITData>('/api/executive-it'),
          ])

          return json({
            dashboard,
            executive,
            refreshedAt: new Date().toISOString(),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Kindle data',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
