import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CpuIcon } from '@hugeicons/core-free-icons'

import { OperationalWorkerCard } from './operational-worker-card'
import { Swarm2KanbanBoard } from './swarm2-kanban-board'
import { Swarm2OrchestratorCard } from './swarm2-orchestrator-card'
import { Swarm2ReportsView } from './swarm2-reports-view'
import { Swarm2Wires } from './swarm2-wires'
import {
  buildActiveMissionQueue,
  commandForRuntime,
  formatAssignedModel,
  recentRuntimeLines,
} from './lib/swarm2-workflow'
import type { CrewMember } from '@/hooks/use-crew-status'
import type { Swarm2InboxItem } from './swarm2-reports-view'
import type {
  RuntimeEntry,
  SwarmMissionSummary,
  ViewMode,
} from './lib/swarm2-workflow'
import { cn } from '@/lib/utils'
import { SwarmTerminal } from '@/components/swarm/swarm-terminal'
import { SetupEmptyState } from '@/components/setup-empty-state'

export type ControlPlaneStageProps = {
  members: Array<CrewMember>
  selectedId: string | null
  roomIds: Array<string>
  activeRuntimeCount: number
  authErrors: number
  selectedLabel: string
  workspaceModel: string | null
  lanes: Array<{ role: string; count: number; active: number }>
  activeAgents: Array<{
    workerId: string
    workerName: string
    role: string
    task: string
    progress: number
    state: 'working' | 'reviewing' | 'blocked' | 'ready'
    age: string
  }>
  recentUpdates: Array<{
    workerId: string
    workerName: string
    text: string
    age: string
    tone: 'idle' | 'active' | 'warning'
  }>
  latestMission: {
    id: string
    title: string
    state: string
    assignmentCount: number
    checkpointedCount: number
  } | null
  missions: Array<SwarmMissionSummary>
  runtimeEntries: Array<RuntimeEntry>
  inboxCounts: { needsReview: number; blocked: number; ready: number }
  routerSeed: {
    key: number
    prompt: string
    mode: 'auto' | 'manual' | 'broadcast'
  } | null
  onOpenInboxItem: (item: Swarm2InboxItem) => void
  onRouteToReviewer: (item: Swarm2InboxItem) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenRouter: () => void
  onRouterResults: () => void
  onSelect: (workerId: string) => void
  onToggleRoom: (workerId: string) => void
  onOpenTui: (workerId: string) => void
  onOpenTasks: (workerId: string) => void
  runtimeByWorker: Map<string, RuntimeEntry>
  terminalTargets: Array<CrewMember>
  tmuxAvailable: boolean
  pendingTmux: Set<string>
  focusedRuntimeWorkerId: string | null
  onToggleFocusedRuntimeWorker: (workerId: string) => void
  onClearFocusedRuntimeWorker: () => void
  onStartAgentSession: (workerId: string) => void
  onScrollTmuxSession: (
    workerId: string,
    direction: 'up' | 'down',
    session?: string | null,
  ) => void
}

export function ControlPlaneStage({
  members,
  selectedId,
  roomIds,
  activeRuntimeCount,
  authErrors,
  selectedLabel,
  workspaceModel,
  lanes,
  activeAgents,
  recentUpdates,
  latestMission,
  missions,
  runtimeEntries,
  inboxCounts,
  routerSeed,
  onOpenInboxItem,
  onRouteToReviewer,
  viewMode,
  onViewModeChange,
  onOpenRouter,
  onRouterResults,
  onSelect,
  onToggleRoom,
  onOpenTui,
  onOpenTasks,
  runtimeByWorker,
  terminalTargets,
  tmuxAvailable,
  pendingTmux,
  focusedRuntimeWorkerId,
  onToggleFocusedRuntimeWorker,
  onClearFocusedRuntimeWorker,
  onStartAgentSession,
  onScrollTmuxSession,
}: ControlPlaneStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const workerRefsMap = useRef<Map<string, HTMLElement>>(new Map())
  const cardSetters = useRef<Map<string, (node: HTMLElement | null) => void>>(
    new Map(),
  )
  const [refsVersion, setRefsVersion] = useState(0)
  const bumpRefsVersion = useCallback(() => {
    setRefsVersion((value) => value + 1)
  }, [])

  const setAnchor = useCallback(
    (node: HTMLDivElement | null) => {
      if (anchorRef.current === node) return
      anchorRef.current = node
      bumpRefsVersion()
    },
    [bumpRefsVersion],
  )

  const setWorkerRef = useCallback(
    (workerId: string) => {
      const existing = cardSetters.current.get(workerId)
      if (existing) return existing
      const setter = (node: HTMLElement | null) => {
        const map = workerRefsMap.current
        const prior = map.get(workerId) ?? null
        if (node === prior) return
        if (node) map.set(workerId, node)
        else map.delete(workerId)
        bumpRefsVersion()
      }
      cardSetters.current.set(workerId, setter)
      return setter
    },
    [bumpRefsVersion],
  )

  // Drop stale setters for workers that left the roster.
  useEffect(() => {
    const liveIds = new Set(members.map((member) => member.id))
    let mutated = false
    for (const id of cardSetters.current.keys()) {
      if (!liveIds.has(id)) {
        cardSetters.current.delete(id)
        workerRefsMap.current.delete(id)
        mutated = true
      }
    }
    if (mutated) bumpRefsVersion()
  }, [members, bumpRefsVersion])

  const wireTargets = useMemo(
    () =>
      members.map((member) => ({
        id: member.id,
        selected: member.id === selectedId,
        inRoom: roomIds.includes(member.id),
      })),
    [members, selectedId, roomIds],
  )
  const activeMissionQueue = useMemo(
    () => buildActiveMissionQueue(missions, 2),
    [missions],
  )
  const visibleCardMembers = useMemo(() => {
    const ordered = selectedId
      ? [
          ...members.filter((member) => member.id === selectedId),
          ...members.filter((member) => member.id !== selectedId),
        ]
      : members
    return ordered.slice(0, 6)
  }, [members, selectedId])

  return (
    <section
      ref={stageRef}
      className="relative overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-[0_24px_80px_var(--theme-shadow)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--theme-accent-soft),transparent_42%)]" />
      <Swarm2Wires
        containerRef={stageRef}
        anchorRef={anchorRef}
        workerRefs={workerRefsMap.current}
        workers={wireTargets}
        version={refsVersion}
      />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-full max-w-5xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
                Active missions
              </div>
              <div className="mt-1 text-sm text-[var(--theme-muted-2)]">
                Running, blocked, and review work.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onViewModeChange('reports')}
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
            >
              Reports
            </button>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {activeMissionQueue.map((mission) => (
              <article
                key={mission.id}
                className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--theme-text)]">
                      {mission.title}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--theme-muted-2)]">
                      {mission.nextAction}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                    {mission.state}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-[var(--theme-muted)]">
                  <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
                    <div className="text-sm font-semibold text-[var(--theme-text)]">
                      {mission.assignmentCount}
                    </div>
                    <div>tasks</div>
                  </div>
                  <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1">
                    <div className="text-sm font-semibold text-[var(--theme-text)]">
                      {mission.checkpointedCount}
                    </div>
                    <div>checked</div>
                  </div>
                  <div className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] px-2 py-1 text-[var(--theme-warning)]">
                    <div className="text-sm font-semibold">
                      {mission.reviewCount}
                    </div>
                    <div>review</div>
                  </div>
                  <div className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-2 py-1 text-[var(--theme-danger)]">
                    <div className="text-sm font-semibold">
                      {mission.blockedCount}
                    </div>
                    <div>blocked</div>
                  </div>
                </div>
              </article>
            ))}
            {activeMissionQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-sm text-[var(--theme-muted)]">
                No active missions.
              </div>
            ) : null}
          </div>
        </div>
        <Swarm2OrchestratorCard
          totalWorkers={members.length}
          activeRuntimeCount={activeRuntimeCount}
          roomCount={roomIds.length}
          authErrors={authErrors}
          selectedLabel={selectedLabel}
          workspaceModel={workspaceModel}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          lanes={lanes}
          activeAgents={activeAgents}
          recentUpdates={recentUpdates}
          latestMission={latestMission}
          inboxCounts={inboxCounts}
          members={members}
          roomIds={roomIds}
          selectedId={selectedId}
          routerSeed={routerSeed}
          onOpenRouter={onOpenRouter}
          onRouterResults={() => {
            void onRouterResults()
          }}
          onAnchorRef={setAnchor}
          className="w-full max-w-5xl"
        />
        <div className="relative w-full pt-3">
          <div
            className={cn(
              'relative z-10',
              viewMode === 'cards' ? 'block' : 'hidden',
            )}
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 min-[1680px]:grid-cols-3">
              {members.length === 0 ? (
                <SetupEmptyState
                  title="No swarm workers."
                  description="Crew has no workers."
                  nextAction="Open Ops, then check crew."
                  detail="/api/crew-status + /api/swarm-roster"
                  className="col-span-full p-8 text-[var(--theme-muted)]"
                  action={
                    <a
                      href="/workspace/agents/operations"
                      className="inline-flex rounded-xl bg-primary-900 px-3 py-2 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Operations
                    </a>
                  }
                />
              ) : (
                visibleCardMembers.map((member) => {
                  const runtime = runtimeByWorker.get(member.id)
                  return (
                    <OperationalWorkerCard
                      key={member.id}
                      cardRef={setWorkerRef(member.id)}
                      member={member}
                      currentTask={runtime?.currentTask ?? null}
                      checkpointStatus={runtime?.checkpointStatus ?? null}
                      runtimeState={runtime?.state ?? null}
                      recentLines={recentRuntimeLines(runtime)}
                      recentOutputAt={
                        runtime?.lastOutputAt ??
                        runtime?.lastSessionStartedAt ??
                        null
                      }
                      recentSummary={
                        runtime?.lastRealSummary ??
                        runtime?.lastRealResult ??
                        runtime?.lastSummary ??
                        runtime?.lastResult ??
                        runtime?.blockedReason ??
                        null
                      }
                      artifacts={runtime?.artifacts ?? []}
                      previews={runtime?.previews ?? []}
                      inRoom={roomIds.includes(member.id)}
                      selected={member.id === selectedId}
                      onSelect={() => onSelect(member.id)}
                      onToggleRoom={() => onToggleRoom(member.id)}
                      onOpenTui={() => onOpenTui(member.id)}
                      onOpenTasks={() => onOpenTasks(member.id)}
                    />
                  )
                })
              )}
            </div>
            {members.length > visibleCardMembers.length ? (
              <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-center text-xs text-[var(--theme-muted)]">
                {members.length - visibleCardMembers.length} more workers in
                Runtime and Reports.
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              'relative z-10 flex flex-col gap-3',
              viewMode === 'runtime' ? 'block' : 'hidden',
            )}
          >
            {!tmuxAvailable ? (
              <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2.5 text-xs text-amber-100">
                <div className="font-semibold text-amber-50">
                  tmux not installed on this host
                </div>
                <div className="mt-1 text-amber-100/80">Install tmux:</div>
                <code className="mt-1 inline-block rounded bg-black/30 px-2 py-0.5 text-[10px] text-amber-100">
                  brew install tmux
                </code>{' '}
                <span className="text-amber-100/60">(macOS) or</span>{' '}
                <code className="inline-block rounded bg-black/30 px-2 py-0.5 text-[10px] text-amber-100">
                  apt install tmux
                </code>{' '}
                <span className="text-amber-100/60">(Ubuntu/Debian).</span>
              </div>
            ) : null}
            {focusedRuntimeWorkerId ? (
              <div className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-xs text-[var(--theme-muted)]">
                <span>
                  Focus mode on{' '}
                  <span className="font-semibold text-[var(--theme-text)]">
                    {members.find(
                      (member) => member.id === focusedRuntimeWorkerId,
                    )?.displayName || focusedRuntimeWorkerId}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onClearFocusedRuntimeWorker}
                  className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-card2)] hover:text-[var(--theme-text)]"
                >
                  Exit focus
                </button>
              </div>
            ) : null}
            <div
              className={cn(
                'grid grid-cols-1 gap-3',
                focusedRuntimeWorkerId ? '' : '2xl:grid-cols-2',
              )}
            >
              {terminalTargets.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] p-8 text-sm text-[var(--theme-muted)]">
                  No active workers. Select or add one.
                </div>
              ) : (
                terminalTargets.map((member) => {
                  const runtime = runtimeByWorker.get(member.id)
                  const cmd = commandForRuntime(runtime, 'auto')
                  const kindBadgeClass =
                    cmd.kind === 'tmux'
                      ? 'border-[var(--theme-accent)]/40 bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                      : cmd.kind === 'log-tail'
                        ? 'border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] text-[var(--theme-warning)]'
                        : 'border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)]'
                  const titleLabel = member.displayName || member.id
                  const modelLabel = formatAssignedModel(
                    member.model,
                    member.provider,
                  )
                  return (
                    <div
                      key={member.id}
                      className="overflow-hidden rounded-[1.5rem] border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-[0_20px_60px_color-mix(in_srgb,var(--theme-shadow)_14%,transparent)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border)] px-3 py-2 text-[11px] text-[var(--theme-muted)]">
                        <span className="inline-flex items-center gap-2 font-semibold text-[var(--theme-text)]">
                          <HugeiconsIcon icon={CpuIcon} size={13} />
                          <span>{titleLabel}</span>
                          <span className="text-[10px] font-medium text-[var(--theme-muted)]">
                            · {modelLabel}
                          </span>
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          {runtime?.tmuxAttachable ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  onScrollTmuxSession(
                                    member.id,
                                    'up',
                                    runtime.tmuxSession,
                                  )
                                }
                                className="rounded-full border border-transparent px-1.5 py-0.5 text-[12px] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-border)] hover:bg-[var(--theme-card2)] hover:text-[var(--theme-text)]"
                                title={`Scroll up in ${runtime.tmuxSession ?? `swarm-${member.id}`}`}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onScrollTmuxSession(
                                    member.id,
                                    'down',
                                    runtime.tmuxSession,
                                  )
                                }
                                className="rounded-full border border-transparent px-1.5 py-0.5 text-[12px] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-border)] hover:bg-[var(--theme-card2)] hover:text-[var(--theme-text)]"
                                title={`Scroll down in ${runtime.tmuxSession ?? `swarm-${member.id}`}`}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onToggleFocusedRuntimeWorker(member.id)
                                }
                                className="rounded-full border border-transparent px-1.5 py-0.5 text-[12px] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-border)] hover:bg-[var(--theme-card2)] hover:text-[var(--theme-text)]"
                                title={
                                  focusedRuntimeWorkerId === member.id
                                    ? `Exit focus for swarm-${member.id}`
                                    : `Focus swarm-${member.id}`
                                }
                              >
                                {focusedRuntimeWorkerId === member.id
                                  ? '⛶'
                                  : '⤢'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                pendingTmux.has(member.id) || !tmuxAvailable
                              }
                              onClick={() => onStartAgentSession(member.id)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] transition-colors',
                                'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)] hover:opacity-90',
                                (pendingTmux.has(member.id) ||
                                  !tmuxAvailable) &&
                                  'cursor-not-allowed opacity-50',
                              )}
                              title={
                                tmuxAvailable
                                  ? `Start tmux: swarm-${member.id}`
                                  : 'tmux is not installed on this host'
                              }
                            >
                              {pendingTmux.has(member.id)
                                ? 'Starting…'
                                : 'Start'}
                            </button>
                          )}
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]',
                            kindBadgeClass,
                          )}
                          title={cmd.command.join(' ')}
                        >
                          {cmd.kind === 'tmux'
                            ? 'tmux'
                            : cmd.kind === 'log-tail'
                              ? 'logs'
                              : 'shell'}
                        </span>
                      </div>
                      <SwarmTerminal
                        workerId={member.id}
                        command={cmd.command}
                        cwd={runtime?.cwd ?? undefined}
                        height={420}
                        active={viewMode === 'runtime'}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div
            className={cn(
              'relative z-10',
              viewMode === 'kanban' ? 'block' : 'hidden',
            )}
          >
            <Swarm2KanbanBoard
              workers={members}
              latestMission={latestMission}
              selectedWorkerId={selectedId}
              onSelectWorker={onSelect}
              onOpenRouter={onOpenRouter}
            />
          </div>

          <div
            className={cn(
              'relative z-10',
              viewMode === 'reports' ? 'block' : 'hidden',
            )}
          >
            <Swarm2ReportsView
              missions={missions}
              runtimes={runtimeEntries}
              onSelectWorker={(workerId) => {
                onSelect(workerId)
                onViewModeChange('cards')
              }}
              onOpenItem={onOpenInboxItem}
              onRouteToReviewer={onRouteToReviewer}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
