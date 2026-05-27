'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckListIcon,
  Download01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { TaskCard, formatTaskAssigneeLabel } from './task-card'
import { TaskDialog } from './task-dialog'
import type {
  ClaudeTask,
  CreateTaskInput,
  TaskAssignee,
  TaskColumn,
} from '@/lib/tasks-api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { readJsonStorage, writeJsonStorage } from '@/lib/typed-storage'
import {
  COLUMN_COLORS,
  COLUMN_LABELS,
  COLUMN_ORDER,
  createTask,
  deleteTask,
  fetchAssignees,
  fetchTasks,
  getActiveBackend,
  isOverdue,
  launchSession,
  linkSession,
  moveTask,
  updateTask,
} from '@/lib/tasks-api'
import { stashPendingSend } from '@/screens/chat/pending-send'

const QUERY_KEY = ['claude', 'tasks'] as const
const ASSIGNEES_KEY = ['claude', 'tasks', 'assignees'] as const
const TASKS_VIEW_STORAGE_KEY = 'hermes-tasks-view-preferences-v1'
type TaskSavedFilter =
  | 'all'
  | 'active'
  | 'blocked'
  | 'overdue'
  | 'today'
  | 'waiting'
  | 'delegated'

export function getInitialTasksSearchState(search: {
  assignee?: string
  filter?: TaskSavedFilter
  create?: 'task'
  column?: TaskColumn
}): {
  assignee: string | null
  filter: TaskSavedFilter
  createTask: boolean
  column: TaskColumn
} {
  return {
    assignee: typeof search.assignee === 'string' ? search.assignee : null,
    filter: search.filter ?? 'all',
    createTask: search.create === 'task',
    column: search.column ?? 'backlog',
  }
}

type TasksViewPreferences = {
  showDone: boolean
  searchText: string
  savedFilter: TaskSavedFilter
}

function isTaskSavedFilter(value: unknown): value is TaskSavedFilter {
  return (
    value === 'all' ||
    value === 'active' ||
    value === 'blocked' ||
    value === 'overdue' ||
    value === 'today' ||
    value === 'waiting' ||
    value === 'delegated'
  )
}

function isTasksViewPreferences(value: unknown): value is TasksViewPreferences {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as TasksViewPreferences).showDone === 'boolean' &&
    typeof (value as TasksViewPreferences).searchText === 'string' &&
    isTaskSavedFilter((value as TasksViewPreferences).savedFilter)
  )
}

export function readTasksViewPreferences(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): TasksViewPreferences {
  return readJsonStorage(
    TASKS_VIEW_STORAGE_KEY,
    { showDone: false, searchText: '', savedFilter: 'all' },
    isTasksViewPreferences,
    storage,
  ).value
}

export function writeTasksViewPreferences(
  preferences: TasksViewPreferences,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): boolean {
  return writeJsonStorage(TASKS_VIEW_STORAGE_KEY, preferences, storage)
}

export const TASKS_BOARD_HELP_TEXT =
  'Active work, blockers, follow-ups, and review handoffs in one board.'

export function serializeTasksCsv(tasks: Array<ClaudeTask>): string {
  const headers = [
    'title',
    'column',
    'priority',
    'assignee',
    'due_date',
    'tags',
    'created_by',
    'updated_at',
  ]
  const rows = tasks.map((task) =>
    [
      task.title,
      task.column,
      task.priority,
      task.assignee ?? '',
      task.due_date ?? '',
      task.tags.join('; '),
      task.created_by,
      task.updated_at,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

function formatQueryFreshness(updatedAt: number): string {
  if (!updatedAt) return 'never'
  const diff = Date.now() - updatedAt
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function isDueToday(
  task: Pick<ClaudeTask, 'due_date' | 'column'>,
): boolean {
  if (!task.due_date || ['done', 'deleted'].includes(task.column)) return false
  const dateOnly = task.due_date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const due = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(task.due_date)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  )
}

export function isWaitingTask(
  task: Pick<ClaudeTask, 'title' | 'description' | 'tags' | 'column'>,
): boolean {
  if (['done', 'deleted'].includes(task.column)) return false
  const text = [task.title, task.description, ...(task.tags ?? [])]
    .join(' ')
    .toLowerCase()
  return /\b(waiting|blocked by|pending|needs reply|needs approval|follow[- ]?up)\b/.test(
    text,
  )
}

export function isDelegatedTask(
  task: Pick<ClaudeTask, 'assignee' | 'column'>,
): boolean {
  return Boolean(task.assignee) && !['done', 'deleted'].includes(task.column)
}

export function getTaskFocusSections(tasks: Array<ClaudeTask>): Array<{
  id: 'blocked-by-me' | 'waiting-on-others'
  title: string
  description: string
  filter: TaskSavedFilter
  tasks: Array<ClaudeTask>
}> {
  const actionableTasks = tasks.filter(
    (task) => !['done', 'deleted'].includes(task.column),
  )
  const blockedByMe = actionableTasks.filter(
    (task) => task.column === 'blocked',
  )
  const waitingOnOthers = actionableTasks.filter(
    (task) => task.column !== 'blocked' && isWaitingTask(task),
  )

  return [
    {
      id: 'blocked-by-me',
      title: 'Blocked by me',
      description: 'Unstick these before new work starts.',
      filter: 'blocked',
      tasks: blockedByMe,
    },
    {
      id: 'waiting-on-others',
      title: 'Waiting on others',
      description: 'Follow up or keep these out of the active lane.',
      filter: 'waiting',
      tasks: waitingOnOthers,
    },
  ]
}

export type TaskDueLane = 'today' | 'this week' | 'later' | 'no date'
export type TaskDueRisk = {
  label: 'Overdue' | 'Due today' | 'Due soon' | 'Scheduled' | 'No due date'
  severity: 'danger' | 'warning' | 'success' | 'muted'
}
export type TaskSource =
  | 'chat'
  | 'meetings'
  | 'phone capture'
  | 'jobs'
  | 'manual'
  | 'automation'
export type TaskProvenance =
  | 'created from chat'
  | 'created from meeting'
  | 'created from note'
  | 'manual'
  | 'automation'

export function getTaskDueLane(
  task: Pick<ClaudeTask, 'due_date'>,
): TaskDueLane {
  if (!task.due_date) return 'no date'
  const due = new Date(task.due_date)
  if (Number.isNaN(due.getTime())) return 'no date'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / 86_400_000)
  if (diffDays <= 0) return 'today'
  if (diffDays <= 7) return 'this week'
  return 'later'
}

export function getTaskProvenance(
  task: Pick<ClaudeTask, 'created_by' | 'tags' | 'title' | 'description'>,
): TaskProvenance {
  const text = [task.created_by, task.title, task.description, ...task.tags]
    .join(' ')
    .toLowerCase()
  if (/chat|session/.test(text)) return 'created from chat'
  if (/meeting|transcript/.test(text)) return 'created from meeting'
  if (/note|obsidian|markdown/.test(text)) return 'created from note'
  if (/agent|automation|cron|system/.test(text)) return 'automation'
  return 'manual'
}

export function getTaskSource(
  task: Pick<ClaudeTask, 'created_by' | 'tags' | 'title' | 'description'>,
): TaskSource {
  const text = [task.created_by, task.title, task.description, ...task.tags]
    .join(' ')
    .toLowerCase()
  if (/phone|capture|mobile/.test(text)) return 'phone capture'
  if (/meeting|transcript|agenda/.test(text)) return 'meetings'
  if (/chat|session/.test(text)) return 'chat'
  if (/job|cron|schedule|automation run/.test(text)) return 'jobs'
  if (/agent|automation|system/.test(text)) return 'automation'
  return 'manual'
}

export function getTaskSourceGroups(
  tasks: Array<ClaudeTask>,
): Array<{ source: TaskSource; count: number; blocked: number }> {
  const counts = new Map<
    TaskSource,
    { source: TaskSource; count: number; blocked: number }
  >()
  for (const task of tasks) {
    if (['done', 'deleted'].includes(task.column)) continue
    const source = getTaskSource(task)
    const entry = counts.get(source) ?? { source, count: 0, blocked: 0 }
    entry.count += 1
    if (task.column === 'blocked' || isWaitingTask(task)) entry.blocked += 1
    counts.set(source, entry)
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)
}

export function getTaskDueRisk(
  task: Pick<ClaudeTask, 'due_date' | 'column'>,
): TaskDueRisk {
  if (['done', 'deleted'].includes(task.column)) {
    return { label: 'Scheduled', severity: 'success' }
  }
  const lane = getTaskDueLane(task)
  if (lane === 'today') {
    if (task.due_date && isOverdue(task as ClaudeTask)) {
      return { label: 'Overdue', severity: 'danger' }
    }
    return { label: 'Due today', severity: 'warning' }
  }
  if (lane === 'this week') return { label: 'Due soon', severity: 'warning' }
  if (lane === 'later') return { label: 'Scheduled', severity: 'success' }
  return { label: 'No due date', severity: 'muted' }
}

export function getTodayPromiseTask(
  tasks: Array<ClaudeTask>,
): ClaudeTask | null {
  const priorityRank: Record<ClaudeTask['priority'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  }
  return (
    tasks
      .filter((task) => !['done', 'deleted'].includes(task.column))
      .filter((task) => isDueToday(task) || task.priority === 'high')
      .sort((a, b) => {
        const rank = priorityRank[a.priority] - priorityRank[b.priority]
        if (rank !== 0) return rank
        return (a.due_date ?? '9999-12-31').localeCompare(
          b.due_date ?? '9999-12-31',
        )
      })[0] ?? null
  )
}

export function getOwnerWorkload(
  tasks: Array<ClaudeTask>,
): Array<{ owner: string; count: number; blocked: number }> {
  const counts = new Map<
    string,
    { owner: string; count: number; blocked: number }
  >()
  for (const task of tasks) {
    if (['done', 'deleted'].includes(task.column)) continue
    const owner = task.assignee || 'unassigned'
    const entry = counts.get(owner) ?? { owner, count: 0, blocked: 0 }
    entry.count += 1
    if (task.column === 'blocked' || isWaitingTask(task)) entry.blocked += 1
    counts.set(owner, entry)
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)
}

export function getTaskFollowUpTarget(task: ClaudeTask): string {
  const match = `${task.title} ${task.description}`.match(
    /\b(?:waiting on|follow up with|pending from)\s+([A-Z][A-Za-z0-9._ -]{1,40})/i,
  )
  const target = match?.[1]
    ?.replace(/\b(created|linked|due|for files?)\b.*$/i, '')
    .trim()
  return target || task.assignee || 'unknown person'
}

export function getTaskDiagnostics(task: ClaudeTask): string {
  const provenance = getTaskProvenance(task)
  const linked = task.session_id
    ? `linked session ${task.session_id}`
    : 'no linked session'
  const launchStatus =
    task.column === 'blocked' ? 'launch blocked' : 'launch ready'
  return `${provenance}; ${linked}; ${launchStatus}`
}

export function getTaskColumnEmptyState(
  column: TaskColumn,
  hasActiveFilter: boolean,
): { title: string; description: string } {
  if (hasActiveFilter) {
    return {
      title: 'No matching tasks',
      description: 'Clear search or change filters to widen this lane.',
    }
  }
  if (column === 'blocked') {
    return {
      title: 'No blockers',
      description: 'Anything waiting on you will appear here.',
    }
  }
  if (column === 'review') {
    return {
      title: 'No review handoffs',
      description: 'Agent and meeting follow-ups land here before done.',
    }
  }
  if (column === 'done') {
    return {
      title: 'Nothing completed yet',
      description: 'Done work appears here when the board includes it.',
    }
  }
  return {
    title: 'No tasks',
    description: 'Drop here or click + to add the next item.',
  }
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 animate-pulse">
      <div className="h-3.5 bg-[var(--theme-hover)] rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-[var(--theme-hover)] rounded w-full mb-1" />
      <div className="h-2.5 bg-[var(--theme-hover)] rounded w-2/3 mb-3" />
      <div className="flex gap-1.5">
        <div className="h-4 w-12 bg-[var(--theme-hover)] rounded" />
        <div className="h-4 w-10 bg-[var(--theme-hover)] rounded" />
      </div>
    </div>
  )
}

export function TasksScreen() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createColumn, setCreateColumn] = useState<TaskColumn>('backlog')
  const [editingTask, setEditingTask] = useState<ClaudeTask | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskColumn | null>(null)
  const [showDone, setShowDone] = useState(
    () => readTasksViewPreferences().showDone,
  )
  const [searchText, setSearchText] = useState(
    () => readTasksViewPreferences().searchText,
  )
  const [savedFilter, setSavedFilter] = useState<TaskSavedFilter>(
    () => readTasksViewPreferences().savedFilter,
  )

  const search = useSearch({ from: '/tasks' })
  const navigate = useNavigate()
  const initialSearchState = getInitialTasksSearchState(search)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(
    initialSearchState.assignee,
  )

  const tasksQuery = useQuery({
    queryKey: [...QUERY_KEY, showDone],
    queryFn: () => fetchTasks({ include_done: showDone }),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })

  // Load assignees dynamically from profiles + config
  const assigneesQuery = useQuery({
    queryKey: ASSIGNEES_KEY,
    queryFn: fetchAssignees,
    staleTime: 5 * 60_000, // profiles don't change often
  })

  const assignees: Array<TaskAssignee> = assigneesQuery.data?.assignees ?? []
  const humanReviewer = assigneesQuery.data?.humanReviewer ?? null

  // Build a label map from dynamic assignees for TaskCard display
  const assigneeLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of assignees) map[a.id] = a.label
    return map
  }, [assignees])

  const tasks = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return (tasksQuery.data ?? []).filter((task) => {
      if (savedFilter === 'active' && ['done', 'deleted'].includes(task.column))
        return false
      if (savedFilter === 'blocked' && task.column !== 'blocked') return false
      if (savedFilter === 'overdue' && !isOverdue(task)) return false
      if (savedFilter === 'today' && !isDueToday(task)) return false
      if (savedFilter === 'waiting' && !isWaitingTask(task)) return false
      if (savedFilter === 'delegated' && !isDelegatedTask(task)) return false
      if (!q) return true
      return [
        task.title,
        task.description,
        task.assignee,
        task.column,
        task.priority,
        task.due_date,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [savedFilter, searchText, tasksQuery.data])

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskColumn, Array<ClaudeTask>> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: [],
      deleted: [],
    }
    for (const t of tasks) {
      if (assigneeFilter && t.assignee !== assigneeFilter) continue
      map[t.column].push(t)
    }
    for (const col of COLUMN_ORDER) {
      map[col].sort((a, b) => a.position - b.position)
    }
    return map
  }, [tasks, assigneeFilter])

  const stats = useMemo(() => {
    const total = tasks.length
    const running = tasks.filter((t) => t.column === 'in_progress').length
    const blocked = tasks.filter((t) => t.column === 'blocked').length
    const done = tasks.filter((t) => t.column === 'done').length
    const overdue = tasks.filter(
      (t) => isOverdue(t) && t.column !== 'done',
    ).length
    const today = tasks.filter(isDueToday).length
    const waiting = tasks.filter(isWaitingTask).length
    const delegated = tasks.filter(isDelegatedTask).length
    const completion = total > 0 ? Math.round((done / total) * 100) : 0
    return {
      total,
      running,
      blocked,
      done,
      overdue,
      today,
      waiting,
      delegated,
      completion,
    }
  }, [tasks])

  const focusSections = useMemo(() => getTaskFocusSections(tasks), [tasks])
  const dueLaneCounts = useMemo(() => {
    return tasks.reduce<Record<TaskDueLane, number>>(
      (counts, task) => {
        if (!['done', 'deleted'].includes(task.column)) {
          counts[getTaskDueLane(task)] += 1
        }
        return counts
      },
      { today: 0, 'this week': 0, later: 0, 'no date': 0 },
    )
  }, [tasks])
  const ownerWorkload = useMemo(() => getOwnerWorkload(tasks), [tasks])
  const sourceGroups = useMemo(() => getTaskSourceGroups(tasks), [tasks])
  const todayPromiseTask = useMemo(() => getTodayPromiseTask(tasks), [tasks])
  const dueRiskCounts = useMemo(() => {
    return tasks.reduce<Record<TaskDueRisk['severity'], number>>(
      (counts, task) => {
        if (!['done', 'deleted'].includes(task.column)) {
          counts[getTaskDueRisk(task).severity] += 1
        }
        return counts
      },
      { danger: 0, warning: 0, success: 0, muted: 0 },
    )
  }, [tasks])
  const reviewWithTylerCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.column === 'review' &&
          (getTaskProvenance(task) === 'automation' ||
            /agent|automation/i.test(
              `${task.created_by} ${task.tags.join(' ')}`,
            )),
      ).length,
    [tasks],
  )

  const visibleColumns = showDone
    ? COLUMN_ORDER
    : COLUMN_ORDER.filter((c) => c !== 'done')
  const activeBackend = getActiveBackend()
  const hasActiveFilter = Boolean(
    searchText.trim() || savedFilter !== 'all' || assigneeFilter,
  )
  const filteredTaskCount = useMemo(
    () =>
      visibleColumns.reduce((sum, col) => sum + tasksByColumn[col].length, 0),
    [tasksByColumn, visibleColumns],
  )

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }, [queryClient])

  const exportTasksCsv = useCallback(() => {
    const visibleTasks = visibleColumns.flatMap((col) => tasksByColumn[col])
    const blob = new Blob([serializeTasksCsv(visibleTasks)], {
      type: 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `hermes-tasks-${savedFilter}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [savedFilter, tasksByColumn, visibleColumns])

  const exportTasksJson = useCallback(() => {
    const visibleTasks = visibleColumns.flatMap((col) => tasksByColumn[col])
    const blob = new Blob([JSON.stringify(visibleTasks, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `hermes-tasks-${savedFilter}-with-ids.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [savedFilter, tasksByColumn, visibleColumns])

  const copyVisibleTaskSummary = useCallback(async () => {
    const visibleTasks = visibleColumns.flatMap((col) => tasksByColumn[col])
    const report = visibleTasks
      .map(
        (task) =>
          `${task.id}: ${task.title}\n${getTaskDiagnostics(task)}\nFollow-up: ${getTaskFollowUpTarget(task)}\nRelated links: chat/session/meeting/files`,
      )
      .join('\n\n')
    if (!report.trim()) return
    await navigator.clipboard.writeText(report)
    toast('Visible task summary copied')
  }, [tasksByColumn, visibleColumns])

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      invalidate()
      toast('Task created')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to create task', {
        type: 'error',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTaskInput }) =>
      updateTask(id, input),
    onSuccess: () => {
      invalidate()
      toast('Task updated')
      setEditingTask(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update task', {
        type: 'error',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      invalidate()
      toast('Task deleted')
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to delete task', {
        type: 'error',
      }),
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, column }: { id: string; column: TaskColumn }) =>
      moveTask(id, column, 'user'),
    onSuccess: () => invalidate(),
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to move task', {
        type: 'error',
      }),
  })

  const completeTask = useCallback(
    (task: ClaudeTask) => {
      if (task.column === 'done') return
      if (humanReviewer) {
        moveMutation.mutate({ id: task.id, column: 'review' })
        toast(`Moved to review for ${humanReviewer}`)
        return
      }
      moveMutation.mutate({ id: task.id, column: 'done' })
    },
    [humanReviewer, moveMutation],
  )

  const deferTask = useCallback(
    (task: ClaudeTask) => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      updateMutation.mutate({
        id: task.id,
        input: {
          due_date: tomorrow.toISOString().slice(0, 10),
          column: task.column === 'blocked' ? 'todo' : task.column,
        },
      })
    },
    [updateMutation],
  )

  const delegateTask = useCallback(
    (task: ClaudeTask) => {
      const fallbackAssignee =
        humanReviewer ??
        assignees.find((assignee) => assignee.isHuman)?.id ??
        assignees[0]?.id ??
        null
      if (!fallbackAssignee) {
        toast('No assignee is configured for delegation', { type: 'error' })
        return
      }
      updateMutation.mutate({
        id: task.id,
        input: {
          assignee:
            task.assignee === fallbackAssignee ? null : fallbackAssignee,
        },
      })
    },
    [assignees, humanReviewer, updateMutation],
  )

  useEffect(() => {
    const next = getInitialTasksSearchState(search)
    setSavedFilter(next.filter)
    setAssigneeFilter(next.assignee)
    if (next.createTask) {
      setCreateColumn(next.column)
      setShowCreate(true)
      void navigate({
        to: '/tasks',
        search: (current) => ({
          ...current,
          create: undefined,
          column: undefined,
        }),
        replace: true,
      })
    }
  }, [navigate, search])

  useEffect(() => {
    writeTasksViewPreferences({ showDone, searchText, savedFilter })
  }, [savedFilter, searchText, showDone])

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(
        target.closest('input, textarea, select, button, [contenteditable]'),
      )
    }

    function getFocusedTask(): ClaudeTask | null {
      const element = document.activeElement?.closest('[data-task-card-id]')
      if (!(element instanceof HTMLElement)) return null
      const taskId = element.dataset.taskCardId
      return tasks.find((task) => task.id === taskId) ?? null
    }

    function focusNextTaskCard() {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>('[data-task-card-id]'),
      )
      if (!cards.length) return
      const activeCard = document.activeElement?.closest('[data-task-card-id]')
      const activeIndex =
        activeCard instanceof HTMLElement ? cards.indexOf(activeCard) : -1
      cards[(activeIndex + 1) % cards.length]?.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        setCreateColumn('backlog')
        setShowCreate(true)
      } else if (key === 'r') {
        event.preventDefault()
        invalidate()
      } else if (key === 'j') {
        event.preventDefault()
        focusNextTaskCard()
      } else if (key === 'd') {
        const task = getFocusedTask()
        if (!task) return
        event.preventDefault()
        completeTask(task)
      } else if (key === 's') {
        const task = getFocusedTask()
        if (!task) return
        event.preventDefault()
        deferTask(task)
      } else if (key === 'g') {
        const task = getFocusedTask()
        if (!task) return
        event.preventDefault()
        delegateTask(task)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [completeTask, deferTask, delegateTask, invalidate, tasks])

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId)
    setDraggingId(taskId)
  }

  function handleDragOver(e: React.DragEvent, col: TaskColumn) {
    e.preventDefault()
    setDragOverColumn(col)
  }

  function handleDrop(e: React.DragEvent, targetColumn: TaskColumn) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.column === targetColumn) {
      setDraggingId(null)
      setDragOverColumn(null)
      return
    }
    // Hybrid autonomy: if a human reviewer is configured, only they can move
    // tasks into the 'done' column — agents may move to 'review' at most.
    if (targetColumn === 'done' && humanReviewer) {
      toast(`Only ${humanReviewer} can mark tasks as done`, { type: 'error' })
      setDraggingId(null)
      setDragOverColumn(null)
      return
    }
    moveMutation.mutate({ id: taskId, column: targetColumn })
    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const colMaxWidth = Math.floor(1200 / visibleColumns.length)

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Header */}
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h1 className="text-2xl font-medium leading-none text-ink">
                Tasks
              </h1>
              {assigneeFilter && (
                <div className="flex items-center gap-2 text-xs text-[var(--theme-muted)]">
                  <span>
                    Filtered by:{' '}
                    <span className="capitalize" style={{ color: '#f59e0b' }}>
                      {assigneeFilter}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeFilter(null)
                      void navigate({
                        to: '/tasks',
                        search: (current) => ({
                          ...current,
                          assignee: undefined,
                        }),
                      })
                    }}
                    className="text-[var(--theme-muted)] hover:text-[var(--theme-text)] transition-colors"
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
              {/* Stats */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--theme-muted)]">
                <span>{stats.total} total</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  {stats.running} running
                </span>
                {stats.blocked > 0 && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="text-red-400">
                      {stats.blocked} blocked
                    </span>
                  </>
                )}
                {stats.overdue > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-400">
                      {stats.overdue} overdue
                    </span>
                  </>
                )}
                {stats.today > 0 && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="text-amber-400">{stats.today} today</span>
                  </>
                )}
                {stats.waiting > 0 && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="text-cyan-400">
                      {stats.waiting} waiting
                    </span>
                  </>
                )}
                {stats.delegated > 0 && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="text-violet-400">
                      {stats.delegated} delegated
                    </span>
                  </>
                )}
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  {stats.completion}% done
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <button
                onClick={() => setShowDone((v) => !v)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  showDone
                    ? 'border-[var(--theme-accent)] text-[var(--theme-accent)] bg-[var(--theme-hover)]'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-accent)]',
                )}
              >
                {showDone ? 'Hide Done' : 'Show Done'}
              </button>
              <button
                onClick={invalidate}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                title="Refresh"
                aria-label="Refresh task board"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  className="text-[var(--theme-muted)]"
                />
              </button>
              <button
                type="button"
                onClick={exportTasksCsv}
                disabled={filteredTaskCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
                title="Export visible tasks as CSV"
              >
                <HugeiconsIcon icon={Download01Icon} size={14} />
                Export
              </button>
              <button
                onClick={() => {
                  setCreateColumn('backlog')
                  setShowCreate(true)
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Task
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--theme-muted)]">
            {TASKS_BOARD_HELP_TEXT}
          </p>
          <div
            className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--theme-muted)]"
            aria-label="Task board runtime metadata"
          >
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
              Source:{' '}
              {activeBackend
                ? `${activeBackend} tasks API`
                : 'probing task backend'}
            </span>
            <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
              Last fetched: {formatQueryFreshness(tasksQuery.dataUpdatedAt)}
            </span>
            {assigneesQuery.isError ? (
              <span className="rounded-md border border-red-300/40 bg-red-500/10 px-2 py-1 text-red-400">
                Assignees unavailable
              </span>
            ) : (
              <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
                Owners: {assignees.length || 'none configured'}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.currentTarget.value)}
              placeholder="Search tasks"
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none"
            />
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['blocked', 'Blocked'],
              ['overdue', 'Overdue'],
              ['today', 'Today'],
              ['waiting', 'Waiting'],
              ['delegated', 'Delegated'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const nextFilter = value as TaskSavedFilter
                  setSavedFilter(nextFilter)
                  void navigate({
                    to: '/tasks',
                    search: (current) => ({
                      ...current,
                      filter: nextFilter === 'all' ? undefined : nextFilter,
                      assignee: assigneeFilter ?? undefined,
                    }),
                  })
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                  savedFilter === value
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-xs text-[var(--theme-muted)]">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <h2 className="text-sm font-semibold text-[var(--theme-text)]">
                Daily queue
              </h2>
              {todayPromiseTask ? (
                <button
                  type="button"
                  onClick={() => setEditingTask(todayPromiseTask)}
                  className="mt-2 block w-full rounded-lg border border-[var(--theme-accent)] bg-[var(--theme-hover)] px-3 py-2 text-left"
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-accent)]">
                    Today's promise
                  </span>
                  <span className="mt-1 block line-clamp-1 text-sm font-semibold text-[var(--theme-text)]">
                    {todayPromiseTask.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-[var(--theme-muted)]">
                    {getTaskDueRisk(todayPromiseTask).label} ·{' '}
                    {formatTaskAssigneeLabel(
                      todayPromiseTask.assignee,
                      assigneeLabels,
                    )}
                  </span>
                </button>
              ) : (
                <p className="mt-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-muted)]">
                  No high-priority or due-today task is asking for a promise.
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                  Today {dueLaneCounts.today}
                </span>
                <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                  This week {dueLaneCounts['this week']}
                </span>
                <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                  Later {dueLaneCounts.later}
                </span>
                <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                  No date {dueLaneCounts['no date']}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['danger', 'Overdue'],
                  ['warning', 'At risk'],
                  ['success', 'Scheduled'],
                  ['muted', 'No date'],
                ].map(([severity, label]) => (
                  <span
                    key={severity}
                    className={cn(
                      'rounded-lg border px-2 py-1',
                      severity === 'danger' &&
                        'border-red-300/40 bg-red-500/10 text-red-400',
                      severity === 'warning' &&
                        'border-amber-300/40 bg-amber-500/10 text-amber-400',
                      severity === 'success' &&
                        'border-emerald-300/40 bg-emerald-500/10 text-emerald-400',
                      severity === 'muted' &&
                        'border-[var(--theme-border)] bg-[var(--theme-bg)]',
                    )}
                  >
                    {label} {dueRiskCounts[severity as TaskDueRisk['severity']]}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  'selected text',
                  'chat',
                  'meeting',
                  'LILY',
                  'phone capture',
                ].map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => {
                      setCreateColumn(source === 'LILY' ? 'review' : 'backlog')
                      setShowCreate(true)
                    }}
                    className="rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
                  >
                    Quick task from {source}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--theme-text)]">
                Owner workload
              </h2>
              <div className="mt-2 space-y-1">
                {(ownerWorkload.length
                  ? ownerWorkload.slice(0, 4)
                  : [{ owner: 'unassigned', count: 0, blocked: 0 }]
                ).map((owner) => (
                  <div
                    key={owner.owner}
                    className="flex items-center justify-between rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1"
                  >
                    <span>{owner.owner}</span>
                    <span>
                      {owner.count} open · {owner.blocked} blocked/waiting
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2">
                WIP limits: backlog unlimited, todo 12, in progress 5, review 8,
                blocked 10. Review with Tyler lane: {reviewWithTylerCount}.
              </p>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                Sources
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(sourceGroups.length
                  ? sourceGroups.slice(0, 6)
                  : [{ source: 'manual' as TaskSource, count: 0, blocked: 0 }]
                ).map((source) => (
                  <div
                    key={source.source}
                    className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1"
                  >
                    <div className="capitalize text-[var(--theme-text)]">
                      {source.source}
                    </div>
                    <div>
                      {source.count} open · {source.blocked} blocked
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--theme-text)]">
                Controls
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyVisibleTaskSummary}
                  className="rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
                >
                  Copy task summary
                </button>
                <button
                  type="button"
                  onClick={exportTasksJson}
                  disabled={filteredTaskCount === 0}
                  className="rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[var(--theme-text)] hover:bg-[var(--theme-hover)] disabled:opacity-50"
                >
                  Export with IDs and provenance
                </button>
              </div>
              {humanReviewer ? (
                <p className="mt-2">
                  Done is gated by {humanReviewer}; move agent work to review
                  first.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section
          aria-label="Blocked and waiting task focus"
          className="grid gap-3 md:grid-cols-2"
        >
          {focusSections.map((section) => {
            const previewTasks = section.tasks.slice(0, 3)
            return (
              <article
                key={section.id}
                className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.16)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                      Task focus
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[var(--theme-text)]">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--theme-muted)]">
                      {section.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSavedFilter(section.filter)
                      void navigate({
                        to: '/tasks',
                        search: (current) => ({
                          ...current,
                          filter: section.filter,
                          assignee: assigneeFilter ?? undefined,
                        }),
                      })
                    }}
                    className={cn(
                      'min-h-10 shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors',
                      savedFilter === section.filter
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
                        : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                    )}
                  >
                    {section.tasks.length} open
                  </button>
                </div>
                {previewTasks.length ? (
                  <ul className="mt-3 space-y-2">
                    {previewTasks.map((task) => (
                      <li
                        key={task.id}
                        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => setEditingTask(task)}
                          className="block w-full text-left"
                        >
                          <span className="block line-clamp-1 text-sm font-medium text-[var(--theme-text)]">
                            {task.title}
                          </span>
                          <span className="mt-1 block text-xs text-[var(--theme-muted)]">
                            {formatTaskAssigneeLabel(
                              task.assignee,
                              assigneeLabels,
                            )}
                            {task.due_date ? ` · Due ${task.due_date}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-muted)]">
                    Nothing in this lane.
                  </p>
                )}
              </article>
            )
          })}
        </section>

        {/* Board */}
        <div
          className="mx-auto flex w-full max-w-[1200px] flex-1 gap-3 overflow-x-auto overflow-y-hidden p-4 min-h-0"
          style={{ boxShadow: 'inset 0 8px 24px rgba(0,0,0,0.2)' }}
        >
          {visibleColumns.map((col) => {
            const colTasks = tasksByColumn[col]
            const colColor = COLUMN_COLORS[col]
            const isDragOver = dragOverColumn === col

            return (
              <div
                key={col}
                className={cn(
                  'flex flex-col rounded-xl border min-w-[180px] w-full shrink-0 flex-1',
                  'bg-[var(--theme-card)] border-[var(--theme-border)]',
                  'transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.25)]',
                  isDragOver &&
                    'border-[var(--theme-accent)] bg-[var(--theme-hover)]',
                )}
                style={{ maxWidth: colMaxWidth }}
                onDragOver={(e) => handleDragOver(e, col)}
                onDrop={(e) => handleDrop(e, col)}
                onDragLeave={() => setDragOverColumn(null)}
              >
                {/* Column header */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--theme-border)] rounded-t-xl"
                  style={{
                    borderTopWidth: 2,
                    borderTopColor: colColor,
                    borderTopStyle: 'solid',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: colColor }}
                    />
                    <span className="text-xs font-semibold text-[var(--theme-text)]">
                      {COLUMN_LABELS[col]}
                    </span>
                    <span className="text-xs text-[var(--theme-muted)]">
                      (
                      {tasksQuery.isFetching && tasksQuery.data === undefined
                        ? '…'
                        : colTasks.length}
                      )
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCreateColumn(col)
                      setShowCreate(true)
                    }}
                    className="rounded p-0.5 hover:bg-[var(--theme-hover)] transition-colors"
                    title={`Add to ${COLUMN_LABELS[col]}`}
                  >
                    <HugeiconsIcon
                      icon={Add01Icon}
                      size={14}
                      className="text-[var(--theme-muted)]"
                    />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
                  {tasksQuery.isError ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-8 gap-2 text-red-400"
                    >
                      <p className="text-xs font-medium">
                        Failed to load tasks
                      </p>
                      <button
                        onClick={() => tasksQuery.refetch()}
                        className="text-xs text-[var(--theme-accent)] hover:underline"
                      >
                        Retry
                      </button>
                    </motion.div>
                  ) : tasksQuery.isLoading ? (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  ) : (
                    <AnimatePresence initial={false}>
                      {colTasks.length === 0
                        ? (() => {
                            const empty = getTaskColumnEmptyState(
                              col,
                              hasActiveFilter,
                            )
                            return (
                              <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[var(--theme-muted)] opacity-75"
                              >
                                <HugeiconsIcon icon={CheckListIcon} size={22} />
                                <p className="text-xs font-medium">
                                  {empty.title}
                                </p>
                                <p className="max-w-[12rem] text-[10px]">
                                  {empty.description}
                                </p>
                              </motion.div>
                            )
                          })()
                        : colTasks.map((task) => (
                            <motion.div
                              key={task.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              onDragEnd={handleDragEnd}
                            >
                              <TaskCard
                                task={task}
                                assigneeLabels={assigneeLabels}
                                isDragging={draggingId === task.id}
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onClick={() => setEditingTask(task)}
                                onComplete={() => completeTask(task)}
                                onDefer={() => deferTask(task)}
                                onDelegate={() => delegateTask(task)}
                              />
                            </motion.div>
                          ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Create dialog */}
        <TaskDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          defaultColumn={createColumn}
          assignees={assignees}
          isSubmitting={createMutation.isPending}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input)
          }}
        />

        {/* Edit dialog */}
        <TaskDialog
          open={editingTask !== null}
          onOpenChange={(open) => {
            if (!open) setEditingTask(null)
          }}
          task={editingTask}
          assignees={assignees}
          isSubmitting={updateMutation.isPending}
          onSubmit={async (input) => {
            if (!editingTask) return
            await updateMutation.mutateAsync({ id: editingTask.id, input })
          }}
        />
      </div>
    </div>
  )
}
