import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  CompletedMap,
  ImprovementCategory,
  ImprovementScope,
  ImprovementStatus,
  IndexedImprovement,
} from '@/lib/workspace-improvement-progress'
import { cn } from '@/lib/utils'
import {
  countWorkspaceRecommendations,
  findWorkspaceImprovementPage,
} from '@/lib/workspace-improvements'
import { findWorkspaceRouteRegistryEntry } from '@/lib/workspace-route-registry'
import {
  IMPROVEMENT_CATEGORIES,
  WORKSPACE_IMPROVEMENT_OPEN_EVENT,
  WORKSPACE_IMPROVEMENT_STORAGE_KEY,
  filterWorkspaceImprovements,
  getImprovementStats,
  improvementItemKey,
  serializeImprovementPlan,
} from '@/lib/workspace-improvement-progress'

type CopyState = 'idle' | 'copied' | 'failed'

function readCompleted(): CompletedMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(WORKSPACE_IMPROVEMENT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCompleted(completed: CompletedMap) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    WORKSPACE_IMPROVEMENT_STORAGE_KEY,
    JSON.stringify(completed),
  )
}

function ImprovementScopeButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-xs font-medium',
        active
          ? 'border-primary-400 bg-primary-100 text-primary-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
          : 'border-primary-200 text-primary-600 dark:border-neutral-800 dark:text-neutral-300',
      )}
    >
      {children}
    </button>
  )
}

function ImprovementActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
    >
      {children}
    </button>
  )
}

export function WorkspaceImprovementDrawer({ pathname }: { pathname: string }) {
  const page = findWorkspaceImprovementPage(pathname)
  const routeRegistry = page
    ? findWorkspaceRouteRegistryEntry(page.route)
    : null
  const panelRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<ImprovementScope>('current')
  const [status, setStatus] = useState<ImprovementStatus>('open')
  const [category, setCategory] = useState<ImprovementCategory | 'all'>('all')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [completed, setCompleted] = useState<CompletedMap>({})
  const totalCount = countWorkspaceRecommendations()

  useEffect(() => {
    setCompleted(readCompleted())
  }, [])

  useEffect(() => {
    function handleOpen() {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      setOpen(true)
    }

    window.addEventListener(WORKSPACE_IMPROVEMENT_OPEN_EVENT, handleOpen)
    return () =>
      window.removeEventListener(WORKSPACE_IMPROVEMENT_OPEN_EVENT, handleOpen)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCopyState('idle')
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => searchInputRef.current?.focus(), 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('aria-hidden'))

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (copyState !== 'copied') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 1600)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  const visiblePages = useMemo(() => {
    return filterWorkspaceImprovements({
      completed,
      page,
      scope,
      query,
      status,
      category,
    })
  }, [category, completed, page, query, scope, status])

  const pageStats = page
    ? getImprovementStats(completed, page.id)
    : { done: 0, open: 0, total: 0, percent: 0 }
  const workspaceStats = getImprovementStats(completed)
  const visibleItems = visiblePages.flatMap((candidate) => candidate.items)

  function toggleItem(pageId: string, index: number) {
    setCompleted((current) => {
      const key = improvementItemKey(pageId, index)
      const next = { ...current, [key]: !current[key] }
      writeCompleted(next)
      return next
    })
  }

  function setVisibleItems(items: Array<IndexedImprovement>, value: boolean) {
    setCompleted((current) => {
      const next = { ...current }
      for (const item of items) next[item.key] = value
      writeCompleted(next)
      return next
    })
  }

  async function copyPlan(format: 'json' | 'markdown') {
    try {
      await navigator.clipboard.writeText(
        serializeImprovementPlan(completed, format),
      )
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  if (!page) return null

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-improvement-title"
        >
          <button
            type="button"
            aria-label="Close improvements"
            tabIndex={-1}
            className="absolute inset-0 bg-black/35"
            onClick={() => setOpen(false)}
          />
          <section
            ref={panelRef}
            className={cn(
              'absolute bottom-0 right-0 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border bg-surface shadow-2xl',
              'md:bottom-4 md:right-4 md:max-h-[min(760px,calc(100dvh-2rem))] md:w-[520px] md:rounded-2xl',
              'border-primary-200 dark:border-neutral-800 dark:bg-neutral-950',
            )}
          >
            <header className="shrink-0 border-b border-primary-200 px-4 py-3 dark:border-neutral-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2
                    id="workspace-improvement-title"
                    className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100"
                  >
                    {page.label} Improvements
                  </h2>
                  <p className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                    {workspaceStats.done}/{totalCount} workspace recommendations
                    complete. {visibleItems.length} visible in this view.
                  </p>
                  {routeRegistry ? (
                    <p className="mt-1 text-[11px] text-primary-500 dark:text-neutral-500">
                      Owner: {routeRegistry.owner} · Smoke:{' '}
                      {routeRegistry.smokeText} · Dependencies:{' '}
                      {routeRegistry.runtimeDependencies.join(', ')}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:items-center">
                  <button
                    type="button"
                    onClick={() => void copyPlan('markdown')}
                    className="rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    {copyState === 'failed'
                      ? 'Failed'
                      : copyState === 'copied'
                        ? 'Copied'
                        : 'Copy MD'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyPlan('json')}
                    className="rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="h-2 overflow-hidden rounded-full bg-primary-100 dark:bg-neutral-900">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width]"
                    style={{ width: `${pageStats.percent}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-primary-500 dark:text-neutral-400">
                  {pageStats.percent}%
                </span>
              </div>
              <details className="mt-3 md:hidden">
                <summary className="cursor-pointer rounded-lg border border-primary-200 px-3 py-2 text-xs font-medium text-primary-700 dark:border-neutral-800 dark:text-neutral-200">
                  Filters and batch actions
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ImprovementScopeButton
                    active={scope === 'current'}
                    onClick={() => setScope('current')}
                  >
                    Current
                  </ImprovementScopeButton>
                  <ImprovementScopeButton
                    active={scope === 'all'}
                    onClick={() => setScope('all')}
                  >
                    All pages
                  </ImprovementScopeButton>
                  <ImprovementActionButton
                    onClick={() => setVisibleItems(visibleItems, true)}
                    disabled={visibleItems.length === 0}
                  >
                    Mark visible
                  </ImprovementActionButton>
                  <ImprovementActionButton
                    onClick={() => setVisibleItems(visibleItems, false)}
                    disabled={visibleItems.length === 0}
                  >
                    Clear visible
                  </ImprovementActionButton>
                </div>
              </details>
              <div className="mt-3 hidden grid-cols-2 gap-2 md:grid md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setScope('current')}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                    scope === 'current'
                      ? 'border-primary-400 bg-primary-100 text-primary-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'border-primary-200 text-primary-600 dark:border-neutral-800 dark:text-neutral-300',
                  )}
                >
                  Current
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                    scope === 'all'
                      ? 'border-primary-400 bg-primary-100 text-primary-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'border-primary-200 text-primary-600 dark:border-neutral-800 dark:text-neutral-300',
                  )}
                >
                  All pages
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleItems(visibleItems, true)}
                  disabled={visibleItems.length === 0}
                  className="rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Mark visible
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleItems(visibleItems, false)}
                  disabled={visibleItems.length === 0}
                  className="rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Clear visible
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as ImprovementStatus)
                  }
                  className="h-9 rounded-lg border border-primary-200 bg-transparent px-2 text-sm outline-none focus:border-primary-400 dark:border-neutral-800 dark:text-neutral-100"
                  aria-label="Filter improvements by status"
                >
                  <option value="open">Open</option>
                  <option value="done">Done</option>
                  <option value="all">All status</option>
                </select>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.currentTarget.value as ImprovementCategory | 'all',
                    )
                  }
                  className="h-9 rounded-lg border border-primary-200 bg-transparent px-2 text-sm outline-none focus:border-primary-400 dark:border-neutral-800 dark:text-neutral-100"
                  aria-label="Filter improvements by category"
                >
                  <option value="all">All categories</option>
                  {IMPROVEMENT_CATEGORIES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                ref={searchInputRef}
                placeholder="Search all page recommendations"
                className="mt-3 h-9 w-full rounded-lg border border-primary-200 bg-transparent px-3 text-sm outline-none focus:border-primary-400 dark:border-neutral-800 dark:text-neutral-100"
              />
              {routeRegistry ? (
                <details className="mt-2 rounded-lg border border-primary-200 px-3 py-2 text-xs text-primary-600 dark:border-neutral-800 dark:text-neutral-400">
                  <summary className="cursor-pointer font-medium text-primary-800 dark:text-neutral-200">
                    Route escalation
                  </summary>
                  <p className="mt-2">{routeRegistry.escalationPath}</p>
                  <p className="mt-1">
                    Mobile smoke:{' '}
                    {routeRegistry.mobileSmokeText ?? routeRegistry.smokeText}
                  </p>
                </details>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {visiblePages.length === 0 ? (
                <div className="rounded-xl border border-primary-200 px-3 py-6 text-center text-sm text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
                  No recommendations match this search.
                </div>
              ) : (
                visiblePages.map((candidate) => (
                  <div key={candidate.page.id} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
                        {candidate.page.label}
                      </h3>
                      <span className="text-[11px] text-primary-400 dark:text-neutral-500">
                        {candidate.items.length} shown
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {candidate.items.map((item) => {
                        return (
                          <label
                            key={item.key}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm',
                              item.completed
                                ? 'border-emerald-400/25 bg-emerald-400/10 text-primary-500 dark:text-neutral-400'
                                : 'border-primary-200 bg-primary-50/50 text-primary-800 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-100',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() =>
                                toggleItem(item.page.id, item.index)
                              }
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={item.completed ? 'line-through' : ''}
                              >
                                {item.item}
                              </span>
                              <span className="mt-1 block text-[11px] text-primary-400 dark:text-neutral-500">
                                {item.category} · {item.page.route}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
