import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Folder01Icon,
  RefreshIcon,
  Rocket01Icon,
  SlidersHorizontalIcon,
} from '@hugeicons/core-free-icons'
import { OfficeView } from './components/office-view'
import {
  MissionCostSection,
  ModelSelectorDropdown,
  PlanningIndicator,
  QUICK_ACTIONS,
  THEME_STYLE,
  WorkerCard,
  deriveSessionStatus,
  formatDurationRange,
  formatElapsedMilliseconds,
  formatElapsedTime,
  formatRelativeTime,
  getAgentPersona,
  getDirectorySuggestions,
  getLastAssistantMessage,
  getParentDirectory,
  getShortModelName,
} from './conductor-ui'
import {
  TYLER_RECURRING_WORKFLOW_TEMPLATES,
  buildConductorCockpitTiles,
} from './conductor-workflow'
import type { HistoryMessage } from './conductor-ui'
import type { GatewaySession } from '@/lib/gateway-api'
import type {
  MissionHistoryEntry,
  MissionHistoryWorkerDetail,
} from './hooks/use-conductor-gateway'
import { Button } from '@/components/ui/button'
import { WorkflowHelpModal } from '@/components/workflow-help-modal'
import { Markdown } from '@/components/prompt-kit/markdown'
import { cn } from '@/lib/utils'

type ConductorPhaseRouterProps = Record<string, any>

export function ConductorPhaseRouter(props: ConductorPhaseRouterProps) {
  const {
    phase,
    selectedHistoryEntry,
    selectedHistoryOutputPath,
    selectedHistoryPreview,
    selectedHistoryPreviewUrl,
    selectedHistoryOutputLabel,
    historyMissionCostWorkers,
    historyCostExpanded,
    setHistoryCostExpanded,
    handleNewMission,
    conductor,
    readinessSummary,
    readinessChecklist,
    launchValidation,
    goalDraft,
    setGoalDraft,
    handleSubmit,
    setMissionModalOpen,
    homeOfficeRows,
    workerAvailabilitySummary,
    executionGuard,
    missionCheckpointSummary,
    copyPortablePlan,
    portablePlanCopied,
    activityFilter,
    setActivityFilter,
    setActivityPage,
    setContinueModalOpen,
    setSelectedAction,
    activityTotalPages,
    safeActivityPage,
    visibleActivityItems,
    hasMissionHistory,
    missionModalOpen,
    selectedAction,
    handleQuickActionSelect,
    constraintsDraft,
    setConstraintsDraft,
    verificationDraft,
    setVerificationDraft,
    handoffTargetDraft,
    setHandoffTargetDraft,
    settingsOpen,
    setSettingsOpen,
    availableModels,
    updateSettings,
    openDirectoryBrowser,
    canResetSavedState,
    setContinueDraft,
    setSelectedTaskId,
    directoryBrowserOpen,
    closeDirectoryBrowser,
    directoryBrowserPath,
    setDirectoryBrowserPath,
    directoryBrowserLoading,
    directoryBreadcrumbs,
    directoryBrowserError,
    directoryBrowserEntries,
    now,
    completeSummary,
    previewState,
    previewUrl,
    completePhaseProjectPath,
    completePhaseOutputLabel,
    completedTaskOutputs,
    completeMissionCostWorkers,
    totalTokens,
    completeCostExpanded,
    setCompleteCostExpanded,
    totalWorkers,
    completedWorkers,
    activeWorkerCount,
    missionProgress,
    officeAgentRows,
    selectedTaskId,
    continueModalOpen,
    continuationModalPreview,
    continueDraft,
    handleContinueMission,
  } = props

  if (phase === 'home') {
    if (selectedHistoryEntry) {
      const historyWorkerDetails = selectedHistoryEntry.workerDetails ?? []
      const historySummary =
        selectedHistoryEntry.completeSummary ?? selectedHistoryEntry.streamText
      const historyOutputText =
        selectedHistoryEntry.outputText?.trim() ||
        selectedHistoryEntry.streamText?.trim() ||
        ''
      const showHistoryOutputFallback =
        !!historyOutputText &&
        (!selectedHistoryOutputPath || selectedHistoryPreview.unavailable)
      const historyStatusLabel =
        selectedHistoryEntry.status === 'completed' ? 'Complete' : 'Stopped'
      const historyStatusClasses =
        selectedHistoryEntry.status === 'completed'
          ? 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
          : 'border border-red-400/35 bg-red-500/10 text-red-300'

      return (
        <div
          className="flex min-h-dvh flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]"
          style={THEME_STYLE}
        >
          <main className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 py-4 pb-4 md:pb-[calc(var(--tabbar-h,80px)+1rem)] md:px-6 md:py-8">
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => conductor.setSelectedHistoryEntry(null)}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-border2)] hover:text-[var(--theme-text)]"
              >
                <span aria-hidden="true">←</span> Back
              </button>

              <div className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase tracking-[0.24em]',
                        selectedHistoryEntry.status === 'completed'
                          ? 'text-[var(--theme-accent)]'
                          : 'text-red-400',
                      )}
                    >
                      {selectedHistoryEntry.status === 'completed'
                        ? 'Mission Complete'
                        : 'Mission Stopped'}
                    </p>
                    <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-2xl">
                      {selectedHistoryEntry.goal}
                    </h1>
                    <p className="mt-2 text-xs text-[var(--theme-muted-2)]">
                      {selectedHistoryEntry.workerCount}/
                      {Math.max(selectedHistoryEntry.workerCount, 1)} workers
                      finished ·{' '}
                      {formatDurationRange(
                        selectedHistoryEntry.startedAt,
                        selectedHistoryEntry.completedAt,
                        now,
                      )}{' '}
                      total elapsed
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        conductor.setSelectedHistoryEntry(null)
                        handleNewMission()
                      }}
                      className="rounded-xl bg-[var(--theme-accent)] px-5 text-white hover:bg-[var(--theme-accent-strong)]"
                    >
                      New Mission
                    </Button>
                  </div>
                </div>
              </div>

              {selectedHistoryOutputPath && selectedHistoryPreview.ready ? (
                <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                        Output Preview
                      </p>
                      <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                        {selectedHistoryOutputLabel}
                      </p>
                    </div>
                    <a
                      href={selectedHistoryPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                  <div className="mt-4 overflow-auto rounded-2xl border border-[var(--theme-border)] bg-white">
                    <iframe
                      src={selectedHistoryPreviewUrl}
                      className="h-[clamp(280px,55vh,520px)] w-full"
                      sandbox=""
                      title="Mission history output preview"
                    />
                  </div>
                </section>
              ) : selectedHistoryOutputPath &&
                selectedHistoryPreview.loading ? (
                <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                  <div className="flex items-center gap-3 text-sm text-[var(--theme-muted)]">
                    <div className="size-4 animate-spin rounded-full border-2 border-[var(--theme-border)] border-t-[var(--theme-accent)]" />
                    Loading output preview…
                  </div>
                </section>
              ) : selectedHistoryOutputPath &&
                selectedHistoryPreview.unavailable ? (
                showHistoryOutputFallback ? null : (
                  <p className="px-1 text-sm text-[var(--theme-muted)]">
                    No preview available.
                  </p>
                )
              ) : null}

              <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                      Agent Summary
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium',
                      historyStatusClasses,
                    )}
                  >
                    {historyStatusLabel}
                  </span>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                  {historySummary ? (
                    <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                      {historySummary}
                    </Markdown>
                  ) : (
                    <p className="text-sm text-[var(--theme-muted)]">
                      No summary captured.
                    </p>
                  )}
                </div>
                {historyWorkerDetails.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {historyWorkerDetails.map(
                      (worker: MissionHistoryWorkerDetail, index: number) => (
                        <div
                          key={`${selectedHistoryEntry.id}-worker-${index}`}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                        >
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              selectedHistoryEntry.status === 'completed'
                                ? 'bg-emerald-400'
                                : 'bg-red-400',
                            )}
                          />
                          <span className="font-medium text-[var(--theme-text)]">
                            {worker.personaEmoji} {worker.personaName}
                          </span>
                          <span className="text-[var(--theme-muted)]">
                            {worker.label}
                          </span>
                          <span className="ml-auto text-xs text-[var(--theme-muted)]">
                            {getShortModelName(worker.model)} ·{' '}
                            {worker.totalTokens.toLocaleString()} tok
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
                {(selectedHistoryEntry.totalTokens > 0 ||
                  historyMissionCostWorkers.length > 0) && (
                  <div className="mt-4">
                    <MissionCostSection
                      totalTokens={selectedHistoryEntry.totalTokens}
                      workers={historyMissionCostWorkers}
                      expanded={historyCostExpanded}
                      onToggle={() =>
                        setHistoryCostExpanded((current: boolean) => !current)
                      }
                    />
                  </div>
                )}
                {selectedHistoryEntry.streamText &&
                  selectedHistoryEntry.completeSummary && (
                    <details className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                      <summary className="cursor-pointer text-xs font-medium text-[var(--theme-muted)]">
                        Raw Agent Output
                      </summary>
                      <div className="mt-4 border-t border-[var(--theme-border)] pt-4">
                        <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                          {selectedHistoryEntry.streamText}
                        </Markdown>
                      </div>
                    </details>
                  )}
              </section>

              {showHistoryOutputFallback ? (
                <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                        Output
                      </p>
                      <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                        Preview unavailable
                        {selectedHistoryOutputPath
                          ? ` for ${selectedHistoryOutputLabel}`
                          : ''}
                        .
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                    <Markdown className="max-h-[600px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                      {historyOutputText}
                    </Markdown>
                  </div>
                </section>
              ) : historyOutputText ? (
                <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Worker Output
                  </p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                    <Markdown className="max-h-[600px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                      {historyOutputText}
                    </Markdown>
                  </div>
                </section>
              ) : null}

              {!historySummary &&
                historyWorkerDetails.length === 0 &&
                !selectedHistoryOutputPath &&
                !selectedHistoryEntry.workerSummary?.length &&
                !historyOutputText && (
                  <section className="overflow-hidden rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
                    <p className="text-center text-sm text-[var(--theme-muted)]">
                      No detailed output was captured for this mission.
                      <br />
                      <span className="text-xs text-[var(--theme-muted-2)]">
                        Missions run after this update will save full agent
                        summaries and output previews.
                      </span>
                    </p>
                  </section>
                )}
            </div>
          </main>
        </div>
      )
    }

    const conductorCockpitTiles = buildConductorCockpitTiles({
      readinessSummary,
      workerAvailabilitySummary,
      executionGuard,
      activityCount:
        conductor.missionHistory?.length ||
        conductor.recentSessions?.length ||
        0,
      activeWorkerCount,
      totalWorkers,
      goalPresent: goalDraft.trim().length > 0,
    })

    return (
      <div
        className="flex min-h-dvh flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]"
        style={THEME_STYLE}
      >
        <main className="mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col items-stretch justify-start px-4 py-4 pb-4 md:pb-[calc(var(--tabbar-h,80px)+1rem)] md:px-6 md:py-6">
          <div className="w-full space-y-6">
            <div className="space-y-2 md:text-center">
              <div className="flex items-center gap-2">
                <div className="hidden md:block flex-1" />
                <div className="hidden md:inline-flex shrink-0 items-center gap-2.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
                  <span>Conductor</span>
                  <span className="size-2.5 shrink-0 rounded-full bg-emerald-400" />
                </div>
                <div className="flex md:flex-1 items-center justify-end gap-2 ml-auto md:ml-0">
                  <WorkflowHelpModal
                    compact
                    eyebrow="Conductor"
                    title="How Conductor works"
                    sections={[
                      {
                        title: 'What Conductor is for',
                        bullets: [
                          'Conductor is the mission-level orchestration surface for coordinated agent execution.',
                          'Use it when one goal should be planned, assigned, and tracked end to end.',
                        ],
                      },
                      {
                        title: 'Typical flow',
                        bullets: [
                          'Start a mission, watch worker progress, and intervene only when something is blocked or clearly off-course.',
                          'Use the mission views to understand what happened before retrying or launching the next mission.',
                        ],
                      },
                      {
                        title: 'FAQ',
                        bullets: [
                          'If Conductor says upstream is unavailable, the underlying runtime capability is not ready yet.',
                          'Conductor is for orchestration, not first-time setup. Fix setup issues in Operations first.',
                        ],
                      },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setMissionModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-[var(--theme-accent)] p-2 text-white shadow-sm transition-colors hover:bg-[var(--theme-accent-strong)]"
                    aria-label="New Mission"
                  >
                    <HugeiconsIcon
                      icon={Rocket01Icon}
                      size={18}
                      strokeWidth={1.7}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-2 text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    aria-label="Mission defaults"
                    title="Mission defaults"
                  >
                    <HugeiconsIcon
                      icon={SlidersHorizontalIcon}
                      size={18}
                      strokeWidth={1.7}
                    />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--theme-muted-2)]">
                Plan, assign, verify.
              </p>
              <h1 className="sr-only">Conductor mission orchestration</h1>
              <div className="flex flex-wrap items-center gap-2 md:justify-center">
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    readinessSummary.blockedCount > 0
                      ? 'border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger)]'
                      : readinessSummary.warningCount > 0
                        ? 'border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] text-[var(--theme-warning)]'
                        : 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]',
                  )}
                >
                  {readinessSummary.readyCount}/{readinessSummary.totalCount}{' '}
                  ready · {readinessSummary.label}
                </span>
                {conductor.conductorSettings.projectsDir.trim() ? (
                  <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1 text-xs font-medium text-[var(--theme-muted)]">
                    CWD locked
                  </span>
                ) : null}
              </div>
            </div>

            <section
              aria-label="Conductor cockpit"
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              {conductorCockpitTiles.map((tile) => (
                <div
                  key={tile.id}
                  className={cn(
                    'min-h-[9rem] rounded-3xl border p-4 shadow-[0_18px_60px_var(--theme-shadow)]',
                    tile.tone === 'danger'
                      ? 'border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger)]'
                      : tile.tone === 'warning'
                        ? 'border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] text-[var(--theme-warning)]'
                        : tile.tone === 'good'
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                          : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70 [overflow-wrap:anywhere]">
                        {tile.label}
                      </p>
                      <p className="mt-2 break-words text-xl font-semibold leading-none tracking-normal [overflow-wrap:anywhere] sm:text-2xl">
                        {tile.value}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                      {tile.tone}
                    </span>
                  </div>
                  <p className="mt-3 min-h-[2.25rem] text-xs leading-snug opacity-80">
                    {tile.detail}
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-current/10">
                    <div
                      className="h-full rounded-full bg-current transition-[width]"
                      style={{
                        width: `${Math.min(100, Math.max(4, tile.progress))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] p-4 shadow-[0_24px_80px_var(--theme-shadow)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Launch a mission
                    <textarea
                      value={goalDraft}
                      onChange={(event) => setGoalDraft(event.target.value)}
                      placeholder="Describe the goal Conductor should plan, assign, and verify."
                      disabled={conductor.isSending}
                      rows={3}
                      aria-label="Quick mission goal"
                      className="mt-2 min-h-[96px] w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--theme-text)] outline-none transition-colors placeholder:text-[var(--theme-muted-2)] focus:border-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:w-44 sm:flex-col">
                  <Button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!launchValidation.valid || conductor.isSending}
                    className="flex-1 rounded-xl bg-[var(--theme-accent)] px-4 text-white hover:bg-[var(--theme-accent-strong)] sm:flex-none"
                  >
                    {conductor.isSending ? 'Launching...' : 'Launch'}
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={16}
                      strokeWidth={1.7}
                    />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMissionModalOpen(true)}
                    className="flex-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-2 text-sm font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] sm:flex-none"
                  >
                    Advanced
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {readinessChecklist.map((item: any) => (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-xl border px-3 py-2',
                      item.severity === 'blocked'
                        ? 'border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)]'
                        : item.severity === 'warning'
                          ? 'border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)]'
                          : 'border-[var(--theme-border)] bg-[var(--theme-bg)]',
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                      {item.label}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-text)]">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="h-[280px] overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-[0_24px_80px_var(--theme-shadow)] md:h-[520px]">
              <OfficeView
                agentRows={homeOfficeRows}
                missionRunning={homeOfficeRows.some(
                  (a: any) => a.status === 'active',
                )}
                onViewOutput={() => {}}
                processType="parallel"
                companyName=""
                containerHeight={520}
                hideHeader
              />
            </section>

            <section className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 text-sm text-[var(--theme-muted)] shadow-[0_24px_80px_var(--theme-shadow)]">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                    Launch readiness
                  </p>
                  <p className="mt-2 text-[var(--theme-text)]">
                    {readinessSummary.label}
                  </p>
                  <p className="mt-1">{workerAvailabilitySummary}</p>
                  <p className="mt-1">
                    Missing fields:{' '}
                    {launchValidation.missing.length
                      ? launchValidation.missing.join(', ')
                      : 'none'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyPortablePlan()}
                    className="mt-3 rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)]"
                  >
                    {portablePlanCopied
                      ? 'Portable plan copied'
                      : 'Copy portable plan'}
                  </button>
                </div>
                <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                    Guardrails
                  </p>
                  <p className="mt-2">{executionGuard}</p>
                  <p className="mt-1">Cost guard: estimate first.</p>
                  <p className="mt-1">Model fallback: defaults.</p>
                </div>
                <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                    Evidence workflow
                  </p>
                  <p className="mt-2">{missionCheckpointSummary}</p>
                  <p className="mt-1">Links: Files, Tasks, Memory, Chat.</p>
                  <p className="mt-1">
                    Archive durable evidence on completion.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {(
                  [
                    'all',
                    'active',
                    'blocked',
                    'review-needed',
                    'completed',
                    'failed',
                  ] as const
                ).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setActivityFilter(filter)
                      setActivityPage(0)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 font-medium capitalize transition-colors',
                      activityFilter === filter
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                        : 'border-[var(--theme-border)] text-[var(--theme-muted-2)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]',
                    )}
                  >
                    {filter}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setContinueModalOpen(true)}
                  className="rounded-full border border-[var(--theme-border)] px-3 py-1 font-medium text-[var(--theme-text)] hover:border-[var(--theme-accent)]"
                >
                  Resume failed mission
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const latest = conductor.missionHistory[0]
                    if (latest) setGoalDraft(latest.goal)
                    setMissionModalOpen(true)
                  }}
                  className="rounded-full border border-[var(--theme-border)] px-3 py-1 font-medium text-[var(--theme-text)] hover:border-[var(--theme-accent)]"
                >
                  Clone mission
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGoalDraft(
                      'Browser QA: verify the selected frontend route, capture console errors, screenshots, and overflow findings.',
                    )
                    setMissionModalOpen(true)
                  }}
                  className="rounded-full border border-[var(--theme-border)] px-3 py-1 font-medium text-[var(--theme-text)] hover:border-[var(--theme-accent)]"
                >
                  Browser QA launch option
                </button>
                <span className="rounded-full border border-[var(--theme-border)] px-3 py-1">
                  Mobile operator view: active mission state and blockers only
                </span>
                <span className="rounded-full border border-[var(--theme-border)] px-3 py-1">
                  Swarm handoff summary: next exact action
                </span>
                <span className="rounded-full border border-[var(--theme-border)] px-3 py-1">
                  Exact terminal/log panel per worker
                </span>
              </div>
            </section>

            {hasMissionHistory || conductor.recentSessions.length > 0 ? (
              <section className="mt-6 w-full space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
                    Recent Missions
                  </h2>
                  {activityTotalPages > 1 && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-[10px] text-[var(--theme-muted-2)]">
                        {safeActivityPage + 1}/{activityTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeActivityPage === 0}
                        onClick={() =>
                          setActivityPage((p: number) => Math.max(0, p - 1))
                        }
                        className="inline-flex size-6 items-center justify-center rounded-lg border border-[var(--theme-border)] text-xs text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        disabled={safeActivityPage >= activityTotalPages - 1}
                        onClick={() =>
                          setActivityPage((p: number) =>
                            Math.min(activityTotalPages - 1, p + 1),
                          )
                        }
                        className="inline-flex size-6 items-center justify-center rounded-lg border border-[var(--theme-border)] text-xs text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(['all', 'completed', 'failed'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setActivityFilter(filter)
                        setActivityPage(0)
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors',
                        activityFilter === filter
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                          : 'border-[var(--theme-border)] text-[var(--theme-muted-2)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]',
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                {visibleActivityItems.length > 0 ? (
                  <div className="min-h-[140px] space-y-1.5">
                    {hasMissionHistory
                      ? visibleActivityItems.map((item: any) => {
                          const entry = item as MissionHistoryEntry
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() =>
                                conductor.setSelectedHistoryEntry(entry)
                              }
                              className="flex w-full items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--theme-accent)] sm:gap-3"
                            >
                              <span className="min-w-0 flex-1 truncate font-medium text-[var(--theme-text)]">
                                {entry.goal}
                              </span>
                              <span
                                className={cn(
                                  'w-[72px] shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-[0.12em]',
                                  entry.status === 'completed'
                                    ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                                    : 'border-red-400/35 bg-red-500/10 text-red-300',
                                )}
                              >
                                {entry.status === 'completed'
                                  ? 'Complete'
                                  : 'Failed'}
                              </span>
                              <span className="w-[48px] shrink-0 text-right text-xs text-[var(--theme-muted-2)]">
                                {formatRelativeTime(entry.completedAt, now)}
                              </span>
                              <span className="hidden shrink-0 text-right text-xs text-[var(--theme-muted)] sm:inline">
                                {entry.totalTokens.toLocaleString()} tok
                              </span>
                            </button>
                          )
                        })
                      : visibleActivityItems.map((item: any) => {
                          const recentSession = item as GatewaySession
                          const label =
                            recentSession.label ?? recentSession.key ?? ''
                          const displayName = label
                            .replace(/^worker-/, '')
                            .replace(/[-_]+/g, ' ')
                          const tokens =
                            typeof recentSession.totalTokens === 'number'
                              ? recentSession.totalTokens
                              : 0
                          const model = getShortModelName(recentSession.model)
                          const updatedAt =
                            typeof recentSession.updatedAt === 'string'
                              ? recentSession.updatedAt
                              : typeof recentSession.startedAt === 'string'
                                ? recentSession.startedAt
                                : typeof recentSession.createdAt === 'string'
                                  ? recentSession.createdAt
                                  : null
                          const sessionStatus =
                            deriveSessionStatus(recentSession)
                          const dotClass =
                            sessionStatus === 'completed'
                              ? 'bg-emerald-400'
                              : sessionStatus === 'failed'
                                ? 'bg-red-400'
                                : 'bg-sky-400 animate-pulse'

                          return (
                            <div
                              key={recentSession.key}
                              className="flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm sm:gap-3"
                            >
                              <span className="min-w-0 flex-1 truncate font-medium capitalize text-[var(--theme-text)]">
                                {displayName}
                              </span>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]',
                                  sessionStatus === 'completed'
                                    ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                                    : sessionStatus === 'failed'
                                      ? 'border-red-400/35 bg-red-500/10 text-red-300'
                                      : 'border-sky-400/35 bg-sky-500/10 text-sky-300',
                                )}
                              >
                                <span
                                  className={cn(
                                    'mr-1 inline-block size-1.5 rounded-full align-middle',
                                    dotClass,
                                  )}
                                />
                                {sessionStatus}
                              </span>
                              <span className="shrink-0 text-xs text-[var(--theme-muted-2)]">
                                {formatRelativeTime(updatedAt, now)}
                              </span>
                              <span className="hidden shrink-0 text-xs text-[var(--theme-muted)] sm:inline">
                                {tokens.toLocaleString()} tok
                              </span>
                              <span className="hidden shrink-0 text-xs text-[var(--theme-muted)] sm:inline">
                                {model}
                              </span>
                            </div>
                          )
                        })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-6 text-center text-sm text-[var(--theme-muted)]">
                    No {activityFilter === 'all' ? '' : `${activityFilter} `}
                    {hasMissionHistory ? 'missions' : 'sessions'} found
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-6 w-full">
                <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-8 text-center">
                  <p className="text-sm text-[var(--theme-muted)]">
                    No missions yet.
                  </p>
                  <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                    Launch your first mission and it will appear here.
                  </p>
                </div>
              </section>
            )}
          </div>

          {missionModalOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-bg)_48%,transparent)] px-4 py-6 backdrop-blur-md"
              onClick={() => setMissionModalOpen(false)}
            >
              <div
                className="w-full max-w-2xl rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] p-5 shadow-[0_24px_80px_var(--theme-shadow)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[var(--theme-text)]">
                      New Mission
                    </h2>
                    <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
                      Describe the mission, constraints, and desired outcome.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMissionModalOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] text-lg text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    aria-label="Close new mission dialog"
                  >
                    ×
                  </button>
                </div>

                <form
                  className="mt-5 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSubmit()
                  }}
                >
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handleQuickActionSelect(action)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          selectedAction === action.id
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                            : 'border-[var(--theme-border)] bg-transparent text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]',
                        )}
                      >
                        <HugeiconsIcon
                          icon={action.icon}
                          size={14}
                          strokeWidth={1.7}
                        />
                        {action.label}
                      </button>
                    ))}
                  </div>

                  <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                          Proven Tyler workflows
                        </p>
                        <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                          Recurring missions with verification and preservation
                          rules already baked in.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {TYLER_RECURRING_WORKFLOW_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setSelectedAction('build')
                            setGoalDraft(template.prompt)
                          }}
                          className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-left transition-colors hover:border-[var(--theme-accent)] hover:bg-[var(--theme-card2)]"
                        >
                          <span className="block text-sm font-semibold text-[var(--theme-text)]">
                            {template.title}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-snug text-[var(--theme-muted-2)]">
                            {template.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <textarea
                    value={goalDraft}
                    onChange={(event) => setGoalDraft(event.target.value)}
                    placeholder={`${QUICK_ACTIONS.find((action) => action.id === selectedAction)?.label ?? 'Build'}: describe the mission goal.`}
                    disabled={conductor.isSending}
                    rows={4}
                    aria-label="Mission goal"
                    className="min-h-[120px] w-full rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-bg)] px-4 py-4 text-sm text-[var(--theme-text)] outline-none transition-colors placeholder:text-[var(--theme-muted-2)] focus:border-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                        Constraints
                      </span>
                      <textarea
                        value={constraintsDraft}
                        onChange={(event) =>
                          setConstraintsDraft(event.target.value)
                        }
                        rows={4}
                        aria-label="Mission constraints"
                        className="min-h-[120px] w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                        Verification
                      </span>
                      <textarea
                        value={verificationDraft}
                        onChange={(event) =>
                          setVerificationDraft(event.target.value)
                        }
                        rows={4}
                        aria-label="Mission verification"
                        className="min-h-[120px] w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                        Handoff target
                      </span>
                      <textarea
                        value={handoffTargetDraft}
                        onChange={(event) =>
                          setHandoffTargetDraft(event.target.value)
                        }
                        rows={4}
                        aria-label="Mission handoff target"
                        className="min-h-[120px] w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                          Mission readiness
                        </p>
                        <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                          {readinessSummary.readyCount}/
                          {readinessSummary.totalCount} ready ·{' '}
                          {readinessSummary.label}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyPortablePlan()}
                        className="rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)]"
                      >
                        {portablePlanCopied
                          ? 'Portable plan copied'
                          : 'Copy portable plan'}
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-5">
                      {readinessChecklist.map((item: any) => (
                        <div
                          key={`modal-${item.id}`}
                          className={cn(
                            'rounded-xl border px-3 py-2',
                            item.severity === 'blocked'
                              ? 'border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)]'
                              : item.severity === 'warning'
                                ? 'border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)]'
                                : 'border-[var(--theme-border)] bg-[var(--theme-card)]',
                          )}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                            {item.label}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-text)]">
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[var(--theme-muted)]">
                      Missing launch fields:{' '}
                      {launchValidation.missing.length
                        ? launchValidation.missing.join(', ')
                        : 'none'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!launchValidation.valid || conductor.isSending}
                      className="rounded-full bg-[var(--theme-accent)] px-5 text-white hover:bg-[var(--theme-accent-strong)]"
                    >
                      {conductor.isSending ? 'Launching...' : 'Launch Mission'}
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={16}
                        strokeWidth={1.7}
                      />
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {settingsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-bg)_55%,transparent)] px-4 py-6 backdrop-blur-md"
              onClick={() => setSettingsOpen(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] p-5 shadow-[0_24px_80px_var(--theme-shadow)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                      Mission Defaults
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--theme-text)]">
                      Defaults
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] text-lg text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    aria-label="Close defaults"
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={18}
                      strokeWidth={1.7}
                    />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <ModelSelectorDropdown
                    label="Orchestrator Model"
                    value={conductor.conductorSettings.orchestratorModel}
                    onChange={(nextValue) =>
                      updateSettings({ orchestratorModel: nextValue })
                    }
                    models={availableModels}
                  />

                  <ModelSelectorDropdown
                    label="Worker Model"
                    value={conductor.conductorSettings.workerModel}
                    onChange={(nextValue) =>
                      updateSettings({ workerModel: nextValue })
                    }
                    models={availableModels}
                  />

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-[var(--theme-text)]">
                      Project Directory
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={conductor.conductorSettings.projectsDir}
                        onChange={(event) =>
                          updateSettings({ projectsDir: event.target.value })
                        }
                        placeholder="~/conductor-projects"
                        className="min-w-0 flex-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm text-[var(--theme-text)] outline-none transition-colors placeholder:text-[var(--theme-muted-2)] focus:border-[var(--theme-accent)]"
                      />
                      <button
                        type="button"
                        onClick={openDirectoryBrowser}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-3 text-sm font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                      >
                        <HugeiconsIcon
                          icon={Folder01Icon}
                          size={16}
                          strokeWidth={1.7}
                        />
                        <span className="hidden sm:inline">Browse</span>
                      </button>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--theme-text)]">
                      Max Parallel Workers
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={conductor.conductorSettings.maxParallel}
                      onChange={(event) =>
                        updateSettings({
                          maxParallel: Math.min(
                            5,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        })
                      }
                      className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm text-[var(--theme-text)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-4">
                    <input
                      type="checkbox"
                      checked={conductor.conductorSettings.supervised}
                      onChange={(event) =>
                        updateSettings({ supervised: event.target.checked })
                      }
                      className="mt-1 size-4 rounded border-[var(--theme-border2)] accent-[var(--theme-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--theme-text)]">
                        Supervised Mode
                      </span>
                      <span className="mt-1 block text-sm text-[var(--theme-muted-2)]">
                        Require approval before each task
                      </span>
                    </span>
                  </label>

                  {canResetSavedState ? (
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--theme-text)]">
                          Reset saved state
                        </p>
                        <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                          Clear mission history and any persisted Conductor
                          mission state.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false)
                          conductor.resetSavedState()
                          setGoalDraft('')
                          setContinueDraft('')
                          setSelectedTaskId(null)
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-accent)]"
                      >
                        <HugeiconsIcon
                          icon={RefreshIcon}
                          size={14}
                          strokeWidth={1.7}
                        />
                        Reset
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {directoryBrowserOpen ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-bg)_55%,transparent)] px-4 py-6 backdrop-blur-md"
              onClick={closeDirectoryBrowser}
            >
              <div
                className="w-full max-w-2xl rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] p-5 shadow-[0_24px_80px_var(--theme-shadow)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                      Directory Browser
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--theme-text)]">
                      Choose project directory
                    </h3>
                    <p className="mt-2 text-sm text-[var(--theme-muted-2)]">
                      Select the folder where Conductor should create project
                      output.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDirectoryBrowser}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] text-lg text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    aria-label="Close directory browser"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDirectoryBrowserPath(
                          getParentDirectory(directoryBrowserPath),
                        )
                      }
                      disabled={
                        directoryBrowserLoading ||
                        getParentDirectory(directoryBrowserPath) ===
                          directoryBrowserPath
                      }
                      className={cn(
                        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        directoryBrowserLoading ||
                          getParentDirectory(directoryBrowserPath) ===
                            directoryBrowserPath
                          ? 'cursor-not-allowed border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] opacity-60'
                          : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]',
                      )}
                    >
                      Up
                    </button>
                    <div className="min-w-0 flex-1 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1 text-sm">
                        {directoryBreadcrumbs.map(
                          (crumb: any, index: number) => (
                            <div
                              key={crumb.path}
                              className="flex items-center gap-1"
                            >
                              {index > 0 ? (
                                <span className="text-[var(--theme-muted-2)]">
                                  /
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  setDirectoryBrowserPath(crumb.path)
                                }
                                className={cn(
                                  'rounded-md px-1.5 py-0.5 transition-colors',
                                  crumb.path === directoryBrowserPath
                                    ? 'bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                                    : 'text-[var(--theme-text)] hover:bg-[var(--theme-card2)]',
                                )}
                              >
                                {crumb.label}
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                        Current path
                      </span>
                      <span className="truncate text-sm text-[var(--theme-text)]">
                        {directoryBrowserPath}
                      </span>
                    </div>
                  </div>

                  {directoryBrowserError ? (
                    <div className="rounded-2xl border border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] px-4 py-3 text-sm text-[var(--theme-warning)]">
                      {directoryBrowserError}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]">
                    <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                        Folders
                      </span>
                      {directoryBrowserLoading ? (
                        <span className="text-xs text-[var(--theme-muted-2)]">
                          Loading…
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--theme-muted-2)]">
                          {directoryBrowserEntries.length} visible
                        </span>
                      )}
                    </div>
                    <div className="max-h-[22rem] overflow-y-auto p-2">
                      {directoryBrowserLoading ? (
                        <div className="flex items-center justify-center gap-3 px-4 py-10 text-sm text-[var(--theme-muted)]">
                          <div className="size-4 animate-spin rounded-full border-2 border-[var(--theme-border)] border-t-[var(--theme-accent)]" />
                          <span>Loading folders…</span>
                        </div>
                      ) : directoryBrowserEntries.length > 0 ? (
                        <div className="space-y-1">
                          {directoryBrowserEntries.map((entry: any) => (
                            <button
                              key={entry.path}
                              type="button"
                              onClick={() =>
                                setDirectoryBrowserPath(entry.path)
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)]"
                            >
                              <span className="inline-flex size-2 rounded-full bg-[var(--theme-accent)]" />
                              <span className="min-w-0 flex-1 truncate">
                                {entry.name}
                              </span>
                              <span className="text-xs text-[var(--theme-muted)]">
                                Open
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-10 text-center text-sm text-[var(--theme-muted)]">
                          No folders found in this location.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                      Quick paths
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getDirectorySuggestions().map((pathOption) => (
                        <button
                          key={pathOption}
                          type="button"
                          onClick={() => setDirectoryBrowserPath(pathOption)}
                          className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                        >
                          {pathOption}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeDirectoryBrowser}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({ projectsDir: directoryBrowserPath })
                        closeDirectoryBrowser()
                      }}
                      className="rounded-xl bg-[var(--theme-accent)] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--theme-accent-strong)]"
                    >
                      Select This Directory
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    )
  }

  if (phase === 'preview') {
    return (
      <div
        className="flex min-h-dvh flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]"
        style={THEME_STYLE}
      >
        <main className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 py-4 pb-4 md:pb-[calc(var(--tabbar-h,80px)+1rem)] md:px-6 md:py-8">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-accent)]">
                Mission Decomposition
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {conductor.goal}
              </h1>
              <p className="text-sm text-[var(--theme-muted-2)]">
                The agent is breaking the mission into workers. Once they spawn,
                this view flips into the active board.
              </p>
            </div>

            <section className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Mission Planning
                  </p>
                  <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                    Analyzing your request and preparing agents
                  </p>
                </div>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300 animate-pulse">
                  Working
                </span>
              </div>
              <div className="mt-4 min-h-[200px] overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                {conductor.planText ? (
                  <div className="space-y-4">
                    <Markdown className="max-h-[500px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                      {conductor.planText.replace(/(.{20,}?)\1+/g, '$1')}
                    </Markdown>
                    <PlanningIndicator />
                  </div>
                ) : (
                  <PlanningIndicator />
                )}
              </div>
              {conductor.streamError && (
                <div className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  {conductor.streamError}
                </div>
              )}
              {conductor.timeoutWarning && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-3">
                  <p className="text-sm text-amber-700">
                    ⚠️ Planning is taking longer than expected...
                  </p>
                  <Button
                    type="button"
                    onClick={handleNewMission}
                    className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {conductor.tasks.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Identified Tasks ({conductor.tasks.length})
                  </p>
                  {conductor.tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2 text-sm"
                    >
                      <span className="size-2 rounded-full bg-zinc-500" />
                      <span className="text-[var(--theme-text)]">
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div
        className="flex min-h-dvh flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]"
        style={THEME_STYLE}
      >
        <main className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 py-4 pb-4 md:pb-[calc(var(--tabbar-h,80px)+1rem)] md:px-6 md:py-8">
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
                Conductor
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
            </div>
            {conductor.streamError && (
              <div className="rounded-2xl border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5 text-[var(--theme-danger)]">
                      ❌
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--theme-danger)]">
                        Mission failed
                      </p>
                      <p className="mt-1 text-sm text-[var(--theme-danger)]/90">
                        {conductor.streamError}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <WorkflowHelpModal
                      compact
                      eyebrow="Conductor"
                      title="How Conductor works"
                      sections={[
                        {
                          title: 'What Conductor is for',
                          bullets: [
                            'Conductor is the mission-level orchestration surface for coordinated agent execution.',
                            'Use it when one goal should be planned, assigned, and tracked end to end.',
                          ],
                        },
                        {
                          title: 'Typical flow',
                          bullets: [
                            'Start a mission, watch worker progress, and intervene only when something is blocked or clearly off-course.',
                            'Use the mission views to understand what happened before retrying or launching the next mission.',
                          ],
                        },
                        {
                          title: 'FAQ',
                          bullets: [
                            'If Conductor says upstream is unavailable, the underlying runtime capability is not ready yet.',
                            'Conductor is for orchestration, not first-time setup. Fix setup issues in Operations first.',
                          ],
                        },
                      ]}
                    />
                    <Button
                      type="button"
                      onClick={() => void conductor.retryMission()}
                      className="rounded-xl border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-4 text-[var(--theme-danger)] hover:bg-[var(--theme-danger-soft-strong)]"
                    >
                      Retry Mission
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNewMission}
                      className="rounded-xl bg-[var(--theme-accent)] px-4 text-white hover:bg-[var(--theme-accent-strong)]"
                    >
                      New Mission
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p
                    className={cn(
                      'text-xs font-semibold uppercase tracking-[0.24em]',
                      conductor.streamError
                        ? 'text-red-400'
                        : 'text-[var(--theme-accent)]',
                    )}
                  >
                    {conductor.streamError
                      ? 'Mission Stopped'
                      : 'Mission Complete'}
                  </p>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-2xl">
                    {conductor.goal}
                  </h1>
                  <p className="mt-2 text-xs text-[var(--theme-muted-2)]">
                    {completedWorkers}/
                    {Math.max(totalWorkers, completedWorkers)} workers finished
                    ·{' '}
                    {formatElapsedTime(
                      conductor.missionStartedAt,
                      conductor.completedAt
                        ? new Date(conductor.completedAt).getTime()
                        : now,
                    )}{' '}
                    total elapsed
                  </p>
                </div>
                <div className="flex gap-2">
                  {!completePhaseProjectPath || !previewState.ready ? (
                    <Button
                      type="button"
                      onClick={() => setContinueModalOpen(true)}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-4 text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    >
                      Continue
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={handleNewMission}
                    className="rounded-xl bg-[var(--theme-accent)] px-5 text-white hover:bg-[var(--theme-accent-strong)]"
                  >
                    New Mission
                  </Button>
                </div>
              </div>
            </div>

            {completePhaseProjectPath && previewState.ready ? (
              <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                      Output Preview
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                      {completePhaseProjectPath.split('/').pop() ||
                        'index.html'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                    >
                      Open in new tab ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => setContinueModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                    >
                      Continue
                    </button>
                  </div>
                </div>
                <div className="mt-4 overflow-auto rounded-2xl border border-[var(--theme-border)] bg-white">
                  <iframe
                    src={previewUrl}
                    className="h-[clamp(280px,55vh,520px)] w-full"
                    sandbox=""
                    title="Mission output preview"
                  />
                </div>
              </section>
            ) : completePhaseProjectPath &&
              previewState.loading &&
              !conductor.streamError ? (
              <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                <div className="flex items-center gap-3 text-sm text-[var(--theme-muted)]">
                  <div className="size-4 animate-spin rounded-full border-2 border-[var(--theme-border)] border-t-[var(--theme-accent)]" />
                  Loading output preview…
                </div>
              </section>
            ) : null}

            {/* Worker output fallback — show when no iframe preview is available */}
            {(!completePhaseProjectPath || previewState.unavailable) &&
              (() => {
                const outputSections = conductor.workers
                  .map((worker: any, index: number) => {
                    const output = (
                      conductor.workerOutputs[worker.key] ??
                      getLastAssistantMessage(
                        worker.raw.messages as
                          | Array<HistoryMessage>
                          | undefined,
                      )
                    ).trim()
                    if (!output) return null
                    const persona = getAgentPersona(index)
                    return {
                      key: worker.key,
                      persona,
                      label: worker.label,
                      output,
                    }
                  })
                  .filter(
                    (section: any): section is NonNullable<typeof section> =>
                      section !== null,
                  )

                const fallbackText =
                  outputSections.length > 0
                    ? outputSections
                        .map(
                          (s: any) =>
                            `### ${s.persona.emoji} ${s.persona.name} · ${s.label}\n\n${s.output}`,
                        )
                        .join('\n\n---\n\n')
                    : conductor.streamText.trim()

                if (!fallbackText) return null

                return (
                  <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                          Output
                        </p>
                        <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                          {completePhaseProjectPath
                            ? `Preview unavailable for ${completePhaseOutputLabel}`
                            : 'Agent work output'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                      <Markdown className="max-h-[600px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                        {fallbackText}
                      </Markdown>
                    </div>
                  </section>
                )
              })()}

            {conductor.tasks.length > 1 && completedTaskOutputs.length > 0 && (
              <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                      Task Outputs
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
                      Per-task output snapshots from completed workers.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {completedTaskOutputs.map((task: any) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-400" />
                            <p className="truncate text-sm font-medium text-[var(--theme-text)]">
                              {task.title}
                            </p>
                          </div>
                        </div>
                        {task.previewUrl && (
                          <a
                            href={task.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                          >
                            Preview
                          </a>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-[var(--theme-muted)]">
                        {task.previewText}
                        {(task.output ?? '').trim().length > 200 ? '…' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    Agent Summary
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    conductor.streamError
                      ? 'border border-red-400/35 bg-red-500/10 text-red-300'
                      : 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-300',
                  )}
                >
                  {conductor.streamError ? 'Stopped' : 'Complete'}
                </span>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                {completeSummary ? (
                  <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                    {completeSummary}
                  </Markdown>
                ) : conductor.streamText ? (
                  <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                    {conductor.streamText}
                  </Markdown>
                ) : (
                  <p className="text-sm text-[var(--theme-muted)]">
                    No summary captured.
                  </p>
                )}
              </div>
              {conductor.workers.length > 0 && (
                <div className="mt-4 space-y-2">
                  {conductor.workers.map((worker: any, index: number) => {
                    const persona = getAgentPersona(index)
                    const shortModelName = getShortModelName(worker.model)
                    return (
                      <div
                        key={worker.key}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                      >
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span className="font-medium text-[var(--theme-text)]">
                          {persona.emoji} {persona.name}
                        </span>
                        <span className="text-[var(--theme-muted)]">
                          {worker.label}
                        </span>
                        <span className="ml-auto text-xs text-[var(--theme-muted)]">
                          {shortModelName} ·{' '}
                          {worker.totalTokens.toLocaleString()} tok
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              {(totalTokens > 0 || completeMissionCostWorkers.length > 0) && (
                <div className="mt-4">
                  <MissionCostSection
                    totalTokens={totalTokens}
                    workers={completeMissionCostWorkers}
                    expanded={completeCostExpanded}
                    onToggle={() =>
                      setCompleteCostExpanded((current: boolean) => !current)
                    }
                  />
                </div>
              )}
              {conductor.streamText && completeSummary && (
                <details className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--theme-muted)]">
                    Raw Agent Output
                  </summary>
                  <div className="mt-4 border-t border-[var(--theme-border)] pt-4">
                    <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
                      {conductor.streamText}
                    </Markdown>
                  </div>
                </details>
              )}
            </section>
          </div>

          {continueModalOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-bg)_48%,transparent)] px-4 py-6 backdrop-blur-md"
              onClick={() => setContinueModalOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] p-5 shadow-[0_24px_80px_var(--theme-shadow)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[var(--theme-text)]">
                      Continue Mission
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContinueModalOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] text-lg text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                    aria-label="Close continue mission dialog"
                  >
                    ×
                  </button>
                </div>

                {continuationModalPreview ? (
                  <div className="mt-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                      Previous output summary
                    </p>
                    <p className="mt-2 text-sm text-[var(--theme-text)]">
                      {continuationModalPreview}
                    </p>
                  </div>
                ) : null}

                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleContinueMission()
                  }}
                >
                  <input
                    type="text"
                    value={continueDraft}
                    onChange={(event) => setContinueDraft(event.target.value)}
                    placeholder="Continue with additional instructions..."
                    disabled={conductor.isSending}
                    className="w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm text-[var(--theme-text)] outline-none transition-colors placeholder:text-[var(--theme-muted-2)] focus:border-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!continueDraft.trim() || conductor.isSending}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-colors sm:min-w-[96px]',
                        !continueDraft.trim() || conductor.isSending
                          ? 'cursor-not-allowed border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] opacity-60'
                          : 'border border-[var(--theme-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft-strong)]',
                      )}
                    >
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={16}
                        strokeWidth={1.8}
                      />
                      {conductor.isSending ? 'Sending' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-dvh flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]"
      style={THEME_STYLE}
    >
      <main className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 py-4 pb-4 md:pb-[calc(var(--tabbar-h,80px)+1rem)] md:px-6 md:py-8">
        <div className="flex w-full flex-col gap-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
              Conductor
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
          <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-5 shadow-[0_24px_80px_var(--theme-shadow)]">
            <div className="text-center">
              <h1 className="line-clamp-2 text-xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-2xl">
                {conductor.goal}
              </h1>
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--theme-muted)]">
                <span>
                  {formatElapsedMilliseconds(
                    conductor.isPaused
                      ? conductor.pausedElapsedMs
                      : conductor.missionElapsedMs,
                  )}
                </span>
                <span className="text-[var(--theme-border)]">·</span>
                <span>
                  {completedWorkers}/{Math.max(totalWorkers, 1)} complete
                </span>
                <span className="text-[var(--theme-border)]">·</span>
                <span>{activeWorkerCount} active</span>
              </div>
              {conductor.isPaused ? (
                <div className="mt-3 flex justify-center">
                  <span className="rounded-full border border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--theme-accent-strong)] animate-pulse">
                    Paused
                  </span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
              <div
                className="h-full rounded-full bg-[var(--theme-accent)] transition-[width] duration-500 ease-out"
                style={{ width: `${missionProgress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void conductor.stopMission()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--theme-danger-border, color-mix(in srgb, var(--theme-danger) 35%, white))] bg-[var(--theme-danger-soft, color-mix(in srgb, var(--theme-danger) 12%, transparent))] px-3 py-1.5 text-xs font-medium text-[var(--theme-danger)] transition-colors hover:bg-[var(--theme-danger-soft-strong, color-mix(in srgb, var(--theme-danger) 18%, transparent))]"
              >
                <span>■</span> Stop Mission
              </button>
              <button
                type="button"
                disabled={
                  !conductor.orchestratorSessionKey || conductor.isPausing
                }
                onClick={async () => {
                  if (!conductor.orchestratorSessionKey) return
                  try {
                    await conductor.pauseAgent(
                      conductor.orchestratorSessionKey,
                      !conductor.isPaused,
                    )
                  } catch {
                    // best effort
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  !conductor.orchestratorSessionKey || conductor.isPausing
                    ? 'cursor-not-allowed border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] opacity-50'
                    : conductor.isPaused
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)] hover:bg-[var(--theme-accent-soft-strong)]'
                      : 'border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]',
                )}
              >
                <span>{conductor.isPaused ? '▶' : '⏸'}</span>{' '}
                {conductor.isPausing
                  ? '...'
                  : conductor.isPaused
                    ? 'Resume'
                    : 'Pause'}
              </button>
            </div>
          </section>
          {conductor.timeoutWarning && (
            <section className="rounded-2xl border border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--theme-warning)]">
                    ⏳ Mission appears stalled — no activity for 60 seconds
                  </p>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    Sometimes the workers are still alive, but the stream went
                    quiet. Your call.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    onClick={conductor.dismissTimeoutWarning}
                    className="rounded-xl border border-[var(--theme-warning-border)] bg-[var(--theme-card)] px-4 text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
                  >
                    Keep Waiting
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void conductor.stopMission()}
                    className="rounded-xl border border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] px-4 text-[var(--theme-warning)] hover:bg-[var(--theme-warning-soft-strong)]"
                  >
                    Stop Mission
                  </Button>
                </div>
              </div>
            </section>
          )}
          <section className="max-h-[clamp(200px,40vh,360px)] overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-[0_24px_80px_var(--theme-shadow)]">
            <OfficeView
              agentRows={officeAgentRows}
              missionRunning
              onViewOutput={() => {}}
              processType="parallel"
              companyName="Conductor Office"
              containerHeight={360}
              hideHeader
            />
          </section>

          {conductor.tasks.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                  Tasks (
                  {
                    conductor.tasks.filter(
                      (task: any) => task.status === 'complete',
                    ).length
                  }
                  /{conductor.tasks.length})
                </h2>
                {conductor.tasks.map((task: any) => {
                  const isSelected = selectedTaskId === task.id
                  const statusDot =
                    task.status === 'complete'
                      ? 'bg-emerald-400'
                      : task.status === 'running'
                        ? 'bg-sky-400 animate-pulse'
                        : task.status === 'failed'
                          ? 'bg-red-400'
                          : 'bg-zinc-500'
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() =>
                        setSelectedTaskId(isSelected ? null : task.id)
                      }
                      className={cn(
                        'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)]'
                          : 'border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent)]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            statusDot,
                          )}
                        />
                        <span className="min-w-0 truncate font-medium text-[var(--theme-text)]">
                          {task.title}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-3">
                {selectedTaskId ? (
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
                      Task Output
                    </h2>
                  </div>
                ) : null}
                {(() => {
                  const selectedTask = selectedTaskId
                    ? conductor.tasks.find(
                        (task: any) => task.id === selectedTaskId,
                      )
                    : null
                  const displayWorkers = selectedTask?.workerKey
                    ? conductor.workers.filter(
                        (worker: any) => worker.key === selectedTask.workerKey,
                      )
                    : conductor.workers
                  return (
                    <div className="grid gap-3 md:grid-cols-2">
                      {displayWorkers.map((worker: any, index: number) => {
                        return (
                          <WorkerCard
                            key={worker.key}
                            worker={worker}
                            index={index}
                            conductor={conductor}
                            now={now}
                          />
                        )
                      })}
                      {displayWorkers.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-8 text-center text-sm text-[var(--theme-muted)] md:col-span-2">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center justify-center gap-3">
                              <div className="size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                              <span>Spawning workers...</span>
                            </div>
                            {conductor.planText ? (
                              <p className="max-w-xl text-xs text-[var(--theme-muted-2)]">
                                {conductor.planText}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {conductor.workers.map((worker: any, index: number) => {
                  return (
                    <WorkerCard
                      key={worker.key}
                      worker={worker}
                      index={index}
                      conductor={conductor}
                      now={now}
                    />
                  )
                })}
                {conductor.workers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-8 text-center text-sm text-[var(--theme-muted)] md:col-span-2">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center justify-center gap-3">
                        <div className="size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                        <span>Spawning workers...</span>
                      </div>
                      {conductor.planText ? (
                        <p className="max-w-xl text-xs text-[var(--theme-muted-2)]">
                          {conductor.planText}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
