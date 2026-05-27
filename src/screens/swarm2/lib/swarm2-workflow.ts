import type { CrewMember } from '@/hooks/use-crew-status'

export const SWARM2_INFORMATION_HIERARCHY = [
  'Status header: online workers, active room, refresh state, view switch.',
  'Active missions strip: latest running, blocked, and review-needed missions before visual roster.',
  'Orchestrator hub card: top-center primary routing hub with aggregate state and router affordance.',
  'Visible routing wires: subdued connection lines from the orchestrator to every worker, highlighted for selected and wired room nodes.',
  'Operations-style worker node cards: role, state, current task, last useful signal, direct inline chat/action affordances.',
  'Minimal attention rail: only auth, worker availability, room count, selected runtime metadata.',
  'Central bottom router chat: orchestration brain for auto/manual/broadcast dispatch.',
  'Kanban view: manual planning lanes for backlog, ready, running, review, blocked, and done.',
  'Runtime view: side-by-side tmux terminals for selected room workers or the focused worker.',
] as const

export const SWARM2_SURFACE_CONTRACT = {
  route: '/swarm2',
  keepsLegacySwarmRoute: true,
  primarySurface: 'orchestrator-card-topology',
  workerSurface: 'operations-card-patterns',
  connectionLayer: 'visible-routing-wires',
  alternateSurface: 'runtime-tmux',
  routerPlacement: 'bottom-center',
  cardInlineChat: true,
  routerDefaultOpen: false,
  heartbeatOrchestration:
    'main-session loop processes checkpoints and prompts review/continue decisions',
} as const

export const SWARM2_OPERATIONS_REUSE = [
  'centered-card-header-with-status-dot',
  'agent-progress-avatar-stack',
  'compact-operational-metadata-panel',
  'inline-direct-chat-panel',
  'bottom-card-action-row',
] as const

export const SWARM2_CARD_DENSITY_CONTRACT = {
  defaultView: 'cards',
  runtimeView: 'separate-mode',
  workerCardMinHeightRem: 30,
  laptopGridColumns: 2,
  duplicateEmptyStates: false,
} as const

export const SWARM2_REAL_API_ENDPOINTS = [
  '/api/crew-status',
  '/api/swarm-environment',
  '/api/swarm-runtime',
  '/api/swarm-missions',
  '/api/swarm-roster',
  '/api/integrations',
  '/api/swarm-health',
  '/api/swarm-decompose',
  '/api/swarm-dispatch',
  '/api/swarm-tmux-start',
  '/api/swarm-tmux-stop',
  '/api/swarm-tmux-scroll',
  '/api/terminal-stream',
  '/api/terminal-input',
  '/api/terminal-resize',
  '/api/terminal-close',
] as const

export type TerminalKind = 'tmux' | 'log-tail' | 'shell' | 'none'

export type RuntimeArtifact = {
  id: string
  kind: 'file' | 'diff' | 'patch' | 'build' | 'log' | 'report' | 'preview'
  label: string
  path?: string | null
  workerId?: string
  updatedAt?: number | null
  source?: 'runtime' | 'workspace' | 'plugin' | 'inferred'
  sizeBytes?: number | null
  contentType?: string | null
}

export type RuntimePreview = {
  id: string
  label: string
  url: string
  source?: 'detected-port' | 'plugin' | 'runtime'
  status?: 'ready' | 'unknown' | 'down'
  workerId?: string
  updatedAt?: number | null
}

export type RuntimeEntry = {
  workerId: string
  displayName?: string | null
  role?: string | null
  currentTask: string | null
  recentLogTail: string | null
  pid: number | null
  startedAt: number | null
  lastOutputAt: number | null
  cwd: string | null
  phase?: string | null
  lastSummary?: string | null
  lastResult?: string | null
  lastRealSummary?: string | null
  lastRealResult?: string | null
  blockedReason?: string | null
  checkpointStatus?: string | null
  state?: string | null
  needsHuman?: boolean | null
  assignedTaskCount?: number | null
  cronJobCount?: number | null
  tmuxSession: string | null
  tmuxAttachable: boolean
  logPath?: string | null
  terminalKind?: TerminalKind
  lastSessionStartedAt?: number | null
  source?: 'runtime.json' | 'fallback'
  artifacts?: Array<RuntimeArtifact>
  previews?: Array<RuntimePreview>
}

export type HealthData = {
  workspaceModel: string | null
  summary: {
    totalWorkers: number
    totalAuthErrors24h: number
    distinctProviders: Array<string>
  }
}

export type SwarmRosterWorker = {
  id: string
  name: string
  role: string
  specialty?: string
  model?: string
  mission?: string
  skills?: Array<string>
  capabilities?: Array<string>
  defaultCwd?: string
  preferredTaskTypes?: Array<string>
  maxConcurrentTasks?: number
  acceptsBroadcast?: boolean
  reviewRequired?: boolean
}

export type SwarmRosterResponse = {
  ok?: boolean
  roster?: { workers?: Array<SwarmRosterWorker> }
}

export type SwarmMissionSummary = {
  id: string
  title: string
  state: string
  assignments?: Array<{
    id?: string
    state: string
    task?: string
    workerId?: string
    reviewRequired?: boolean
    completedAt?: number | null
    dispatchedAt?: number | null
    checkpoint?: {
      stateLabel?: string | null
      checkpointStatus?: string | null
      runtimeState?: string | null
      filesChanged?: string | null
      commandsRun?: string | null
      result?: string | null
      blocker?: string | null
      nextAction?: string | null
    } | null
  }>
  updatedAt: number
}

export type SwarmMissionsResponse = {
  ok?: boolean
  missions?: Array<SwarmMissionSummary>
}

export type ActiveMissionQueueItem = {
  id: string
  title: string
  state: string
  assignmentCount: number
  checkpointedCount: number
  blockedCount: number
  reviewCount: number
  nextAction: string
  updatedAt: number
}

export type SwarmWorkerOperatorState = {
  id: string
  status: 'active' | 'blocked' | 'review-needed' | 'idle' | 'stale'
  assignment: string
  lastHeartbeat: string
  queueDepth: number
  capability: string
  costGuard: string
}

function isActiveMissionState(state: string) {
  return !/^(done|completed|complete|cancelled|canceled|archived)$/i.test(
    state.trim(),
  )
}

export function compactText(value: string | null | undefined, max = 38): string {
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max)}…` : value
}

export function relativeTime(ts: number | null | undefined): string {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function cleanSwarmLabel(
  rawValue: string,
  fallback = 'Ready for task',
  maxLength = 64,
): string {
  const raw = rawValue.trim()
  if (!raw) return fallback
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const goalLine = lines.find((line) => /^goal\s*:/i.test(line))
  const selected = goalLine
    ? goalLine.replace(/^goal\s*:\s*/i, '')
    : lines.find(
        (line) =>
          !/^you are\b/i.test(line) &&
          !/^context\b/i.test(line) &&
          !/^constraints\b/i.test(line),
      ) || lines[0]
  const cleaned = selected
    .replace(/^[A-Z][A-Z0-9_ -]{2,}TASK\s*:\s*/i, '')
    .replace(/^DESIGN_ADDENDUM\s*:\s*/i, '')
    .replace(/^CONTROL_PLANE_REPROMPT\s*:\s*/i, '')
    .replace(/^EXPERIMENT_PLANNING_TASK\s*:\s*/i, '')
    .replace(/^UPDATE\s*:\s*/i, '')
    .replace(/^You are\s+[^.]{1,80}\.\s*/i, '')
    .replace(/^[-*]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return compactText(cleaned || raw, maxLength)
}

export function buildActiveMissionQueue(
  missions: Array<SwarmMissionSummary>,
  limit = 4,
): Array<ActiveMissionQueueItem> {
  return missions
    .filter((mission) => isActiveMissionState(mission.state))
    .map((mission) => {
      const assignments = mission.assignments ?? []
      const blocked = assignments.filter((assignment) =>
        /blocked|needs_input|failed/i.test(
          `${assignment.state} ${assignment.checkpoint?.checkpointStatus ?? ''} ${assignment.checkpoint?.runtimeState ?? ''}`,
        ),
      )
      const review = assignments.filter((assignment) =>
        /review|checkpoint|handoff/i.test(
          `${assignment.state} ${assignment.checkpoint?.checkpointStatus ?? ''} ${assignment.checkpoint?.stateLabel ?? ''}`,
        ),
      )
      const nextAssignment =
        blocked[0] ??
        review[0] ??
        assignments.find((assignment) => assignment.task?.trim()) ??
        assignments[0]
      return {
        id: mission.id,
        title: cleanSwarmLabel(mission.title, 'Swarm mission', 72),
        state: mission.state,
        assignmentCount: assignments.length,
        checkpointedCount: assignments.filter((assignment) =>
          ['checkpointed', 'done'].includes(assignment.state),
        ).length,
        blockedCount: blocked.length,
        reviewCount: review.length,
        nextAction: cleanSwarmLabel(
          nextAssignment?.checkpoint?.blocker ||
            nextAssignment?.checkpoint?.nextAction ||
            nextAssignment?.task ||
            'No next action reported yet',
          'No next action reported yet',
          92,
        ),
        updatedAt: mission.updatedAt,
      }
    })
    .sort(
      (left, right) =>
        right.blockedCount - left.blockedCount ||
        right.reviewCount - left.reviewCount ||
        right.updatedAt - left.updatedAt ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit)
}

export function getSwarmSurfaceDistinction(): string {
  return 'Swarm coordinates live workers; Conductor launches missions; Operations fixes worker/runtime health; Ops Intelligence explains incidents and risk.'
}

export function buildWorkerOperatorStates(input: {
  members: Array<
    Pick<CrewMember, 'id' | 'displayName' | 'role' | 'model' | 'provider'>
  >
  runtimes: Array<RuntimeEntry>
  roster: Array<SwarmRosterWorker>
}): Array<SwarmWorkerOperatorState> {
  const runtimeById = new Map(
    input.runtimes.map((entry) => [entry.workerId, entry]),
  )
  const rosterById = new Map(input.roster.map((entry) => [entry.id, entry]))
  return input.members.map((member) => {
    const runtime = runtimeById.get(member.id)
    const roster = rosterById.get(member.id)
    const heartbeatAt =
      runtime?.lastOutputAt ?? runtime?.lastSessionStartedAt ?? null
    const stale = heartbeatAt
      ? Date.now() - heartbeatAt > 30 * 60_000
      : !runtime
    const blocked = Boolean(
      runtime?.blockedReason ||
        runtime?.needsHuman ||
        runtime?.checkpointStatus === 'blocked' ||
        runtime?.checkpointStatus === 'needs_input',
    )
    const reviewNeeded = /review|handoff|checkpoint/i.test(
      `${runtime?.checkpointStatus ?? ''} ${runtime?.phase ?? ''}`,
    )
    const status: SwarmWorkerOperatorState['status'] = blocked
      ? 'blocked'
      : reviewNeeded
        ? 'review-needed'
        : stale
          ? 'stale'
          : runtime?.currentTask
            ? 'active'
            : 'idle'
    const modelText =
      `${member.model ?? ''} ${member.provider ?? ''}`.toLowerCase()
    return {
      id: member.id,
      status,
      assignment: cleanSwarmLabel(
        runtime?.blockedReason ||
          runtime?.currentTask ||
          roster?.mission ||
          'No active assignment',
        'No active assignment',
        74,
      ),
      lastHeartbeat: relativeTime(heartbeatAt),
      queueDepth: runtime?.assignedTaskCount ?? 0,
      capability: (
        roster?.capabilities?.[0] ??
        roster?.role ??
        member.role ??
        'worker'
      ).toString(),
      costGuard: /openai|anthropic|claude|gpt|opus|paid/.test(modelText)
        ? 'paid/model guard'
        : 'local/default guard',
    }
  })
}

export function chooseRecommendedWorker(
  states: Array<SwarmWorkerOperatorState>,
  capability: string,
): string {
  const normalized = capability.toLowerCase()
  const matching = states.find(
    (state) =>
      state.status !== 'blocked' &&
      state.status !== 'stale' &&
      state.capability.toLowerCase().includes(normalized),
  )
  return (
    matching?.id ??
    states.find((state) => state.status === 'idle')?.id ??
    'manual review'
  )
}
