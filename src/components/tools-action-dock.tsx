import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Apple01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  CheckListIcon,
  Download01Icon,
  File01Icon,
  Mail01Icon,
  RefreshIcon,
  Search01Icon,
  Shield01Icon,
  Task01Icon,
} from '@hugeicons/core-free-icons'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DockIcon =
  | 'add'
  | 'apple'
  | 'arrow'
  | 'calendar'
  | 'check'
  | 'download'
  | 'file'
  | 'mail'
  | 'refresh'
  | 'search'
  | 'shield'
  | 'task'

type DockTone = 'primary' | 'neutral' | 'warning' | 'danger' | 'good'

export type ToolsActionDockItem = {
  id: string
  label: string
  icon: DockIcon
  tone?: DockTone
  href?: string
  onClick?: () => void
  disabled?: boolean
  meta?: string
}

export type ToolsStatusRailItem = {
  id: string
  label: string
  value: string
  tone?: DockTone
  progress?: number
}

const iconByName: Record<
  DockIcon,
  ComponentProps<typeof HugeiconsIcon>['icon']
> = {
  add: Add01Icon,
  apple: Apple01Icon,
  arrow: ArrowRight01Icon,
  calendar: Calendar01Icon,
  check: CheckListIcon,
  download: Download01Icon,
  file: File01Icon,
  mail: Mail01Icon,
  refresh: RefreshIcon,
  search: Search01Icon,
  shield: Shield01Icon,
  task: Task01Icon,
}

function toneClass(tone: DockTone) {
  if (tone === 'primary') {
    return 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white shadow-sm dark:text-neutral-950'
  }
  if (tone === 'warning') {
    return 'border-amber-300/50 bg-amber-400/12 text-amber-700 dark:text-amber-200'
  }
  if (tone === 'danger') {
    return 'border-rose-300/50 bg-rose-500/12 text-rose-700 dark:text-rose-200'
  }
  if (tone === 'good') {
    return 'border-emerald-300/50 bg-emerald-400/12 text-emerald-700 dark:text-emerald-200'
  }
  return 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)]'
}

function itemClass(tone: DockTone, disabled?: boolean) {
  return cn(
    'group grid min-h-[72px] min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-3 py-2 text-left transition',
    'focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]',
    !disabled && 'hover:-translate-y-0.5 hover:shadow-sm',
    disabled && 'cursor-not-allowed opacity-50',
    toneClass(tone),
  )
}

function ActionFrame({
  item,
  children,
}: {
  item: ToolsActionDockItem
  children: ReactNode
}) {
  const tone = item.tone ?? 'neutral'
  if (item.href && !item.disabled) {
    return (
      <a href={item.href} className={itemClass(tone)}>
        {children}
      </a>
    )
  }
  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={item.disabled}
      className={itemClass(tone, item.disabled)}
    >
      {children}
    </button>
  )
}

export function ToolsActionDock({
  label = 'Tool actions',
  items,
  className,
}: {
  label?: string
  items: Array<ToolsActionDockItem>
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <nav
      aria-label={label}
      className={cn(
        'grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]',
        className,
      )}
    >
      {items.map((item) => (
        <ActionFrame key={item.id} item={item}>
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-current/15 bg-current/10">
            <HugeiconsIcon
              icon={iconByName[item.icon]}
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {item.label}
            </span>
            {item.meta ? (
              <span className="mt-0.5 block truncate text-[11px] opacity-75">
                {item.meta}
              </span>
            ) : null}
          </span>
        </ActionFrame>
      ))}
    </nav>
  )
}

export function ToolsStatusRail({
  label = 'Tool status',
  items,
  className,
}: {
  label?: string
  items: Array<ToolsStatusRailItem>
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <section
      aria-label={label}
      className={cn('grid gap-2 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'neutral'
        const progress =
          typeof item.progress === 'number'
            ? Math.max(0, Math.min(100, item.progress))
            : null
        return (
          <article
            key={item.id}
            className={cn('min-w-0 rounded-lg border p-3', toneClass(tone))}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-[10px] font-semibold uppercase tracking-[0.08em] opacity-75 [overflow-wrap:anywhere]">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-xl font-semibold leading-none tabular-nums [overflow-wrap:anywhere] sm:text-2xl">
                  {item.value}
                </p>
              </div>
              <span className="mt-0.5 size-2.5 shrink-0 rounded-full bg-current opacity-70" />
            </div>
            {progress !== null ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/12">
                <div
                  className="h-full rounded-full bg-current transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
