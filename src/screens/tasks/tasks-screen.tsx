'use client'

import { useCallback, useMemo, useState } from 'react'
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
import { TaskCard } from './task-card'
import { TaskDialog } from './task-dialog'
import type {
  ClaudeTask,
  CreateTaskInput,
  TaskAssignee,
  TaskColumn,
} from '@/lib/tasks-api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
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
type TaskSavedFilter = 'all' | 'active' | 'blocked' | 'overdue'

export const TASKS_BOARD_HELP_TEXT =
  'Workspace Tasks is a lightweight task board. Drag cards to change status. Use Dashboard Kanban for native multi-board controls.'

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
  const [showDone, setShowDone] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [savedFilter, setSavedFilter] = useState<TaskSavedFilter>('all')

  const search = useSearch({ from: '/tasks' })
  const navigate = useNavigate()
  const initialAssignee =
    typeof search.assignee === 'string' ? search.assignee : null
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(
    initialAssignee,
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
    const completion = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, running, blocked, done, overdue, completion }
  }, [tasks])

  const visibleColumns = showDone
    ? COLUMN_ORDER
    : COLUMN_ORDER.filter((c) => c !== 'done')
  const activeBackend = getActiveBackend()
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
                    onClick={() => setAssigneeFilter(null)}
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
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSavedFilter(value as TaskSavedFilter)}
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
                      {colTasks.length === 0 ? (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-8 gap-2 text-[var(--theme-muted)] opacity-60"
                        >
                          <HugeiconsIcon icon={CheckListIcon} size={22} />
                          <p className="text-xs font-medium">No tasks</p>
                          <p className="text-[10px]">
                            Drop here or click + to add
                          </p>
                        </motion.div>
                      ) : (
                        colTasks.map((task) => (
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
                            />
                          </motion.div>
                        ))
                      )}
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
