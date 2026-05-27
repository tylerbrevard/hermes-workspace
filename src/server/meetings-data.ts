import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'

const HERMES_MEETINGS_DB =
  '/Users/tylerlyon/.hermes/workspace/runtime/db/workspace/.meetings.db'
const MEETINGS_DB_PATH =
  process.env.HERMES_MEETINGS_DB ||
  HERMES_MEETINGS_DB

if (!existsSync(MEETINGS_DB_PATH)) {
  throw new Error(`Hermes meetings database not found: ${MEETINGS_DB_PATH}`)
}

export type Meeting = {
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
  actionItems?: Array<{
    id: string
    text: string
    assignee?: string
    dueDate?: string
    status?: string
    priority?: string
    createdDate?: string
  }>
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
    rationale?: string
  }>
}

type MeetingRow = {
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
  summary?: string | null
}

function sqlString(value: unknown) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}

function queryDb<T>(sql: string): Array<T> {
  const output = execFileSync('sqlite3', ['-json', MEETINGS_DB_PATH, sql], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).trim()
  return output ? (JSON.parse(output) as Array<T>) : []
}

function execDb(sql: string) {
  execFileSync('sqlite3', [MEETINGS_DB_PATH, sql], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
}

function parseParticipants(raw: string | null) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function rowToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    type: row.type || undefined,
    date: row.date,
    duration: row.duration || undefined,
    reviewed: Boolean(row.reviewed),
    content: row.content || undefined,
    joinUrl: row.join_url,
    hasTranscription: Boolean(row.has_transcription),
    transcriptionSource: row.transcription_source,
    participants: parseParticipants(row.participants),
  }
}

function hydrateMeetings(meetings: Array<Meeting>) {
  if (meetings.length === 0) return meetings
  const ids = meetings.map((meeting) => sqlString(meeting.id)).join(',')
  const actionRows = queryDb<{
    id: string
    meeting_id: string
    text: string
    assignee: string | null
    due_date: string | null
    status: string | null
    priority: string | null
    created_date: string | null
  }>(
    `SELECT id, meeting_id, text, assignee, due_date, status, priority, created_date
     FROM action_items
     WHERE meeting_id IN (${ids}) AND deleted_at IS NULL
     ORDER BY created_date ASC;`,
  )
  const issueRows = queryDb<{
    id: string
    meeting_id: string
    title: string
    description: string | null
    status: string | null
    priority: string | null
    assignee: string | null
    stagnant_days: number | null
  }>(
    `SELECT id, meeting_id, title, description, status, priority, assignee, stagnant_days
     FROM issues
     WHERE meeting_id IN (${ids})
     ORDER BY first_mentioned ASC;`,
  )
  const decisionRows = queryDb<{
    id: string
    meeting_id: string
    text: string
    decision_maker: string | null
    impact: string | null
    date: string | null
    rationale: string | null
  }>(
    `SELECT id, meeting_id, text, decision_maker, impact, date, rationale
     FROM decisions
     WHERE meeting_id IN (${ids})
     ORDER BY date ASC;`,
  )

  const actionsByMeeting = new Map<string, Meeting['actionItems']>()
  const issuesByMeeting = new Map<string, Meeting['issues']>()
  const decisionsByMeeting = new Map<string, Meeting['decisions']>()
  for (const item of actionRows) {
    actionsByMeeting.set(item.meeting_id, [
      ...(actionsByMeeting.get(item.meeting_id) || []),
      {
        id: item.id,
        text: item.text,
        assignee: item.assignee || undefined,
        dueDate: item.due_date || undefined,
        status: item.status || undefined,
        priority: item.priority || undefined,
        createdDate: item.created_date || undefined,
      },
    ])
  }
  for (const issue of issueRows) {
    issuesByMeeting.set(issue.meeting_id, [
      ...(issuesByMeeting.get(issue.meeting_id) || []),
      {
        id: issue.id,
        title: issue.title,
        description: issue.description || undefined,
        status: issue.status || undefined,
        priority: issue.priority || undefined,
        assignee: issue.assignee || undefined,
        stagnantDays:
          typeof issue.stagnant_days === 'number' ? issue.stagnant_days : undefined,
      },
    ])
  }
  for (const decision of decisionRows) {
    decisionsByMeeting.set(decision.meeting_id, [
      ...(decisionsByMeeting.get(decision.meeting_id) || []),
      {
        id: decision.id,
        text: decision.text,
        decisionMaker: decision.decision_maker || undefined,
        impact: decision.impact || undefined,
        date: decision.date || undefined,
        rationale: decision.rationale || undefined,
      },
    ])
  }

  return meetings.map((meeting) => ({
    ...meeting,
    actionItems: actionsByMeeting.get(meeting.id) || [],
    issues: issuesByMeeting.get(meeting.id) || [],
    decisions: decisionsByMeeting.get(meeting.id) || [],
  }))
}

export function getMeetingById(meetingId: string) {
  const row = queryDb<MeetingRow>(
    `SELECT id, title, type, date, duration, participants, content, join_url,
            has_transcription, transcription_source, reviewed, summary
     FROM meetings
     WHERE id = ${sqlString(meetingId)}
     LIMIT 1;`,
  )[0]
  return row ? hydrateMeetings([rowToMeeting(row)])[0] : null
}

export function listMeetings(options: {
  search?: string
  limit?: number
  offset?: number
  upcoming?: boolean
} = {}) {
  const limit = Math.max(1, Math.min(options.limit || 50, 500))
  const offset = Math.max(0, options.offset || 0)
  const clauses: Array<string> = []
  if (options.search?.trim()) {
    const pattern = `%${options.search.trim()}%`
    clauses.push(
      `(title LIKE ${sqlString(pattern)} OR content LIKE ${sqlString(pattern)} OR participants LIKE ${sqlString(pattern)})`,
    )
  }
  if (options.upcoming) {
    clauses.push(`date >= ${sqlString(new Date().toISOString())}`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const order = options.upcoming ? 'date ASC' : 'date DESC'
  const rows = queryDb<MeetingRow>(
    `SELECT id, title, type, date, duration, participants, content, join_url,
            has_transcription, transcription_source, reviewed, summary
     FROM meetings
     ${where}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${offset};`,
  )
  const total =
    queryDb<{ total: number }>(
      `SELECT COUNT(*) as total FROM meetings ${where};`,
    )[0]?.total || rows.length
  return {
    meetings: hydrateMeetings(rows.map(rowToMeeting)),
    total,
    hasMore: offset + limit < total,
  }
}

export function getTodayMeetings(days = 1) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + Math.max(1, Math.min(days, 14)))
  end.setMilliseconds(-1)
  const rows = queryDb<MeetingRow>(
    `SELECT id, title, type, date, duration, participants, content, join_url,
            has_transcription, transcription_source, reviewed, summary
     FROM meetings
     WHERE date >= ${sqlString(start.toISOString())}
       AND date <= ${sqlString(end.toISOString())}
     ORDER BY date ASC;`,
  )
  const now = Date.now()
  return hydrateMeetings(rows.map(rowToMeeting)).map((meeting) => ({
    ...meeting,
    isPast: new Date(meeting.date).getTime() < now,
  }))
}

export function getWeeklySparkline() {
  const rows = queryDb<{ day: string; count: number }>(
    `SELECT substr(date, 1, 10) as day, COUNT(*) as count
     FROM meetings
     WHERE date >= date('now', '-13 days')
     GROUP BY day
     ORDER BY day ASC;`,
  )
  return rows.map((row) => row.count)
}

export function getMeetingStats() {
  const totals = queryDb<{ total: number; reviewed: number }>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed FROM meetings;`,
  )[0]
  const actions = queryDb<{ open: number; completed: number }>(
    `SELECT
       SUM(CASE WHEN status = 'open' AND deleted_at IS NULL THEN 1 ELSE 0 END) as open,
       SUM(CASE WHEN status = 'completed' AND deleted_at IS NULL THEN 1 ELSE 0 END) as completed
     FROM action_items;`,
  )[0]
  return {
    totalMeetings: totals?.total || 0,
    reviewedMeetings: totals?.reviewed || 0,
    openActionItems: actions?.open || 0,
    completedActionItems: actions?.completed || 0,
  }
}

function intensityFromHours(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours === 0) return 0
  if (hours < 2) return 1
  if (hours < 4) return 2
  if (hours < 6) return 3
  return 4
}

export function getWeekHeatmap() {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 14)
  end.setMilliseconds(-1)
  const rows = queryDb<{ day: string; meeting_count: number; minutes: number }>(
    `SELECT substr(date, 1, 10) as day,
            COUNT(*) as meeting_count,
            SUM(COALESCE(duration, 30)) as minutes
     FROM meetings
     WHERE date >= ${sqlString(start.toISOString())}
       AND date <= ${sqlString(end.toISOString())}
     GROUP BY day;`,
  )
  const rowMap = new Map(rows.map((row) => [row.day, row]))
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start)
    date.setDate(date.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    const row = rowMap.get(key)
    const totalHours = Math.round(((row?.minutes || 0) / 60) * 10) / 10
    return {
      date: key,
      dayLabel: dayLabels[date.getDay()],
      meetingCount: row?.meeting_count || 0,
      totalHours,
      intensity: intensityFromHours(totalHours),
    }
  })
}

export function getMeetingBrief(meetingId: string | null) {
  let id = meetingId
  if (!id) {
    id =
      queryDb<{ id: string }>(
        `SELECT id FROM meetings WHERE date >= ${sqlString(new Date().toISOString())} ORDER BY date ASC LIMIT 1;`,
      )[0]?.id || null
  }
  if (!id) {
    return {
      meetingId: null,
      message: 'No upcoming meetings found',
      previousMeetings: [],
      openActionItems: [],
      lastMeetingSummary: null,
    }
  }
  const meeting = getMeetingById(id)
  if (!meeting) return null

  const participantTerms = (meeting.participants || [])
    .map((participant) =>
      typeof participant === 'string'
        ? participant
        : participant.email || participant.displayName || '',
    )
    .filter(Boolean)
    .slice(0, 12)
  const participantWhere = participantTerms.length
    ? `AND (${participantTerms.map((term) => `participants LIKE ${sqlString(`%${term}%`)}`).join(' OR ')})`
    : ''
  const previousRows = queryDb<MeetingRow>(
    `SELECT id, title, type, date, duration, participants, content, join_url,
            has_transcription, transcription_source, reviewed, summary
     FROM meetings
     WHERE id != ${sqlString(id)} ${participantWhere}
     ORDER BY date DESC
     LIMIT 5;`,
  )
  const previousMeetings = previousRows.map(rowToMeeting)
  const previousIds = previousMeetings.map((previous) => sqlString(previous.id))
  const openActionItems = previousIds.length
    ? queryDb<{
        id: string
        text: string
        assignee: string | null
        due_date: string | null
        status: string | null
        priority: string | null
        created_date: string | null
        meeting_title: string | null
        meeting_date: string | null
      }>(
        `SELECT ai.id, ai.text, ai.assignee, ai.due_date, ai.status, ai.priority, ai.created_date,
                m.title as meeting_title, m.date as meeting_date
         FROM action_items ai
         LEFT JOIN meetings m ON ai.meeting_id = m.id
         WHERE ai.meeting_id IN (${previousIds.join(',')})
           AND ai.status = 'open'
           AND ai.deleted_at IS NULL
         ORDER BY CASE ai.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  ai.created_date DESC;`,
      )
    : []
  const last = previousRows[0]
  return {
    meetingId: id,
    meetingTitle: meeting.title,
    meetingDate: meeting.date,
    previousMeetings: previousMeetings.map((previous) => ({
      id: previous.id,
      title: previous.title,
      date: previous.date,
      duration: previous.duration,
    })),
    openActionItems: openActionItems.map((item) => ({
      id: item.id,
      text: item.text,
      assignee: item.assignee || undefined,
      dueDate: item.due_date || undefined,
      status: item.status || undefined,
      priority: item.priority || undefined,
      createdDate: item.created_date || undefined,
      meetingTitle: item.meeting_title || undefined,
      meetingDate: item.meeting_date || undefined,
    })),
    lastMeetingSummary: last
      ? {
          id: last.id,
          title: last.title,
          date: last.date,
          duration: last.duration || undefined,
          summary: last.summary || null,
        }
      : null,
  }
}

export function setMeetingReviewed(meetingId: string, reviewed: boolean) {
  execDb(
    `UPDATE meetings SET reviewed = ${reviewed ? 1 : 0} WHERE id = ${sqlString(meetingId)};`,
  )
  return { success: true }
}

export function bulkMarkReviewed(meetingIds: Array<string>) {
  if (meetingIds.length === 0) return { success: true, count: 0 }
  execDb(
    `UPDATE meetings SET reviewed = 1 WHERE id IN (${meetingIds.map(sqlString).join(',')});`,
  )
  return { success: true, count: meetingIds.length }
}

export function createActionItem(input: {
  meetingId?: string
  text: string
  assignee?: string
  dueDate?: string
  priority?: string
}) {
  if (!input.text.trim()) throw new Error('Text required')
  const meetingId = input.meetingId || 'standalone'
  if (meetingId === 'standalone') {
    execDb(
      `INSERT OR IGNORE INTO meetings
       (id, graph_id, title, type, date, duration, participants, content, source, last_modified, has_transcription, team_id)
       VALUES ('standalone', NULL, 'Standalone Action Items', 'other', ${sqlString(new Date().toISOString())}, NULL, '[]', '', 'manual', ${sqlString(new Date().toISOString())}, 0, NULL);`,
    )
  }
  const id = `ai-${randomUUID()}`
  const now = new Date().toISOString()
  execDb(
    `INSERT INTO action_items
       (id, meeting_id, text, assignee, due_date, status, priority, source, created_date, last_updated)
     VALUES
       (${sqlString(id)}, ${sqlString(meetingId)}, ${sqlString(input.text)}, ${sqlString(input.assignee || '')},
        ${sqlString(input.dueDate || '')}, 'open', ${sqlString(input.priority || 'medium')}, 'manual',
        ${sqlString(now)}, ${sqlString(now)});`,
  )
  return { success: true, id }
}

export function updateActionItem(actionItem: any) {
  if (!actionItem?.id) throw new Error('Action item ID required')
  const sets: Array<string> = []
  if (actionItem.text !== undefined) sets.push(`text = ${sqlString(actionItem.text)}`)
  if (actionItem.assignee !== undefined) sets.push(`assignee = ${sqlString(actionItem.assignee)}`)
  if (actionItem.dueDate !== undefined) sets.push(`due_date = ${sqlString(actionItem.dueDate)}`)
  if (actionItem.status !== undefined) sets.push(`status = ${sqlString(actionItem.status)}`)
  if (actionItem.priority !== undefined) sets.push(`priority = ${sqlString(actionItem.priority)}`)
  sets.push("source = 'user-edited'")
  sets.push(`last_updated = ${sqlString(new Date().toISOString())}`)
  execDb(`UPDATE action_items SET ${sets.join(', ')} WHERE id = ${sqlString(actionItem.id)};`)
  return { success: true }
}

export function deleteActionItem(actionItemId: string) {
  execDb(
    `UPDATE action_items SET deleted_at = ${sqlString(new Date().toISOString())} WHERE id = ${sqlString(actionItemId)};`,
  )
  return { success: true }
}

export function updateIssue(issue: any) {
  if (!issue?.id) throw new Error('Issue ID required')
  const sets: Array<string> = []
  if (issue.title !== undefined) sets.push(`title = ${sqlString(issue.title)}`)
  if (issue.description !== undefined) sets.push(`description = ${sqlString(issue.description)}`)
  if (issue.status !== undefined) sets.push(`status = ${sqlString(issue.status)}`)
  if (issue.priority !== undefined) sets.push(`priority = ${sqlString(issue.priority)}`)
  if (issue.assignee !== undefined) sets.push(`assignee = ${sqlString(issue.assignee)}`)
  if (!sets.length) return { success: true }
  execDb(`UPDATE issues SET ${sets.join(', ')} WHERE id = ${sqlString(issue.id)};`)
  return { success: true }
}

export function deleteIssue(issueId: string) {
  execDb(`DELETE FROM issues WHERE id = ${sqlString(issueId)};`)
  return { success: true }
}

export function updateDecision(decision: any) {
  if (!decision?.id) throw new Error('Decision ID required')
  const sets: Array<string> = []
  if (decision.text !== undefined) sets.push(`text = ${sqlString(decision.text)}`)
  if (decision.decisionMaker !== undefined) sets.push(`decision_maker = ${sqlString(decision.decisionMaker)}`)
  if (decision.impact !== undefined) sets.push(`impact = ${sqlString(decision.impact)}`)
  if (decision.rationale !== undefined) sets.push(`rationale = ${sqlString(decision.rationale)}`)
  if (!sets.length) return { success: true }
  execDb(`UPDATE decisions SET ${sets.join(', ')} WHERE id = ${sqlString(decision.id)};`)
  return { success: true }
}

export function deleteDecision(decisionId: string) {
  execDb(`DELETE FROM decisions WHERE id = ${sqlString(decisionId)};`)
  return { success: true }
}
