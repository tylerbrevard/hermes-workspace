import { startTransition, useEffect, useMemo, useState } from 'react'
import { apiPath } from '@/lib/base-path'

type ItOpsData = {
  overview?: {
    totalMeetings: number
    dateRange?: { from?: string | null; to?: string | null }
    attendance?: Array<{
      name: string
      total: number
      present: number
      absent: number
      absenceRate: number
    }>
    actionItems?: Array<{
      id: string
      meetingId: string
      meetingDate: string
      assignee: string
      task: string
      isDirectReport?: boolean
      isTyler?: boolean
    }>
    recurringIssues?: Array<{
      label: string
      count: number
      dates: string[]
      firstSeen?: string | null
      lastSeen?: string | null
    }>
    recentMeetings?: Array<{
      id: string
      date: string
      title: string
      attendees?: string[]
      absentDirectReports?: string[]
      actionItems?: string[]
      issues?: string[]
      decisions?: string[]
    }>
    generatedAt?: string
    warning?: string
  }
  analytics?: {
    ticketStats: {
      open: number
      closedToday: number
      avgResolutionHours: number
      slaCompliancePct: number
    }
    escalationCount: number
    teamPerformance: Array<{
      name: string
      role: string
      ticketsAssigned: number
      ticketsResolved: number
      avgResolutionHours: number
    }>
    trendData: Array<{
      date: string
      created: number
      resolved: number
    }>
    queueBreakdown: Array<{
      queue: string
      count: number
    }>
    priorityBreakdown?: Array<{
      priority: string
      count: number
    }>
    recentTickets?: Array<{
      id: string | number
      summary: string
      board: string
      status: string
      priority: string
      owner: string
      company: string
      dateEntered: string | null
      requiredDate: string | null
    }>
    briefing: string
    errors?: string[]
    fetchedAt: string
  }
  refreshedAt?: string
  error?: string
}

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

export function ItOpsScreen() {
  const [data, setData] = useState<ItOpsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(apiPath('/api/ops/it-ops'))
      const payload = (await response.json()) as ItOpsData
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load IT Ops')
      }
      startTransition(() => {
        setData(payload)
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IT Ops')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const directReportActions = useMemo(
    () =>
      (data?.overview?.actionItems || []).filter(
        (item) => item.isDirectReport || item.isTyler,
      ),
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
              IT Ops / ConnectWise
            </h1>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              ConnectWise ticket health, service-board load, standup patterns, and action ownership.
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
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {data?.overview?.warning ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {data.overview.warning}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Open tickets
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.analytics?.ticketStats.open ?? 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {data?.analytics?.ticketStats.closedToday ?? 0} closed today
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            SLA compliance
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.analytics?.ticketStats.slaCompliancePct ?? 0}%
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Avg resolution {data?.analytics?.ticketStats.avgResolutionHours ?? 0}h
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Escalations
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.analytics?.escalationCount ?? 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Logged in the last 24 hours
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Standups tracked
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.overview?.totalMeetings ?? 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {data?.overview?.dateRange?.from || '—'} to {data?.overview?.dateRange?.to || '—'}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            ConnectWise Briefing
          </h2>
          <div className="mt-3 text-sm text-primary-800 dark:text-neutral-200">
            {data?.analytics?.briefing || 'No briefing available.'}
          </div>
          {(data?.analytics?.errors || []).length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              {(data?.analytics?.errors || []).join(' | ')}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Service boards
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.queueBreakdown || []).slice(0, 6).map((item) => (
                  <div key={item.queue} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-primary-800 dark:text-neutral-200">{item.queue}</span>
                    <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Priority load
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.priorityBreakdown || []).slice(0, 6).map((item) => (
                  <div key={item.priority} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-primary-800 dark:text-neutral-200">{item.priority}</span>
                    <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                      {item.count}
                    </span>
                  </div>
                ))}
                {(data?.analytics?.priorityBreakdown || []).length === 0 ? (
                  <div className="text-sm text-primary-500 dark:text-neutral-400">
                    No priority data available.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900 md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Recent open tickets
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.recentTickets || []).slice(0, 8).map((ticket) => (
                  <div key={String(ticket.id)} className="rounded-lg border border-primary-200 bg-primary-50/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="font-medium text-primary-900 dark:text-neutral-100">
                      #{ticket.id} {ticket.summary}
                    </div>
                    <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                      {ticket.company} · {ticket.board} · {ticket.status} · {ticket.priority} · {ticket.owner}
                    </div>
                  </div>
                ))}
                {(data?.analytics?.recentTickets || []).length === 0 ? (
                  <div className="text-sm text-primary-500 dark:text-neutral-400">
                    No recent open tickets available.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/70 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Team performance
              </div>
              <div className="mt-3 grid gap-2">
                {(data?.analytics?.teamPerformance || []).slice(0, 6).map((member) => (
                  <div key={member.name} className="rounded-lg border border-primary-200 bg-primary-50/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="font-medium text-primary-900 dark:text-neutral-100">{member.name}</div>
                    <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                      {member.ticketsAssigned} assigned · {member.ticketsResolved} resolved · avg {member.avgResolutionHours}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Recurring issues
          </h2>
          <div className="mt-3 grid gap-2">
            {(data?.overview?.recurringIssues || []).slice(0, 8).map((issue) => (
              <div key={issue.label} className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-primary-900 dark:text-neutral-100">{issue.label}</div>
                  <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                    {issue.count} mentions
                  </span>
                </div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                  {issue.firstSeen || '—'} to {issue.lastSeen || '—'}
                </div>
              </div>
            ))}
            {(data?.overview?.recurringIssues || []).length === 0 ? (
              <div className="text-sm text-primary-500 dark:text-neutral-400">
                No recurring issue clusters found.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Direct-report action load
          </h2>
          <div className="mt-3 grid gap-2">
            {directReportActions.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-primary-900 dark:text-neutral-100">{item.assignee}</div>
                  <span className="text-xs text-primary-500 dark:text-neutral-400">{item.meetingDate}</span>
                </div>
                <div className="mt-1 text-sm text-primary-700 dark:text-neutral-300">{item.task}</div>
              </div>
            ))}
            {directReportActions.length === 0 ? (
              <div className="text-sm text-primary-500 dark:text-neutral-400">
                No direct-report action items available.
              </div>
            ) : null}
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Recent standups
          </h2>
          <div className="mt-3 grid gap-2">
            {(data?.overview?.recentMeetings || []).slice(0, 8).map((meeting) => (
              <div key={meeting.id} className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="font-medium text-primary-900 dark:text-neutral-100">{meeting.title}</div>
                <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">{meeting.date}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                    {(meeting.actionItems || []).length} action item(s)
                  </span>
                  <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                    {(meeting.issues || []).length} issue(s)
                  </span>
                  <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-primary-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                    {(meeting.absentDirectReports || []).length} absent
                  </span>
                </div>
              </div>
            ))}
            {(data?.overview?.recentMeetings || []).length === 0 ? (
              <div className="text-sm text-primary-500 dark:text-neutral-400">
                No recent standup records available.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
