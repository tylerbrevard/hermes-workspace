'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlarmClockIcon,
  MessageMultiple01Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import { Swarm2AddAgentModal } from './swarm2-add-agent-modal'
import { ControlPlaneStage } from './swarm2-control-plane-stage'
import { Swarm2ActivityFeed } from './swarm2-activity-feed'
import { buildSwarm2InboxLanes } from './swarm2-reports-view'
import {
  ROLE_PRESETS,
  buildSwarm2CockpitTiles,
  buildWorkerOperatorStates,
  chooseRecommendedWorker,
  cleanSwarmLabel,
  commandForRuntime,
  compactText,
  displayTaskTitle,
  formatAssignedModel,
  getSwarmSurfaceDistinction,
  isRuntimeActive,
  progressForRuntime,
  recentRuntimeLines,
  relativeTime,
  sortSwarmMembers,
} from './lib/swarm2-workflow'
import type { Swarm2InboxItem } from './swarm2-reports-view'
import type { CSSProperties } from 'react'
import type {
  HealthData,
  RuntimeEntry,
  SwarmMissionSummary,
  SwarmMissionsResponse,
  SwarmRosterResponse,
  SwarmRosterWorker,
  SwarmWorkerOperatorState,
  ViewMode,
} from './lib/swarm2-workflow'
import { toast } from '@/components/ui/toast'
import { useCrewStatus } from '@/hooks/use-crew-status'
import { RouterChat } from '@/components/swarm/router-chat'
import { WorkflowHelpModal } from '@/components/workflow-help-modal'
import { cn } from '@/lib/utils'

const SWARM2_ROOM_STORAGE_KEY = 'claude-swarm2-room-v1'

const SWARM2_OPERATION_THEME: CSSProperties = {
  ['--theme-bg' as string]: 'var(--color-surface)',
  ['--theme-card' as string]: 'var(--color-primary-50)',
  ['--theme-card2' as string]: 'var(--color-primary-100)',
  ['--theme-border' as string]: 'var(--color-primary-200)',
  ['--theme-border2' as string]: 'var(--color-primary-400)',
  ['--theme-text' as string]: 'var(--color-ink)',
  ['--theme-muted' as string]: 'var(--color-primary-700)',
  ['--theme-muted-2' as string]: 'var(--color-primary-600)',
  ['--theme-accent' as string]: 'var(--color-accent-500)',
  ['--theme-accent-strong' as string]: 'var(--color-accent-600)',
  ['--theme-accent-soft' as string]:
    'color-mix(in srgb, var(--color-accent-500) 12%, transparent)',
  ['--theme-accent-soft-strong' as string]:
    'color-mix(in srgb, var(--color-accent-500) 18%, transparent)',
  ['--theme-shadow' as string]:
    'color-mix(in srgb, var(--color-primary-950) 14%, transparent)',
  ['--theme-danger' as string]: 'var(--color-red-600, #dc2626)',
  ['--theme-danger-soft' as string]:
    'color-mix(in srgb, var(--theme-danger) 12%, transparent)',
  ['--theme-danger-border' as string]:
    'color-mix(in srgb, var(--theme-danger) 35%, white)',
  ['--theme-warning' as string]: 'var(--color-amber-600, #d97706)',
  ['--theme-warning-soft' as string]:
    'color-mix(in srgb, var(--theme-warning) 12%, transparent)',
  ['--theme-warning-border' as string]:
    'color-mix(in srgb, var(--theme-warning) 35%, white)',
}

async function fetchAvailableModels(): Promise<
  Array<{ id: string; name: string; provider: string }>
> {
  try {
    const res = await fetch('/api/models')
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.ok || !Array.isArray(data?.data)) return []
    return data.data
  } catch {
    return []
  }
}

type RuntimeResponse = {
  entries: Array<RuntimeEntry>
  tmuxAvailable?: boolean
  checkedAt?: number
}

async function fetchRuntime(): Promise<RuntimeResponse> {
  const res = await fetch('/api/swarm-runtime')
  if (!res.ok) throw new Error(`Runtime request failed: ${res.status}`)
  return res.json()
}

async function fetchHealth(): Promise<HealthData> {
  const res = await fetch('/api/swarm-health')
  if (!res.ok) throw new Error(`Health request failed: ${res.status}`)
  return res.json()
}

async function fetchRoster(): Promise<Array<SwarmRosterWorker>> {
  const res = await fetch('/api/swarm-roster')
  if (!res.ok) throw new Error(`Roster request failed: ${res.status}`)
  const data = (await res.json()) as SwarmRosterResponse
  return Array.isArray(data.roster?.workers) ? data.roster.workers : []
}

async function fetchMissions(): Promise<Array<SwarmMissionSummary>> {
  const res = await fetch('/api/swarm-missions?limit=50')
  if (!res.ok) throw new Error(`Missions request failed: ${res.status}`)
  const data = (await res.json()) as SwarmMissionsResponse
  return Array.isArray(data.missions) ? data.missions : []
}

function useUpdatedAgo(fetchedAt: number | null): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function update() {
      if (!fetchedAt) {
        setLabel('')
        return
      }
      const diff = Math.floor((Date.now() - fetchedAt) / 1000)
      if (diff < 5) setLabel('just now')
      else if (diff < 60) setLabel(`${diff}s ago`)
      else setLabel(`${Math.floor(diff / 60)}m ago`)
    }

    update()
    const id = setInterval(update, 5_000)
    return () => clearInterval(id)
  }, [fetchedAt])

  return label
}

function scrollNodeToTop(node: HTMLElement | null) {
  if (!node) return
  node.scrollTop = 0
  node.scrollLeft = 0
}

function withInstantScroll<T>(anchor: HTMLElement | null, fn: () => T): T {
  if (typeof window === 'undefined') return fn()

  const targets: Array<HTMLElement> = []
  if (document.documentElement instanceof HTMLElement)
    targets.push(document.documentElement)
  if (document.body instanceof HTMLElement) targets.push(document.body)

  let current: HTMLElement | null = anchor
  while (current) {
    targets.push(current)
    current = current.parentElement
  }

  for (const selector of [
    'main',
    '[data-slot="content"]',
    '[data-slot="main"]',
    '[data-scroll-container]',
  ]) {
    const node = document.querySelector(selector)
    if (node instanceof HTMLElement) targets.push(node)
  }

  const deduped = [...new Set(targets)].filter(
    (node) => !node.closest('.xterm'),
  )
  const previous = deduped.map(
    (node) => [node, node.style.scrollBehavior] as const,
  )
  for (const [node] of previous) node.style.scrollBehavior = 'auto'
  try {
    return fn()
  } finally {
    for (const [node, value] of previous) node.style.scrollBehavior = value
  }
}

function scrollContextToTop(anchor: HTMLElement | null) {
  if (typeof window === 'undefined') return

  withInstantScroll(anchor, () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    let current: HTMLElement | null = anchor
    while (current) {
      scrollNodeToTop(current)
      current = current.parentElement
    }

    const candidates = [
      document.querySelector('main'),
      document.querySelector('[data-slot="content"]'),
      document.querySelector('[data-slot="main"]'),
      document.querySelector('[data-scroll-container]'),
    ]

    for (const node of candidates) {
      if (node instanceof HTMLElement && !node.closest('.xterm'))
        scrollNodeToTop(node)
    }

    if (anchor) {
      anchor.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
  })
}

function scheduleScrollContextToTop(anchor: HTMLElement | null) {
  if (typeof window === 'undefined') return () => {}

  let cancelled = false
  const timers: Array<number> = []
  const frames: Array<number> = []

  const run = () => {
    if (cancelled) return
    scrollContextToTop(anchor)
  }

  run()
  frames.push(window.requestAnimationFrame(run))
  frames.push(
    window.requestAnimationFrame(() => window.requestAnimationFrame(run)),
  )
  timers.push(window.setTimeout(run, 0))
  timers.push(window.setTimeout(run, 50))
  timers.push(window.setTimeout(run, 150))
  timers.push(window.setTimeout(run, 300))

  return () => {
    cancelled = true
    for (const id of timers) window.clearTimeout(id)
    for (const id of frames) window.cancelAnimationFrame(id)
  }
}

export const __runtimeTabInternals = {
  commandForRuntime,
  isRuntimeActive,
}

export function Swarm2Screen() {
  const { crew, lastUpdated } = useCrewStatus()
  useUpdatedAgo(lastUpdated)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [roomIds, setRoomIds] = useState<Array<string>>(() => {
    if (typeof window === 'undefined') return []
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(SWARM2_ROOM_STORAGE_KEY) ?? '[]',
      )
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
    } catch {
      return []
    }
  })
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [routerOpen, setRouterOpen] = useState(false)
  const [routerSeed, setRouterSeed] = useState<{
    key: number
    prompt: string
    mode: 'auto' | 'manual' | 'broadcast'
  } | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [addSwarmOpen, setAddSwarmOpen] = useState(false)
  const [addSwarmSaving, setAddSwarmSaving] = useState(false)
  const [addSwarmError, setAddSwarmError] = useState<string | null>(null)
  const modelsQuery = useQuery({
    queryKey: ['swarm2', 'available-models'],
    queryFn: fetchAvailableModels,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const availableModels = modelsQuery.data ?? []
  const [newWorkerId, setNewWorkerId] = useState('')
  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerRole, setNewWorkerRole] = useState('Builder')
  const [newWorkerSpecialty, setNewWorkerSpecialty] = useState('')
  const [newWorkerModel, setNewWorkerModel] = useState('')
  const [newWorkerMission, setNewWorkerMission] = useState('')
  // Worker IDs whose tmux session is currently being started/stopped via API.
  const [pendingTmux, setPendingTmux] = useState<Set<string>>(new Set())
  const [focusedRuntimeWorkerId, setFocusedRuntimeWorkerId] = useState<
    string | null
  >(null)
  const topRef = useRef<HTMLDivElement | null>(null)

  const runtimeQuery = useQuery({
    queryKey: ['swarm2', 'runtime'],
    queryFn: fetchRuntime,
    refetchInterval: 30_000,
  })
  const healthQuery = useQuery({
    queryKey: ['swarm2', 'health'],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
  })
  const rosterQuery = useQuery({
    queryKey: ['swarm2', 'roster'],
    queryFn: fetchRoster,
    refetchInterval: 60_000,
  })
  const missionsQuery = useQuery({
    queryKey: ['swarm2', 'missions'],
    queryFn: fetchMissions,
    refetchInterval: 30_000,
  })

  const startAgentSession = useCallback(
    async (workerId: string) => {
      setPendingTmux((prev) => new Set(prev).add(workerId))
      try {
        const res = await fetch('/api/swarm-tmux-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          let parsed: { error?: string } = {}
          try {
            parsed = JSON.parse(text)
          } catch {}
          const msg = parsed.error || text || `HTTP ${res.status}`
          if (msg.includes('tmux not installed')) {
            toast(
              `tmux not installed: Swarm worker ${workerId} couldn't start because tmux is not installed on this host. Install tmux and try again. See #244.`,
              { type: 'error' },
            )
          } else {
            toast(`Failed to start ${workerId}: ${msg}`, { type: 'error' })
          }

          console.error('[swarm2] start session failed:', res.status, text)
        }
      } catch (err) {
        toast(
          `Failed to start ${workerId}: ${err instanceof Error ? err.message : String(err)}`,
          { type: 'error' },
        )
      } finally {
        setPendingTmux((prev) => {
          const next = new Set(prev)
          next.delete(workerId)
          return next
        })
        void runtimeQuery.refetch()
      }
    },
    [runtimeQuery],
  )

  const stopAgentSession = useCallback(
    async (workerId: string) => {
      setPendingTmux((prev) => new Set(prev).add(workerId))
      try {
        const res = await fetch('/api/swarm-tmux-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')

          console.error('[swarm2] stop session failed:', res.status, text)
        }
      } finally {
        setPendingTmux((prev) => {
          const next = new Set(prev)
          next.delete(workerId)
          return next
        })
        void runtimeQuery.refetch()
      }
    },
    [runtimeQuery],
  )

  const scrollTmuxSession = useCallback(
    async (
      workerId: string,
      direction: 'up' | 'down',
      session?: string | null,
    ) => {
      try {
        const res = await fetch('/api/swarm-tmux-scroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, session, direction, lines: 8 }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')

          console.error('[swarm2] tmux scroll failed:', res.status, text)
        }
      } catch (error) {
        console.error('[swarm2] tmux scroll exception:', error)
      }
    },
    [],
  )

  const toggleFocusedRuntimeWorker = useCallback((workerId: string) => {
    setFocusedRuntimeWorkerId((current) =>
      current === workerId ? null : workerId,
    )
  }, [])

  const runtimeByWorker = useMemo(() => {
    const map = new Map<string, RuntimeEntry>()
    for (const entry of runtimeQuery.data?.entries ?? [])
      map.set(entry.workerId, entry)
    return map
  }, [runtimeQuery.data])
  const members = useMemo(() => {
    const merged = sortSwarmMembers(crew, roomIds).map((member) => {
      const runtime = runtimeByWorker.get(member.id)
      const roster = rosterQuery.data?.find((worker) => worker.id === member.id)
      return {
        ...member,
        displayName: runtime?.displayName || roster?.name || member.displayName,
        role: roster?.role || runtime?.role || member.role,
        specialty: roster?.specialty,
        mission: roster?.mission,
        skills: roster?.skills ?? [],
        capabilities: roster?.capabilities ?? [],
        model: roster?.model || member.model,
      }
    })
    const seen = new Set(merged.map((member) => member.id))
    const extras = (rosterQuery.data ?? [])
      .filter((worker) => !seen.has(worker.id))
      .map((worker) => ({
        id: worker.id,
        displayName: worker.name || worker.id,
        role: worker.role || 'Worker',
        profileFound: false,
        gatewayState: 'unknown',
        processAlive: false,
        platforms: {},
        model: worker.model || 'unknown',
        provider: 'roster-only',
        specialty: worker.specialty,
        mission: worker.mission,
        skills: worker.skills ?? [],
        capabilities: worker.capabilities ?? [],
        lastSessionTitle: worker.mission || null,
        lastSessionAt: null,
        sessionCount: 0,
        messageCount: 0,
        toolCallCount: 0,
        totalTokens: 0,
        estimatedCostUsd: null,
        cronJobCount: 0,
        assignedTaskCount: 0,
      }))
    return sortSwarmMembers([...merged, ...extras], roomIds)
  }, [crew, roomIds, runtimeByWorker, rosterQuery.data])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        SWARM2_ROOM_STORAGE_KEY,
        JSON.stringify(roomIds),
      )
    } catch {
      /* noop */
    }
  }, [roomIds])

  useEffect(() => {
    if (members.length === 0) {
      setSelectedId(null)
      setFocusedRuntimeWorkerId(null)
      return
    }
    if (!selectedId || !members.some((member) => member.id === selectedId)) {
      setSelectedId(members[0]?.id ?? null)
    }
    if (
      focusedRuntimeWorkerId &&
      !members.some((member) => member.id === focusedRuntimeWorkerId)
    ) {
      setFocusedRuntimeWorkerId(null)
    }
  }, [members, selectedId, focusedRuntimeWorkerId])

  useLayoutEffect(() => {
    return scheduleScrollContextToTop(topRef.current)
  }, [])

  const activeRuntimeCount = members.filter((member) =>
    isRuntimeActive(runtimeByWorker.get(member.id)),
  ).length
  const selectedMember = selectedId
    ? members.find((member) => member.id === selectedId)
    : null
  const selectedLabel = selectedMember?.displayName || selectedId || 'none'
  const tmuxAvailable = runtimeQuery.data?.tmuxAvailable ?? true

  // Runtime tab auto-mount priority:
  // 1. Wired room workers (explicit user pick)
  // 2. All workers with an attachable tmux session OR an active runtime signal
  // 3. Single selected worker as last resort
  const autoMountTargets = useMemo(() => {
    if (roomIds.length) {
      return members.filter((member) => roomIds.includes(member.id))
    }
    const active = members.filter((member) => {
      const runtime = runtimeByWorker.get(member.id)
      if (runtime?.tmuxAttachable) return true
      return isRuntimeActive(runtime)
    })
    if (active.length > 0) return active
    return selectedId
      ? members.filter((member) => member.id === selectedId)
      : []
  }, [members, roomIds, runtimeByWorker, selectedId])
  const terminalTargets = focusedRuntimeWorkerId
    ? autoMountTargets.filter((member) => member.id === focusedRuntimeWorkerId)
    : autoMountTargets
  const rosterLanes = useMemo(() => {
    const map = new Map<
      string,
      { role: string; count: number; active: number }
    >()
    for (const member of members) {
      const role = member.role || 'Worker'
      const existing = map.get(role) ?? { role, count: 0, active: 0 }
      existing.count += 1
      if (isRuntimeActive(runtimeByWorker.get(member.id))) existing.active += 1
      map.set(role, existing)
    }
    return [...map.values()].sort(
      (a, b) =>
        b.active - a.active ||
        b.count - a.count ||
        a.role.localeCompare(b.role),
    )
  }, [members, runtimeByWorker])
  const latestMission = useMemo(() => {
    const mission = missionsQuery.data?.[0]
    if (!mission) return null
    const assignments = mission.assignments ?? []
    const genericTitle =
      /^\d+\s+assigned tasks?$/i.test(mission.title.trim()) ||
      /assigned tasks/i.test(mission.title)
    const firstTask =
      assignments.find((assignment) => assignment.task?.trim())?.task ?? ''
    return {
      id: mission.id,
      title: cleanSwarmLabel(
        genericTitle ? firstTask : mission.title,
        'Swarm mission',
        72,
      ),
      state: mission.state,
      assignmentCount: assignments.length,
      checkpointedCount: assignments.filter((assignment) =>
        ['checkpointed', 'done'].includes(assignment.state),
      ).length,
    }
  }, [missionsQuery.data])

  const activeAgents = useMemo(() => {
    return members
      .map((member) => {
        const runtime = runtimeByWorker.get(member.id)
        const currentTask = runtime?.currentTask?.trim()
        const blocked = Boolean(
          runtime?.blockedReason ||
          runtime?.needsHuman ||
          runtime?.checkpointStatus === 'blocked' ||
          runtime?.checkpointStatus === 'needs_input',
        )
        const done =
          runtime?.checkpointStatus === 'done' ||
          runtime?.checkpointStatus === 'handoff'
        if (!currentTask && !blocked) return null
        const state: 'working' | 'reviewing' | 'blocked' | 'ready' = blocked
          ? 'blocked'
          : done
            ? 'ready'
            : `${runtime?.phase ?? ''} ${currentTask ?? ''}`
                  .toLowerCase()
                  .includes('review')
              ? 'reviewing'
              : 'working'
        const ts =
          runtime?.lastOutputAt ??
          runtime?.lastSessionStartedAt ??
          member.lastSessionAt ??
          null
        return {
          workerId: member.id,
          workerName: member.displayName || member.id,
          role: member.role || runtime?.role || 'Worker',
          task: displayTaskTitle(runtime, 'Awaiting checkpoint'),
          progress: progressForRuntime(runtime),
          state,
          age: relativeTime(ts),
          ts: ts ?? 0,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        const priority = { blocked: 0, reviewing: 1, working: 2, ready: 3 }
        return (
          priority[a.state] - priority[b.state] ||
          b.ts - a.ts ||
          a.workerId.localeCompare(b.workerId)
        )
      })
      .map((item) => ({
        workerId: item.workerId,
        workerName: item.workerName,
        role: item.role,
        task: item.task,
        progress: item.progress,
        state: item.state,
        age: item.age,
      }))
  }, [members, runtimeByWorker])

  const inboxLanes = useMemo(
    () =>
      buildSwarm2InboxLanes({
        missions: missionsQuery.data ?? [],
        runtimes: runtimeQuery.data?.entries ?? [],
      }),
    [missionsQuery.data, runtimeQuery.data?.entries],
  )

  const openInboxItem = useCallback((item: Swarm2InboxItem) => {
    if (item.workerId) {
      setSelectedId(item.workerId)
      setFocusedRuntimeWorkerId(item.workerId)
    }
    setViewMode('reports')
    setNotificationsOpen(false)
  }, [])

  const routeInboxItemToReviewer = useCallback((item: Swarm2InboxItem) => {
    setSelectedId('swarm6')
    setRouterSeed({
      key: Date.now(),
      mode: 'manual',
      prompt: [
        `Review ${item.workerId}'s Swarm control-plane output for mission ${item.missionId ?? 'unknown mission'}. Do not broaden scope. Return the required checkpoint format.`,
        '',
        `Task: ${item.title}`,
        `Summary: ${item.summary}`,
        `Checkpoint: ${item.checkpointStatus ?? item.stateLabel}`,
        `Blocker: ${item.blocker ?? 'none'}`,
        `Next action: ${item.nextAction ?? 'none'}`,
      ].join('\n'),
    })
    setRouterOpen(true)
    setViewMode('reports')
  }, [])

  const swarmNotifications = useMemo(() => {
    const laneItems = [
      ...inboxLanes.needs_review.map((item) => ({
        id: `review-${item.id}`,
        workerId: item.workerId,
        title: `${item.workerName} · Needs review`,
        body: item.summary,
        age: relativeTime(item.updatedAt),
        actionable: true,
      })),
      ...inboxLanes.blocked.map((item) => ({
        id: `blocked-${item.id}`,
        workerId: item.workerId,
        title: `${item.workerName} · Needs input`,
        body: item.blocker ?? item.summary,
        age: relativeTime(item.updatedAt),
        actionable: true,
      })),
      ...inboxLanes.ready.map((item) => ({
        id: `ready-${item.id}`,
        workerId: item.workerId,
        title: `${item.workerName} · Ready`,
        body: item.summary,
        age: relativeTime(item.updatedAt),
        actionable: true,
      })),
    ]
    if (latestMission) {
      laneItems.unshift({
        id: `mission-${latestMission.id}`,
        workerId: '',
        title: `Mission ${latestMission.state}`,
        body: `${latestMission.checkpointedCount}/${latestMission.assignmentCount} checkpointed · ${latestMission.title}`,
        age: latestMission.id,
        actionable:
          latestMission.checkpointedCount < latestMission.assignmentCount,
      })
    }
    return laneItems.slice(0, 8)
  }, [inboxLanes, latestMission])
  const actionableNotificationCount = swarmNotifications.filter(
    (item) => item.actionable,
  ).length
  const workerOperatorStates = useMemo(
    () =>
      buildWorkerOperatorStates({
        members,
        runtimes: runtimeQuery.data?.entries ?? [],
        roster: rosterQuery.data ?? [],
      }),
    [members, rosterQuery.data, runtimeQuery.data?.entries],
  )
  const blockedWorkerCount = workerOperatorStates.filter(
    (worker) => worker.status === 'blocked',
  ).length
  const reviewWorkerCount = workerOperatorStates.filter(
    (worker) => worker.status === 'review-needed',
  ).length
  const staleWorkerCount = workerOperatorStates.filter(
    (worker) => worker.status === 'stale',
  ).length
  const recommendedWorker = chooseRecommendedWorker(
    workerOperatorStates,
    selectedMember?.role || 'builder',
  )
  const cockpitTiles = useMemo(
    () =>
      buildSwarm2CockpitTiles({
        memberCount: members.length,
        activeRuntimeCount,
        blockedWorkerCount,
        reviewWorkerCount,
        staleWorkerCount,
        terminalTargetCount: terminalTargets.length,
        notificationCount: actionableNotificationCount,
        latestMission,
        recommendedWorker,
      }),
    [
      actionableNotificationCount,
      activeRuntimeCount,
      blockedWorkerCount,
      latestMission,
      members.length,
      recommendedWorker,
      reviewWorkerCount,
      staleWorkerCount,
      terminalTargets.length,
    ],
  )

  const recentUpdates = useMemo(() => {
    return members
      .map((member) => {
        const runtime = runtimeByWorker.get(member.id)
        const ts =
          runtime?.lastOutputAt ??
          runtime?.lastSessionStartedAt ??
          member.lastSessionAt ??
          null
        const rawText =
          runtime?.lastRealSummary ??
          runtime?.lastRealResult ??
          runtime?.lastSummary ??
          runtime?.lastResult ??
          runtime?.blockedReason ??
          runtime?.currentTask ??
          member.lastSessionTitle ??
          `Ready in ${member.role || 'worker'} lane`
        const state = (
          runtime?.phase ||
          runtime?.currentTask ||
          ''
        ).toLowerCase()
        const tone: 'idle' | 'active' | 'warning' = runtime?.blockedReason
          ? 'warning'
          : state.includes('review') ||
              state.includes('write') ||
              state.includes('build') ||
              state.includes('implement') ||
              state.includes('active')
            ? 'active'
            : 'idle'
        return {
          workerId: member.id,
          workerName: member.displayName || member.id,
          text: compactText(rawText, 72),
          age: relativeTime(ts),
          ts: ts ?? 0,
          tone,
        }
      })
      .sort((a, b) => b.ts - a.ts || a.workerId.localeCompare(b.workerId))
      .slice(0, 3)
      .map(({ workerId, workerName, text, age, tone }) => ({
        workerId,
        workerName,
        text,
        age,
        tone,
      }))
  }, [members, runtimeByWorker])

  function toggleRoom(id: string) {
    setRoomIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  }

  function openAddSwarm() {
    const existingIds = new Set(
      (rosterQuery.data ?? []).map((worker) => worker.id),
    )
    let next = 13
    while (existingIds.has(`swarm${next}`)) next += 1
    setNewWorkerId(`swarm${next}`)
    setNewWorkerName(`Swarm${next}`)
    setNewWorkerRole('Builder')
    setNewWorkerSpecialty('')
    setNewWorkerModel('')
    setNewWorkerMission('')
    setAddSwarmError(null)
    setAddSwarmOpen(true)
  }

  async function saveAddSwarm() {
    setAddSwarmSaving(true)
    setAddSwarmError(null)
    try {
      const preset = ROLE_PRESETS.find((p) => p.role === newWorkerRole)
      const res = await fetch('/api/swarm-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newWorkerId.trim(),
          name: newWorkerName.trim(),
          role: newWorkerRole.trim(),
          specialty: newWorkerSpecialty.trim() || preset?.specialty || '',
          model: newWorkerModel.trim(),
          mission:
            newWorkerMission.trim() ||
            preset?.mission ||
            'Awaiting orchestrator dispatch.',
          systemPrompt: preset?.systemPrompt ?? null,
          skills: preset?.skills ?? [],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      await rosterQuery.refetch()
      setAddSwarmOpen(false)
    } catch (error) {
      setAddSwarmError(
        error instanceof Error ? error.message : 'Failed to save swarm agent',
      )
    } finally {
      setAddSwarmSaving(false)
    }
  }

  return (
    <div
      ref={topRef}
      className="min-h-full bg-surface text-primary-900"
      style={SWARM2_OPERATION_THEME}
    >
      <div
        className={cn(
          'mx-auto flex min-h-full max-w-[1680px] flex-col gap-3 px-3 pt-3 sm:px-4 lg:px-5',
          routerOpen ? 'pb-[30rem]' : 'pb-24',
        )}
      >
        <header className="rounded-xl border border-primary-200 bg-primary-50/80 px-5 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-accent)] shadow-sm">
                <HugeiconsIcon icon={UserMultipleIcon} size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-primary-900">
                  Swarm
                </h1>
                <p className="truncate text-xs text-[var(--theme-muted-2)]">
                  {members.length > 0
                    ? `${members.length} worker${members.length === 1 ? '' : 's'} · route · reports · review`
                    : 'Profiles + roster · route · reports · review'}
                </p>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-2 text-sm text-[var(--theme-muted)]">
              <WorkflowHelpModal
                compact
                eyebrow="Swarm"
                title="How Swarm works"
                sections={[
                  {
                    title: 'What this surface does',
                    bullets: [
                      'Routes tasks across workers.',
                      'Shows state, reports, and live runtime.',
                    ],
                  },
                  {
                    title: 'Typical flow',
                    bullets: [
                      'Check workers, then dispatch or reroute.',
                      'Use reports, inbox, and runtime for blockers.',
                    ],
                  },
                  {
                    title: 'FAQ',
                    bullets: [
                      'Missing setup lives in Operations.',
                      'Swarm is coordination, not setup.',
                    ],
                  },
                ]}
              />
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] text-base shadow-sm hover:bg-[var(--theme-card2)]"
                aria-label="Swarm notifications"
                title="Swarm notifications"
              >
                <HugeiconsIcon
                  icon={AlarmClockIcon}
                  size={17}
                  strokeWidth={1.8}
                />
                {actionableNotificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {actionableNotificationCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-40 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 text-left shadow-[0_24px_80px_var(--theme-shadow)]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
                        Updates
                      </div>
                      <div className="text-xs text-[var(--theme-muted-2)]">
                        Checkpoints + reports.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="rounded-lg px-2 py-1 text-xs hover:bg-[var(--theme-card2)]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {swarmNotifications.length ? (
                      swarmNotifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.workerId) {
                              setViewMode('reports')
                              setSelectedId(item.workerId)
                              setFocusedRuntimeWorkerId(item.workerId)
                            }
                            setNotificationsOpen(false)
                          }}
                          className="block w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-left hover:border-[var(--theme-accent)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium text-[var(--theme-text)]">
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--theme-muted)]">
                              {item.age}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs text-[var(--theme-muted-2)]">
                            {item.body}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-xs text-[var(--theme-muted)]">
                        No active swarm updates.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={openAddSwarm}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-primary-950 shadow-sm hover:bg-[var(--theme-accent-strong)]"
              >
                <HugeiconsIcon icon={MessageMultiple01Icon} size={13} />
                Add
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-1 gap-3">
          <section
            aria-label="Swarm cockpit"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            {cockpitTiles.slice(0, 4).map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => {
                  if (tile.id === 'review' || tile.id === 'mission') {
                    setViewMode('reports')
                    return
                  }
                  if (tile.id === 'runtime') {
                    setViewMode('runtime')
                    return
                  }
                  if (tile.id === 'router') {
                    setRouterOpen(true)
                  }
                }}
                className={cn(
                  'min-h-[7rem] rounded-xl border p-3 text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]',
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
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      {tile.label}
                    </p>
                    <p className="mt-1 truncate text-xl font-semibold tracking-normal">
                      {tile.value}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                    {tile.tone}
                  </span>
                </div>
                <p className="mt-2 line-clamp-1 text-xs leading-snug opacity-80">
                  {tile.detail}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/10">
                  <div
                    className="h-full rounded-full bg-current transition-[width]"
                    style={{
                      width: `${Math.min(100, Math.max(4, tile.progress))}%`,
                    }}
                  />
                </div>
              </button>
            ))}
          </section>
          <section className="rounded-xl border border-primary-200 bg-primary-50/80 px-4 py-3 text-xs text-[var(--theme-muted)] shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
              <div>
                <h2 className="text-sm font-semibold text-primary-900">
                  Operator
                </h2>
                <p className="mt-1 truncate">
                  {members.length} workers · {blockedWorkerCount} blocked ·{' '}
                  {reviewWorkerCount} review · pick {recommendedWorker}.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary-900">
                  Controls
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Stop', 'Pause', 'Resume'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        toast(`${label} requires runtime confirmation`)
                      }
                      className="rounded-full border border-[var(--theme-border)] px-3 py-1 text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        JSON.stringify(workerOperatorStates, null, 2),
                      )
                    }
                    className="rounded-full border border-[var(--theme-border)] px-3 py-1 text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouterOpen(true)}
                    className="rounded-full border border-[var(--theme-border)] px-3 py-1 text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
                  >
                    Task
                  </button>
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary-900">
                  Glance
                </h2>
                <p className="mt-1">
                  Active {activeRuntimeCount}, blocked {blockedWorkerCount},
                  handoff {reviewWorkerCount}, logs {terminalTargets.length}.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(workerOperatorStates.length
                ? workerOperatorStates.slice(0, 3)
                : [
                    {
                      id: 'inactive',
                      status: 'idle',
                      assignment: 'Workers detected but inactive',
                      lastHeartbeat: 'never',
                      queueDepth: 0,
                      capability: 'setup checks',
                      costGuard: 'model/provider pending',
                    } satisfies SwarmWorkerOperatorState,
                  ]
              ).map((worker) => (
                <div
                  key={worker.id}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--theme-text)]">
                      {worker.id}
                    </span>
                    <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                      {worker.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate">{worker.assignment}</p>
                  <p className="mt-1">
                    Beat {worker.lastHeartbeat} · queue {worker.queueDepth}
                  </p>
                  <p className="mt-1 truncate">
                    Cap {worker.capability} · {worker.costGuard}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <ControlPlaneStage
            members={members}
            selectedId={selectedId}
            roomIds={roomIds}
            activeRuntimeCount={activeRuntimeCount}
            authErrors={healthQuery.data?.summary.totalAuthErrors24h ?? 0}
            selectedLabel={selectedLabel}
            workspaceModel={healthQuery.data?.workspaceModel ?? null}
            lanes={rosterLanes}
            activeAgents={activeAgents}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenRouter={() => setRouterOpen(true)}
            onRouterResults={() => {
              void runtimeQuery.refetch()
              void missionsQuery.refetch()
            }}
            onSelect={(workerId) => setSelectedId(workerId)}
            onToggleRoom={(workerId) => toggleRoom(workerId)}
            onOpenTui={(workerId) => {
              setSelectedId(workerId)
              setViewMode('runtime')
            }}
            onOpenTasks={(workerId) => {
              setSelectedId(workerId)
              setRouterOpen(true)
            }}
            runtimeByWorker={runtimeByWorker}
            recentUpdates={recentUpdates}
            latestMission={latestMission}
            missions={missionsQuery.data ?? []}
            runtimeEntries={runtimeQuery.data?.entries ?? []}
            inboxCounts={{
              needsReview: inboxLanes.needs_review.length,
              blocked: inboxLanes.blocked.length,
              ready: inboxLanes.ready.length,
            }}
            routerSeed={routerSeed}
            onOpenInboxItem={openInboxItem}
            onRouteToReviewer={routeInboxItemToReviewer}
            terminalTargets={terminalTargets}
            tmuxAvailable={tmuxAvailable}
            pendingTmux={pendingTmux}
            focusedRuntimeWorkerId={focusedRuntimeWorkerId}
            onToggleFocusedRuntimeWorker={toggleFocusedRuntimeWorker}
            onClearFocusedRuntimeWorker={() => setFocusedRuntimeWorkerId(null)}
            onStartAgentSession={(workerId) => {
              void startAgentSession(workerId)
            }}
            onScrollTmuxSession={(workerId, direction, session) => {
              void scrollTmuxSession(workerId, direction, session)
            }}
          />
        </div>

        {viewMode === 'cards' && members.length > 0 ? (
          <Swarm2ActivityFeed
            members={members}
            runtimeByWorker={runtimeByWorker}
            selectedId={selectedId}
            onSelect={(workerId) => setSelectedId(workerId)}
          />
        ) : null}
      </div>

      <Swarm2AddAgentModal
        open={addSwarmOpen}
        saving={addSwarmSaving}
        error={addSwarmError}
        modelsLoading={modelsQuery.isLoading}
        modelsError={modelsQuery.isError}
        availableModels={availableModels}
        workerId={newWorkerId}
        workerName={newWorkerName}
        workerRole={newWorkerRole}
        workerSpecialty={newWorkerSpecialty}
        workerModel={newWorkerModel}
        workerMission={newWorkerMission}
        onClose={() => setAddSwarmOpen(false)}
        onSave={() => void saveAddSwarm()}
        onWorkerIdChange={setNewWorkerId}
        onWorkerNameChange={setNewWorkerName}
        onWorkerRoleChange={(role) => {
          setNewWorkerRole(role)
          const preset = ROLE_PRESETS.find((item) => item.role === role)
          if (preset && role !== 'Custom') {
            if (!newWorkerSpecialty.trim())
              setNewWorkerSpecialty(preset.specialty)
            if (!newWorkerMission.trim()) setNewWorkerMission(preset.mission)
            if (preset.defaultModel && !newWorkerModel.trim())
              setNewWorkerModel(preset.defaultModel)
          }
        }}
        onWorkerSpecialtyChange={setNewWorkerSpecialty}
        onWorkerModelChange={setNewWorkerModel}
        onWorkerMissionChange={setNewWorkerMission}
      />

      <RouterChat
        members={members}
        roomIds={roomIds}
        selectedId={selectedId}
        open={routerOpen}
        showClosedDock={false}
        seedPrompt={routerSeed?.prompt ?? null}
        seedMode={routerSeed?.mode}
        seedKey={routerSeed?.key ?? null}
        onOpen={() => setRouterOpen(true)}
        onClose={() => setRouterOpen(false)}
        onResults={() => {
          void runtimeQuery.refetch()
          void missionsQuery.refetch()
        }}
      />
    </div>
  )
}
