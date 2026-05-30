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
    status?: string
    assignee?: string
    dueDate?: string
    priority?: string
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
  }>
}

export type MeetingsData = {
  meetings: Array<Meeting>
  todayMeetings: Array<Meeting>
  selectedMeetingId?: string | null
  selectedMeeting?: Meeting | null
  brief?: {
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
  } | null
  heatmapDays?: Array<{
    date: string
    dayLabel: string
    meetingCount: number
    totalHours: number
    intensity: 0 | 1 | 2 | 3 | 4
  }>
  total?: number
  graphSource?: string
  graphWarning?: string
  dataWarning?: string
  refreshedAt?: string
  error?: string
}

type BriefOpenActionItem = NonNullable<
  MeetingsData['brief']
>['openActionItems'][number]

export type MeetingReviewFilter =
  | 'all'
  | 'today'
  | 'this-week'
  | 'needs-review'
  | 'reviewed'
  | 'has-open-actions'
  | 'no-prep'
  | 'no-transcript'
  | 'missing-notes'
  | 'needs-follow-up'

export type MeetingCockpitAction =
  | 'sync'
  | 'prep'
  | 'follow-up'
  | 'review'
  | 'agenda'

export type MeetingCockpitTile = {
  id: string
  label: string
  value: string
  detail: string
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  action: MeetingCockpitAction
  progress: number
}

export function isUnresolvedStatus(status?: string) {
  return !/^(completed|done|resolved|closed)$/i.test(status || 'open')
}

export function participantList(meeting: Meeting) {
  return (meeting.participants || [])
    .map((participant) =>
      typeof participant === 'string'
        ? participant
        : participant.displayName || participant.email || '',
    )
    .filter(Boolean)
}

export function buildMeetingExtractionSummary(meeting: Meeting | null) {
  const actionCount = meeting?.actionItems?.length ?? 0
  const issueCount = meeting?.issues?.length ?? 0
  const decisionCount = meeting?.decisions?.length ?? 0
  const hasTranscript = Boolean(meeting?.hasTranscription || meeting?.content)
  const confidence =
    hasTranscript && actionCount + issueCount + decisionCount > 0
      ? 'high'
      : hasTranscript
        ? 'medium'
        : 'needs review'
  return {
    actionCount,
    issueCount,
    decisionCount,
    confidence,
    reviewState: meeting?.reviewed ? 'reviewed' : 'needs review',
  }
}

export function formatMeetingTitle(title: string) {
  const trimmed = title.trim()
  if (/cancell?ed/i.test(trimmed) && /placeholder/i.test(trimmed)) {
    const detail = trimmed.match(/\(([^)]+)\)/)?.[1]?.trim()
    return detail ? `Canceled: ${detail}` : 'Canceled meeting'
  }
  return trimmed
    .replace(/^\[EXTERNAL\]\s*/i, '')
    .replace(/\s+Placeholder\s*$/i, '')
    .trim()
}

export function buildMeetingCockpitTiles({
  data,
  nextMeeting,
  nextNeedsPrep,
  unresolvedCommitmentCount,
  unreviewedCount,
}: {
  data: MeetingsData | null
  nextMeeting: Meeting | null
  nextNeedsPrep: boolean
  unresolvedCommitmentCount: number
  unreviewedCount: number
}): Array<MeetingCockpitTile> {
  const todayCount = data?.todayMeetings?.length || 0
  const totalCount = data?.total || data?.meetings?.length || 0
  const graphDegraded = Boolean(data?.graphWarning || data?.dataWarning)
  const graphOffline = Boolean(data?.error)
  const totalForProgress = Math.max(1, totalCount)

  return [
    {
      id: 'agenda',
      label: 'Today',
      value: String(todayCount),
      detail: todayCount > 0 ? 'Agenda loaded' : 'Clear',
      tone: todayCount > 4 ? 'warn' : 'ok',
      action: 'agenda',
      progress: Math.min(100, todayCount * 20),
    },
    {
      id: 'next',
      label: 'Next',
      value: nextMeeting ? formatMeetingTitle(nextMeeting.title) : 'None',
      detail: nextNeedsPrep
        ? 'Prep open'
        : nextMeeting
          ? 'Ready'
          : 'Sync',
      tone: nextNeedsPrep ? 'warn' : nextMeeting ? 'ok' : 'neutral',
      action: 'prep',
      progress: nextMeeting ? 100 : 0,
    },
    {
      id: 'follow-up',
      label: 'Follow-up',
      value: String(unresolvedCommitmentCount),
      detail: unresolvedCommitmentCount > 0 ? 'Route' : 'Clear',
      tone: unresolvedCommitmentCount > 0 ? 'warn' : 'ok',
      action: 'follow-up',
      progress: Math.min(100, unresolvedCommitmentCount * 20),
    },
    {
      id: 'review',
      label: 'Review',
      value: String(unreviewedCount),
      detail: unreviewedCount > 0 ? 'Open' : 'Clear',
      tone: unreviewedCount > 0 ? 'warn' : 'ok',
      action: 'review',
      progress: Math.round((unreviewedCount / totalForProgress) * 100),
    },
    {
      id: 'sync',
      label: 'Source',
      value: graphOffline ? 'Offline' : graphDegraded ? 'Degraded' : 'Live',
      detail: data?.graphSource || 'Unknown',
      tone: graphOffline ? 'bad' : graphDegraded ? 'warn' : 'ok',
      action: 'sync',
      progress: graphOffline ? 0 : graphDegraded ? 55 : 100,
    },
  ]
}

export function meetingMatchesReviewFilter(
  meeting: Meeting,
  filter: MeetingReviewFilter,
  now = new Date(),
) {
  if (filter === 'today') return isSameCalendarDay(meeting.date, now)
  if (filter === 'this-week') return isWithinDays(meeting.date, 7, now)
  if (filter === 'needs-review') return !meeting.reviewed
  if (filter === 'reviewed') return Boolean(meeting.reviewed)
  if (filter === 'has-open-actions') {
    return (meeting.actionItems || []).some((item) =>
      isUnresolvedStatus(item.status),
    )
  }
  if (filter === 'no-prep') return !meeting.content?.trim()
  if (filter === 'no-transcript') return !meeting.hasTranscription
  if (filter === 'missing-notes') {
    return !meeting.content?.trim() && !meeting.hasTranscription
  }
  if (filter === 'needs-follow-up') {
    return (
      (meeting.actionItems || []).some((item) =>
        isUnresolvedStatus(item.status),
      ) ||
      (meeting.issues || []).some((issue) => isUnresolvedStatus(issue.status))
    )
  }
  return true
}

function meetingSearchText(meeting: Meeting) {
  return [
    meeting.title,
    meeting.type,
    meeting.content,
    ...participantList(meeting),
    ...(meeting.actionItems || []).flatMap((item) => [
      item.text,
      item.assignee,
      item.priority,
      item.status,
    ]),
    ...(meeting.issues || []).flatMap((issue) => [
      issue.title,
      issue.description,
      issue.assignee,
      issue.priority,
      issue.status,
    ]),
    ...(meeting.decisions || []).flatMap((decision) => [
      decision.text,
      decision.decisionMaker,
      decision.impact,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function meetingMatchesSearch(meeting: Meeting, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return normalized
    .split(/\s+/)
    .every((token) => meetingSearchText(meeting).includes(token))
}

export function isSameCalendarDay(value: string, now = new Date()) {
  const date = new Date(value)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function isWithinDays(value: string, days: number, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + days)
  return date >= start && date < end
}

export function isMeetingPrepWindow(
  meeting: Meeting | null,
  hours = 24,
  now = new Date(),
) {
  if (!meeting) return false
  const date = new Date(meeting.date)
  if (Number.isNaN(date.getTime())) return false
  const diffHours = (date.getTime() - now.getTime()) / 1000 / 60 / 60
  return diffHours >= 0 && diffHours <= hours
}

export function getMeetingSeverity(meeting: Meeting) {
  if (
    (meeting.issues || []).some(
      (issue) =>
        isUnresolvedStatus(issue.status) &&
        /critical|urgent|high/i.test(issue.priority || ''),
    )
  ) {
    return 'blocked'
  }
  if (
    !meeting.reviewed ||
    !meeting.content?.trim() ||
    (meeting.actionItems || []).some((item) =>
      isUnresolvedStatus(item.status),
    ) ||
    (meeting.issues || []).some((issue) => isUnresolvedStatus(issue.status))
  ) {
    return 'attention'
  }
  return 'ok'
}

export function getMeetingOwnerChips(meeting: Meeting) {
  const chips = new Set<string>()
  participantList(meeting)
    .slice(0, 3)
    .forEach((participant) => chips.add(`Attendee: ${participant}`))
  ;(meeting.actionItems || [])
    .map((item) => item.assignee)
    .filter(Boolean)
    .slice(0, 3)
    .forEach((assignee) => chips.add(`Owner: ${assignee}`))
  ;(meeting.issues || [])
    .map((issue) => issue.assignee)
    .filter(Boolean)
    .slice(0, 2)
    .forEach((assignee) => chips.add(`Issue: ${assignee}`))
  return Array.from(chips).slice(0, 6)
}

export function buildMeetingActionTodoItems(
  meeting: Meeting | null,
  carryForwardItems: Array<BriefOpenActionItem> = [],
) {
  const carryForward = Array.isArray(carryForwardItems) ? carryForwardItems : []
  const selectedItems = (meeting?.actionItems || [])
    .filter((item) => isUnresolvedStatus(item.status))
    .map((item) => ({
      text: item.text,
      assignee: item.assignee,
      dueDate: item.dueDate,
      priority: item.priority,
      meetingTitle: meeting?.title,
      sourceType: 'meeting-action-item',
    }))
  const priorItems = carryForward.map((item) => ({
    text: item.text,
    assignee: item.assignee,
    dueDate: item.dueDate,
    priority: item.priority,
    meetingTitle: item.meetingTitle || meeting?.title,
    sourceType: 'meeting-action-item',
  }))
  const seen = new Set<string>()
  return [...priorItems, ...selectedItems].filter((item) => {
    const key = `${item.text}|${item.meetingTitle || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function classifyTylerRole(meeting: Meeting) {
  const attendees = participantList(meeting)
  if (attendees.length <= 2) return 'owner/direct participant'
  if (
    (meeting.actionItems || []).some((item) =>
      /tyler/i.test(item.assignee || ''),
    )
  ) {
    return 'assigned owner'
  }
  return 'attendee'
}

export function buildMeetingBriefMarkdown(
  meeting: Meeting | null,
  options: { redactParticipants?: boolean } = {},
) {
  if (!meeting) return '# Meeting brief\n\nNo meeting selected.'
  const summary = buildMeetingExtractionSummary(meeting)
  const participants = participantList(meeting)
  const participantLine = options.redactParticipants
    ? `Attendees: ${participants.length} attendee(s), redacted`
    : `Attendees: ${participants.join(', ') || 'none recorded'}`
  return [
    `# ${formatMeetingTitle(meeting.title)}`,
    '',
    `Date: ${meeting.date}`,
    participantLine,
    `Review: ${summary.reviewState}`,
    `Confidence: ${summary.confidence}`,
    `Actions: ${summary.actionCount}`,
    `Decisions: ${summary.decisionCount}`,
    `FYIs/issues: ${summary.issueCount}`,
  ].join('\n')
}

export function getMeetingTrendInterpretation(
  days: NonNullable<MeetingsData['heatmapDays']> = [],
) {
  if (days.length === 0) return 'No load trend available yet.'
  const heavyDays = days.filter((day) => day.intensity >= 3)
  const totalHours = days.reduce((sum, day) => sum + day.totalHours, 0)
  if (heavyDays.length >= 3) {
    return `${heavyDays.length} heavy meeting days ahead; protect prep and follow-up blocks before accepting more holds.`
  }
  if (totalHours <= 4) {
    return 'Light meeting load; use the open space for follow-up and deep work.'
  }
  return 'Meeting load is balanced; watch for unresolved items before the next heavy day.'
}

export function getMeetingEmptyState(error?: string | null) {
  if (error && /auth|unauthorized|token/i.test(error)) {
    return 'Calendar auth required. Repair Graph auth before sync.'
  }
  return 'Clear.'
}
