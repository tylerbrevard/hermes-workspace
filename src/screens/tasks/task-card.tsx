import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import type { ClaudeTask } from '@/lib/tasks-api'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, isOverdue } from '@/lib/tasks-api'

type Props = {
  task: ClaudeTask
  assigneeLabels?: Record<string, string>
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onComplete?: () => void
  onDefer?: () => void
  onDelegate?: () => void
  isDragging?: boolean
}

export function formatTaskAssigneeLabel(
  assignee: string | null,
  assigneeLabels: Record<string, string>,
): string {
  const resolvedLabel = assignee
    ? (assigneeLabels[assignee] ?? assignee)
    : 'Unassigned'
  return resolvedLabel
}

export function formatTaskCardText(value: string, maxLength = 86): string {
  const cleaned = value
    .replace(/^Source:\s+.*$/i, '')
    .replace(/\s+Source:\s+.*$/i, '')
    .replace(/\s+Section:\s+.*$/i, '')
    .replace(/\s+Unassigned\b.*$/i, '')
    .replace(/\s+manual\s+no session\b.*$/i, '')
    .replace(/\s+automation\s+no session\b.*$/i, '')
    .replace(/\s+created from meeting\s+no session\b.*$/i, '')
    .replace(/\s+links\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 3).replace(/[.,;:\s]+$/, '')}...`
}

export function TaskCard({
  task,
  assigneeLabels = {},
  onClick,
  onDragStart,
  onComplete,
  onDefer,
  onDelegate,
  isDragging,
}: Props) {
  const overdue = isOverdue(task)
  const priorityColor = PRIORITY_COLORS[task.priority]
  const visibleTags = task.tags
    .filter((tag) => tag.length <= 18 && !/^workspace-flow-/i.test(tag))
    .slice(0, 1)
  const extraTagCount = Math.max(0, task.tags.length - visibleTags.length)
  const assigneeLabel = formatTaskAssigneeLabel(task.assignee, assigneeLabels)
  const title = formatTaskCardText(task.title, 38)
  const provenance = (() => {
    const text = [task.created_by, task.title, task.description, ...task.tags]
      .join(' ')
      .toLowerCase()
    if (/chat|session/.test(text)) return 'chat'
    if (/meeting|transcript/.test(text)) return 'meeting'
    if (/note|obsidian|markdown/.test(text)) return 'note'
    if (/agent|automation|cron|system/.test(text)) return 'automation'
    return 'manual'
  })()
  const waitingPerson =
    `${task.title} ${task.description}`
      .match(
        /\b(?:waiting on|follow up with|pending from)\s+([A-Z][A-Za-z0-9._ -]{1,40})/i,
      )?.[1]
      ?.trim() || null
  const quickActions = [
    { label: 'Done', action: onComplete, icon: CheckmarkCircle02Icon },
    { label: 'Defer', action: onDefer, icon: Clock01Icon },
    { label: 'Delegate', action: onDelegate, icon: UserMultipleIcon },
  ] as const

  return (
    <div
      tabIndex={0}
      role="button"
      data-task-card-id={task.id}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'relative rounded-lg border p-3 cursor-pointer transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] select-none focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]',
        'bg-[var(--theme-card)] border-[var(--theme-border)]',
        'hover:border-[var(--theme-accent)]',
        isDragging
          ? 'opacity-40 rotate-1 shadow-2xl'
          : 'hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: priorityColor }}
    >
      {/* Priority dot in top-right */}
      <span
        className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full shrink-0"
        style={{ background: priorityColor }}
        title={`Priority: ${task.priority}`}
      />

      <p className="text-sm font-medium text-[var(--theme-text)] leading-snug mb-1 line-clamp-2 pr-4">
        {title || task.title}
      </p>

      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {quickActions.map(({ label, action, icon }) => (
          <button
            key={label}
            type="button"
            disabled={!action}
            title={label}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation()
              if (typeof action === 'function') action()
            }}
            className="flex min-h-8 items-center justify-center rounded-md border border-[var(--theme-border)] px-1.5 text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <HugeiconsIcon icon={icon} size={14} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.assignee ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--theme-hover)] text-[var(--theme-muted)]">
              {assigneeLabel}
            </span>
          ) : null}
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--theme-hover)] text-[var(--theme-muted)]">
            {provenance}
          </span>
          {task.session_id ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--theme-hover)] text-[var(--theme-muted)]">
              session
            </span>
          ) : null}
          {waitingPerson ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--theme-hover)] text-[var(--theme-muted)]">
              Follow-up
            </span>
          ) : null}
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--theme-hover)] text-[var(--theme-muted)]"
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--theme-hover)] text-[var(--theme-muted)]">
              +{extraTagCount} more
            </span>
          )}
        </div>

        {task.due_date && (
          <div className="flex items-center gap-1 text-[10px] tabular-nums">
            {overdue && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-red-400 font-semibold">Overdue</span>
                <span className="text-[var(--theme-muted)] mx-0.5">·</span>
              </>
            )}
            <span
              className={
                overdue
                  ? 'text-red-400 font-semibold'
                  : 'text-[var(--theme-muted)]'
              }
            >
              {(() => {
                const [y, m, d] = task.due_date.split('-').map(Number)
                return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
