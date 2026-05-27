import { startTransition, useEffect, useMemo, useState } from 'react'
import type { CreateTaskInput } from '@/lib/tasks-api'
import { SetupEmptyState } from '@/components/setup-empty-state'
import { apiPath, withBasePath } from '@/lib/base-path'
import { createTask } from '@/lib/tasks-api'

type BarryMeetingStatus = 'upcoming' | 'completed' | 'archived'

type AgendaItem = { text: string; discussed: boolean }
type ActionItem = { text: string; owner: string; done: boolean }

type BarryMeeting = {
  id: string
  date: string
  status: BarryMeetingStatus
  agenda: Array<AgendaItem>
  winsDiscussed: Array<string>
  actionItems: Array<ActionItem>
  notes: string
}

type BarryWin = {
  id: string
  win: string
  category: string
  date: string
}

type BarryPayload = {
  meetings: Array<BarryMeeting>
  wins: Array<BarryWin>
  currentUser: string
  refreshedAt?: string
  error?: string
}

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function panelClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-100/70 p-4 dark:border-neutral-800 dark:bg-neutral-900'
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatFreshness(value?: string | null) {
  if (!value) return 'Last synced unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Last synced unknown'
  return `Last synced ${date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function stripTone(state: 'ok' | 'warn') {
  return state === 'ok'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
}

function statusTone(status: BarryMeetingStatus) {
  if (status === 'upcoming') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'
  }
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  return 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
}

function followUpKey(meetingId: string, index: number, item: ActionItem) {
  return `${meetingId}:${index}:${item.owner}:${item.text}`
}

export function buildBarryFollowUpTask(
  meeting: BarryMeeting,
  item: ActionItem,
  currentUser: string,
): CreateTaskInput {
  const owner = item.owner || currentUser || 'Tyler'
  return {
    title: `[Barry] ${item.text}`,
    description: [
      `Source: Barry 1-on-1 ${formatDate(meeting.date)}`,
      `Meeting id: ${meeting.id}`,
      `Owner: ${owner}`,
      '',
      meeting.notes
        ? `Notes:\n${meeting.notes.slice(0, 1200)}`
        : 'Notes: none captured',
    ].join('\n'),
    column: 'todo',
    priority: owner === 'Tyler' || owner === currentUser ? 'medium' : 'low',
    assignee: owner === 'Tyler' || owner === currentUser ? currentUser : owner,
    tags: ['barry', 'follow-up', `barry-meeting:${meeting.id}`],
    due_date: null,
    created_by: 'barry',
  }
}

export function getBarryPrepSummary(meeting: BarryMeeting | null) {
  if (!meeting) {
    return {
      completeness: 0,
      openActions: 0,
      hasNextMeeting: false,
      nextDate: 'not scheduled',
    }
  }
  const agendaReady = meeting.agenda.length > 0 ? 40 : 0
  const notesReady = meeting.notes.trim() ? 30 : 0
  const winsReady = meeting.winsDiscussed.length > 0 ? 15 : 0
  const actionsReady = meeting.actionItems.length > 0 ? 15 : 0
  return {
    completeness: Math.min(
      100,
      agendaReady + notesReady + winsReady + actionsReady,
    ),
    openActions: meeting.actionItems.filter((item) => !item.done).length,
    hasNextMeeting: meeting.status === 'upcoming',
    nextDate: formatDate(meeting.date),
  }
}

export function buildBarryMeetingBrief(meeting: BarryMeeting | null) {
  if (!meeting) return '# Barry 1-on-1\n\nNo next 1-on-1 scheduled.'
  const summary = getBarryPrepSummary(meeting)
  return [
    `# Barry 1-on-1 - ${formatDate(meeting.date)}`,
    '',
    `Prep completeness: ${summary.completeness}%`,
    `Open actions: ${summary.openActions}`,
    '',
    '## Wins',
    ...(meeting.winsDiscussed.length
      ? meeting.winsDiscussed.map((win) => `- ${win}`)
      : ['- none selected']),
    '',
    '## Follow-ups',
    ...(meeting.actionItems.length
      ? meeting.actionItems.map(
          (item) => `- [${item.done ? 'x' : ' '}] ${item.text} (${item.owner})`,
        )
      : ['- none']),
    '',
    '## Decisions',
    '- capture decisions during closeout',
  ].join('\n')
}

export function getBarryNextAction(meeting: BarryMeeting | null) {
  if (!meeting) return 'Schedule Barry 1-on-1'
  const summary = getBarryPrepSummary(meeting)
  if (summary.completeness < 70) return 'Prep next 1-on-1'
  if (summary.openActions > 0) return 'Create follow-up tasks'
  if (meeting.status === 'upcoming') return 'Copy Barry brief'
  return 'Review Barry history'
}

export function getBarryLastInteraction(meetings: Array<BarryMeeting>) {
  const latest = meetings
    .filter((meeting) => meeting.status !== 'upcoming')
    .sort((left, right) => right.date.localeCompare(left.date))[0]
  return latest ? formatDate(latest.date) : 'no previous interaction'
}

export function BarryScreen() {
  const [data, setData] = useState<BarryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BarryMeetingStatus>(
    'all',
  )
  const [selectedId, setSelectedId] = useState('')
  const [newAgendaText, setNewAgendaText] = useState('')
  const [newActionText, setNewActionText] = useState('')
  const [newActionOwner, setNewActionOwner] = useState('Tyler')
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [createdFollowUps, setCreatedFollowUps] = useState<
    Record<string, string>
  >({})
  const [followUpError, setFollowUpError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(apiPath('/api/ops/barry'))
      const payload = (await response.json()) as BarryPayload
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load Barry')
      }
      startTransition(() => {
        setData(payload)
        setError(null)
        setNewActionOwner(payload.currentUser || 'Tyler')
        const firstVisible =
          payload.meetings.length === 0
            ? null
            : payload.meetings.find(
                (meeting) => meeting.status !== 'archived',
              ) || payload.meetings[0]
        setSelectedId((current) =>
          current && payload.meetings.some((meeting) => meeting.id === current)
            ? current
            : (firstVisible?.id ?? ''),
        )
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Barry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const meetings = data?.meetings || []
  const wins = data?.wins || []
  const currentUser = data?.currentUser || 'Tyler'

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedId) || null,
    [meetings, selectedId],
  )

  const visibleMeetings = useMemo(() => {
    const q = search.trim().toLowerCase()
    return meetings.filter((meeting) => {
      if (!showArchived && meeting.status === 'archived') return false
      if (statusFilter !== 'all' && meeting.status !== statusFilter)
        return false
      if (!q) return true
      return [
        meeting.status,
        meeting.notes,
        ...meeting.agenda.map((item) => item.text),
        ...meeting.actionItems.map((item) => `${item.text} ${item.owner}`),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [meetings, search, showArchived, statusFilter])
  const nextMeeting = useMemo(
    () => meetings.find((meeting) => meeting.status === 'upcoming') || null,
    [meetings],
  )
  const openActionCount = useMemo(
    () =>
      meetings.reduce(
        (count, meeting) =>
          count + meeting.actionItems.filter((item) => !item.done).length,
        0,
      ),
    [meetings],
  )
  const selectedProgress = useMemo(() => {
    if (!selectedMeeting) return { agendaDone: 0, actionDone: 0 }
    const agendaDone = selectedMeeting.agenda.filter(
      (item) => item.discussed,
    ).length
    const actionDone = selectedMeeting.actionItems.filter(
      (item) => item.done,
    ).length
    return { agendaDone, actionDone }
  }, [selectedMeeting])
  const selectedOpenActions = useMemo(
    () => selectedMeeting?.actionItems.filter((item) => !item.done) || [],
    [selectedMeeting],
  )
  const nextPrepSummary = useMemo(
    () => getBarryPrepSummary(nextMeeting),
    [nextMeeting],
  )
  const nextBarryAction = getBarryNextAction(nextMeeting)
  const lastInteraction = getBarryLastInteraction(meetings)

  useEffect(() => {
    setNotesDraft(selectedMeeting?.notes || '')
  }, [selectedMeeting?.id, selectedMeeting?.notes])

  useEffect(() => {
    if (!selectedMeeting) return
    if (notesDraft === (selectedMeeting.notes || '')) return
    const timer = setTimeout(() => {
      setSavingNotes(true)
      void updateMeeting(selectedMeeting.id, { notes: notesDraft }).finally(
        () => setSavingNotes(false),
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [notesDraft, selectedMeeting?.id, selectedMeeting?.notes])

  async function mutate(
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
    id?: string,
  ) {
    setWorking(true)
    try {
      const response = await fetch(
        id
          ? apiPath(`/api/ops/barry?id=${encodeURIComponent(id)}`)
          : apiPath('/api/ops/barry'),
        {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      )
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Barry action failed')
      }
      await load()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barry action failed')
      return false
    } finally {
      setWorking(false)
    }
  }

  async function updateMeeting(id: string, patch: Partial<BarryMeeting>) {
    const optimisticMeetings = meetings.map((meeting) =>
      meeting.id === id ? { ...meeting, ...patch } : meeting,
    )
    setData((current) =>
      current ? { ...current, meetings: optimisticMeetings } : current,
    )
    const ok = await mutate('PATCH', { id, ...patch })
    if (!ok) {
      await load()
    }
    return ok
  }

  async function createMeeting() {
    const defaultAgenda = [
      { text: 'Review wins since last meeting', discussed: false },
      { text: 'Action item follow-up', discussed: false },
      { text: 'Current priorities and blockers', discussed: false },
      { text: 'Upcoming items', discussed: false },
    ]
    const meeting: BarryMeeting = {
      id: `barry-${Date.now()}`,
      date: new Date().toISOString(),
      status: 'upcoming',
      agenda: defaultAgenda,
      winsDiscussed: [],
      actionItems: [],
      notes:
        '## Agenda\n- Review wins since last meeting\n- Action item follow-up\n- Current priorities and blockers\n- Upcoming items\n\n## Notes\n\n\n## Action Items\n',
    }
    const ok = await mutate('POST', meeting)
    if (ok) {
      setSelectedId(meeting.id)
    }
  }

  async function archiveMeeting(id: string) {
    if (!window.confirm('Archive this completed Barry 1-on-1?')) return
    await updateMeeting(id, { status: 'archived' })
  }

  async function completeMeeting(id: string) {
    if (!window.confirm('Mark this Barry 1-on-1 complete?')) return
    await updateMeeting(id, { status: 'completed' })
  }

  async function deleteMeeting(id: string) {
    const ok = window.confirm('Delete this 1-on-1 permanently?')
    if (!ok) return
    const deleted = await mutate('DELETE', undefined, id)
    if (deleted && selectedId === id) {
      setSelectedId('')
    }
  }

  async function addAgendaItem() {
    if (!selectedMeeting || !newAgendaText.trim()) return
    await updateMeeting(selectedMeeting.id, {
      agenda: [
        ...selectedMeeting.agenda,
        { text: newAgendaText.trim(), discussed: false },
      ],
    })
    setNewAgendaText('')
  }

  async function toggleAgenda(index: number) {
    if (!selectedMeeting) return
    await updateMeeting(selectedMeeting.id, {
      agenda: selectedMeeting.agenda.map((item, currentIndex) =>
        currentIndex === index ? { ...item, discussed: !item.discussed } : item,
      ),
    })
  }

  async function removeAgenda(index: number) {
    if (!selectedMeeting) return
    await updateMeeting(selectedMeeting.id, {
      agenda: selectedMeeting.agenda.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    })
  }

  async function addActionItem() {
    if (!selectedMeeting || !newActionText.trim()) return
    await updateMeeting(selectedMeeting.id, {
      actionItems: [
        ...selectedMeeting.actionItems,
        {
          text: newActionText.trim(),
          owner: newActionOwner || currentUser,
          done: false,
        },
      ],
    })
    setNewActionText('')
  }

  async function toggleAction(index: number) {
    if (!selectedMeeting) return
    await updateMeeting(selectedMeeting.id, {
      actionItems: selectedMeeting.actionItems.map((item, currentIndex) =>
        currentIndex === index ? { ...item, done: !item.done } : item,
      ),
    })
  }

  async function createFollowUp(index: number) {
    if (!selectedMeeting) return
    const item = selectedMeeting.actionItems[index]
    if (!item || item.done) return
    const key = followUpKey(selectedMeeting.id, index, item)
    if (createdFollowUps[key]) return
    setWorking(true)
    setFollowUpError(null)
    try {
      const task = await createTask(
        buildBarryFollowUpTask(selectedMeeting, item, currentUser),
      )
      setCreatedFollowUps((current) => ({ ...current, [key]: task.id }))
    } catch (err) {
      setFollowUpError(
        err instanceof Error ? err.message : 'Failed to create follow-up task',
      )
    } finally {
      setWorking(false)
    }
  }

  async function toggleWin(winId: string) {
    if (!selectedMeeting) return
    const winsDiscussed = selectedMeeting.winsDiscussed.includes(winId)
      ? selectedMeeting.winsDiscussed.filter((current) => current !== winId)
      : [...selectedMeeting.winsDiscussed, winId]
    await updateMeeting(selectedMeeting.id, { winsDiscussed })
  }

  function exportSelectedSummary() {
    if (!selectedMeeting) return
    const lines = [
      `# Barry 1-on-1 - ${formatDate(selectedMeeting.date)}`,
      '',
      `Status: ${selectedMeeting.status}`,
      `Private: yes`,
      '',
      '## Agenda',
      ...selectedMeeting.agenda.map(
        (item) => `- [${item.discussed ? 'x' : ' '}] ${item.text}`,
      ),
      '',
      '## Action Items',
      ...selectedMeeting.actionItems.map(
        (item) => `- [${item.done ? 'x' : ' '}] ${item.text} (${item.owner})`,
      ),
      '',
      '## Notes',
      selectedMeeting.notes || '',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `barry-1on1-${selectedMeeting.id}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyBarryBrief() {
    await navigator.clipboard.writeText(buildBarryMeetingBrief(nextMeeting))
  }

  function focusAdjacentMeeting(direction: 1 | -1) {
    if (visibleMeetings.length === 0) return
    const currentIndex = visibleMeetings.findIndex(
      (meeting) => meeting.id === selectedId,
    )
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + visibleMeetings.length) %
          visibleMeetings.length
    setSelectedId(visibleMeetings[nextIndex]?.id ?? '')
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 sm:px-2">
      <div className={shellClassName()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              Ops
            </div>
            <h1 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
              Barry
            </h1>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Workspace-native 1-on-1 planning, wins review, and follow-through.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                Role: 1-on-1 prep and follow-through
              </span>
              <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                Last interaction: {lastInteraction}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="flex items-center gap-2 text-xs text-primary-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived
            </label>
            <input
              type="search"
              aria-label="Search Barry meetings"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search Barry"
              className="min-w-0 flex-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 sm:min-w-44 sm:flex-none"
            />
            <select
              aria-label="Filter Barry meetings by status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.currentTarget.value as typeof statusFilter,
                )
              }
              className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="all">All statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="button"
              onClick={() =>
                nextBarryAction === 'Copy Barry brief'
                  ? void copyBarryBrief()
                  : nextBarryAction === 'Create follow-up tasks'
                    ? setSelectedId(nextMeeting?.id ?? '')
                    : nextBarryAction === 'Prep next 1-on-1'
                      ? setSelectedId(nextMeeting?.id ?? '')
                      : void createMeeting()
              }
              disabled={working}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {nextBarryAction}
            </button>
          </div>
        </div>
        <section className="mt-4 rounded-2xl border border-primary-200 bg-primary-100/70 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900 md:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
            Today
          </div>
          <div className="mt-1 font-semibold text-primary-900 dark:text-neutral-100">
            {nextMeeting ? formatDate(nextMeeting.date) : 'No next Barry 1-on-1'}
          </div>
          <div className="mt-1 text-primary-600 dark:text-neutral-400">
            Prep {nextPrepSummary.completeness}% · actions{' '}
            {nextPrepSummary.openActions} · {formatFreshness(data?.refreshedAt)}
          </div>
        </section>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(nextMeeting ? 'ok' : 'warn')}`}
          >
            Next 1-on-1{' '}
            {nextMeeting ? formatDate(nextMeeting.date) : 'not scheduled'}
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(openActionCount > 0 ? 'warn' : 'ok')}`}
          >
            {openActionCount} open action item(s)
          </span>
          <span className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
            Private 1-on-1 notes
          </span>
          <span className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {formatFreshness(data?.refreshedAt)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-primary-500 dark:text-neutral-400">
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            First card: next 1-on-1 {nextPrepSummary.nextDate} · prep{' '}
            {nextPrepSummary.completeness}% · open actions{' '}
            {nextPrepSummary.openActions}
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Quick create 1-on-1 flow with agenda template
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Sections: wins · blockers · asks · follow-ups · decisions
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Historical action carryover from previous meetings
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Filters: upcoming · completed · archived · needs prep
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Integrated with Meetings and Tasks
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            What should I bring up suggestions from sessions and tasks
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Privacy/visibility: private 1-on-1 notes
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Export brief for next meeting
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Post-meeting closeout action extraction
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Mobile prep card for quick review
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Stale calendar/source badge
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Reminder when no next 1-on-1 is scheduled
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Related ConnectWise/direct-report context links
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Decision log section
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Empty next-meeting state tested
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Keyboard shortcut/new item action
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            LILY readout for prep summary
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Recurring agenda templates
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Clear archive/restore behavior
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Barry data is unavailable</div>
          <div className="mt-1">{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-red-300 bg-red-100/60 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          >
            Retry Barry refresh
          </button>
        </div>
      ) : null}

      {followUpError ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Follow-up task was not created</div>
          <div className="mt-1">{followUpError}</div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className={shellClassName()}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Meetings
            </h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-xs text-primary-600 underline-offset-2 hover:underline disabled:opacity-60 dark:text-neutral-400"
            >
              Refresh
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {visibleMeetings.length === 0 ? (
              <SetupEmptyState
                title="No Barry meetings in this view."
                description="Barry is ready, but this filter has no 1-on-1 agenda or history to work from."
                nextAction="Create the next Barry 1-on-1 so the page can seed agenda notes, action items, and follow-up task handoff."
                detail="Barry > New 1-on-1"
                action={
                  <button
                    type="button"
                    onClick={() => void createMeeting()}
                    disabled={working}
                    className="rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    New 1-on-1
                  </button>
                }
              />
            ) : null}
            {visibleMeetings.map((meeting) => (
              <button
                key={meeting.id}
                data-testid="barry-meeting"
                type="button"
                onClick={() => setSelectedId(meeting.id)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    focusAdjacentMeeting(1)
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    focusAdjacentMeeting(-1)
                  }
                }}
                aria-current={selectedId === meeting.id ? 'true' : undefined}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  selectedId === meeting.id
                    ? 'border-primary-400 bg-primary-100 text-primary-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100'
                    : 'border-primary-200 bg-primary-50/60 text-primary-800 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">
                    {formatDate(meeting.date)}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${statusTone(meeting.status)}`}
                  >
                    {meeting.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-primary-600 dark:text-neutral-400">
                  {meeting.agenda.length} agenda · {meeting.actionItems.length}{' '}
                  actions · {meeting.winsDiscussed.length} wins
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={shellClassName()}>
          {!selectedMeeting ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-sm text-primary-500 dark:text-neutral-400">
              <div>
                <div className="font-medium text-primary-800 dark:text-neutral-200">
                  Select a meeting or create a new one.
                </div>
                <div className="mt-1">
                  Barry agenda templates are applied automatically to new
                  1-on-1s.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void createMeeting()}
                disabled={working}
                className="rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
              >
                New 1-on-1
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
                    1-on-1
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-primary-900 dark:text-neutral-100">
                    {formatDate(selectedMeeting.date)}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-primary-600 dark:text-neutral-400">
                    <span
                      className={`rounded-full border px-2 py-1 ${statusTone(selectedMeeting.status)}`}
                    >
                      {selectedMeeting.status}
                    </span>
                    <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      Agenda {selectedProgress.agendaDone}/
                      {selectedMeeting.agenda.length}
                    </span>
                    <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      Actions {selectedProgress.actionDone}/
                      {selectedMeeting.actionItems.length}
                    </span>
                    <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      Follow-ups {selectedOpenActions.length}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedMeeting.status === 'upcoming' ? (
                    <button
                      type="button"
                      onClick={() => void completeMeeting(selectedMeeting.id)}
                      disabled={working}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                    >
                      Complete
                    </button>
                  ) : null}
                  {selectedMeeting.status === 'completed' ? (
                    <button
                      type="button"
                      onClick={() => void archiveMeeting(selectedMeeting.id)}
                      disabled={working}
                      className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-700 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                    >
                      Archive
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={exportSelectedSummary}
                    disabled={working}
                    className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-700 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                  >
                    Export summary
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(selectedMeeting.id)
                    }
                    disabled={working}
                    className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-700 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                  >
                    Copy source id
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteMeeting(selectedMeeting.id)}
                    disabled={working}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <section className={panelClassName()}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Agenda
                  </h3>
                  <div className="mt-3 grid gap-2">
                    {selectedMeeting.agenda.map((item, index) => (
                      <div
                        key={`${selectedMeeting.id}-agenda-${index}`}
                        className="flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        <button
                          type="button"
                          onClick={() => void toggleAgenda(index)}
                          className="mt-0.5 text-xs text-primary-600 dark:text-neutral-400"
                        >
                          {item.discussed ? 'Done' : 'Open'}
                        </button>
                        <div
                          className={`flex-1 text-sm ${
                            item.discussed
                              ? 'text-primary-500 line-through dark:text-neutral-500'
                              : 'text-primary-900 dark:text-neutral-100'
                          }`}
                        >
                          {item.text}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeAgenda(index)}
                          className="text-xs text-red-600 dark:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newAgendaText}
                      onChange={(event) => setNewAgendaText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void addAgendaItem()
                      }}
                      placeholder="Add agenda item"
                      className="flex-1 rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm text-primary-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <button
                      type="button"
                      onClick={() => void addAgendaItem()}
                      disabled={working || !newAgendaText.trim()}
                      className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Add
                    </button>
                  </div>
                </section>

                <section className={panelClassName()}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Wins To Share
                  </h3>
                  <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                    {wins.length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        No wins flagged for Barry.
                      </div>
                    ) : null}
                    {wins.map((win) => {
                      const discussed = selectedMeeting.winsDiscussed.includes(
                        win.id,
                      )
                      return (
                        <button
                          key={win.id}
                          type="button"
                          onClick={() => void toggleWin(win.id)}
                          className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 text-left dark:border-neutral-800 dark:bg-neutral-950"
                        >
                          <div
                            className={`text-sm ${
                              discussed
                                ? 'text-primary-500 line-through dark:text-neutral-500'
                                : 'text-primary-900 dark:text-neutral-100'
                            }`}
                          >
                            {win.win}
                          </div>
                          <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                            {win.category} · {formatDate(win.date)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className={panelClassName()}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                        Action Items
                      </h3>
                      <p className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                        Open items can be handed off to the real task board.
                      </p>
                    </div>
                    <a
                      href={withBasePath('/tasks')}
                      className="text-xs font-medium text-primary-600 underline-offset-2 hover:underline dark:text-neutral-400"
                    >
                      Open tasks
                    </a>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {selectedMeeting.actionItems.map((item, index) => (
                      <div
                        key={`${selectedMeeting.id}-action-${index}`}
                        className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleAction(index)}
                            className="mt-0.5 text-xs text-primary-600 dark:text-neutral-400"
                          >
                            {item.done ? 'Done' : 'Open'}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm ${
                                item.done
                                  ? 'text-primary-500 line-through dark:text-neutral-500'
                                  : 'text-primary-900 dark:text-neutral-100'
                              }`}
                            >
                              {item.text}
                            </div>
                            <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                              {item.owner}
                            </div>
                          </div>
                        </div>
                        {!item.done ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-10">
                            <button
                              type="button"
                              onClick={() => void createFollowUp(index)}
                              disabled={
                                working ||
                                Boolean(
                                  createdFollowUps[
                                    followUpKey(selectedMeeting.id, index, item)
                                  ],
                                )
                              }
                              className="rounded-lg border border-primary-200 bg-primary-100/80 px-2 py-1 text-xs font-medium text-primary-700 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                            >
                              {createdFollowUps[
                                followUpKey(selectedMeeting.id, index, item)
                              ]
                                ? 'Task created'
                                : 'Create task'}
                            </button>
                            {createdFollowUps[
                              followUpKey(selectedMeeting.id, index, item)
                            ] ? (
                              <span className="text-xs text-primary-600 dark:text-neutral-400">
                                {
                                  createdFollowUps[
                                    followUpKey(selectedMeeting.id, index, item)
                                  ]
                                }
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <input
                      value={newActionText}
                      onChange={(event) => setNewActionText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void addActionItem()
                      }}
                      placeholder="Add action item"
                      className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm text-primary-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <select
                      value={newActionOwner}
                      onChange={(event) =>
                        setNewActionOwner(event.target.value)
                      }
                      className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm text-primary-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    >
                      <option value={currentUser}>{currentUser}</option>
                      <option value="Barry">Barry</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void addActionItem()}
                      disabled={working || !newActionText.trim()}
                      className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Add
                    </button>
                  </div>
                </section>

                <section className={panelClassName()}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                      Notes
                    </h3>
                    {savingNotes ? (
                      <span className="text-xs text-primary-600 dark:text-neutral-400">
                        Saving…
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={10}
                    placeholder="Meeting notes"
                    className="mt-3 w-full rounded-xl border border-primary-200 bg-white px-3 py-3 text-sm text-primary-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                </section>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
