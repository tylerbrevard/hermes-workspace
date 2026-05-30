import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  buildMeetingActionTodoItems,
  buildMeetingBriefMarkdown,
  buildMeetingExtractionSummary,
  formatMeetingTitle,
  getMeetingEmptyState,
  getMeetingSeverity,
  getMeetingTrendInterpretation,
  isMeetingPrepWindow,
  isUnresolvedStatus,
  meetingMatchesReviewFilter,
  meetingMatchesSearch,
  participantList,
} from './lib/meeting-workflow'
import {
  MeetingCockpitSection,
  MeetingHeatmapSection,
  MeetingListsSection,
  MeetingMobileAgendaSection,
  MeetingPrepAndCommitmentsSection,
  MeetingSummaryStats,
  MeetingsHeaderSection,
} from './meeting-sections'
import {
  compactText,
  formatWhen,
  shellClassName,
  stripTone,
  toneForType,
} from './meeting-ui'
import type { ActionDraft, DecisionDraft, IssueDraft } from './meeting-ui'
import type {
  Meeting,
  MeetingCockpitAction,
  MeetingReviewFilter,
  MeetingsData,
} from './lib/meeting-workflow'

export function MeetingsScreen() {
  const [data, setData] = useState<MeetingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reviewFilter, setReviewFilter] = useState<MeetingReviewFilter>('all')
  const [redactBrief, setRedactBrief] = useState(true)
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')
  const [newActionItemText, setNewActionItemText] = useState('')
  const [editingActionItemId, setEditingActionItemId] = useState<string | null>(
    null,
  )
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null)
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(
    null,
  )
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>(
    {},
  )
  const [issueDrafts, setIssueDrafts] = useState<Record<string, IssueDraft>>({})
  const [decisionDrafts, setDecisionDrafts] = useState<
    Record<string, DecisionDraft>
  >({})
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
        setSelectedMeetingId(
          (current) => current || payload.selectedMeetingId || '',
        )
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
      setError(
        err instanceof Error ? err.message : 'Failed to load meeting detail',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedMeetingId) return
    void loadSelectedMeeting(selectedMeetingId)
  }, [selectedMeetingId])

  const unreviewedIds = useMemo(
    () =>
      (data?.meetings || [])
        .filter((meeting) => !meeting.reviewed)
        .map((meeting) => meeting.id),
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
  const meetingBrief = data?.brief || null
  const previousMeetings = meetingBrief?.previousMeetings || []
  const openActionItems = meetingBrief?.openActionItems || []
  const nextMeeting = data?.todayMeetings?.[0] || data?.meetings?.[0] || null
  const selectedOpenActionItems = (selectedMeeting?.actionItems || []).filter(
    (item) => isUnresolvedStatus(item.status),
  )
  const selectedOpenIssues = (selectedMeeting?.issues || []).filter((issue) =>
    isUnresolvedStatus(issue.status),
  )
  const nextNeedsPrep = isMeetingPrepWindow(nextMeeting)
  const selectedSeverity = selectedMeeting
    ? getMeetingSeverity(selectedMeeting)
    : 'attention'
  const trendInterpretation = getMeetingTrendInterpretation(data?.heatmapDays)
  const actionTodoItems = buildMeetingActionTodoItems(
    selectedMeeting,
    data?.brief?.openActionItems || [],
  )
  const unresolvedCommitmentCount =
    openActionItems.length +
    selectedOpenActionItems.length +
    selectedOpenIssues.length
  const extractionSummary = useMemo(
    () => buildMeetingExtractionSummary(selectedMeeting),
    [selectedMeeting],
  )
  const visibleRecentMeetings = useMemo(
    () =>
      (data?.meetings || []).filter((meeting) => {
        return (
          meetingMatchesReviewFilter(meeting, reviewFilter) &&
          meetingMatchesSearch(meeting, deferredSearch)
        )
      }),
    [data?.meetings, deferredSearch, reviewFilter],
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

  function activateMeetingCockpit(action: MeetingCockpitAction) {
    if (action === 'sync') {
      void post({ kind: 'force-sync' })
      return
    }
    if (action === 'prep') {
      if (nextMeeting) pickMeeting(nextMeeting.id)
      else setReviewFilter('no-prep')
      return
    }
    if (action === 'follow-up') {
      setReviewFilter('needs-follow-up')
      return
    }
    if (action === 'review') {
      setReviewFilter('needs-review')
      return
    }
    setReviewFilter('today')
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
    const items = buildMeetingActionTodoItems(
      selectedMeeting,
      data?.brief?.openActionItems || [],
    )
    if (items.length === 0) return
    if (
      !window.confirm(`Send ${items.length} meeting action item(s) to To Do?`)
    )
      return
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
    if (!window.confirm(`Send ${items.length} meeting issue(s) to To Do?`))
      return
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
    if (!window.confirm(`Send ${items.length} meeting decision(s) to To Do?`))
      return
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
    if (
      !window.confirm(
        'Extract action items, issues, and decisions from the five most recent meetings?',
      )
    )
      return
    await post({
      kind: 'auto-extract-recent',
      limit: 5,
    })
  }

  async function exportMeetingBrief() {
    const markdown = buildMeetingBriefMarkdown(selectedMeeting, {
      redactParticipants: redactBrief,
    })
    try {
      await navigator.clipboard.writeText(markdown)
    } catch {
      // Clipboard is best-effort; the generated brief is still available in UI.
    }
  }

  function beginEditActionItem(
    item: NonNullable<Meeting['actionItems']>[number],
  ) {
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

  function beginEditDecision(
    decision: NonNullable<Meeting['decisions']>[number],
  ) {
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-1 pb-[calc(var(--tabbar-h,0px)+12px)] sm:gap-4 sm:px-2 sm:pb-6">
      <MeetingsHeaderSection
        search={search}
        reviewFilter={reviewFilter}
        working={working}
        unreviewedCount={unreviewedIds.length}
        redactBrief={redactBrief}
        error={error}
        data={data}
        nextMeeting={nextMeeting}
        extractionSummary={extractionSummary}
        selectedMeeting={selectedMeeting}
        selectedSeverity={selectedSeverity}
        selectedMeetingId={selectedMeetingId}
        detailLoading={detailLoading}
        onSearchChange={setSearch}
        onReviewFilterChange={(value) =>
          setReviewFilter(value as MeetingReviewFilter)
        }
        onForceSync={() => {
          if (window.confirm('Force a fresh Graph meeting sync now?')) {
            void post({ kind: 'force-sync' })
          }
        }}
        onAutoExtractRecent={() => void autoExtractRecent()}
        onBulkReview={() => {
          if (
            window.confirm(
              `Mark ${unreviewedIds.length} unreviewed meeting(s) reviewed?`,
            )
          ) {
            void post({ kind: 'bulk-review', meetingIds: unreviewedIds })
          }
        }}
        onExportBrief={() => void exportMeetingBrief()}
        onRedactBriefChange={setRedactBrief}
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-primary-200 bg-primary-100/70 dark:border-neutral-800 dark:bg-neutral-900"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Meetings unavailable</div>
          <div className="mt-1">{error}</div>
          <div className="mt-1">{getMeetingEmptyState(error)}</div>
          <button
            type="button"
            onClick={() => void load(true)}
            className="mt-3 rounded-xl border border-red-300 bg-red-100/60 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}
      {data?.graphWarning || data?.dataWarning ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {data.graphWarning || data.dataWarning}
        </div>
      ) : null}

      {!loading ? (
        <MeetingCockpitSection
          data={data}
          nextMeeting={nextMeeting}
          nextNeedsPrep={nextNeedsPrep}
          unresolvedCommitmentCount={unresolvedCommitmentCount}
          unreviewedCount={unreviewedIds.length}
          onActivate={activateMeetingCockpit}
        />
      ) : null}

      <MeetingMobileAgendaSection
        nextMeeting={nextMeeting}
        nextNeedsPrep={nextNeedsPrep}
        openActionItems={openActionItems}
        selectedOpenActionItems={selectedOpenActionItems}
        unresolvedCommitmentCount={unresolvedCommitmentCount}
        onPickMeeting={pickMeeting}
      />

      <div className="hidden md:contents">
        <MeetingPrepAndCommitmentsSection
          nextMeeting={nextMeeting}
          nextNeedsPrep={nextNeedsPrep}
          meetingBrief={meetingBrief}
          openActionItems={openActionItems}
          previousMeetings={previousMeetings}
          selectedOpenActionItems={selectedOpenActionItems}
          selectedOpenIssues={selectedOpenIssues}
          unresolvedCommitmentCount={unresolvedCommitmentCount}
          actionTodoItemsCount={actionTodoItems.length}
          working={working}
          onPickMeeting={pickMeeting}
          onRefresh={() => void load(true)}
          onSendOpenItems={() => void sendOpenActionItemsToTodo()}
        />

        <MeetingSummaryStats
          data={data}
          unreviewedCount={unreviewedIds.length}
        />

        <MeetingListsSection
          data={data}
          loading={loading}
          selectedMeetingId={selectedMeetingId}
          visibleRecentMeetings={visibleRecentMeetings}
          working={working}
          onPickMeeting={pickMeeting}
          onRefresh={() => void load(true)}
          onShowAll={() => setReviewFilter('all')}
          onToggleReviewed={(meeting) =>
            void post({
              kind: 'set-reviewed',
              meetingId: meeting.id,
              reviewed: !meeting.reviewed,
            })
          }
        />
      </div>

      <div className="hidden gap-4 md:grid xl:grid-cols-[0.75fr_1.25fr]">
        <MeetingHeatmapSection
          heatmapDays={data?.heatmapDays || []}
          trendInterpretation={trendInterpretation}
        />

        <section className={shellClassName()}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Selected
            </h2>
            <div className="text-xs text-primary-500 dark:text-neutral-400">
              {detailLoading
                ? 'Refreshing…'
                : selectedMeeting
                  ? compactText(formatMeetingTitle(selectedMeeting.title), 30)
                  : meetingBrief?.meetingTitle
                    ? compactText(
                        formatMeetingTitle(meetingBrief.meetingTitle),
                        30,
                      )
                    : 'Pick'}
            </div>
          </div>

          {selectedMeeting ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="text-sm text-primary-600 dark:text-neutral-400">
                  {formatWhen(selectedMeeting.date)} ·{' '}
                  {selectedMeeting.duration || 0}m
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-1 ${toneForType(selectedMeeting.type)}`}
                  >
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
                      Review
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-2 py-1 ${stripTone(selectedSeverity === 'ok' ? 'ok' : selectedSeverity === 'blocked' ? 'bad' : 'warn')}`}
                  >
                    {selectedSeverity}
                  </span>
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
                      Extract
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void sendOpenActionItemsToTodo()}
                    disabled={working || actionTodoItems.length === 0}
                    className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                  >
                    To Do
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
                    Reviewed
                  </button>
                  {selectedMeeting.joinUrl ? (
                    <a
                      href={selectedMeeting.joinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      Join
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(selectedMeeting.id)
                    }
                    className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                  >
                    ID
                  </button>
                </div>
                {selectedMeeting.content ? (
                  <details className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 p-3 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                      Notes
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap break-words">
                      {selectedMeeting.content}
                    </div>
                  </details>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {participantList(selectedMeeting)
                    .slice(0, 4)
                    .map((participant) => (
                      <span
                        key={participant}
                        className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-[11px] text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                      >
                        {participant}
                      </span>
                    ))}
                  {participantList(selectedMeeting).length > 4 ? (
                    <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-[11px] text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                      +{participantList(selectedMeeting).length - 4}
                    </span>
                  ) : null}
                </div>
              </div>

              <details className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                        Detail
                      </div>
                      <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                        Actions, risks, decisions, and carry-forward context.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                        {(selectedMeeting.actionItems || []).length} actions
                      </span>
                      <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                        {(selectedMeeting.issues || []).length} risks
                      </span>
                      <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                        {(selectedMeeting.decisions || []).length} decisions
                      </span>
                    </div>
                  </div>
                </summary>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Prior
                  </div>
                  <div className="mt-3 grid gap-2">
                    {previousMeetings.slice(0, 3).map((meeting) => (
                      <div
                        key={meeting.id}
                        className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-left text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                      >
                        <button
                          type="button"
                          onClick={() => pickMeeting(meeting.id)}
                          className="font-medium text-primary-900 dark:text-neutral-100"
                        >
                          {compactText(formatMeetingTitle(meeting.title), 24)}
                        </button>
                        <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                          {formatWhen(meeting.date)} · {meeting.duration || 0}{' '}
                          m
                        </div>
                      </div>
                    ))}
                    {previousMeetings.length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        No history.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Actions
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={newActionItemText}
                      onChange={(event) =>
                        setNewActionItemText(event.currentTarget.value)
                      }
                      placeholder={
                        selectedMeeting
                          ? `Add action for ${compactText(formatMeetingTitle(selectedMeeting.title), 28)}`
                          : 'Add action item'
                      }
                      className="w-full rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <button
                      type="button"
                      onClick={() => void createActionItem()}
                      disabled={
                        working ||
                        !selectedMeetingId ||
                        !newActionItemText.trim()
                      }
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
                                    ...(current[item.id] || {
                                      text: '',
                                      assignee: '',
                                      priority: 'medium',
                                      dueDate: '',
                                    }),
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
                                      ...(current[item.id] || {
                                        text: '',
                                        assignee: '',
                                        priority: 'medium',
                                        dueDate: '',
                                      }),
                                      assignee: event.currentTarget.value,
                                    },
                                  }))
                                }
                                placeholder="Assignee"
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                              <select
                                value={
                                  actionDrafts[item.id]?.priority || 'medium'
                                }
                                onChange={(event) =>
                                  setActionDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...(current[item.id] || {
                                        text: '',
                                        assignee: '',
                                        priority: 'medium',
                                        dueDate: '',
                                      }),
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
                                      ...(current[item.id] || {
                                        text: '',
                                        assignee: '',
                                        priority: 'medium',
                                        dueDate: '',
                                      }),
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
                              <span>{item.assignee || 'Open'}</span>
                              {item.priority ? (
                                <span>{item.priority}</span>
                              ) : null}
                              {item.dueDate ? (
                                <span>{formatWhen(item.dueDate)}</span>
                              ) : null}
                              {item.status ? <span>{item.status}</span> : null}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(
                            [
                              'open',
                              'in-progress',
                              'blocked',
                              'completed',
                            ] as const
                          ).map((status) => (
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
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                    {(selectedMeeting.actionItems || []).length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        Clear.
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
                      disabled={
                        working || (selectedMeeting.issues || []).length === 0
                      }
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      To Do
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
                                    ...(current[issue.id] || {
                                      title: '',
                                      description: '',
                                      status: 'new',
                                      priority: 'medium',
                                      assignee: '',
                                    }),
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
                                    ...(current[issue.id] || {
                                      title: '',
                                      description: '',
                                      status: 'new',
                                      priority: 'medium',
                                      assignee: '',
                                    }),
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
                                      ...(current[issue.id] || {
                                        title: '',
                                        description: '',
                                        status: 'new',
                                        priority: 'medium',
                                        assignee: '',
                                      }),
                                      status: event.currentTarget.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              >
                                <option value="new">new</option>
                                <option value="investigating">
                                  investigating
                                </option>
                                <option value="blocked">blocked</option>
                                <option value="resolved">resolved</option>
                              </select>
                              <select
                                value={
                                  issueDrafts[issue.id]?.priority || 'medium'
                                }
                                onChange={(event) =>
                                  setIssueDrafts((current) => ({
                                    ...current,
                                    [issue.id]: {
                                      ...(current[issue.id] || {
                                        title: '',
                                        description: '',
                                        status: 'new',
                                        priority: 'medium',
                                        assignee: '',
                                      }),
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
                                      ...(current[issue.id] || {
                                        title: '',
                                        description: '',
                                        status: 'new',
                                        priority: 'medium',
                                        assignee: '',
                                      }),
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
                              {issue.status ? (
                                <span>{issue.status}</span>
                              ) : null}
                              {issue.priority ? (
                                <span>{issue.priority}</span>
                              ) : null}
                              {issue.assignee ? (
                                <span>{issue.assignee}</span>
                              ) : null}
                              {typeof issue.stagnantDays === 'number' ? (
                                <span>{issue.stagnantDays}d stagnant</span>
                              ) : null}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(
                            [
                              'new',
                              'investigating',
                              'blocked',
                              'resolved',
                            ] as const
                          ).map((status) => (
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
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                    {(selectedMeeting.issues || []).length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        Clear.
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
                      disabled={
                        working ||
                        (selectedMeeting.decisions || []).length === 0
                      }
                      className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs text-primary-800 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      To Do
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
                                    ...(current[decision.id] || {
                                      text: '',
                                      decisionMaker: '',
                                      impact: 'medium',
                                    }),
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
                                value={
                                  decisionDrafts[decision.id]?.decisionMaker ||
                                  ''
                                }
                                onChange={(event) =>
                                  setDecisionDrafts((current) => ({
                                    ...current,
                                    [decision.id]: {
                                      ...(current[decision.id] || {
                                        text: '',
                                        decisionMaker: '',
                                        impact: 'medium',
                                      }),
                                      decisionMaker: event.currentTarget.value,
                                    },
                                  }))
                                }
                                placeholder="Owner"
                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                              />
                              <select
                                value={
                                  decisionDrafts[decision.id]?.impact ||
                                  'medium'
                                }
                                onChange={(event) =>
                                  setDecisionDrafts((current) => ({
                                    ...current,
                                    [decision.id]: {
                                      ...(current[decision.id] || {
                                        text: '',
                                        decisionMaker: '',
                                        impact: 'medium',
                                      }),
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
                              {decision.decisionMaker ? (
                                <span>{decision.decisionMaker}</span>
                              ) : null}
                              {decision.impact ? (
                                <span>{decision.impact}</span>
                              ) : null}
                              {decision.date ? (
                                <span>{formatWhen(decision.date)}</span>
                              ) : null}
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(['low', 'medium', 'high'] as const).map(
                            (impact) => (
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
                            ),
                          )}
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
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                    {(selectedMeeting.decisions || []).length === 0 ? (
                      <div className="text-sm text-primary-500 dark:text-neutral-400">
                        Clear.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {meetingBrief ? (
                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                    Context
                  </div>
                  <div className="mt-3 text-sm text-primary-600 dark:text-neutral-400">
                    Related history.
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="grid gap-2">
                      {previousMeetings.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-left text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                        >
                          <button
                            type="button"
                            onClick={() => pickMeeting(meeting.id)}
                            className="font-medium text-primary-900 dark:text-neutral-100"
                          >
                            {compactText(formatMeetingTitle(meeting.title), 24)}
                          </button>
                          <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                            {formatWhen(meeting.date)} · {meeting.duration || 0}m
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-2">
                      {openActionItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                        >
                          <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                            {item.text}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
                            <span>{item.assignee || 'Open'}</span>
                            {item.priority ? (
                              <span>{item.priority}</span>
                            ) : null}
                            {item.dueDate ? (
                              <span>{formatWhen(item.dueDate)}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              </details>
            </div>
          ) : (
            <div className="mt-4 text-sm text-primary-500 dark:text-neutral-400">
              Pick a meeting.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
