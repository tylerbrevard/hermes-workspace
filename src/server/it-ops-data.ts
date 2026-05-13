import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || path.join(HOME, '.hermes', 'workspace')
const MEETINGS_DB_PATH =
  process.env.HERMES_MEETINGS_DB ||
  process.env.CLAWOS_MEETINGS_DB ||
  '/Users/tylerlyon/clawos/data/.meetings.db'
const IT_OPS_DB_PATH =
  process.env.HERMES_IT_OPS_DB || path.join(HERMES_WORKSPACE, '.it-ops.db')

const DIRECT_REPORTS = [
  'Carlos Castillo',
  'Gerald Headd',
  'Christopher Jones',
  'Jose Villarreal',
  'Drew Wolfe',
  'Alan Ahr',
  'Asadbek Koshniyazov',
  'Adam Acevedo',
]

const IT_TEAM_MEMBERS = [
  { name: 'Carlos Castillo', role: 'Team Lead' },
  { name: 'Gerald Headd', role: 'Tier 1' },
  { name: 'Christopher Jones', role: 'Tier 2' },
  { name: 'Jose Villarreal', role: 'Tier 2' },
  { name: 'Drew Wolfe', role: 'Tier 2' },
  { name: 'Alan Ahr', role: 'Tier 1' },
  { name: 'Asadbek Koshniyazov', role: 'Tier 1' },
  { name: 'Adam Acevedo', role: 'Tier 1' },
]

const ESCALATION_THRESHOLDS = {
  STALE_TICKET_HOURS: 24,
}

const RECURRING_THEMES = [
  { label: 'Darktrace', keywords: ['darktrace'] },
  { label: 'CrowdStrike Azure gap', keywords: ['crowdstrike'] },
  { label: 'VDI migration', keywords: ['vdi migration', ' vdi '] },
  { label: 'Server OS upgrades (2016->2022)', keywords: ['os upgrade', '2016 to 2022'] },
  { label: 'Cisco CSR replacement', keywords: ['csr router', 'cisco csr'] },
  { label: 'CWA / Power Platform', keywords: ['cwa', 'power platform', 'powerapp'] },
  { label: 'LinkSquare -> SharePoint', keywords: ['linksquare'] },
  { label: 'Current Chemicals SD-WAN', keywords: ['sd-wan', 'current chem'] },
  { label: 'BPM server', keywords: ['bpm server'] },
  { label: 'MPSA licensing', keywords: ['mpsa'] },
  { label: 'Service Express', keywords: ['service express'] },
  { label: 'Drata / Intune integration', keywords: ['drata'] },
]

type MeetingRow = {
  id: string
  title: string
  date: string
  participants: string | null
  content: string | null
}

type ActionItemRow = {
  id: string
  meeting_id: string
  text: string
  assignee: string | null
  status: string | null
  priority: string | null
}

type IssueRow = {
  meeting_id: string
  title: string
  description: string | null
  status: string | null
  priority: string | null
  assignee: string | null
}

type DecisionRow = {
  meeting_id: string
  text: string
  decision_maker: string | null
  impact: string | null
}

type ConnectWiseConfig = {
  baseUrl: string
  companyId: string
  publicKey: string
  privateKey: string
  clientId: string
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''")
}

function queryDb<T>(dbPath: string, sql: string): T[] {
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
  }).trim()
  if (!output) return []
  return JSON.parse(output) as T[]
}

function execDb(dbPath: string, sql: string) {
  execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' })
}

function parseParticipants(raw: string | null): Array<string | { displayName?: string; email?: string }> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function participantName(participant: string | { displayName?: string; name?: string; email?: string }) {
  if (typeof participant === 'string') return participant
  return participant.displayName || participant.name || participant.email || ''
}

function isPresent(candidate: string, person: string) {
  const lower = candidate.toLowerCase()
  const parts = person.toLowerCase().split(/\s+/).filter(Boolean)
  return parts.every((part) => lower.includes(part) || lower.includes(`${part},`))
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function hoursAgoISO(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

function readConnectWiseConfig(): ConnectWiseConfig | null {
  const candidates = [
    process.env.HERMES_CONNECTWISE_CONFIG,
    process.env.OPENCLAW_CONNECTWISE_CONFIG,
    path.join(HOME, '.config', 'hermes', 'tokens', 'connectwise_config.json'),
    path.join(HOME, '.config', 'openclaw', 'tokens', 'connectwise_config.json'),
  ].filter(Boolean) as string[]

  for (const configPath of candidates) {
    if (!existsSync(configPath)) continue
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as ConnectWiseConfig
      if (
        parsed.baseUrl &&
        parsed.companyId &&
        parsed.publicKey &&
        parsed.privateKey &&
        parsed.clientId
      ) {
        return parsed
      }
    } catch {
      // Try the next configured path.
    }
  }

  return null
}

function getCWAuthHeader(config: ConnectWiseConfig) {
  return `Basic ${Buffer.from(`${config.companyId}+${config.publicKey}:${config.privateKey}`).toString('base64')}`
}

async function cwFetch(config: ConnectWiseConfig, requestPath: string) {
  const response = await fetch(`${config.baseUrl}${requestPath}`, {
    headers: {
      Authorization: getCWAuthHeader(config),
      'Content-Type': 'application/json',
      clientId: config.clientId,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`ConnectWise API ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

async function safeCWFetch(config: ConnectWiseConfig, requestPath: string, errors: string[]) {
  try {
    return await cwFetch(config, requestPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`ConnectWise ${requestPath.split('?')[0]}: ${message}`)
    return null
  }
}

function ensureItOpsSchema() {
  execDb(
    IT_OPS_DB_PATH,
    `
    CREATE TABLE IF NOT EXISTS escalation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      escalated_by TEXT DEFAULT 'system',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_escalation_log_ticket ON escalation_log(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_escalation_log_created ON escalation_log(created_at);
    `,
  )
}

function logEscalation(ticketId: string, reason: string, escalatedBy = 'system') {
  ensureItOpsSchema()
  execDb(
    IT_OPS_DB_PATH,
    `INSERT INTO escalation_log (ticket_id, reason, escalated_by) VALUES ('${sqlEscape(ticketId)}', '${sqlEscape(reason)}', '${sqlEscape(escalatedBy)}');`,
  )
}

function getEscalationCountSince(sinceISO: string) {
  ensureItOpsSchema()
  const row = queryDb<{ cnt: number }>(
    IT_OPS_DB_PATH,
    `SELECT COUNT(*) as cnt FROM escalation_log WHERE created_at >= '${sqlEscape(sinceISO)}';`,
  )[0]
  return row?.cnt ?? 0
}

function getItOpsOverview() {
  const meetings = queryDb<MeetingRow>(
    MEETINGS_DB_PATH,
    `SELECT id, title, date, participants, content FROM meetings WHERE title LIKE '%IT Ops Standup%' ORDER BY date ASC LIMIT 500;`,
  )

  const meetingIds = meetings.map((meeting) => `'${sqlEscape(meeting.id)}'`)
  const idFilter = meetingIds.length ? `IN (${meetingIds.join(',')})` : "IN ('')"

  const actionRows = queryDb<ActionItemRow>(
    MEETINGS_DB_PATH,
    `SELECT id, meeting_id, text, assignee, status, priority FROM action_items WHERE meeting_id ${idFilter} AND deleted_at IS NULL ORDER BY created_date ASC;`,
  )
  const issueRows = queryDb<IssueRow>(
    MEETINGS_DB_PATH,
    `SELECT meeting_id, title, description, status, priority, assignee FROM issues WHERE meeting_id ${idFilter} ORDER BY first_mentioned ASC;`,
  )
  const decisionRows = queryDb<DecisionRow>(
    MEETINGS_DB_PATH,
    `SELECT meeting_id, text, decision_maker, impact FROM decisions WHERE meeting_id ${idFilter} ORDER BY date ASC;`,
  )

  const actionsByMeeting = new Map<string, ActionItemRow[]>()
  const issuesByMeeting = new Map<string, IssueRow[]>()
  const decisionsByMeeting = new Map<string, DecisionRow[]>()
  for (const item of actionRows) actionsByMeeting.set(item.meeting_id, [...(actionsByMeeting.get(item.meeting_id) || []), item])
  for (const item of issueRows) issuesByMeeting.set(item.meeting_id, [...(issuesByMeeting.get(item.meeting_id) || []), item])
  for (const item of decisionRows) decisionsByMeeting.set(item.meeting_id, [...(decisionsByMeeting.get(item.meeting_id) || []), item])

  const hydratedStandups = meetings.filter(
    (meeting) => meeting.date >= '2026-01-15' && parseParticipants(meeting.participants).length > 0,
  )
  const total = hydratedStandups.length
  const attendanceMap: Record<string, { present: string[]; absent: string[] }> = {}
  const personStats: Record<string, { present: number; absent: number }> = {}
  for (const name of DIRECT_REPORTS) personStats[name] = { present: 0, absent: 0 }

  for (const meeting of hydratedStandups) {
    const dateKey = meeting.date.slice(0, 10)
    const participantNames = parseParticipants(meeting.participants).map(participantName).filter(Boolean)
    const present = DIRECT_REPORTS.filter((person) =>
      participantNames.some((candidate) => isPresent(candidate, person)),
    )
    const absent = DIRECT_REPORTS.filter((person) => !present.includes(person))
    attendanceMap[dateKey] = { present, absent }
    for (const person of present) personStats[person].present += 1
    for (const person of absent) personStats[person].absent += 1
  }

  const attendance = DIRECT_REPORTS.map((name) => ({
    name,
    total,
    present: personStats[name]?.present ?? 0,
    absent: personStats[name]?.absent ?? 0,
    absenceRate: total > 0 ? Math.round(((personStats[name]?.absent ?? 0) / total) * 100) : 0,
  })).sort((a, b) => b.absenceRate - a.absenceRate)

  const actionItems = actionRows.map((item, index) => {
    const task = item.text || ''
    const assignee = item.assignee || (() => {
      const colonIndex = task.indexOf(':')
      return colonIndex > 0 ? task.slice(0, colonIndex).trim() : 'Unassigned'
    })()
    return {
      id: item.id || `${item.meeting_id}-${index}`,
      meetingId: item.meeting_id,
      meetingDate: meetings.find((meeting) => meeting.id === item.meeting_id)?.date.slice(0, 10) || '',
      assignee,
      task,
      isDirectReport: DIRECT_REPORTS.some((name) => assignee.includes(name.split(' ')[0])),
      isTyler: assignee.toLowerCase().includes('tyler'),
      status: item.status || undefined,
      priority: item.priority || undefined,
    }
  })

  const recurringIssues = RECURRING_THEMES.map((theme) => {
    const appearances = meetings.filter((meeting) => {
      const text = JSON.stringify({
        meeting,
        issues: issuesByMeeting.get(meeting.id) || [],
        decisions: decisionsByMeeting.get(meeting.id) || [],
        actions: actionsByMeeting.get(meeting.id) || [],
      }).toLowerCase()
      return theme.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    })
    return {
      label: theme.label,
      count: appearances.length,
      dates: appearances.map((meeting) => meeting.date.slice(0, 10)),
      firstSeen: appearances[0]?.date?.slice(0, 10) ?? null,
      lastSeen: appearances[appearances.length - 1]?.date?.slice(0, 10) ?? null,
    }
  }).filter((theme) => theme.count >= 2).sort((a, b) => b.count - a.count)

  const recentMeetings = meetings.slice(-10).reverse().map((meeting) => ({
    id: meeting.id,
    date: meeting.date.slice(0, 10),
    title: meeting.title,
    attendees: parseParticipants(meeting.participants).map(participantName).filter(Boolean),
    absentDirectReports: attendanceMap[meeting.date.slice(0, 10)]?.absent || [],
    actionItems: (actionsByMeeting.get(meeting.id) || []).map((item) => item.text),
    issues: (issuesByMeeting.get(meeting.id) || []).map((issue) => issue.title || issue.description || ''),
    decisions: (decisionsByMeeting.get(meeting.id) || []).map((decision) => decision.text),
  }))

  return {
    totalMeetings: total,
    dateRange: {
      from: hydratedStandups[0]?.date?.slice(0, 10),
      to: hydratedStandups[total - 1]?.date?.slice(0, 10),
    },
    attendance,
    attendanceMap,
    actionItems,
    tylerActions: [],
    hotItems: [],
    recurringIssues,
    recentMeetings,
    generatedAt: new Date().toISOString(),
  }
}

function calcSLACompliance(totalTickets: number, slaBreaches: number) {
  if (totalTickets === 0) return 100
  return Math.round(((totalTickets - slaBreaches) / totalTickets) * 1000) / 10
}

async function getItOpsAnalytics() {
  const errors: string[] = []
  const now = new Date()
  let ticketStats = { open: 0, closedToday: 0, avgResolutionHours: 0, slaCompliancePct: 100 }
  let teamPerformance = IT_TEAM_MEMBERS.map((member) => ({
    name: member.name,
    role: member.role,
    ticketsAssigned: 0,
    ticketsResolved: 0,
    avgResolutionHours: 0,
  }))
  let trendData: Array<{ date: string; created: number; resolved: number }> = []
  let queueBreakdown: Array<{ queue: string; count: number }> = []

  const config = readConnectWiseConfig()
  if (!config) {
    errors.push('ConnectWise not configured - returning empty analytics.')
  } else {
    const today = todayStr()
    const thirtyDaysAgo = daysAgoStr(30)
    const [openTicketsRaw, closedTodayRaw, last30DaysRaw] = await Promise.all([
      safeCWFetch(config, '/service/tickets?conditions=status/name!="Closed"&pageSize=200&fields=id,priority,assignedTo,board,status,requiredDate,dateEntered,owner,company', errors),
      safeCWFetch(config, `/service/tickets?conditions=closedDate>=[${today}T00:00:00Z]&pageSize=200&fields=id,closedDate,dateEntered,assignedTo,owner`, errors),
      safeCWFetch(config, `/service/tickets?conditions=dateEntered>=[${thirtyDaysAgo}T00:00:00Z]&pageSize=500&fields=id,dateEntered,closedDate,board,assignedTo,requiredDate,status,owner`, errors),
    ])

    const openTickets = Array.isArray(openTicketsRaw) ? openTicketsRaw : []
    const closedToday = Array.isArray(closedTodayRaw) ? closedTodayRaw : []
    const last30Days = Array.isArray(last30DaysRaw) ? last30DaysRaw : []
    let slaBreaches = 0
    for (const ticket of openTickets) {
      if (!ticket.requiredDate) continue
      const hoursLeft = (new Date(ticket.requiredDate).getTime() - Date.now()) / 3_600_000
      if (hoursLeft < 0) slaBreaches += 1
    }

    let totalResolutionHours = 0
    let resolvedCount = 0
    for (const ticket of closedToday) {
      if (!ticket.closedDate || !ticket.dateEntered) continue
      const hours =
        (new Date(ticket.closedDate).getTime() - new Date(ticket.dateEntered).getTime()) /
        3_600_000
      if (hours >= 0) {
        totalResolutionHours += hours
        resolvedCount += 1
      }
    }

    ticketStats = {
      open: openTickets.length,
      closedToday: closedToday.length,
      avgResolutionHours:
        resolvedCount > 0 ? Math.round((totalResolutionHours / resolvedCount) * 10) / 10 : 0,
      slaCompliancePct: calcSLACompliance(openTickets.length, slaBreaches),
    }

    const teamMap: Record<string, { assigned: number; resolved: number; resHoursSum: number; resCount: number }> = {}
    for (const member of IT_TEAM_MEMBERS) {
      teamMap[member.name] = { assigned: 0, resolved: 0, resHoursSum: 0, resCount: 0 }
    }
    for (const ticket of last30Days) {
      const ownerName = ticket.owner?.name || ticket.assignedTo?.name
      if (!ownerName || !teamMap[ownerName]) continue
      teamMap[ownerName].assigned += 1
      if (!ticket.closedDate) continue
      teamMap[ownerName].resolved += 1
      if (!ticket.dateEntered) continue
      const hours =
        (new Date(ticket.closedDate).getTime() - new Date(ticket.dateEntered).getTime()) /
        3_600_000
      if (hours >= 0) {
        teamMap[ownerName].resHoursSum += hours
        teamMap[ownerName].resCount += 1
      }
    }
    teamPerformance = IT_TEAM_MEMBERS.map((member) => {
      const stats = teamMap[member.name]
      return {
        name: member.name,
        role: member.role,
        ticketsAssigned: stats.assigned,
        ticketsResolved: stats.resolved,
        avgResolutionHours:
          stats.resCount > 0 ? Math.round((stats.resHoursSum / stats.resCount) * 10) / 10 : 0,
      }
    })

    const trendMap: Record<string, { created: number; resolved: number }> = {}
    for (let index = 0; index < 30; index += 1) {
      trendMap[daysAgoStr(index)] = { created: 0, resolved: 0 }
    }
    for (const ticket of last30Days) {
      const entered = ticket.dateEntered?.slice(0, 10)
      if (entered && trendMap[entered]) trendMap[entered].created += 1
      const closed = ticket.closedDate?.slice(0, 10)
      if (closed && trendMap[closed]) trendMap[closed].resolved += 1
    }
    trendData = Object.entries(trendMap)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, counts]) => ({ date, created: counts.created, resolved: counts.resolved }))

    const queueMap: Record<string, number> = {}
    for (const ticket of openTickets) {
      const board = ticket.board?.name || 'Unknown'
      queueMap[board] = (queueMap[board] || 0) + 1
    }
    queueBreakdown = Object.entries(queueMap)
      .sort((left, right) => right[1] - left[1])
      .map(([queue, count]) => ({ queue, count }))

    try {
      for (const ticket of openTickets) {
        const ageHours = ticket.dateEntered
          ? (Date.now() - new Date(ticket.dateEntered).getTime()) / 3_600_000
          : 0
        if (ageHours > ESCALATION_THRESHOLDS.STALE_TICKET_HOURS) {
          logEscalation(String(ticket.id), `Stale ticket (${Math.round(ageHours)}h old)`, 'system')
        }
      }
    } catch (error) {
      errors.push(`Escalation auto-log: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  let escalationCount = 0
  try {
    escalationCount = getEscalationCountSince(hoursAgoISO(24))
  } catch (error) {
    errors.push(`Escalation DB read: ${error instanceof Error ? error.message : String(error)}`)
  }

  const topQueue = queueBreakdown[0]
  const slaRiskCount =
    ticketStats.open > 0
      ? Math.round(ticketStats.open * (1 - ticketStats.slaCompliancePct / 100))
      : 0
  const briefing =
    [
      `${ticketStats.open} open ticket${ticketStats.open !== 1 ? 's' : ''}`,
      slaRiskCount > 0 ? `${slaRiskCount} at SLA risk` : null,
      ticketStats.avgResolutionHours > 0
        ? `Avg resolution: ${ticketStats.avgResolutionHours}h`
        : null,
      topQueue
        ? `Top queue: ${topQueue.queue} with ${topQueue.count} ticket${topQueue.count !== 1 ? 's' : ''}`
        : null,
    ]
      .filter(Boolean)
      .join('. ') + '.'

  return {
    ticketStats,
    escalationCount,
    teamPerformance,
    trendData,
    queueBreakdown,
    briefing,
    errors,
    fetchedAt: now.toISOString(),
  }
}

export async function getItOpsData() {
  const [overview, analytics] = await Promise.all([getItOpsOverview(), getItOpsAnalytics()])
  return {
    overview,
    analytics,
    refreshedAt: new Date().toISOString(),
  }
}
