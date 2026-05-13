import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'

type Meeting = {
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

type MeetingsData = {
  meetings: Meeting[]
  todayMeetings: Meeting[]
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

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function toneForType(type?: string) {
  switch (type) {
    case 'client':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-200'
    case 'project':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200'
    case 'team':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
    case 'it-ops':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
    default:
      return 'border-primary-200 bg-primary-100/70 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
  }
}

function formatWhen(value: string) {
  const date = new Date(value)
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function participantLabel(meeting: Meeting) {
  const names = (meeting.participants || [])
    .map((participant) =>
      typeof participant === 'string'
        ? participant
        : participant.displayName || participant.email || '',
    )
    .filter(Boolean)
  return names.slice(0, 4).join(', ')
}

function participantList(meeting: Meeting) {
  return (meeting.participants || [])
    .map((participant) =>
      typeof participant === 'string'
        ? participant
        : participant.displayName || participant.email || '',
    )
    .filter(Boolean)
}

type ActionDraft = {
  text: string
  assignee: string
  priority: string
  dueDate: string
}

type IssueDraft = {
  title: string
  description: string
  status: string
  priority: string
  assignee: string
}

type DecisionDraft = {
  text: string
  decisionMaker: string
  impact: string
}

export function MeetingsScreen() {
  const [data, setData] = useState<MeetingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')
  const [newActionItemText, setNewActionItemText] = useState('')
  const [editingActionItemId, setEditingActionItemId] = useState<string | null>(null)
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null)
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null)
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({})
  const [issueDrafts, setIssueDrafts] = useState<Record<string, IssueDraft>>({})
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, DecisionDraft>>({})
  const deferredSearch = useDeferredValue(search)

  async function load(forceRefresh = false) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '60',
      })
      if (deferredSearch.trim()) params.set('search', deferredSearch.trim())
      if (forceRefresh) params.set('forceRefresh', 'true')
      const response = await fetch(`/api/ops/meetings?${params.toString()}`)
      const payload = (await response.json()) as MeetingsData
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load meetings')
      }
      startTransition(() => {
        setData((current) => ({
          ...(current || {}),
          ...payload,
          brief: current?.brief || null,
          selectedMeeting: current?.selectedMeeting || null,
        }))
        setSelectedMeetingId((current) => current || payload.selectedMeetingId || '')
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [deferredSearch])

  async function loadSelectedMeeting(meetingId: string) {
    if (!meetingId) return
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({
        selectedMeetingId: meetingId,
        detailOnly: 'true',
      })
      const response = await fetch(`/api/ops/meetings?${params.toString()}`)
      const payload = (await response.json()) as MeetingsData
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load meeting detail')
      }
      startTransition(() => {
        setData((current) =>
          current
            ? {
                ...current,
                selectedMeetingId: payload.selectedMeetingId || meetingId,
                selectedMeeting: payload.selectedMeeting || null,
                brief: payload.brief || null,
              }
            : payload,
        )
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting detail')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedMeetingId) return
    void loadSelectedMeeting(selectedMeetingId)
  }, [selectedMeetingId])

  const unreviewedIds = useMemo(
    () => (data?.meetings || []).filter((meeting) => !meeting.reviewed).map((meeting) => meeting.id),
    [data],
  )

  const selectedMeeting = useMemo(
    () =>
      data?.selectedMeeting ||
      [...(data?.todayMeetings || []), ...(data?.meetings || [])].find(
        (meeting, index, items) =>
          meeting.id === selectedMeetingId &&
          items.findIndex((candidate) => candidate.id === meeting.id) === index,
      ) ||
      null,
    [data, selectedMeetingId],
  )

  async function post(body: Record<string, unknown>, reload = true) {
    setWorking(true)
    try {
      const response = await fetch('/api/ops/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Action failed')
      }
      if (reload) {
        await load(body.kind === 'force-sync')
        if (selectedMeetingId) {
          await loadSelectedMeeting(selectedMeetingId)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setWorking(false)
    }
  }

  function pickMeeting(meetingId: string) {
    setSelectedMeetingId(meetingId)
  }

  async function createActionItem() {
    const text = newActionItemText.trim()
    if (!text) return
    await post({
      kind: 'create-action-item',
      meetingId: selectedMeetingId,
      text,
      priority: 'medium',
    })
    setNewActionItemText('')
  }

  async function sendOpenActionItemsToTodo() {
    const items = (data?.brief?.openActionItems || []).map((item) => ({
      text: item.text,
      assignee: item.assignee,
      dueDate: item.dueDate,
      priority: item.priority,
      meetingTitle: item.meetingTitle || data?.brief?.meetingTitle,
      sourceType: 'meeting-action-item',
    }))
    if (items.length === 0) return
    await post({ kind: 'send-action-items-to-todo', items })
  }

  async function sendIssuesToTodo() {
    const items = (selectedMeeting?.issues || []).map((issue) => ({
      text: issue.title,
      assignee: issue.assignee,
      priority: issue.priority,
      meetingTitle: selectedMeeting?.title,
      details: issue.description || `Issue status: ${issue.status || 'new'}`,
      sourceType: 'meeting-issue',
    }))
    if (items.length === 0) return
    await post({ kind: 'send-issues-to-todo', items })
  }

  async function sendDecisionsToTodo() {
    const items = (selectedMeeting?.decisions || []).map((decision) => ({
      text: decision.text,
      assignee: decision.decisionMaker,
      priority: decision.impact === 'high' ? 'high' : 'medium',
      meetingTitle: selectedMeeting?.title,
      details: decision.impact ? `Impact: ${decision.impact}` : undefined,
      sourceType: 'meeting-decision',
    }))
    if (items.length === 0) return
    await post({ kind: 'send-decisions-to-todo', items })
  }

  async function extractSelectedMeeting() {
    if (!selectedMeeting?.id || !selectedMeeting.content) return
    await post({
      kind: 'extract-selected',
      meetingId: selectedMeeting.id,
      content: selectedMeeting.content,
    })
  }

  async function autoExtractRecent() {
    await post({
      kind: 'auto-extract-recent',
      limit: 5,
    })
  }

  function beginEditActionItem(item: NonNullable<Meeting['actionItems']>[number]) {
    setEditingActionItemId(item.id)
    setActionDrafts((current) => ({
      ...current,
      [item.id]: {
        text: item.text || '',
        assignee: item.assignee || '',
        priority: item.priority || 'medium',
        dueDate: item.dueDate || '',
      },
    }))
  }

  function cancelEditActionItem() {
    setEditingActionItemId(null)
  }

  async function saveActionItem(itemId: string) {
    const draft = actionDrafts[itemId]
    if (!draft) return
    await post({
      kind: 'update-action-item',
      actionItem: {
        id: itemId,
        text: draft.text.trim(),
        assignee: draft.assignee.trim(),
        priority: draft.priority.trim(),
        dueDate: draft.dueDate.trim(),
      },
    })
    setEditingActionItemId(null)
  }

  function beginEditIssue(issue: NonNullable<Meeting['issues']>[number]) {
    setEditingIssueId(issue.id)
    setIssueDrafts((current) => ({
      ...current,
      [issue.id]: {
        title: issue.title || '',
        description: issue.description || '',
        status: issue.status || 'new',
        priority: issue.priority || 'medium',
        assignee: issue.assignee || '',
      },
    }))
  }

  function cancelEditIssue() {
    setEditingIssueId(null)
  }

  async function saveIssue(issueId: string) {
    const draft = issueDrafts[issueId]
    if (!draft) return
    await post({
      kind: 'update-issue',
      issue: {
        id: issueId,
        title: draft.title.trim(),
        description: draft.description.trim(),
        status: draft.status.trim(),
        priority: draft.priority.trim(),
        assignee: draft.assignee.trim(),
      },
    })
    setEditingIssueId(null)
  }

  function beginEditDecision(decision: NonNullable<Meeting['decisions']>[number]) {
    setEditingDecisionId(decision.id)
    setDecisionDrafts((current) => ({
      ...current,
      [decision.id]: {
        text: decision.text || '',
        decisionMaker: decision.decisionMaker || '',
        impact: decision.impact || 'medium',
      },
    }))
  }

  function cancelEditDecision() {
    setEditingDecisionId(null)
  }

  async function saveDecision(decisionId: string) {
    const draft = decisionDrafts[decisionId]
    if (!draft) return
    await post({
      kind: 'update-decision',
      decision: {
        id: decisionId,
        text: draft.text.trim(),
        decisionMaker: draft.decisionMaker.trim(),
        impact: draft.impact.trim(),
      },
    })
    setEditingDecisionId(null)
  }

  function heatmapTone(intensity: 0 | 1 | 2 | 3 | 4) {
    switch (intensity) {
      case 4:
        return 'bg-red-500/85 text-white dark:bg-red-500'
      case 3:
        return 'bg-amber-500/85 text-white dark:bg-amber-500'
      case 2:
        return 'bg-cyan-500/85 text-white dark:bg-cyan-500'
      case 1:
        return 'bg-primary-200 text-primary-900 dark:bg-neutral-800 dark:text-neutral-100'
      default:
        return 'bg-primary-100/70 text-primary-500 dark:bg-neutral-900 dark:text-neutral-500'
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 sm:px-2">
      <div className={shellClassName()}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Meetings
            </div>
            <h1 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
              Meetings
            </h1>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Native Workspace view for meeting health, today’s calendar, and review state.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search meetings"
              className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={() => post({ kind: 'force-sync' })}
              disabled={working}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
            >
              Force sync
            </button>
            <button
              type="button"
              onClick={() => void autoExtractRecent()}
              disabled={working}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Auto-extract recent
            </button>
            <button
              type="button"
              onClick={() => post({ kind: 'bulk-review', meetingIds: unreviewedIds })}
              disabled={working || unreviewedIds.length === 0}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Mark all reviewed
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {data?.graphWarning || data?.dataWarning ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {data.graphWarning || data.dataWarning}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <section className={shellClassName()}>
          <div className="text-xs uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Today
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.todayMeetings?.length || 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Upcoming and current meetings in the next 5-day window
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-xs uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Total tracked
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {data?.total || data?.meetings?.length || 0}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Graph source: {data?.graphSource || 'unknown'}
          </div>
        </section>
        <section className={shellClassName()}>
          <div className="text-xs uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Unreviewed
          </div>
          <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
            {unreviewedIds.length}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            Native Workspace review state
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={shellClassName()}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Today and next
            </h2>
            <div className="text-xs text-primary-500 dark:text-neutral-400">
              {loading ? 'Loading…' : `${data?.todayMeetings?.length || 0} meetings`}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {(data?.todayMeetings || []).map((meeting) => (
              <div
                key={`${meeting.id}-${meeting.date}`}
                className={`rounded-2xl border px-4 py-3 transition-colors dark:border-neutral-800 ${
                  selectedMeetingId === meeting.id
                    ? 'border-primary-400 bg-primary-100/80 dark:bg-neutral-900/90'
                    : 'border-primary-200 bg-primary-50/70 dark:bg-neutral-900/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => pickMeeting(meeting.id)}
                  className="block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                          {meeting.title}
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${toneForType(meeting.type)}`}>
                          {meeting.type || 'other'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                        {formatWhen(meeting.date)} · {meeting.duration || 0} min
                      </div>
                      <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                        {participantLabel(meeting)}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
            {!loading && (data?.todayMeetings?.length || 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 px-4 py-8 text-center text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
                No meetings in the current window.
              </div>
            ) : null}
          </div>
        </section>

        <section className={shellClassName()}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Recent meeting records
            </h2>
            <div className="text-xs text-primary-500 dark:text-neutral-400">
              {loading ? 'Loading…' : `${data?.meetings?.length || 0} rows`}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {(data?.meetings || []).slice(0, 24).map((meeting) => (
              <div
                key={meeting.id}
                className={`rounded-2xl border px-4 py-3 transition-colors dark:border-neutral-800 ${
                  selectedMeetingId === meeting.id
                    ? 'border-primary-400 bg-primary-100/80 dark:bg-neutral-900/90'
                    : 'border-primary-200 bg-primary-50/70 dark:bg-neutral-900/70'
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <button
                    type="button"
                    onClick={() => pickMeeting(meeting.id)}
                    className="text-left"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                          {meeting.title}
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${toneForType(meeting.type)}`}>
                          {meeting.type || 'other'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                        {formatWhen(meeting.date)} · {meeting.duration || 0} min
                      </div>
                      <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                        {participantLabel(meeting)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                          {(meeting.actionItems || []).length} action item(s)
                        </span>
                        {meeting.reviewed ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                            Reviewed
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                            Needs review
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      post({
                        kind: 'set-reviewed',
                        meetingId: meeting.id,
                        reviewed: !meeting.reviewed,
                      })
                    }
                    disabled={working}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      meeting.reviewed
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'border border-primary-200 bg-primary-100/70 text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                    }`}
                  >
                    {meeting.reviewed ? 'Reviewed' : 'Mark reviewed'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <section className={shellClassName()}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Two-week load
            </h2>
            <div className="text-xs text-primary-500 dark:text-neutral-400">
              Forward-looking meeting density
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            {(data?.heatmapDays || []).map((day) => (
              <div
                key={day.date}
                className="rounded-2xl border border-primary-200 bg-primary-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/60"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    {day.dayLabel}
                  </div>
                  <div className={`rounded-full px-2 py-1 text-[10px] font-semibold ${heatmapTone(day.intensity)}`}>
                    {day.totalHours}h
                  </div>
                </div>
                <div className="mt-2 text-sm font-semibold text-primary-900 dark:text-neutral-100">
                  {new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                  {day.meetingCount} meeting(s)
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={shellClassName()}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Selected meeting
            </h2>
            <div className="text-xs text-primary-500 dark:text-neutral-400">
              {detailLoading
                ? 'Refreshing detail…'
                : selectedMeeting?.title || data?.brief?.meetingTitle || 'Select a meeting'}
            </div>
          </div>

          {selectedMeeting ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                  {selectedMeeting.title}
                </div>
                <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                  {formatWhen(selectedMeeting.date)} · {selectedMeeting.duration || 0} min
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-1 ${toneForType(selectedMeeting.type)}`}>
                    {selectedMeeting.type || 'other'}
                  </span>
                  {selectedMeeting.hasTranscription ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                      {selectedMeeting.transcriptionSource || 'transcript'}
                    </span>
                  ) : null}
                  {selectedMeeting.reviewed ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                      Reviewed
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                      Needs review
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedMeeting.content &&
                  (selectedMeeting.actionItems?.length || 0) === 0 &&
                  (selectedMeeting.issues?.length || 0) === 0 &&
                  (selectedMeeting.decisions?.length || 0) === 0 ? (
                    <button
                      type="button"
                      onClick={() => void extractSelectedMeeting()}
                      disabled={working}
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      Extract insights
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void sendOpenActionItemsToTodo()}
                    disabled={working || data.brief.openActionItems.length === 0}
                    className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                  >
                    Send open items to To Do
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      post({
                        kind: 'set-reviewed',
                        meetingId: selectedMeeting.id,
                        reviewed: true,
                      })
                    }
                    disabled={working}
                    className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    Mark reviewed
                  </button>
                  {selectedMeeting.joinUrl ? (
                    <a
                      href={selectedMeeting.joinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      Join link
                    </a>
                  ) : null}
                </div>
                {selectedMeeting.content ? (
                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 p-3 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                    {selectedMeeting.content}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {participantList(selectedMeeting).map((participant) => (
                    <span
                      key={participant}
                      className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-[11px] text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                    >
                      {participant}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Prior meetings
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(data.brief.previousMeetings || []).map((meeting) => (
                      <button
                        key={meeting.id}
                        type="button"
                        onClick={() => pickMeeting(meeting.id)}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-left text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                      >
                        <div className="font-medium">{meeting.title}</div>
                        <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                          {formatWhen(meeting.date)} · {meeting.duration || 0} min
                        </div>
                      </button>
                    ))}
                    {data.brief.previousMeetings.length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        No overlapping-participant history found.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Action items
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={newActionItemText}
                      onChange={(event) => setNewActionItemText(event.currentTarget.value)}
                      placeholder={selectedMeeting ? `Add action item for ${selectedMeeting.title}` : 'Add action item'}
                      className="w-full rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <button
                      type="button"
                      onClick={() => void createActionItem()}
                      disabled={working || !selectedMeetingId || !newActionItemText.trim()}
                      className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(selectedMeeting.actionItems || []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        {editingActionItemId === item.id ? (
                          <div className="grid gap-2">
                            <input
                              type="text"
                              value={actionDrafts[item.id]?.text || ''}
                              onChange={(event) =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...(current[item.id] || { text: '', assignee: '', priority: 'medium', dueDate: '' }),
                                    text: event.currentTarget.value,
                                  },
                                }))
                              }
                              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                            <div className="grid gap-2 sm:grid-cols-3">
                              <input
                                type="text"
                                value={actionDrafts[item.id]?.assignee || ''}
                                onChange={(event) =>
                                  setActionDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...(current[item.id] || { text: '', assignee: '', priority: 'medium', dueDate: '' }),
                                      assignee: event.currentTarget.value,
                                    },
                                  }))
                                }
                                placeholder="Assignee"
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                              <select
                                value={actionDrafts[item.id]?.priority || 'medium'}
                                onChange={(event) =>
                                  setActionDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...(current[item.id] || { text: '', assignee: '', priority: 'medium', dueDate: '' }),
                                      priority: event.currentTarget.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              >
                                <option value="low">low</option>
                                <option value="medium">medium</option>
                                <option value="high">high</option>
                                <option value="urgent">urgent</option>
                              </select>
                              <input
                                type="date"
                                value={actionDrafts[item.id]?.dueDate || ''}
                                onChange={(event) =>
                                  setActionDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...(current[item.id] || { text: '', assignee: '', priority: 'medium', dueDate: '' }),
                                      dueDate: event.currentTarget.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                              {item.text}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
                              <span>{item.assignee || 'Unassigned'}</span>
                              {item.priority ? <span>{item.priority}</span> : null}
                              {item.dueDate ? <span>Due {formatWhen(item.dueDate)}</span> : null}
                              {item.status ? <span>{item.status}</span> : null}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(['open', 'in-progress', 'blocked', 'completed'] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                post({
                                  kind: 'update-action-item',
                                  actionItem: {
                                    id: item.id,
                                    status,
                                  },
                                })
                              }
                              disabled={working}
                              className={`rounded-lg px-2 py-1 text-xs ${
                                item.status === status
                                  ? 'bg-primary-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                  : 'border border-primary-200 bg-primary-50 text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                          {editingActionItemId === item.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveActionItem(item.id)}
                                disabled={working}
                                className="rounded-lg bg-primary-900 px-2 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelEditActionItem()}
                                disabled={working}
                                className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                          <button
                            type="button"
                            onClick={() => beginEditActionItem(item)}
                            disabled={working}
                            className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                          >
                            Edit
                          </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              post({
                                kind: 'delete-action-item',
                                actionItemId: item.id,
                              })
                            }
                            disabled={working}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {(selectedMeeting.actionItems || []).length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        No action items recorded for this meeting.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                      Issues
                    </div>
                    <button
                      type="button"
                      onClick={() => void sendIssuesToTodo()}
                      disabled={working || (selectedMeeting.issues || []).length === 0}
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      Send to To Do
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(selectedMeeting.issues || []).map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        {editingIssueId === issue.id ? (
                          <div className="grid gap-2">
                            <input
                              type="text"
                              value={issueDrafts[issue.id]?.title || ''}
                              onChange={(event) =>
                                setIssueDrafts((current) => ({
                                  ...current,
                                  [issue.id]: {
                                    ...(current[issue.id] || { title: '', description: '', status: 'new', priority: 'medium', assignee: '' }),
                                    title: event.currentTarget.value,
                                  },
                                }))
                              }
                              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                            <textarea
                              value={issueDrafts[issue.id]?.description || ''}
                              onChange={(event) =>
                                setIssueDrafts((current) => ({
                                  ...current,
                                  [issue.id]: {
                                    ...(current[issue.id] || { title: '', description: '', status: 'new', priority: 'medium', assignee: '' }),
                                    description: event.currentTarget.value,
                                  },
                                }))
                              }
                              rows={3}
                              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                            <div className="grid gap-2 sm:grid-cols-3">
                              <select
                                value={issueDrafts[issue.id]?.status || 'new'}
                                onChange={(event) =>
                                  setIssueDrafts((current) => ({
                                    ...current,
                                    [issue.id]: {
                                      ...(current[issue.id] || { title: '', description: '', status: 'new', priority: 'medium', assignee: '' }),
                                      status: event.currentTarget.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              >
                                <option value="new">new</option>
                                <option value="investigating">investigating</option>
                                <option value="blocked">blocked</option>
                                <option value="resolved">resolved</option>
                              </select>
                              <select
                                value={issueDrafts[issue.id]?.priority || 'medium'}
                                onChange={(event) =>
                                  setIssueDrafts((current) => ({
                                    ...current,
                                    [issue.id]: {
                                      ...(current[issue.id] || { title: '', description: '', status: 'new', priority: 'medium', assignee: '' }),
                                      priority: event.currentTarget.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              >
                                <option value="low">low</option>
                                <option value="medium">medium</option>
                                <option value="high">high</option>
                                <option value="critical">critical</option>
                              </select>
                              <input
                                type="text"
                                value={issueDrafts[issue.id]?.assignee || ''}
                                onChange={(event) =>
                                  setIssueDrafts((current) => ({
                                    ...current,
                                    [issue.id]: {
                                      ...(current[issue.id] || { title: '', description: '', status: 'new', priority: 'medium', assignee: '' }),
                                      assignee: event.currentTarget.value,
                                    },
                                  }))
                                }
                                placeholder="Assignee"
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                              {issue.title}
                            </div>
                            {issue.description ? (
                              <div className="mt-1 text-sm text-primary-700 dark:text-neutral-300">
                                {issue.description}
                              </div>
                            ) : null}
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
                              {issue.status ? <span>{issue.status}</span> : null}
                              {issue.priority ? <span>{issue.priority}</span> : null}
                              {issue.assignee ? <span>{issue.assignee}</span> : null}
                              {typeof issue.stagnantDays === 'number' ? <span>{issue.stagnantDays}d stagnant</span> : null}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(['new', 'investigating', 'blocked', 'resolved'] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                post({
                                  kind: 'update-issue',
                                  issue: {
                                    id: issue.id,
                                    status,
                                  },
                                })
                              }
                              disabled={working}
                              className={`rounded-lg px-2 py-1 text-xs ${
                                issue.status === status
                                  ? 'bg-primary-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                  : 'border border-primary-200 bg-primary-50 text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                          {editingIssueId === issue.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveIssue(issue.id)}
                                disabled={working}
                                className="rounded-lg bg-primary-900 px-2 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelEditIssue()}
                                disabled={working}
                                className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                          <button
                            type="button"
                            onClick={() => beginEditIssue(issue)}
                            disabled={working}
                            className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                          >
                            Edit
                          </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              post({
                                kind: 'delete-issue',
                                issueId: issue.id,
                              })
                            }
                            disabled={working}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {(selectedMeeting.issues || []).length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        No issues recorded for this meeting.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                      Decisions
                    </div>
                    <button
                      type="button"
                      onClick={() => void sendDecisionsToTodo()}
                      disabled={working || (selectedMeeting.decisions || []).length === 0}
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      Send to To Do
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(selectedMeeting.decisions || []).map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        {editingDecisionId === decision.id ? (
                          <div className="grid gap-2">
                            <textarea
                              value={decisionDrafts[decision.id]?.text || ''}
                              onChange={(event) =>
                                setDecisionDrafts((current) => ({
                                  ...current,
                                  [decision.id]: {
                                    ...(current[decision.id] || { text: '', decisionMaker: '', impact: 'medium' }),
                                    text: event.currentTarget.value,
                                  },
                                }))
                              }
                              rows={3}
                              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                type="text"
                                value={decisionDrafts[decision.id]?.decisionMaker || ''}
                                onChange={(event) =>
                                  setDecisionDrafts((current) => ({
                                    ...current,
                                    [decision.id]: {
                                      ...(current[decision.id] || { text: '', decisionMaker: '', impact: 'medium' }),
                                      decisionMaker: event.currentTarget.value,
                                    },
                                  }))
                                }
                                placeholder="Decision maker"
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                              <select
                                value={decisionDrafts[decision.id]?.impact || 'medium'}
                                onChange={(event) =>
                                  setDecisionDrafts((current) => ({
                                    ...current,
                                    [decision.id]: {
                                      ...(current[decision.id] || { text: '', decisionMaker: '', impact: 'medium' }),
                                      impact: event.currentTarget.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              >
                                <option value="low">low</option>
                                <option value="medium">medium</option>
                                <option value="high">high</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                              {decision.text}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
                              {decision.decisionMaker ? <span>{decision.decisionMaker}</span> : null}
                              {decision.impact ? <span>{decision.impact}</span> : null}
                              {decision.date ? <span>{formatWhen(decision.date)}</span> : null}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(['low', 'medium', 'high'] as const).map((impact) => (
                            <button
                              key={impact}
                              type="button"
                              onClick={() =>
                                post({
                                  kind: 'update-decision',
                                  decision: {
                                    id: decision.id,
                                    impact,
                                  },
                                })
                              }
                              disabled={working}
                              className={`rounded-lg px-2 py-1 text-xs ${
                                decision.impact === impact
                                  ? 'bg-primary-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                  : 'border border-primary-200 bg-primary-50 text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                              }`}
                            >
                              {impact}
                            </button>
                          ))}
                          {editingDecisionId === decision.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveDecision(decision.id)}
                                disabled={working}
                                className="rounded-lg bg-primary-900 px-2 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelEditDecision()}
                                disabled={working}
                                className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEditDecision(decision)}
                              disabled={working}
                              className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              post({
                                kind: 'delete-decision',
                                decisionId: decision.id,
                              })
                            }
                            disabled={working}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {(selectedMeeting.decisions || []).length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        No decisions recorded for this meeting.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {data?.brief ? (
                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Carry-forward context
                  </div>
                  <div className="mt-3 text-sm text-primary-600 dark:text-neutral-400">
                    Related history and carry-forward items for overlapping participants.
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="grid gap-2">
                      {(data.brief.previousMeetings || []).map((meeting) => (
                        <button
                          key={meeting.id}
                          type="button"
                          onClick={() => pickMeeting(meeting.id)}
                          className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-left text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                        >
                          <div className="font-medium">{meeting.title}</div>
                          <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                            {formatWhen(meeting.date)} · {meeting.duration || 0} min
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2">
                      {(data.brief.openActionItems || []).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                        >
                          <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                            {item.text}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
                            <span>{item.assignee || 'Unassigned'}</span>
                            {item.priority ? <span>{item.priority}</span> : null}
                            {item.dueDate ? <span>Due {formatWhen(item.dueDate)}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-primary-500 dark:text-neutral-400">
              Meeting detail is not available yet.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
