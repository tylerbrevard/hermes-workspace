import { startTransition, useEffect, useMemo, useState } from 'react'
import { apiPath } from '@/lib/base-path'

type BarryMeetingStatus = 'upcoming' | 'completed' | 'archived'

type AgendaItem = { text: string; discussed: boolean }
type ActionItem = { text: string; owner: string; done: boolean }

type BarryMeeting = {
  id: string
  date: string
  status: BarryMeetingStatus
  agenda: AgendaItem[]
  winsDiscussed: string[]
  actionItems: ActionItem[]
  notes: string
}

type BarryWin = {
  id: string
  win: string
  category: string
  date: string
}

type BarryPayload = {
  meetings: BarryMeeting[]
  wins: BarryWin[]
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

function statusTone(status: BarryMeetingStatus) {
  if (status === 'upcoming') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'
  }
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  return 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
}

export function BarryScreen() {
  const [data, setData] = useState<BarryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [newAgendaText, setNewAgendaText] = useState('')
  const [newActionText, setNewActionText] = useState('')
  const [newActionOwner, setNewActionOwner] = useState('Tyler')
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

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
          payload.meetings.find((meeting) => meeting.status !== 'archived') ||
          payload.meetings[0]
        setSelectedId((current) =>
          current && payload.meetings.some((meeting) => meeting.id === current)
            ? current
            : (firstVisible?.id ?? '')
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

  const visibleMeetings = useMemo(
    () =>
      meetings.filter((meeting) => (showArchived ? true : meeting.status !== 'archived')),
    [meetings, showArchived],
  )

  useEffect(() => {
    setNotesDraft(selectedMeeting?.notes || '')
  }, [selectedMeeting?.id, selectedMeeting?.notes])

  useEffect(() => {
    if (!selectedMeeting) return
    if (notesDraft === (selectedMeeting.notes || '')) return
    const timer = setTimeout(() => {
      setSavingNotes(true)
      void updateMeeting(selectedMeeting.id, { notes: notesDraft }).finally(() =>
        setSavingNotes(false),
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
      const response = await fetch(id ? apiPath(`/api/ops/barry?id=${encodeURIComponent(id)}`) : apiPath('/api/ops/barry'), {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
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
    await updateMeeting(id, { status: 'archived' })
  }

  async function completeMeeting(id: string) {
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
        currentIndex === index
          ? { ...item, discussed: !item.discussed }
          : item,
      ),
    })
  }

  async function removeAgenda(index: number) {
    if (!selectedMeeting) return
    await updateMeeting(selectedMeeting.id, {
      agenda: selectedMeeting.agenda.filter((_, currentIndex) => currentIndex !== index),
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

  async function toggleWin(winId: string) {
    if (!selectedMeeting) return
    const winsDiscussed = selectedMeeting.winsDiscussed.includes(winId)
      ? selectedMeeting.winsDiscussed.filter((current) => current !== winId)
      : [...selectedMeeting.winsDiscussed, winId]
    await updateMeeting(selectedMeeting.id, { winsDiscussed })
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
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-primary-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived
            </label>
            <button
              type="button"
              onClick={() => void createMeeting()}
              disabled={working}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
            >
              New 1-on-1
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
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
              <div className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-4 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                No meetings yet.
              </div>
            ) : null}
            {visibleMeetings.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => setSelectedId(meeting.id)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  selectedId === meeting.id
                    ? 'border-primary-400 bg-primary-100 text-primary-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100'
                    : 'border-primary-200 bg-primary-50/60 text-primary-800 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{formatDate(meeting.date)}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${statusTone(meeting.status)}`}>
                    {meeting.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-primary-600 dark:text-neutral-400">
                  {meeting.agenda.length} agenda · {meeting.actionItems.length} actions ·{' '}
                  {meeting.winsDiscussed.length} wins
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={shellClassName()}>
          {!selectedMeeting ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-primary-500 dark:text-neutral-400">
              Select a meeting or create a new one.
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
                      const discussed = selectedMeeting.winsDiscussed.includes(win.id)
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
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Action Items
                  </h3>
                  <div className="mt-3 grid gap-2">
                    {selectedMeeting.actionItems.map((item, index) => (
                      <div
                        key={`${selectedMeeting.id}-action-${index}`}
                        className="flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        <button
                          type="button"
                          onClick={() => void toggleAction(index)}
                          className="mt-0.5 text-xs text-primary-600 dark:text-neutral-400"
                        >
                          {item.done ? 'Done' : 'Open'}
                        </button>
                        <div className="flex-1">
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
                      onChange={(event) => setNewActionOwner(event.target.value)}
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
