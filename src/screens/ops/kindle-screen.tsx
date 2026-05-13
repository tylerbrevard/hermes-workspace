import { startTransition, useEffect, useMemo, useState } from 'react'
import { apiPath } from '@/lib/base-path'

type KindlePayload = {
  dashboard?: {
    connectwise?: {
      openTicketCount?: number | null
    }
    cronHealth?: {
      running?: number
      failed?: number
    } | null
    healthSummary?: {
      overall?: string
      percent?: number
      issues?: string[]
    } | null
    teamsPresence?: {
      availability?: string
      activity?: string
      stale?: boolean
    } | null
    aiCost?: {
      today?: number | null
      month?: number | null
    } | null
    meetings?: {
      todayCount?: number
    }
    wins?: {
      thisWeek?: number
    } | null
    openclaw?: {
      hasUpdate?: boolean
      latestName?: string | null
    } | null
  }
  executive?: {
    connectwise?: {
      summary?: {
        openTickets?: number
        slaAtRisk?: number
        boardCount?: number
        techCount?: number
        slaCompliance?: number | null
        avgResolutionTime?: number | null
      }
      tickets?: {
        byPriority?: Array<{ priority?: string; count?: number }>
        recent?: Array<{
          id: string | number
          summary: string
          status?: string
          priority?: string
          assignedTo?: string
        }>
      }
      fetchedAt?: string | null
      error?: string | null
    }
    microsoft365?: {
      planner?: {
        taskCount?: number
        overdueCount?: number
        dueThisWeekCount?: number
      }
      meetings?: {
        todayCount?: number
        nextMeeting?: { title?: string; date?: string } | null
      }
    }
    fetchedAt?: string
  }
  refreshedAt?: string
  error?: string
}

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function cardClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-100/70 p-4 dark:border-neutral-800 dark:bg-neutral-900'
}

function fmtNum(value?: number | null) {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

function fmtPct(value?: number | null) {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(0)}%`
}

function fmtMoney(value?: number | null) {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function KindleScreen() {
  const [data, setData] = useState<KindlePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(apiPath('/api/ops/kindle'))
      const payload = (await response.json()) as KindlePayload
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load Kindle')
      }
      startTransition(() => {
        setData(payload)
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Kindle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const topPriorities = useMemo(() => {
    const items = data?.executive?.connectwise?.tickets?.byPriority || []
    return [...items].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 4)
  }, [data])

  const recentTickets = useMemo(
    () => (data?.executive?.connectwise?.tickets?.recent || []).slice(0, 5),
    [data],
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 sm:px-2">
      <div className={shellClassName()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Ops
            </div>
            <h1 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
              Kindle
            </h1>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Workspace-native executive snapshot for ConnectWise, calendar, health, and spend.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-primary-600 dark:text-neutral-400 sm:grid-cols-3">
          <div>Dashboard fetch: {fmtDateTime(data?.executive?.fetchedAt)}</div>
          <div>CW fetch: {fmtDateTime(data?.executive?.connectwise?.fetchedAt)}</div>
          <div>Workspace refresh: {fmtDateTime(data?.refreshedAt)}</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {data?.executive?.connectwise?.error ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {data.executive.connectwise.error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cardClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Open Tickets
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {fmtNum(
              data?.executive?.connectwise?.summary?.openTickets ??
                data?.dashboard?.connectwise?.openTicketCount,
            )}
          </div>
        </div>
        <div className={cardClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            SLA At Risk
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {fmtNum(data?.executive?.connectwise?.summary?.slaAtRisk)}
          </div>
        </div>
        <div className={cardClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            System Health
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {fmtPct(data?.dashboard?.healthSummary?.percent)}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {data?.dashboard?.healthSummary?.overall || 'Health'}
          </div>
        </div>
        <div className={cardClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            AI Spend Today
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {fmtMoney(data?.dashboard?.aiCost?.today)}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Month {fmtMoney(data?.dashboard?.aiCost?.month)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Executive Snapshot
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Planner
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {fmtNum(data?.executive?.microsoft365?.planner?.taskCount)}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                Overdue {fmtNum(data?.executive?.microsoft365?.planner?.overdueCount)} · due this week{' '}
                {fmtNum(data?.executive?.microsoft365?.planner?.dueThisWeekCount)}
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Meetings Today
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {fmtNum(
                  data?.executive?.microsoft365?.meetings?.todayCount ??
                    data?.dashboard?.meetings?.todayCount,
                )}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {data?.executive?.microsoft365?.meetings?.nextMeeting?.title || 'Calendar'}
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Teams
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {data?.dashboard?.teamsPresence?.availability || '—'}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {data?.dashboard?.teamsPresence?.activity || 'Presence'}
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Wins This Week
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {fmtNum(data?.dashboard?.wins?.thisWeek)}
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Cron Failures
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {fmtNum(data?.dashboard?.cronHealth?.failed)}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                Running {fmtNum(data?.dashboard?.cronHealth?.running)}
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                OpenClaw
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {data?.dashboard?.openclaw?.hasUpdate ? 'Update' : 'Current'}
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {data?.dashboard?.openclaw?.latestName || 'No pending release'}
              </div>
            </div>
          </div>
        </div>

        <div className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            ConnectWise Focus
          </h2>
          <div className="mt-4 grid gap-3">
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Top Priorities
              </div>
              <div className="mt-3 grid gap-2">
                {topPriorities.length === 0 ? (
                  <div className="text-sm text-primary-500 dark:text-neutral-400">
                    No priority buckets available.
                  </div>
                ) : null}
                {topPriorities.map((item, index) => (
                  <div
                    key={`${item.priority || 'priority'}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <span className="text-sm text-primary-900 dark:text-neutral-100">
                      {item.priority || 'Unlabeled'}
                    </span>
                    <span className="rounded-full border border-primary-200 bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      {fmtNum(item.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Recent Tickets
              </div>
              <div className="mt-3 grid gap-2">
                {recentTickets.length === 0 ? (
                  <div className="text-sm text-primary-500 dark:text-neutral-400">
                    No recent tickets available.
                  </div>
                ) : null}
                {recentTickets.map((ticket) => (
                  <div
                    key={String(ticket.id)}
                    className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                      #{ticket.id} {ticket.summary}
                    </div>
                    <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                      {ticket.status || 'Unknown'} · {ticket.priority || 'No priority'} ·{' '}
                      {ticket.assignedTo || 'Unassigned'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Queue Summary
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="text-xs text-primary-600 dark:text-neutral-400">Boards</div>
                  <div className="mt-1 text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {fmtNum(data?.executive?.connectwise?.summary?.boardCount)}
                  </div>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="text-xs text-primary-600 dark:text-neutral-400">Techs</div>
                  <div className="mt-1 text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {fmtNum(data?.executive?.connectwise?.summary?.techCount)}
                  </div>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="text-xs text-primary-600 dark:text-neutral-400">SLA Compliance</div>
                  <div className="mt-1 text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {fmtPct(data?.executive?.connectwise?.summary?.slaCompliance)}
                  </div>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="text-xs text-primary-600 dark:text-neutral-400">Avg Resolution</div>
                  <div className="mt-1 text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {fmtNum(data?.executive?.connectwise?.summary?.avgResolutionTime)}h
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
