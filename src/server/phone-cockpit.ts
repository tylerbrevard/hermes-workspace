import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { createTask, listTasks } from './tasks-store'
import {
  getMeetingBrief,
  getMeetingStats,
  getTodayMeetings,
} from './meetings-data'
import { getLegacyIotDevices, getTeamsPresence } from './presence-data'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || path.join(HOME, '.hermes', 'workspace')
const GRAPH_WRAPPER = path.join(
  HERMES_WORKSPACE,
  'scripts',
  'run_hermes_venv_python.sh',
)
const GRAPH_BRIDGE = path.join(HERMES_WORKSPACE, 'scripts', 'graph_bridge.py')
const TYLER_GUID = 'b906d90e-689b-464e-8904-aed5180b463a'
const TYLER_REMOTE = path.join(HOME, 'Documents', 'Tyler remote')
const PHONE_CAPTURE_NOTE = path.join(
  TYLER_REMOTE,
  '00 Inbox',
  'Hermes Phone Capture.md',
)
const OFFICE_STATE = path.join(
  HOME,
  '.hermes',
  'office-device-bridge',
  'runtime-state.json',
)
const STALE_OFFICE_MS = 10 * 60 * 1000

type SafeResult<T> = { ok: true; value: T } | { ok: false; error: string }

type SourceKey =
  | 'presence'
  | 'calendar'
  | 'meetingPrep'
  | 'mail'
  | 'tasks'
  | 'devices'

export type DataSourceStatus = {
  ok: boolean
  checkedAt: string
  label: string
  error?: string
}

export type PhoneAttentionItem = {
  id: string
  kind: 'meeting' | 'task' | 'mail' | 'device' | 'source'
  severity: 'info' | 'warning' | 'critical'
  title: string
  body?: string
  href?: string
  actionLabel?: string
  source: SourceKey
  observedAt: string
}

export type PhoneCockpitSnapshot = {
  checkedAt: string
  sources: Record<SourceKey, DataSourceStatus>
  attention: Array<PhoneAttentionItem>
  presence: {
    availability: string
    activity: string
    displayName: string
    color: string
    source?: string
    error?: string
  }
  schedule: {
    meetings: Array<{
      id: string
      title: string
      date: string
      duration?: number
      joinUrl?: string | null
      reviewed?: boolean
      actionCount: number
    }>
    nextMeeting: {
      id: string
      title: string
      date: string
      duration?: number
      joinUrl?: string | null
      minutesUntil: number
    } | null
    stats: {
      totalMeetings: number
      reviewedMeetings: number
      openActionItems: number
      completedActionItems: number
    } | null
    warning?: string
  }
  meetingPrep: {
    meetingId: string | null
    meetingTitle?: string
    meetingDate?: string
    openActionItems: Array<{
      id: string
      text: string
      assignee?: string
      dueDate?: string
      priority?: string
      meetingTitle?: string
    }>
    previousMeetings: Array<{ id: string; title: string; date: string }>
    lastMeetingSummary?: { title: string; summary?: string | null } | null
    message?: string
    warning?: string
  }
  inbox: {
    unread: number | null
    focused: Array<{
      subject: string
      sender: string
      receivedDateTime?: string
      importance?: string
      isRead?: boolean
      webLink?: string
    }>
    warning?: string
  }
  tasks: {
    total: number
    urgent: number
    overdue: number
    today: number
    items: Array<{
      id: string
      title: string
      description?: string
      priority: string
      column: string
      dueDate?: string | null
      tags: Array<string>
    }>
    warning?: string
  }
  devices: {
    m5: Array<Record<string, unknown>>
    office: {
      status: 'online' | 'stale' | 'unknown'
      online: boolean
      checkedAt?: string
      displayMode?: string
      deskMode?: string
      replyLength?: string
      quietHours?: boolean
      bridgeVersion?: string
    }
    warning?: string
  }
  shortcuts: {
    enabled: boolean
    endpoint: string
    allowedActions: Array<PhoneCockpitAction['kind']>
    auth: 'bearer-token'
  }
  capture: {
    notePath: string
    storesAudioTranscripts: boolean
  }
}

export type PhoneCockpitAction =
  | { kind: 'note'; text: string; source?: string }
  | {
      kind: 'task'
      title: string
      description?: string
      priority?: 'high' | 'medium' | 'low'
      dueDate?: string
    }
  | { kind: 'draft'; recipient?: string; subject?: string; body: string }

export function getPhoneShortcutsToken(): string | null {
  const token =
    process.env.HERMES_SHORTCUTS_TOKEN ||
    process.env.PHONE_COCKPIT_SHORTCUTS_TOKEN ||
    process.env.HERMES_API_TOKEN ||
    ''
  return token.trim() || null
}

function safe<T>(fn: () => T): SafeResult<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error: conciseRuntimeError(error) }
  }
}

async function safeAsync<T>(fn: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (error) {
    return { ok: false, error: conciseRuntimeError(error) }
  }
}

function conciseRuntimeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (
    /graph\.microsoft\.com|NameResolutionError|getaddrinfo|ENOTFOUND/i.test(
      message,
    )
  ) {
    return 'Microsoft Graph is unreachable from this machine; using degraded local state.'
  }
  return message.split('\n')[0]?.slice(0, 240) || 'Unknown runtime error'
}

function graphJson<T>(method: string, endpoint: string): T {
  const output = execFileSync(
    GRAPH_WRAPPER,
    [GRAPH_BRIDGE, 'json', method, endpoint],
    {
      encoding: 'utf8',
      timeout: 25_000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim()
  return output ? (JSON.parse(output) as T) : (null as T)
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function minutesUntil(value: string) {
  return Math.round((new Date(value).getTime() - Date.now()) / 60_000)
}

function sameDate(value: string, date = new Date()) {
  const next = new Date(value)
  return (
    next.getFullYear() === date.getFullYear() &&
    next.getMonth() === date.getMonth() &&
    next.getDate() === date.getDate()
  )
}

function isOverdueDate(value?: string | null) {
  if (!value) return false
  const due = new Date(`${value}T23:59:59`)
  return due.getTime() < Date.now()
}

function appendCapture(text: string, source = 'phone') {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Capture text is required')
  mkdirSync(path.dirname(PHONE_CAPTURE_NOTE), { recursive: true })
  const stamp = new Date().toISOString()
  const prefix = existsSync(PHONE_CAPTURE_NOTE)
    ? ''
    : '# Hermes Phone Capture\n\n'
  writeFileSync(
    PHONE_CAPTURE_NOTE,
    `${prefix}- ${stamp} [${source}] ${trimmed}\n`,
    { flag: 'a' },
  )
  return { ok: true, path: PHONE_CAPTURE_NOTE, capturedAt: stamp }
}

function mailSnapshot(): PhoneCockpitSnapshot['inbox'] {
  type Message = {
    subject?: string
    receivedDateTime?: string
    importance?: string
    isRead?: boolean
    webLink?: string
    from?: { emailAddress?: { name?: string; address?: string } }
  }
  const folder = graphJson<{ unreadItemCount?: number } | null>(
    'GET',
    `/users/${TYLER_GUID}/mailFolders/Inbox`,
  )
  const messages = graphJson<{ value?: Array<Message> } | null>(
    'GET',
    `/users/${TYLER_GUID}/mailFolders/Inbox/messages?$top=12&$select=subject,from,receivedDateTime,isRead,importance,webLink&$orderby=receivedDateTime desc`,
  )
  const focused = (messages?.value || [])
    .filter((message) => !message.isRead || message.importance === 'high')
    .sort((a, b) => {
      const aScore = (a.importance === 'high' ? 2 : 0) + (!a.isRead ? 1 : 0)
      const bScore = (b.importance === 'high' ? 2 : 0) + (!b.isRead ? 1 : 0)
      if (aScore !== bScore) return bScore - aScore
      return (
        new Date(b.receivedDateTime || 0).getTime() -
        new Date(a.receivedDateTime || 0).getTime()
      )
    })

  return {
    unread:
      typeof folder?.unreadItemCount === 'number'
        ? folder.unreadItemCount
        : null,
    focused: focused.slice(0, 6).map((message) => ({
      subject: message.subject || '(no subject)',
      sender:
        message.from?.emailAddress?.name ||
        message.from?.emailAddress?.address ||
        'Unknown sender',
      receivedDateTime: message.receivedDateTime,
      importance: message.importance,
      isRead: message.isRead,
      webLink: message.webLink,
    })),
  }
}

function deviceSnapshot(): PhoneCockpitSnapshot['devices'] {
  const officeState = readJson<any>(OFFICE_STATE, {})
  const config = officeState.config || {}
  const officeStateExists = existsSync(OFFICE_STATE)
  const checkedAt = officeStateExists
    ? statSync(OFFICE_STATE).mtime.toISOString()
    : undefined
  const stale = checkedAt
    ? Date.now() - new Date(checkedAt).getTime() > STALE_OFFICE_MS
    : false
  const status: PhoneCockpitSnapshot['devices']['office']['status'] =
    !officeStateExists ? 'unknown' : stale ? 'stale' : 'online'
  const office = {
    status,
    online: status === 'online',
    checkedAt,
    displayMode:
      typeof config.display_mode === 'string' ? config.display_mode : undefined,
    deskMode:
      typeof config.desk_mode === 'string' ? config.desk_mode : undefined,
    replyLength:
      typeof config.reply_length === 'string' ? config.reply_length : undefined,
    quietHours: Boolean(config.quiet_hours_enabled),
    bridgeVersion:
      typeof officeState.bridge_version === 'string'
        ? officeState.bridge_version
        : undefined,
  }
  const m5Result = safe(() => getLegacyIotDevices().devices)
  return {
    m5: m5Result.ok ? m5Result.value : [],
    office,
    warning: m5Result.ok ? undefined : m5Result.error,
  }
}

function shortcutsSnapshot(): PhoneCockpitSnapshot['shortcuts'] {
  return {
    enabled: Boolean(getPhoneShortcutsToken()),
    endpoint: '/api/phone-cockpit/shortcuts',
    allowedActions: ['note', 'task', 'draft'],
    auth: 'bearer-token',
  }
}

function sourceStatus(
  label: string,
  checkedAt: string,
  result: SafeResult<unknown>,
  extraError?: string,
): DataSourceStatus {
  const error = result.ok ? extraError : result.error
  return { ok: !error, checkedAt, label, error }
}

function taskRank(task: { priority: string; due_date?: string | null }) {
  if (isOverdueDate(task.due_date)) return 0
  if (task.priority === 'high') return 1
  if (task.due_date && sameDate(task.due_date)) return 2
  return 3
}

function buildAttention(input: {
  checkedAt: string
  sources: Record<SourceKey, DataSourceStatus>
  next: PhoneCockpitSnapshot['schedule']['nextMeeting']
  overdueTasks: PhoneCockpitSnapshot['tasks']['items']
  inbox: PhoneCockpitSnapshot['inbox']
  devices: PhoneCockpitSnapshot['devices']
}): Array<PhoneAttentionItem> {
  const items: Array<PhoneAttentionItem> = []
  if (
    input.next &&
    input.next.minutesUntil >= -5 &&
    input.next.minutesUntil <= 20
  ) {
    items.push({
      id: `meeting:${input.next.id}`,
      kind: 'meeting',
      severity: input.next.minutesUntil <= 5 ? 'critical' : 'info',
      title:
        input.next.minutesUntil < 0
          ? 'Meeting is live'
          : `Meeting in ${input.next.minutesUntil}m`,
      body: input.next.title,
      href: input.next.joinUrl || '/meetings',
      actionLabel: input.next.joinUrl ? 'Join' : 'Prep',
      source: 'calendar',
      observedAt: input.checkedAt,
    })
  }
  if (input.overdueTasks.length > 0) {
    items.push({
      id: 'tasks:overdue',
      kind: 'task',
      severity: 'warning',
      title: `${input.overdueTasks.length} overdue task${input.overdueTasks.length === 1 ? '' : 's'}`,
      body: input.overdueTasks
        .slice(0, 2)
        .map((task) => task.title)
        .join(' · '),
      href: '/tasks',
      actionLabel: 'Review',
      source: 'tasks',
      observedAt: input.checkedAt,
    })
  }
  const importantUnread = input.inbox.focused.filter(
    (message) => !message.isRead && message.importance === 'high',
  )
  if (importantUnread.length > 0) {
    items.push({
      id: 'mail:important-unread',
      kind: 'mail',
      severity: 'warning',
      title: `${importantUnread.length} important unread`,
      body: importantUnread
        .slice(0, 2)
        .map((message) => message.subject)
        .join(' · '),
      href: importantUnread[0]?.webLink,
      actionLabel: 'Open',
      source: 'mail',
      observedAt: input.checkedAt,
    })
  }
  if (input.devices.office.status === 'unknown') {
    items.push({
      id: `device:office:${input.devices.office.status}`,
      kind: 'device',
      severity: 'info',
      title: `Desk device ${input.devices.office.status}`,
      body: input.devices.office.checkedAt
        ? `Last seen ${new Date(input.devices.office.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'No device state found',
      source: 'devices',
      observedAt: input.checkedAt,
    })
  }
  for (const [source, status] of Object.entries(input.sources) as Array<
    [SourceKey, DataSourceStatus]
  >) {
    if (!status.ok) {
      items.push({
        id: `source:${source}`,
        kind: 'source',
        severity: 'warning',
        title: `${status.label} unavailable`,
        body: status.error,
        source,
        observedAt: input.checkedAt,
      })
    }
  }
  return items.slice(0, 8)
}

export async function buildPhoneCockpitSnapshot(): Promise<PhoneCockpitSnapshot> {
  const checkedAt = new Date().toISOString()
  const [presenceResult, mailResult] = await Promise.all([
    safeAsync(() => getTeamsPresence()),
    safeAsync(() => Promise.resolve(mailSnapshot())),
  ])
  const meetingsResult = safe(() => getTodayMeetings(4))
  const statsResult = safe(() => getMeetingStats())
  const prepResult = safe(() => getMeetingBrief(null))
  const tasksResult = safe(() => listTasks({ includeDone: false }))
  const devices = deviceSnapshot()
  const meetings = meetingsResult.ok ? meetingsResult.value : []
  const upcoming = meetings
    .filter(
      (meeting) => new Date(meeting.date).getTime() >= Date.now() - 5 * 60_000,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const next = upcoming.at(0) ?? null
  const activeTasks = (tasksResult.ok ? tasksResult.value : [])
    .filter((task) => task.column !== 'done' && task.column !== 'deleted')
    .sort((a, b) => taskRank(a) - taskRank(b))
  const mappedTasks = activeTasks.slice(0, 8).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    column: task.column,
    dueDate: task.due_date,
    tags: task.tags,
  }))
  const urgentTasks = mappedTasks.filter((task) => task.priority === 'high')
  const todayTasks = mappedTasks.filter(
    (task) => task.dueDate && sameDate(task.dueDate),
  )
  const overdueTasks = mappedTasks.filter((task) => isOverdueDate(task.dueDate))
  const inbox =
    mailResult.ok === true
      ? mailResult.value
      : { unread: null, focused: [], warning: mailResult.error }
  const scheduleNext = next
    ? {
        id: next.id,
        title: next.title,
        date: next.date,
        duration: next.duration,
        joinUrl: next.joinUrl,
        minutesUntil: minutesUntil(next.date),
      }
    : null
  const sources: Record<SourceKey, DataSourceStatus> = {
    presence: sourceStatus(
      'Presence',
      checkedAt,
      presenceResult,
      presenceResult.ok ? presenceResult.value.error : undefined,
    ),
    calendar: sourceStatus('Calendar', checkedAt, meetingsResult),
    meetingPrep: sourceStatus('Meeting prep', checkedAt, prepResult),
    mail: sourceStatus('Mail', checkedAt, mailResult),
    tasks: sourceStatus('Tasks', checkedAt, tasksResult),
    devices: {
      ok: !devices.warning,
      checkedAt,
      label: 'Devices',
      error: devices.warning,
    },
  }

  const snapshot: PhoneCockpitSnapshot = {
    checkedAt,
    sources,
    attention: [],
    presence: presenceResult.ok
      ? {
          availability: presenceResult.value.availability || 'PresenceUnknown',
          activity:
            presenceResult.value.activity ||
            presenceResult.value.availability ||
            'Unknown',
          displayName:
            presenceResult.value.displayName ||
            presenceResult.value.availability ||
            'Unknown',
          color: presenceResult.value.color || 'gray',
          source: presenceResult.value.source,
          error: presenceResult.value.error,
        }
      : {
          availability: 'PresenceUnknown',
          activity: 'PresenceUnknown',
          displayName: 'Presence unavailable',
          color: 'gray',
          error: presenceResult.error,
        },
    schedule: {
      meetings: meetings.slice(0, 8).map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        date: meeting.date,
        duration: meeting.duration,
        joinUrl: meeting.joinUrl,
        reviewed: meeting.reviewed,
        actionCount: meeting.actionItems?.length || 0,
      })),
      nextMeeting: scheduleNext,
      stats: statsResult.ok ? statsResult.value : null,
      warning: meetingsResult.ok ? undefined : meetingsResult.error,
    },
    meetingPrep:
      prepResult.ok && prepResult.value
        ? {
            meetingId: prepResult.value.meetingId,
            meetingTitle: prepResult.value.meetingTitle,
            meetingDate: prepResult.value.meetingDate,
            openActionItems: prepResult.value.openActionItems.slice(0, 6),
            previousMeetings: prepResult.value.previousMeetings.slice(0, 4),
            lastMeetingSummary: prepResult.value.lastMeetingSummary
              ? {
                  title: prepResult.value.lastMeetingSummary.title,
                  summary: prepResult.value.lastMeetingSummary.summary,
                }
              : null,
            message: prepResult.value.message,
          }
        : {
            meetingId: null,
            openActionItems: [],
            previousMeetings: [],
            warning: prepResult.ok
              ? 'Meeting prep unavailable'
              : prepResult.error,
          },
    inbox,
    tasks: {
      total: activeTasks.length,
      urgent: urgentTasks.length,
      overdue: overdueTasks.length,
      today: todayTasks.length,
      items: mappedTasks,
      warning: tasksResult.ok ? undefined : tasksResult.error,
    },
    devices,
    shortcuts: shortcutsSnapshot(),
    capture: {
      notePath: PHONE_CAPTURE_NOTE,
      storesAudioTranscripts: true,
    },
  }
  snapshot.attention = buildAttention({
    checkedAt,
    sources,
    next: snapshot.schedule.nextMeeting,
    overdueTasks,
    inbox,
    devices,
  })
  return snapshot
}

export function runPhoneCockpitAction(action: PhoneCockpitAction) {
  if (action.kind === 'note') {
    return appendCapture(action.text, action.source || 'phone')
  }
  if (action.kind === 'task') {
    const task = createTask({
      title: action.title,
      description: action.description || '',
      priority: action.priority || 'medium',
      column: 'todo',
      due_date: action.dueDate || null,
      tags: ['phone-cockpit'],
      created_by: 'phone-cockpit',
    })
    return { ok: true, task }
  }
  const pieces = [
    action.recipient ? `To: ${action.recipient}` : '',
    action.subject ? `Subject: ${action.subject}` : '',
    action.body,
  ].filter(Boolean)
  const task = createTask({
    title: action.subject
      ? `Draft reply: ${action.subject}`
      : 'Draft reply from phone cockpit',
    description: pieces.join('\n'),
    priority: 'medium',
    column: 'todo',
    tags: ['phone-cockpit', 'draft-email'],
    created_by: 'phone-cockpit',
  })
  appendCapture(`Queued draft task: ${task.title}`, 'phone-draft')
  return { ok: true, task, externalSend: false }
}
