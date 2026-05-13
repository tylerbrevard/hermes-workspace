import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { execFileSync } from 'node:child_process'
import { isAuthenticated } from '../../../server/auth-middleware'
import { fetchClawosJson } from '../../../server/clawos-internal'

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

const MEETINGS_DB_PATH = '/Users/tylerlyon/clawos/data/.meetings.db'

function sqlEscape(value: string) {
  return value.replace(/'/g, "''")
}

function queryDb<T>(sql: string): T[] {
  const output = execFileSync('sqlite3', ['-json', MEETINGS_DB_PATH, sql], {
    encoding: 'utf8',
  }).trim()
  if (!output) return []
  return JSON.parse(output) as T[]
}

function getMeetingDetailFromDb(meetingId: string): Meeting | null {
  const escapedId = sqlEscape(meetingId)
  const meeting = queryDb<{
    id: string
    title: string
    type: string | null
    date: string
    duration: number | null
    participants: string | null
    content: string | null
    join_url: string | null
    has_transcription: number | null
    transcription_source: string | null
    reviewed: number | null
  }>(
    `SELECT id, title, type, date, duration, participants, content, join_url, has_transcription, transcription_source, reviewed FROM meetings WHERE id = '${escapedId}' LIMIT 1;`,
  )[0]

  if (!meeting) return null

  const actionItems = queryDb<{
    id: string
    text: string
    assignee: string | null
    due_date: string | null
    status: string | null
    priority: string | null
  }>(
    `SELECT id, text, assignee, due_date, status, priority FROM action_items WHERE meeting_id = '${escapedId}' AND deleted_at IS NULL ORDER BY created_date ASC;`,
  )

  const issues = queryDb<{
    id: string
    title: string
    description: string | null
    status: string | null
    priority: string | null
    assignee: string | null
    stagnant_days: number | null
  }>(
    `SELECT id, title, description, status, priority, assignee, stagnant_days FROM issues WHERE meeting_id = '${escapedId}' ORDER BY first_mentioned ASC;`,
  )

  const decisions = queryDb<{
    id: string
    text: string
    decision_maker: string | null
    impact: string | null
    date: string | null
  }>(
    `SELECT id, text, decision_maker, impact, date FROM decisions WHERE meeting_id = '${escapedId}' ORDER BY date ASC;`,
  )

  return {
    id: meeting.id,
    title: meeting.title,
    type: meeting.type || undefined,
    date: meeting.date,
    duration: meeting.duration || undefined,
    participants: meeting.participants ? (JSON.parse(meeting.participants) as Meeting['participants']) : [],
    content: meeting.content || undefined,
    joinUrl: meeting.join_url,
    hasTranscription: Boolean(meeting.has_transcription),
    transcriptionSource: meeting.transcription_source,
    reviewed: Boolean(meeting.reviewed),
    actionItems: actionItems.map((item) => ({
      id: item.id,
      text: item.text,
      assignee: item.assignee || undefined,
      dueDate: item.due_date || undefined,
      status: item.status || undefined,
      priority: item.priority || undefined,
    })),
    issues: issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description || undefined,
      status: issue.status || undefined,
      priority: issue.priority || undefined,
      assignee: issue.assignee || undefined,
      stagnantDays:
        typeof issue.stagnant_days === 'number' ? issue.stagnant_days : undefined,
    })),
    decisions: decisions.map((decision) => ({
      id: decision.id,
      text: decision.text,
      decisionMaker: decision.decision_maker || undefined,
      impact: decision.impact || undefined,
      date: decision.date || undefined,
    })),
  }
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
          const selectedMeetingId = url.searchParams.get('selectedMeetingId') || ''
          const detailOnly = url.searchParams.get('detailOnly') === 'true'

          if (detailOnly) {
            if (!selectedMeetingId) {
              return json({ error: 'selectedMeetingId is required' }, { status: 400 })
            }

            const [meetingPayload, briefPayload] = await Promise.all([
              Promise.resolve(getMeetingDetailFromDb(selectedMeetingId)),
              fetchClawosJson<MeetingBrief>('/api/meetings/brief', {
                searchParams: { meetingId: selectedMeetingId },
              }),
            ])

            if (!meetingPayload) {
              return json({ error: 'Meeting not found' }, { status: 404 })
            }

            return json({
              selectedMeetingId,
              selectedMeeting: meetingPayload,
              brief: briefPayload,
              refreshedAt: new Date().toISOString(),
            })
          }

          const [meetingsPayload, todayPayload, heatmapPayload] = await Promise.all([
            fetchClawosJson<{
              meetings: Meeting[]
              analytics?: Record<string, unknown>
              sparkline?: number[]
              graphSource?: string
              graphWarning?: string
              dataWarning?: string
              total?: number
            }>('/api/meetings', {
              searchParams: {
                search,
                limit,
                force_refresh: forceRefresh,
              },
            }),
            fetchClawosJson<{ meetings: Meeting[] }>('/api/meetings/today', {
              searchParams: { days: 5, force_refresh: forceRefresh },
            }),
            fetchClawosJson<{ days: HeatmapDay[] }>('/api/meetings/week-heatmap'),
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
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'force_sync' }),
            })
            return json(result)
          }

          if (kind === 'set-reviewed') {
            const meetingId =
              typeof body.meetingId === 'string' ? body.meetingId : ''
            const reviewed = body.reviewed !== false
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'set_reviewed',
                meetingId,
                reviewed,
              }),
            })
            return json(result)
          }

          if (kind === 'bulk-review') {
            const meetingIds = Array.isArray(body.meetingIds)
              ? body.meetingIds.filter((value) => typeof value === 'string')
              : []
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'bulk_review',
                meetingIds,
              }),
            })
            return json(result)
          }

          if (kind === 'create-action-item') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create_action_item',
                meetingId:
                  typeof body.meetingId === 'string' ? body.meetingId : '',
                text: typeof body.text === 'string' ? body.text : '',
                assignee:
                  typeof body.assignee === 'string' ? body.assignee : '',
                dueDate:
                  typeof body.dueDate === 'string' ? body.dueDate : '',
                priority:
                  typeof body.priority === 'string' ? body.priority : 'medium',
              }),
            })
            return json(result)
          }

          if (kind === 'update-action-item') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'updateActionItem',
                actionItem: body.actionItem,
              }),
            })
            return json(result)
          }

          if (kind === 'delete-action-item') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'deleteActionItem',
                actionItemId:
                  typeof body.actionItemId === 'string' ? body.actionItemId : '',
              }),
            })
            return json(result)
          }

          if (kind === 'send-action-items-to-todo') {
            const items = Array.isArray(body.items) ? body.items : []
            const result = await fetchClawosJson('/api/meetings/todo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            })
            return json(result)
          }

          if (kind === 'update-issue') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'updateIssue',
                issue: body.issue,
              }),
            })
            return json(result)
          }

          if (kind === 'delete-issue') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'deleteIssue',
                issueId: typeof body.issueId === 'string' ? body.issueId : '',
              }),
            })
            return json(result)
          }

          if (kind === 'delete-decision') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'deleteDecision',
                decisionId:
                  typeof body.decisionId === 'string' ? body.decisionId : '',
              }),
            })
            return json(result)
          }

          if (kind === 'update-decision') {
            const result = await fetchClawosJson('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'updateDecision',
                decision: body.decision,
              }),
            })
            return json(result)
          }

          if (kind === 'send-issues-to-todo' || kind === 'send-decisions-to-todo') {
            const items = Array.isArray(body.items) ? body.items : []
            const result = await fetchClawosJson('/api/meetings/todo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            })
            return json(result)
          }

          if (kind === 'extract-selected') {
            const meetingId =
              typeof body.meetingId === 'string' ? body.meetingId : ''
            const content = typeof body.content === 'string' ? body.content : ''
            const result = await fetchClawosJson('/api/meetings/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                meetingId,
                content,
              }),
            })
            return json(result)
          }

          if (kind === 'auto-extract-recent') {
            const limit =
              typeof body.limit === 'number' && Number.isFinite(body.limit)
                ? body.limit
                : 5
            const result = await fetchClawosJson('/api/meetings/auto-extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ limit }),
            })
            return json(result)
          }

          return json({ error: 'Unsupported operation' }, { status: 400 })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error ? error.message : 'Meetings action failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
