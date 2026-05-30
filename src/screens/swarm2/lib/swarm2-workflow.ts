import type { CrewMember } from '@/hooks/use-crew-status'
import { getOnlineStatus } from '@/hooks/use-crew-status'

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

export type ViewMode = 'cards' | 'kanban' | 'runtime' | 'reports'

export type RolePreset = {
  role: string
  specialty: string
  mission: string
  systemPrompt: string
  skills: Array<string>
  defaultModel?: string
}

export const ROLE_PRESETS: ReadonlyArray<RolePreset> = [
  {
    role: 'Orchestrator',
    specialty: 'control-plane state, dispatch, drift detection, escalation',
    mission:
      'Run the swarm. Read /swarm-specs/ at start. Dispatch workers per their standing missions. Detect drift, re-prompt, escalate to main agent when stuck.',
    systemPrompt:
      'You are the Hermes Agent orchestrator for the swarm. Read /swarm-specs/SWARM_SPEC.md and /swarm-specs/projects/swarmN.md for every worker before dispatching. Apply the swarm-orchestrator skill: assign work, request proof-bearing checkpoints, detect drift, re-prompt with stronger framing, escalate when blocked. Never make irreversible external actions without main-agent ack.',
    skills: [
      'swarm-orchestrator',
      'swarm-worker-core',
      'swarm-review-learning-loop',
      'self-improvement',
    ],
    defaultModel: 'GPT-5.4',
  },
  {
    role: 'Builder',
    specialty: 'full-stack implementation, fast ship cycles',
    mission:
      'Implement features per dispatched briefs. Smallest landed artifact first. Tests + build + smoke before checkpoint.',
    systemPrompt:
      'You are a senior builder. Ship working code. Always read the brief, plan smallest landed artifact, implement, run tests + build + smoke, commit (not push), checkpoint with proof.',
    skills: ['swarm-worker-core', 'byte-verified-code-review'],
    defaultModel: 'GPT-5.5',
  },
  {
    role: 'Reviewer',
    specialty: 'byte-verified code review, naming + tests + build gate',
    mission:
      'No PR ships without you. Verify diff, byte-check naming, run tests/build/smoke, verdict APPROVED/CHANGES_REQUESTED/BLOCKED.',
    systemPrompt:
      'You are the merge gate. For every PR: pull branch, read diff, xxd byte-check naming-sensitive areas, run tests, run build, smoke test. Verdict APPROVED routes to main agent for merge ack. Never merge yourself.',
    skills: [
      'swarm-worker-core',
      'byte-verified-code-review',
      'swarm-review-learning-loop',
    ],
    defaultModel: 'GPT-5.4',
  },
  {
    role: 'Triage',
    specialty: 'autonomous PR/issues processor',
    mission:
      'Score open issues every 4h, repro top-1, fix branch + tests + PR, request review. Never merge or close.',
    systemPrompt:
      'You are the issues/PRs autopilot. Every 4h: gh issue list per repo, score by Impact x Tractability x (1 + locally-tested), pick top-1 unassigned, repro, fix branch, push, gh pr create, request reviewer. Never merge, never close, always escalate to main agent for greenlight.',
    skills: [
      'swarm-worker-core',
      'byte-verified-code-review',
      'swarm-review-learning-loop',
    ],
    defaultModel: 'GPT-5.5',
  },
  {
    role: 'Lab',
    specialty: 'local-model R&D, spec-dec, benchmarking',
    mission:
      'Run autonomous lab loop. Test new model pulls. Wire spec-dec/DFlash/TurboQuant. Push tk/s + quality. Document every experiment.',
    systemPrompt:
      'You are the local-model lab. Read /swarm-specs/projects/lane-c-lab.md. Iterate experiments from open hypothesis space. Log to lab-loop-runs.jsonl. Escalate breakthroughs (>=10% tk/s) and install requests to main agent.',
    skills: [
      'swarm-worker-core',
      'pc1-ollama-gguf-bench',
      'swarm-bench-worker',
    ],
    defaultModel: 'GPT-5.4',
  },
  {
    role: 'Sage',
    specialty: 'research + scripts + X content + creative briefs',
    mission:
      'Research what matters. Draft scripts, X content, briefs. Cite sources. Never post externally without ack.',
    systemPrompt:
      'You are the research/content scout. Find angles, write scripts and drafts, always cite sources. Never post X/Discord/blog without main-agent ack — always draft + escalate.',
    skills: ['swarm-worker-core', 'last30days', 'pdf-and-paper-deep-reading'],
    defaultModel: 'GPT-5.5',
  },
  {
    role: 'Scribe',
    specialty: 'docs, skills hygiene, memory curation',
    mission:
      'Keep docs current. Hygiene the skills folder. Curate memory. Write submission/release copy.',
    systemPrompt:
      'You are the source-of-truth keeper. Audit /skills/ every 12h, flag stale/unused/poorly-documented. Maintain SWARM_SPEC and worker specs as system evolves. Draft READMEs and changelogs.',
    skills: ['swarm-worker-core', 'last30days', 'creative-writing'],
    defaultModel: 'GPT-5.5',
  },
  {
    role: 'Foundation',
    specialty: 'infra, repair playbook, autopilot wiring',
    mission:
      'Keep the swarm running. Apply repair playbook. Wire autopilot. Maintain loop infra.',
    systemPrompt:
      'You are infrastructure. Maintain /swarm-specs/playbooks/auto-repair.yaml. Health-check tmux sessions, autopilot tick, dev server. Apply known fixes; escalate novel failures.',
    skills: ['swarm-worker-core'],
    defaultModel: 'GPT-5.4',
  },
  {
    role: 'QA',
    specialty: 'regression QA, render verification',
    mission: 'Run regression suite on every commit + render. Block bad ships.',
    systemPrompt:
      'You are QA. On commit: full test suite. On render: ffprobe + tone consistency + pacing. Verdict PASS/FAIL/FLAKY with evidence.',
    skills: ['swarm-worker-core', 'byte-verified-code-review'],
    defaultModel: 'GPT-5.4',
  },
  {
    role: 'Mirror Integrations',
    specialty: 'asset packs, upstream sync',
    mission: 'Generate assets. Watch upstream. Pack integrations.',
    systemPrompt:
      'You produce assets and watch upstream. Generate art/audio per Lane A. Every 12h diff upstream Hermes Agent main, surface portable items. Never cross-org PR without ack.',
    skills: ['swarm-worker-core', 'claude-promo', 'songwriting-and-ai-music'],
    defaultModel: 'GPT-5.4',
  },
  {
    role: 'Custom',
    specialty: '',
    mission: '',
    systemPrompt: '',
    skills: [],
  },
] as const

export const ROLE_NAMES = ROLE_PRESETS.map((preset) => preset.role)

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

export type Swarm2CockpitTile = {
  id: 'workers' | 'runtime' | 'review' | 'mission' | 'router'
  label: string
  value: string
  detail: string
  tone: 'good' | 'warning' | 'danger' | 'neutral'
  progress: number
}

export type RuntimeCommand = {
  command: Array<string>
  kind: TerminalKind
  label: string
}

export type RuntimeCommandMode = 'auto' | 'logs' | 'shell'

function isActiveMissionState(state: string) {
  return !/^(done|completed|complete|cancelled|canceled|archived)$/i.test(
    state.trim(),
  )
}

export function compactText(
  value: string | null | undefined,
  max = 38,
): string {
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

// Pick the live command for a worker pane.
export function commandForRuntime(
  runtime: RuntimeEntry | undefined,
  mode: RuntimeCommandMode = 'auto',
): RuntimeCommand {
  const cwd = runtime?.cwd?.replace(/"/g, '\\"')
  const shellCommand = (): RuntimeCommand => ({
    command: ['zsh', '-lc', cwd ? `cd "${cwd}" && exec zsh -l` : 'exec zsh -l'],
    kind: 'shell',
    label: cwd ? 'shell @ cwd' : 'shell',
  })
  const logCommand = (): RuntimeCommand | null =>
    runtime?.logPath
      ? {
          command: ['tail', '-n', '200', '-F', runtime.logPath],
          kind: 'log-tail',
          label: 'tail -F agent.log',
        }
      : null

  if (mode === 'logs') {
    return logCommand() ?? shellCommand()
  }
  if (mode === 'shell') {
    return shellCommand()
  }
  if (runtime?.tmuxAttachable && runtime.tmuxSession) {
    return {
      command: ['tmux', 'attach', '-t', runtime.tmuxSession],
      kind: 'tmux',
      label: `tmux:${runtime.tmuxSession}`,
    }
  }
  if (runtime?.cwd) {
    return shellCommand()
  }
  return logCommand() ?? shellCommand()
}

export function recentRuntimeLines(
  entry: RuntimeEntry | undefined,
): Array<string> {
  return (entry?.recentLogTail ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-4)
}

function rankMember(roomIds: Array<string>) {
  return (member: CrewMember) => {
    if (roomIds.includes(member.id)) return 0
    const status = getOnlineStatus(member)
    if (status === 'online') return 1
    if (status === 'offline') return 2
    return 3
  }
}

export function sortSwarmMembers(
  members: Array<CrewMember>,
  roomIds: Array<string>,
) {
  const rank = rankMember(roomIds)
  return [...members]
    .filter((member) => member.id && member.id.trim().length > 0)
    .sort((a, b) => {
      const ranked = rank(a) - rank(b)
      if (ranked !== 0) return ranked
      const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0
      const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0
      return numA - numB
    })
}

export function isRuntimeActive(entry: RuntimeEntry | undefined): boolean {
  if (!entry) return false
  if (entry.tmuxAttachable) return true
  if (entry.currentTask?.trim()) return true
  const last = entry.lastOutputAt ?? entry.lastSessionStartedAt
  return typeof last === 'number' && Date.now() - last < 12 * 60 * 60 * 1000
}

export function progressForRuntime(runtime: RuntimeEntry | undefined): number {
  if (!runtime) return 0
  if (
    runtime.checkpointStatus === 'done' ||
    runtime.checkpointStatus === 'handoff'
  ) {
    return 100
  }
  if (
    runtime.checkpointStatus === 'blocked' ||
    runtime.checkpointStatus === 'needs_input'
  ) {
    return 100
  }
  if (!runtime.currentTask?.trim()) return 0
  const text =
    `${runtime.phase ?? ''} ${runtime.currentTask ?? ''}`.toLowerCase()
  if (text.includes('review')) return 72
  if (text.includes('test') || text.includes('qa')) return 78
  if (
    text.includes('implement') ||
    text.includes('build') ||
    text.includes('patch')
  ) {
    return 64
  }
  if (
    text.includes('plan') ||
    text.includes('research') ||
    text.includes('design')
  ) {
    return 48
  }
  return 58
}

export function displayTaskTitle(
  runtime: RuntimeEntry | undefined,
  fallback: string,
): string {
  const realSummary = runtime?.lastRealSummary ?? null
  const realResult = runtime?.lastRealResult ?? null
  return cleanSwarmLabel(
    runtime?.blockedReason ||
      runtime?.currentTask ||
      realSummary ||
      runtime?.lastSummary ||
      realResult ||
      runtime?.lastResult ||
      fallback ||
      '',
    'Ready for task',
    64,
  )
}

export function formatAssignedModel(
  model?: string | null,
  provider?: string | null,
): string {
  const value = `${model || ''} ${provider || ''}`.toLowerCase()
  if (value.includes('claude-opus-4-7') || value.includes('opus-4-7')) {
    return 'Opus 4.7'
  }
  if (value.includes('claude-opus-4-6') || value.includes('opus-4-6')) {
    return 'Opus 4.6'
  }
  if (value.includes('gpt-5.5')) return 'GPT-5.5'
  if (value.includes('gpt-5.4')) return 'GPT-5.4'
  if (value.includes('gpt-5.3')) return 'GPT-5.3'
  if (model && model !== 'unknown') return model
  if (provider && provider !== 'unknown') {
    return provider.replace(/^custom:/, '').replace(/[-_]/g, ' ')
  }
  return 'Worker'
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
  return 'Workers live here. Conductor launches; Ops fixes; Intel explains.'
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

export function buildSwarm2CockpitTiles(input: {
  memberCount: number
  activeRuntimeCount: number
  blockedWorkerCount: number
  reviewWorkerCount: number
  staleWorkerCount: number
  terminalTargetCount: number
  notificationCount: number
  latestMission: {
    title: string
    state: string
    assignmentCount: number
    checkpointedCount: number
  } | null
  recommendedWorker: string
}): Array<Swarm2CockpitTile> {
  const safeMemberCount = Math.max(1, input.memberCount)
  const needsReview = input.reviewWorkerCount + input.notificationCount
  const missionProgress =
    input.latestMission && input.latestMission.assignmentCount > 0
      ? Math.round(
          (input.latestMission.checkpointedCount /
            input.latestMission.assignmentCount) *
            100,
        )
      : 0

  return [
    {
      id: 'workers',
      label: 'Worker map',
      value: `${input.memberCount}`,
      detail:
        input.memberCount > 0
          ? `${input.activeRuntimeCount} active · ${input.staleWorkerCount} stale`
          : 'No workers found',
      tone:
        input.memberCount === 0
          ? 'danger'
          : input.staleWorkerCount > 0
            ? 'warning'
            : 'good',
      progress: Math.round((input.activeRuntimeCount / safeMemberCount) * 100),
    },
    {
      id: 'runtime',
      label: 'Runtime lane',
      value: `${input.activeRuntimeCount}/${input.memberCount}`,
      detail:
        input.terminalTargetCount > 0
          ? `${input.terminalTargetCount} terminal target${input.terminalTargetCount === 1 ? '' : 's'} ready`
          : 'No terminal targets mounted',
      tone: input.activeRuntimeCount > 0 ? 'good' : 'neutral',
      progress: Math.round((input.activeRuntimeCount / safeMemberCount) * 100),
    },
    {
      id: 'review',
      label: 'Review queue',
      value: String(needsReview),
      detail: `${input.reviewWorkerCount} handoff · ${input.blockedWorkerCount} blocked`,
      tone:
        input.blockedWorkerCount > 0
          ? 'danger'
          : needsReview > 0
            ? 'warning'
            : 'good',
      progress: needsReview > 0 ? Math.min(100, needsReview * 18) : 100,
    },
    {
      id: 'mission',
      label: 'Latest mission',
      value: input.latestMission?.state ?? 'none',
      detail: input.latestMission?.title ?? 'No active mission loaded',
      tone:
        input.latestMission?.state &&
        /blocked|failed|needs_input/i.test(input.latestMission.state)
          ? 'danger'
          : input.latestMission
            ? 'good'
            : 'neutral',
      progress: input.latestMission ? Math.max(8, missionProgress) : 0,
    },
    {
      id: 'router',
      label: 'Router pick',
      value: input.recommendedWorker,
      detail: 'Recommended worker for the current capability lane',
      tone: input.recommendedWorker === 'manual review' ? 'warning' : 'good',
      progress: input.recommendedWorker === 'manual review' ? 45 : 100,
    },
  ]
}
