import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  runMeetingExtraction,
  runMeetingPipeline,
  runRecentMeetingExtraction,
  sendMeetingItemsToTodo,
  syncExtractedMeetingActionsToTodo,
} from '../../../server/meeting-actions'
import {
  bulkMarkReviewed,
  createActionItem,
  deleteActionItem,
  deleteDecision,
  deleteIssue,
  getMeetingBrief,
  getMeetingById,
  getMeetingStats,
  getTodayMeetings,
  getWeekHeatmap,
  getWeeklySparkline,
  listMeetings,
  setMeetingReviewed,
  updateActionItem,
  updateDecision,
  updateIssue,
} from '../../../server/meetings-data'

type Meeting = {
  id: string
  title: string
  type?: string
  date: string
  duration?: number
  reviewed?: boolean
  content?: string
  joinUrl?: string | null
  hasTranscription?: boolean
  transcriptionSource?: string | null
  participants?: Array<{ displayName?: string; email?: string } | string>
  actionItems?: Array<{ id: string; text: string; status?: string }>
  issues?: Array<{
    id: string
    title: string
    description?: string
    status?: string
    priority?: string
    assignee?: string
    stagnantDays?: number
  }>
  decisions?: Array<{
    id: string
    text: string
    decisionMaker?: string
    impact?: string
    date?: string
  }>
}

type MeetingBrief = {
  meetingId: string | null
  meetingTitle?: string
  meetingDate?: string
  previousMeetings: Array<{
    id: string
    title: string
    date: string
    duration?: number
  }>
  openActionItems: Array<{
    id: string
    text: string
    assignee?: string
    dueDate?: string
    status?: string
    priority?: string
    createdDate?: string
    meetingTitle?: string
    meetingDate?: string
  }>
  lastMeetingSummary?: {
    id: string
    title: string
    date: string
    duration?: number
    summary?: string | null
  } | null
  message?: string
}

type HeatmapDay = {
  date: string
  dayLabel: string
  meetingCount: number
  totalHours: number
  intensity: 0 | 1 | 2 | 3 | 4
}

type MeetingsPayload = {
  meetings?: Array<Meeting>
  total?: number
  hasMore?: boolean
  analytics?: Record<string, unknown>
  sparkline?: Array<number>
  graphSource?: string
  graphWarning?: string
  lastSync?: string
  syncMessage?: string
  newMeetings?: number
  dataWarning?: string
}

export const Route = createFileRoute('/api/ops/meetings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const search = url.searchParams.get('search') || ''
          const limit = url.searchParams.get('limit') || '50'
          const forceRefresh = url.searchParams.get('forceRefresh') === 'true'
          const selectedMeetingId =
            url.searchParams.get('selectedMeetingId') || ''
          const detailOnly = url.searchParams.get('detailOnly') === 'true'

          if (detailOnly) {
            if (!selectedMeetingId) {
              return json(
                { error: 'selectedMeetingId is required' },
                { status: 400 },
              )
            }

            const [meetingPayload, briefPayload] = await Promise.all([
              Promise.resolve({ meeting: getMeetingById(selectedMeetingId) }),
              Promise.resolve(getMeetingBrief(selectedMeetingId)),
            ])

            if (!meetingPayload.meeting || !briefPayload) {
              return json({ error: 'Meeting not found' }, { status: 404 })
            }

            return json({
              selectedMeetingId,
              selectedMeeting: meetingPayload.meeting,
              brief: briefPayload,
              refreshedAt: new Date().toISOString(),
            })
          }

          const [meetingsPayload, todayPayload, heatmapPayload] =
            await Promise.all([
              Promise.resolve({
                ...listMeetings({
                  search,
                  limit: Number.parseInt(limit, 10) || 50,
                }),
                analytics: getMeetingStats(),
                sparkline: getWeeklySparkline(),
                graphSource: 'sqlite',
                dataWarning: forceRefresh
                  ? 'Force refresh is handled by the Hermes meeting pipeline; showing current SQLite data while it runs.'
                  : undefined,
              }),
              Promise.resolve({ meetings: getTodayMeetings(5) }),
              Promise.resolve({ days: getWeekHeatmap() }),
            ])

          const selectedId =
            selectedMeetingId ||
            todayPayload.meetings?.[0]?.id ||
            meetingsPayload.meetings?.[0]?.id ||
            ''

          return json({
            ...meetingsPayload,
            todayMeetings: todayPayload.meetings || [],
            selectedMeetingId: selectedId || null,
            heatmapDays: heatmapPayload.days || [],
            refreshedAt: new Date().toISOString(),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load meetings',
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
          const body = (await request.json()) as Record<string, unknown>
          const kind = typeof body.kind === 'string' ? body.kind : ''

          if (kind === 'force-sync') {
            return json(runMeetingPipeline())
          }

          if (kind === 'set-reviewed') {
            const meetingId =
              typeof body.meetingId === 'string' ? body.meetingId : ''
            const reviewed = body.reviewed !== false
            return json(setMeetingReviewed(meetingId, reviewed))
          }

          if (kind === 'bulk-review') {
            const meetingIds = Array.isArray(body.meetingIds)
              ? body.meetingIds.filter((value) => typeof value === 'string')
              : []
            return json(bulkMarkReviewed(meetingIds))
          }

          if (kind === 'create-action-item') {
            return json(
              createActionItem({
                meetingId:
                  typeof body.meetingId === 'string' ? body.meetingId : '',
                text: typeof body.text === 'string' ? body.text : '',
                assignee:
                  typeof body.assignee === 'string' ? body.assignee : '',
                dueDate: typeof body.dueDate === 'string' ? body.dueDate : '',
                priority:
                  typeof body.priority === 'string' ? body.priority : 'medium',
              }),
            )
          }

          if (kind === 'update-action-item') {
            return json(updateActionItem(body.actionItem))
          }

          if (kind === 'delete-action-item') {
            return json(
              deleteActionItem(
                typeof body.actionItemId === 'string' ? body.actionItemId : '',
              ),
            )
          }

          if (kind === 'send-action-items-to-todo') {
            const items = Array.isArray(body.items) ? body.items : []
            return json(sendMeetingItemsToTodo(items))
          }

          if (kind === 'update-issue') {
            return json(updateIssue(body.issue))
          }

          if (kind === 'delete-issue') {
            return json(
              deleteIssue(typeof body.issueId === 'string' ? body.issueId : ''),
            )
          }

          if (kind === 'delete-decision') {
            return json(
              deleteDecision(
                typeof body.decisionId === 'string' ? body.decisionId : '',
              ),
            )
          }

          if (kind === 'update-decision') {
            return json(updateDecision(body.decision))
          }

          if (
            kind === 'send-issues-to-todo' ||
            kind === 'send-decisions-to-todo'
          ) {
            const items = Array.isArray(body.items) ? body.items : []
            return json(sendMeetingItemsToTodo(items))
          }

          if (kind === 'extract-selected') {
            const meetingId =
              typeof body.meetingId === 'string' ? body.meetingId : ''
            return json(runMeetingExtraction(meetingId))
          }

          if (kind === 'auto-extract-recent') {
            const limit =
              typeof body.limit === 'number' && Number.isFinite(body.limit)
                ? body.limit
                : 5
            return json(runRecentMeetingExtraction(limit))
          }

          if (kind === 'sync-extracted-actions-to-todo') {
            return json(syncExtractedMeetingActionsToTodo())
          }

          return json({ error: 'Unsupported operation' }, { status: 400 })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Meetings action failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
