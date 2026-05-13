import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { fetchClawosJson } from '../../../server/clawos-internal'

type ItOpsOverview = {
  totalMeetings: number
  dateRange?: { from?: string | null; to?: string | null }
  attendance?: Array<{
    name: string
    total: number
    present: number
    absent: number
    absenceRate: number
  }>
  actionItems?: Array<{
    id: string
    meetingId: string
    meetingDate: string
    assignee: string
    task: string
    isDirectReport?: boolean
    isTyler?: boolean
  }>
  recurringIssues?: Array<{
    label: string
    count: number
    dates: string[]
    firstSeen?: string | null
    lastSeen?: string | null
  }>
  recentMeetings?: Array<{
    id: string
    date: string
    title: string
    attendees?: string[]
    absentDirectReports?: string[]
    actionItems?: string[]
    issues?: string[]
    decisions?: string[]
  }>
  generatedAt?: string
  warning?: string
}

type ItOpsAnalytics = {
  ticketStats: {
    open: number
    closedToday: number
    avgResolutionHours: number
    slaCompliancePct: number
  }
  escalationCount: number
  teamPerformance: Array<{
    name: string
    role: string
    ticketsAssigned: number
    ticketsResolved: number
    avgResolutionHours: number
  }>
  trendData: Array<{
    date: string
    created: number
    resolved: number
  }>
  queueBreakdown: Array<{
    queue: string
    count: number
  }>
  briefing: string
  errors?: string[]
  fetchedAt: string
}

export const Route = createFileRoute('/api/ops/it-ops')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const [overview, analytics] = await Promise.all([
            fetchClawosJson<ItOpsOverview>('/api/it-ops'),
            fetchClawosJson<ItOpsAnalytics>('/api/it-ops/analytics'),
          ])

          return json({
            overview,
            analytics,
            refreshedAt: new Date().toISOString(),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load IT Ops data',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
