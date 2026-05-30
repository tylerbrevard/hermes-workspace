import {
  Calendar03Icon,
  CalendarSyncIcon,
  CheckListIcon,
  Task01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import {
  buildMeetingCockpitTiles,
  classifyTylerRole,
  formatMeetingTitle,
  getMeetingEmptyState,
  getMeetingOwnerChips,
} from './lib/meeting-workflow'
import {
  compactText,
  formatFreshness,
  formatWhen,
  participantLabel,
  participantSummary,
  shellClassName,
  stripTone,
  toneForType,
} from './meeting-ui'
import type {
  Meeting,
  MeetingCockpitAction,
  MeetingsData,
} from './lib/meeting-workflow'
import type { HugeIcon } from '@/screens/dashboard/dashboard-ui'
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'
import {
  ToolsActionDock,
  ToolsStatusRail,
} from '@/components/tools-action-dock'

const MEETING_TILE_ICONS: Record<MeetingCockpitAction, HugeIcon> = {
  agenda: Calendar03Icon,
  prep: CheckListIcon,
  'follow-up': Task01Icon,
  review: ViewIcon,
  sync: CalendarSyncIcon,
}

function cockpitTone(tone: 'ok' | 'warn' | 'bad' | 'neutral') {
  if (tone === 'ok') return 'green'
  if (tone === 'warn') return 'amber'
  if (tone === 'bad') return 'red'
  return 'blue'
}

function cockpitActionLabel(action: MeetingCockpitAction) {
  if (action === 'sync') return 'Refresh'
  if (action === 'agenda') return 'Today'
  if (action === 'follow-up') return 'Route'
  if (action === 'review') return 'Review'
  return 'Prep'
}

type BriefOpenActionItem = NonNullable<
  NonNullable<MeetingsData['brief']>['openActionItems']
>[number]

type PriorMeeting = NonNullable<
  NonNullable<MeetingsData['brief']>['previousMeetings']
>[number]

type MeetingIssue = NonNullable<Meeting['issues']>[number]

export function MeetingsHeaderSection({
  search,
  reviewFilter,
  working,
  unreviewedCount,
  redactBrief,
  error,
  data,
  nextMeeting,
  extractionSummary,
  selectedMeeting,
  selectedSeverity,
  detailLoading,
  onSearchChange,
  onReviewFilterChange,
  onForceSync,
  onAutoExtractRecent,
  onBulkReview,
  onExportBrief,
  onRedactBriefChange,
}: {
  search: string
  reviewFilter: string
  working: boolean
  unreviewedCount: number
  redactBrief: boolean
  error: string | null
  data: MeetingsData | null
  nextMeeting: Meeting | null
  extractionSummary: {
    actionCount: number
    confidence: string
    reviewState: string
  }
  selectedMeeting: Meeting | null
  selectedSeverity: string
  selectedMeetingId: string
  detailLoading: boolean
  onSearchChange: (value: string) => void
  onReviewFilterChange: (value: string) => void
  onForceSync: () => void
  onAutoExtractRecent: () => void
  onBulkReview: () => void
  onExportBrief: () => void
  onRedactBriefChange: (value: boolean) => void
}) {
  return (
    <div className={shellClassName()}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary-900 dark:text-neutral-100">
            Meetings
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <input
            type="search"
            aria-label="Search meetings"
            value={search}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Search"
            className="h-10 min-w-0 flex-1 rounded-xl border border-primary-200 bg-primary-50 px-3 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 sm:min-w-48 sm:flex-none"
          />
          <select
            aria-label="Filter meetings by review status"
            value={reviewFilter}
            onChange={(event) =>
              onReviewFilterChange(event.currentTarget.value)
            }
            className="h-10 rounded-xl border border-primary-200 bg-primary-50 px-3 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="all">All</option>
            <option value="today">Today</option>
            <option value="this-week">This week</option>
            <option value="needs-review">Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="has-open-actions">Open actions</option>
            <option value="no-prep">No prep</option>
            <option value="no-transcript">No transcript</option>
            <option value="missing-notes">Missing notes</option>
            <option value="needs-follow-up">Follow-up</option>
          </select>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-primary-200 bg-primary-100/70 px-3 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={redactBrief}
              onChange={(event) =>
                onRedactBriefChange(event.currentTarget.checked)
              }
              className="h-4 w-4"
            />
            Redact
          </label>
        </div>
      </div>
      <ToolsStatusRail
        className="mt-4 hidden md:flex"
        label="Meetings status"
        items={[
          {
            id: 'calendar',
            label: 'Cal',
            value: error
              ? 'Offline'
              : data?.graphWarning || data?.dataWarning
                ? 'Degraded'
                : 'Live',
            tone:
              error || data?.graphWarning || data?.dataWarning
                ? 'warning'
                : 'good',
          },
          {
            id: 'actions',
            label: 'Act',
            value: String(extractionSummary.actionCount),
            tone: extractionSummary.actionCount > 0 ? 'warning' : 'neutral',
            progress: Math.min(100, extractionSummary.actionCount * 12),
          },
          {
            id: 'next',
            label: 'Next',
            value: nextMeeting ? formatWhen(nextMeeting.date) : 'None',
            tone: nextMeeting ? 'good' : 'warning',
          },
          {
            id: 'review',
            label: 'Rev',
            value: extractionSummary.reviewState,
            tone: unreviewedCount > 0 ? 'warning' : 'good',
          },
          {
            id: 'role',
            label: 'Role',
            value: selectedMeeting
              ? classifyTylerRole(selectedMeeting)
              : 'None',
          },
          {
            id: 'selected',
            label: 'Sel',
            value: selectedSeverity,
            tone:
              selectedSeverity === 'ok'
                ? 'good'
                : selectedSeverity === 'blocked'
                  ? 'danger'
                  : 'warning',
          },
          {
            id: 'fresh',
            label: 'Fresh',
            value: formatFreshness(data?.refreshedAt),
          },
          {
            id: 'state',
            label: 'Run',
            value: working ? 'Running' : detailLoading ? 'Loading' : 'Ready',
          },
        ]}
      />
      <ToolsActionDock
        className="mt-4 hidden md:block"
        label="Meetings quick actions"
        items={[
          {
            id: 'sync',
            label: 'Sync',
            icon: 'refresh',
            onClick: onForceSync,
            disabled: working,
            tone: 'primary',
            meta: 'Graph',
          },
          {
            id: 'extract',
            label: 'Extract',
            icon: 'task',
            onClick: onAutoExtractRecent,
            disabled: working,
            meta: 'Actions',
          },
          {
            id: 'review',
            label: 'Review',
            icon: 'check',
            onClick: onBulkReview,
            disabled: working || unreviewedCount === 0,
            tone: unreviewedCount > 0 ? 'warning' : 'good',
            meta: `${unreviewedCount} open`,
          },
          {
            id: 'brief',
            label: 'Brief',
            icon: 'download',
            onClick: onExportBrief,
            meta: redactBrief ? 'Redacted' : 'Copy',
          },
          {
            id: 'prep',
            label: 'Prep',
            icon: 'calendar',
            onClick: () => onReviewFilterChange('today'),
            tone: nextMeeting ? 'good' : 'neutral',
            meta: nextMeeting ? formatWhen(nextMeeting.date) : 'None',
          },
        ]}
      />
    </div>
  )
}

export function MeetingCockpitSection({
  data,
  nextMeeting,
  nextNeedsPrep,
  unresolvedCommitmentCount,
  unreviewedCount,
  onActivate,
}: {
  data: MeetingsData | null
  nextMeeting: Meeting | null
  nextNeedsPrep: boolean
  unresolvedCommitmentCount: number
  unreviewedCount: number
  onActivate: (action: MeetingCockpitAction) => void
}) {
  const tiles = buildMeetingCockpitTiles({
    data,
    nextMeeting,
    nextNeedsPrep,
    unresolvedCommitmentCount,
    unreviewedCount,
  })

  const syncTile = tiles.find((tile) => tile.action === 'sync')

  return (
    <AppSurface>
      <AppSectionHeader
        title="Meeting command center"
        meta="Today, prep, follow-up, review"
        action={
          <AppStatusPill tone={cockpitTone(syncTile?.tone || 'neutral')}>
            {syncTile?.value || 'Sync'}
          </AppStatusPill>
        }
      />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {tiles.map((tile) => (
          <AppTile
            key={tile.id}
            title={tile.label}
            value={compactText(tile.value, tile.action === 'prep' ? 12 : 18)}
            detail={tile.detail}
            icon={MEETING_TILE_ICONS[tile.action]}
            tone={cockpitTone(tile.tone)}
            actionLabel={cockpitActionLabel(tile.action)}
            className="min-h-[118px]"
            onClick={() => onActivate(tile.action)}
          />
        ))}
      </div>
    </AppSurface>
  )
}

export function MeetingMobileAgendaSection({
  nextMeeting,
  nextNeedsPrep,
  openActionItems,
  selectedOpenActionItems,
  unresolvedCommitmentCount,
  onPickMeeting,
}: {
  nextMeeting: Meeting | null
  nextNeedsPrep: boolean
  openActionItems: Array<BriefOpenActionItem>
  selectedOpenActionItems: Array<NonNullable<Meeting['actionItems']>[number]>
  unresolvedCommitmentCount: number
  onPickMeeting: (meetingId: string) => void
}) {
  return (
    <section className={`${shellClassName()} md:hidden`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Mobile
          </div>
          <div className="mt-2 text-base font-semibold text-primary-900 dark:text-neutral-100">
            {nextMeeting
              ? formatMeetingTitle(nextMeeting.title)
              : 'No meeting'}
          </div>
          <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {nextMeeting
              ? `${formatWhen(nextMeeting.date)} · ${nextMeeting.duration || 0} min`
              : 'Clear'}
          </div>
        </div>
        {nextMeeting?.joinUrl ? (
          <a
            href={nextMeeting.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Join
          </a>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {nextNeedsPrep ? (
          <button
            type="button"
            onClick={() => nextMeeting && onPickMeeting(nextMeeting.id)}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            Prep open
          </button>
        ) : null}
        {[...openActionItems, ...selectedOpenActionItems]
          .slice(0, 3)
          .map((item) => (
            <div
              key={`mobile-${item.id}`}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="line-clamp-2 text-sm font-medium text-primary-900 dark:text-neutral-100">
                {item.text}
              </div>
              <div className="mt-1 text-[11px] text-primary-500 dark:text-neutral-400">
                {item.assignee || 'Open'}
              </div>
            </div>
          ))}
        {unresolvedCommitmentCount === 0 ? (
          <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/50 px-3 py-3 text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
            Clear.
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function MeetingPrepAndCommitmentsSection({
  nextMeeting,
  nextNeedsPrep,
  meetingBrief,
  openActionItems,
  previousMeetings,
  selectedOpenActionItems,
  selectedOpenIssues,
  unresolvedCommitmentCount,
  actionTodoItemsCount,
  working,
  onPickMeeting,
  onRefresh,
  onSendOpenItems,
}: {
  nextMeeting: Meeting | null
  nextNeedsPrep: boolean
  meetingBrief: MeetingsData['brief']
  openActionItems: Array<BriefOpenActionItem>
  previousMeetings: Array<PriorMeeting>
  selectedOpenActionItems: Array<NonNullable<Meeting['actionItems']>[number]>
  selectedOpenIssues: Array<MeetingIssue>
  unresolvedCommitmentCount: number
  actionTodoItemsCount: number
  working: boolean
  onPickMeeting: (meetingId: string) => void
  onRefresh: () => void
  onSendOpenItems: () => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <section className={shellClassName()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Prep
            </div>
            <div className="mt-2 text-lg font-semibold text-primary-900 dark:text-neutral-100">
              {nextMeeting?.title || 'No meeting'}
            </div>
            <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
              {nextMeeting
                ? `${formatWhen(nextMeeting.date)} · ${nextMeeting.duration || 0} min`
                : 'Sync or pick one.'}
            </div>
            {meetingBrief?.lastMeetingSummary?.summary ? (
              <p className="mt-3 line-clamp-1 text-sm leading-6 text-primary-700 dark:text-neutral-300">
                {meetingBrief.lastMeetingSummary.summary}
              </p>
            ) : (
              <p className="mt-3 line-clamp-1 text-sm leading-6 text-primary-600 dark:text-neutral-400">
                {meetingBrief?.message ||
                  'Prep appears after selection.'}
              </p>
            )}
            {nextNeedsPrep ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Prep open.
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {nextMeeting?.joinUrl ? (
              <a
                href={nextMeeting.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Join
              </a>
            ) : null}
            {nextMeeting ? (
              <button
                type="button"
                onClick={() => onPickMeeting(nextMeeting.id)}
                className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              >
                {nextNeedsPrep ? 'Prep' : 'Open'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={working}
              className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Sync
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(nextMeeting?.reviewed ? 'ok' : nextMeeting ? 'warn' : 'bad')}`}
          >
            {nextMeeting?.reviewed ? 'Reviewed' : nextMeeting ? 'Review' : 'None'}
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(openActionItems.length > 0 ? 'warn' : 'ok')}`}
          >
            {openActionItems.length} carry
          </span>
          <span
            className={`rounded-xl border px-3 py-2 text-xs ${stripTone(previousMeetings.length > 0 ? 'ok' : 'warn')}`}
          >
            {previousMeetings.length} prior
          </span>
        </div>
      </section>

      <section className={shellClassName()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
              Commitments
            </div>
            <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
              {unresolvedCommitmentCount}
            </div>
          </div>
          <button
            type="button"
            onClick={onSendOpenItems}
            disabled={working || actionTodoItemsCount === 0}
            className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            To Do
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {[...openActionItems, ...selectedOpenActionItems]
            .slice(0, 4)
            .map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="line-clamp-2 text-sm font-medium text-primary-900 dark:text-neutral-100">
                  {item.text}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
                  <span>{item.assignee || 'Unassigned'}</span>
                  {item.priority ? <span>{item.priority}</span> : null}
                  {item.dueDate ? (
                    <span>{formatWhen(item.dueDate)}</span>
                  ) : null}
                  {'meetingTitle' in item && item.meetingTitle ? (
                    <span>{String(item.meetingTitle)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          {selectedOpenIssues.slice(0, 2).map((issue) => (
            <div
              key={issue.id}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <div className="line-clamp-2 text-sm font-medium">
                {issue.title}
              </div>
              <div className="mt-1 text-[11px]">
                {issue.status || 'open'} · {issue.priority || 'medium'}
              </div>
            </div>
          ))}
          {unresolvedCommitmentCount === 0 ? (
            <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/50 px-3 py-4 text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              Clear.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export function MeetingSummaryStats({
  data,
  unreviewedCount,
}: {
  data: MeetingsData | null
  unreviewedCount: number
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section className={shellClassName()}>
        <div className="text-xs uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
          Today
        </div>
        <div className="mt-2 text-3xl font-semibold text-primary-900 dark:text-neutral-100">
          {data?.todayMeetings?.length || 0}
        </div>
        <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
          Next 5 days
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
          {unreviewedCount}
        </div>
        <div className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
          Review state
        </div>
      </section>
    </div>
  )
}

function MeetingListCard({
  meeting,
  selected,
  showReviewControls = false,
  working = false,
  onPickMeeting,
  onToggleReviewed,
}: {
  meeting: Meeting
  selected: boolean
  showReviewControls?: boolean
  working?: boolean
  onPickMeeting: (meetingId: string) => void
  onToggleReviewed?: (meeting: Meeting) => void
}) {
  return (
    <div
      data-testid={showReviewControls ? 'meeting-record' : undefined}
      className={`rounded-xl border px-3 py-2.5 transition-colors dark:border-neutral-800 ${
        selected
          ? 'border-primary-400 bg-primary-100/80 dark:bg-neutral-900/90'
          : 'border-primary-200 bg-primary-50/70 dark:bg-neutral-900/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onPickMeeting(meeting.id)}
              className="min-w-0 truncate text-left text-sm font-semibold text-primary-900 dark:text-neutral-100"
              aria-current={selected ? 'true' : undefined}
              title={formatMeetingTitle(meeting.title)}
            >
              {compactText(formatMeetingTitle(meeting.title), 28)}
            </button>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${toneForType(meeting.type)}`}
            >
              {meeting.type || 'other'}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-primary-500 dark:text-neutral-400">
            <span>{formatWhen(meeting.date)}</span>
            <span>{meeting.duration || 0}m</span>
            <span title={participantLabel(meeting)}>
              {participantSummary(meeting)}
            </span>
          </div>
        </div>
        {showReviewControls ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-primary-200 bg-primary-100/70 px-2 py-1 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              A{(meeting.actionItems || []).length}
            </span>
            <button
              type="button"
              onClick={() => onToggleReviewed?.(meeting)}
              disabled={working}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                meeting.reviewed
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'border border-primary-200 bg-primary-100/70 text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
              }`}
            >
              {meeting.reviewed ? 'Done' : 'Review'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function MeetingListsSection({
  data,
  loading,
  selectedMeetingId,
  visibleRecentMeetings,
  working,
  onPickMeeting,
  onRefresh,
  onShowAll,
  onToggleReviewed,
}: {
  data: MeetingsData | null
  loading: boolean
  selectedMeetingId: string
  visibleRecentMeetings: Array<Meeting>
  working: boolean
  onPickMeeting: (meetingId: string) => void
  onRefresh: () => void
  onShowAll: () => void
  onToggleReviewed: (meeting: Meeting) => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className={shellClassName()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Today
          </h2>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
          {loading ? 'Loading' : String(data?.todayMeetings?.length || 0)}
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {(data?.todayMeetings || []).slice(0, 8).map((meeting) => (
            <MeetingListCard
              key={`${meeting.id}-${meeting.date}`}
              meeting={meeting}
              selected={selectedMeetingId === meeting.id}
              onPickMeeting={onPickMeeting}
            />
          ))}
          {!loading && (data?.todayMeetings?.length || 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 px-4 py-8 text-center text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              <div className="font-medium text-primary-700 dark:text-neutral-200">
                Clear.
              </div>
              <button
                type="button"
                onClick={onRefresh}
                className="mt-3 rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Refresh
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className={shellClassName()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Review queue
          </h2>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
            {loading ? 'Loading' : String(visibleRecentMeetings.length)}
          </div>
        </div>
        <div className="mt-3 grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
          {visibleRecentMeetings.slice(0, 8).map((meeting) => (
            <MeetingListCard
              key={meeting.id}
              meeting={meeting}
              selected={selectedMeetingId === meeting.id}
              showReviewControls
              working={working}
              onPickMeeting={onPickMeeting}
              onToggleReviewed={onToggleReviewed}
            />
          ))}
          {!loading && visibleRecentMeetings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 px-4 py-8 text-center text-sm text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              <div className="font-medium text-primary-700 dark:text-neutral-200">
                No matches.
              </div>
              <button
                type="button"
                onClick={onShowAll}
                className="mt-3 rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-xs font-medium text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              >
                Show all
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
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

export function MeetingHeatmapSection({
  heatmapDays,
  trendInterpretation,
}: {
  heatmapDays: NonNullable<MeetingsData['heatmapDays']>
  trendInterpretation: string
}) {
  return (
    <section className={shellClassName()}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
          Two-week load
        </h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        {heatmapDays.slice(0, 7).map((day) => (
          <div
            key={day.date}
            className="rounded-2xl border border-primary-200 bg-primary-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                {day.dayLabel}
              </div>
              <div
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${heatmapTone(day.intensity)}`}
              >
                {day.totalHours}h
              </div>
            </div>
            <div className="mt-2 text-sm font-semibold text-primary-900 dark:text-neutral-100">
              {new Date(day.date).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div
              className="mt-1 text-xs text-primary-600 dark:text-neutral-400"
              title={`${day.meetingCount} meeting(s)`}
            >
              {day.meetingCount === 0 ? '0' : `${day.meetingCount} mtg`}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 line-clamp-2 rounded-xl border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
        {trendInterpretation}
      </div>
    </section>
  )
}
