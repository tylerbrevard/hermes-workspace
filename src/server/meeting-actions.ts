import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || join(HOME, '.hermes', 'workspace')
const HERMES_PYTHON = join(HERMES_WORKSPACE, 'scripts', 'run_hermes_venv_python.sh')
const GRAPH_BRIDGE = join(HERMES_WORKSPACE, 'scripts', 'graph_bridge.py')
const MEETING_PIPELINE = join(HERMES_WORKSPACE, 'scripts', 'meeting_pipeline.py')
const PROCESS_MEETING = join(HERMES_WORKSPACE, 'scripts', 'process_meeting.py')
const MEETING_TODO_SYNC = join(HERMES_WORKSPACE, 'scripts', 'sync_meeting_actions_todo.py')
const TODO_LIST_NAME = 'Meeting Action Items'
const TODO_USER_UPN = process.env.HERMES_TODO_USER_UPN || 'tyler.lyon@gecurrent.com'
const TODO_BASE = `/users/${TODO_USER_UPN}/todo`

type TodoItemInput = {
  text?: unknown
  title?: unknown
  assignee?: unknown
  dueDate?: unknown
  priority?: unknown
  meetingTitle?: unknown
  details?: unknown
  sourceType?: unknown
}

function assertHermesScript(path: string) {
  if (!existsSync(path)) {
    throw new Error(`Hermes script not found: ${path}`)
  }
}

function runHermesScript(scriptPath: string, args: string[], timeout = 120_000) {
  assertHermesScript(HERMES_PYTHON)
  assertHermesScript(scriptPath)
  const output = execFileSync(HERMES_PYTHON, [scriptPath, ...args], {
    cwd: HERMES_WORKSPACE,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout,
  })
  return output.trim()
}

function graphJson<T>(method: string, endpoint: string, body?: unknown): T {
  assertHermesScript(HERMES_PYTHON)
  assertHermesScript(GRAPH_BRIDGE)
  const args = [GRAPH_BRIDGE, 'json', method, endpoint]
  if (body !== undefined) args.push(JSON.stringify(body))
  const output = execFileSync(HERMES_PYTHON, args, {
    cwd: HERMES_WORKSPACE,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 45_000,
  }).trim()
  return output ? (JSON.parse(output) as T) : (null as T)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeImportance(priority: unknown): 'low' | 'normal' | 'high' {
  const value = readString(priority).toLowerCase()
  if (value === 'high') return 'high'
  if (value === 'low') return 'low'
  return 'normal'
}

function formatDueDate(value: unknown) {
  const raw = readString(value)
  if (!raw) return undefined
  const date = raw.toLowerCase() === 'today' ? new Date() : new Date(raw)
  if (Number.isNaN(date.getTime())) return undefined
  date.setUTCHours(23, 59, 0, 0)
  return {
    dateTime: date.toISOString().replace('Z', '0000'),
    timeZone: 'UTC',
  }
}

function todoBody(item: TodoItemInput) {
  const parts = [
    readString(item.meetingTitle) ? `Meeting: ${readString(item.meetingTitle)}` : '',
    readString(item.assignee) ? `Assignee: ${readString(item.assignee)}` : '',
    readString(item.sourceType) ? `Source: ${readString(item.sourceType)}` : '',
    readString(item.details),
  ].filter(Boolean)
  return parts.join(' | ')
}

function getOrCreateMeetingTodoList() {
  const payload = graphJson<{ value?: Array<{ id?: string; displayName?: string }> }>(
    'GET',
    `${TODO_BASE}/lists`,
  )
  const existing = (payload?.value || []).find(
    (list) => readString(list.displayName).toLowerCase() === TODO_LIST_NAME.toLowerCase(),
  )
  if (existing?.id) return existing.id

  const created = graphJson<{ id?: string }>('POST', `${TODO_BASE}/lists`, {
    displayName: TODO_LIST_NAME,
  })
  if (!created?.id) throw new Error('Failed to create Meeting Action Items To Do list')
  return created.id
}

export function runMeetingPipeline() {
  const output = runHermesScript(MEETING_PIPELINE, [], 360_000)
  return { success: true, output }
}

export function runMeetingExtraction(meetingId: string) {
  if (!meetingId) throw new Error('meetingId is required')
  const output = runHermesScript(PROCESS_MEETING, ['--meeting-id', meetingId, '--force'], 180_000)
  return { success: true, output }
}

export function runRecentMeetingExtraction(limit: number) {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 5))
  const output = runHermesScript(
    PROCESS_MEETING,
    ['--recent', '--days', '30', '--limit', String(safeLimit)],
    300_000,
  )
  return { success: true, output, limit: safeLimit }
}

export function syncExtractedMeetingActionsToTodo() {
  const output = runHermesScript(MEETING_TODO_SYNC, [], 120_000)
  return { success: true, output }
}

export function sendMeetingItemsToTodo(items: unknown[]) {
  const todoItems = items.filter(
    (item): item is TodoItemInput => item !== null && typeof item === 'object',
  )
  if (todoItems.length === 0) return { success: true, created: 0 }

  const listId = getOrCreateMeetingTodoList()
  let created = 0

  for (const item of todoItems) {
    const title = readString(item.text) || readString(item.title)
    if (!title) continue
    const payload: Record<string, unknown> = {
      title,
      body: { content: todoBody(item), contentType: 'text' },
      importance: normalizeImportance(item.priority),
    }
    const dueDateTime = formatDueDate(item.dueDate)
    if (dueDateTime) payload.dueDateTime = dueDateTime
    graphJson('POST', `${TODO_BASE}/lists/${listId}/tasks`, payload)
    created += 1
  }

  return { success: true, created, listName: TODO_LIST_NAME }
}
