export type ConductorPhase = 'home' | 'preview' | 'active' | 'complete'

export type TylerWorkflowTemplate = {
  id: string
  title: string
  label: string
  prompt: string
}

export type MissionLaunchDraft = {
  goal: string
  constraints: string
  verification: string
  handoffTarget: string
}

export type MissionLaunchValidation = {
  valid: boolean
  missing: Array<keyof MissionLaunchDraft>
}

export type MissionReadinessItem = {
  id: 'goal' | 'cwd' | 'model' | 'tools' | 'approvals'
  label: string
  ready: boolean
  severity: 'ok' | 'warning' | 'blocked'
  detail: string
}

export type MissionReadinessSummary = {
  readyCount: number
  totalCount: number
  blockedCount: number
  warningCount: number
  label: string
}

export type ConductorCockpitTile = {
  id: 'readiness' | 'workers' | 'guardrail' | 'activity'
  label: string
  value: string
  detail: string
  tone: 'good' | 'warning' | 'danger' | 'neutral'
  progress: number
}

export type MissionDraftEnvelope = {
  schema: 'conductor.launchDraft.v1'
  draft: MissionLaunchDraft
}

export const CONDUCTOR_GOAL_DRAFT_STORAGE_KEY = 'conductor:goal-draft'
export const CONDUCTOR_LAUNCH_DRAFT_STORAGE_KEY = 'conductor:launch-draft'
export const DEFAULT_MISSION_CONSTRAINTS =
  'Preserve local changes; avoid destructive writes without approval.'
export const DEFAULT_MISSION_VERIFICATION =
  'Run focused tests, build, and live route smoke when applicable.'
export const DEFAULT_MISSION_HANDOFF =
  'Chat summary, Tasks extraction, Files evidence, Memory/runbook update.'

export const TYLER_RECURRING_WORKFLOW_TEMPLATES: Array<TylerWorkflowTemplate> =
  [
    {
      id: 'workspace-page-polish',
      title: 'Workspace page polish',
      label:
        'Review one Hermes Workspace page, make it more actionable for Tyler’s flow, add focused tests, run build, and live-smoke the route before summarizing evidence.',
      prompt:
        'Review one Hermes Workspace page end to end. Make the first viewport more actionable for Tyler’s daily flow, preserve existing behavior, add focused tests for any helper logic, run the focused test and pnpm build, restart the workspace service if needed, and live-smoke the route with Playwright for browser errors and horizontal overflow. Update the workspace-flow backlog and verification status only after proof passes.',
    },
    {
      id: 'ops-runtime-check',
      title: 'Ops runtime check',
      label:
        'Inspect Hermes/Workspace runtime health, logs, LaunchAgents, and recent errors without overwriting local changes.',
      prompt:
        'Run an evidence-backed Hermes and Hermes Workspace runtime check. Inspect git state, launchctl state, recent logs, route health, and update risk. Preserve all local changes unless an upstream change is clearly better. Return exact errors and the narrow fixes needed, then implement low-risk fixes with verification.',
    },
    {
      id: 'mobile-glance-pass',
      title: 'Mobile glance pass',
      label:
        'Make a page usable at phone-at-a-glance density with stable layout, no overflow, and clear next action.',
      prompt:
        'Take the selected Workspace page through a mobile-at-a-glance pass. Prioritize the top three signals, reduce scanning friction, ensure controls fit at 390px width, run focused tests and build, then live-smoke desktop and mobile viewports for overflow, browser errors, and readable first-viewport hierarchy.',
    },
    {
      id: 'lily-implementation-pass',
      title: 'Lily implementation pass',
      label:
        'Move Lily toward a proper daily assistant page: voice readiness, memory context, task capture, and clear fallback states.',
      prompt:
        'Work on the Lily page implementation. Verify the current voice, permission, memory, task capture, and fallback paths from code and live browser state. Implement the next smallest production-ready slice, add targeted tests, run build, and live-smoke the Lily route without breaking existing microphone or text fallback behavior.',
    },
  ]

export function validateMissionLaunchDraft(
  draft: MissionLaunchDraft,
): MissionLaunchValidation {
  const missing = (
    Object.keys(draft) as Array<keyof MissionLaunchDraft>
  ).filter((key) => draft[key].trim().length === 0)
  return { valid: missing.length === 0, missing }
}

export function buildMissionPrompt(draft: MissionLaunchDraft): string {
  return [
    `Goal: ${draft.goal.trim()}`,
    `Constraints: ${draft.constraints.trim()}`,
    `Verification: ${draft.verification.trim()}`,
    `Handoff target: ${draft.handoffTarget.trim()}`,
  ].join('\n')
}

export function getWorkerAvailabilitySummary(input: {
  workers: number
  activeWorkers: number
  staleGateway: boolean
}): string {
  if (input.staleGateway) return 'Worker pool stale'
  if (input.workers === 0) return 'Workers ready'
  return `${input.activeWorkers}/${input.workers} workers active`
}

export function getMissionExecutionGuard(goal: string): string {
  const text = goal.toLowerCase()
  if (/rm -rf|delete|overwrite|production|deploy|write|edit|patch/.test(text)) {
    return 'Review gate required before write/destructive action'
  }
  if (/frontend|ui|route|browser|page|mobile/.test(text)) {
    return 'Browser QA launch option recommended'
  }
  return 'Dry-run ready'
}

export function buildMissionReadinessChecklist(input: {
  draft: MissionLaunchDraft
  projectsDir: string
  orchestratorModel: string
  workerModel: string
  supervised: boolean
  workerAvailabilitySummary: string
  executionGuard: string
}): Array<MissionReadinessItem> {
  const hasGoal = input.draft.goal.trim().length > 0
  const hasProjectDir = input.projectsDir.trim().length > 0
  const modelLabel =
    input.workerModel.trim() || input.orchestratorModel.trim() || 'auto'
  const needsReviewGate = /review gate required/i.test(input.executionGuard)
  return [
    {
      id: 'goal',
      label: 'Goal',
      ready: hasGoal,
      severity: hasGoal ? 'ok' : 'blocked',
      detail: hasGoal ? 'Captured' : 'Add goal',
    },
    {
      id: 'cwd',
      label: 'CWD',
      ready: hasProjectDir,
      severity: hasProjectDir ? 'ok' : 'warning',
      detail: hasProjectDir
        ? `Locked: ${input.projectsDir.trim()}`
        : 'No CWD lock',
    },
    {
      id: 'model',
      label: 'Model',
      ready: true,
      severity: modelLabel === 'auto' ? 'warning' : 'ok',
      detail: modelLabel === 'auto' ? 'Auto fallback' : `Using ${modelLabel}`,
    },
    {
      id: 'tools',
      label: 'Tools',
      ready: !/stale/i.test(input.workerAvailabilitySummary),
      severity: /stale/i.test(input.workerAvailabilitySummary)
        ? 'warning'
        : 'ok',
      detail: input.workerAvailabilitySummary,
    },
    {
      id: 'approvals',
      label: 'Approvals',
      ready: !needsReviewGate || input.supervised,
      severity: needsReviewGate && !input.supervised ? 'warning' : 'ok',
      detail: input.supervised ? 'Supervised' : input.executionGuard,
    },
  ]
}

export function getMissionReadinessSummary(
  items: Array<MissionReadinessItem>,
): MissionReadinessSummary {
  const readyCount = items.filter((item) => item.ready).length
  const blockedCount = items.filter(
    (item) => item.severity === 'blocked',
  ).length
  const warningCount = items.filter(
    (item) => item.severity === 'warning',
  ).length
  const label =
    blockedCount > 0
      ? `${blockedCount} blocked before launch`
      : warningCount > 0
        ? `${warningCount} warning${warningCount === 1 ? '' : 's'} before launch`
        : 'Ready to launch'
  return {
    readyCount,
    totalCount: items.length,
    blockedCount,
    warningCount,
    label,
  }
}

export function buildConductorCockpitTiles(input: {
  readinessSummary: MissionReadinessSummary
  workerAvailabilitySummary: string
  executionGuard: string
  activityCount: number
  activeWorkerCount: number
  totalWorkers: number
  goalPresent: boolean
}): Array<ConductorCockpitTile> {
  const readinessProgress =
    input.readinessSummary.totalCount > 0
      ? Math.round(
          (input.readinessSummary.readyCount /
            input.readinessSummary.totalCount) *
            100,
        )
      : 0
  const workerTotal = Math.max(input.totalWorkers, input.activeWorkerCount, 0)
  const workerProgress =
    workerTotal > 0
      ? Math.round((input.activeWorkerCount / workerTotal) * 100)
      : 100
  const guardNeedsReview = /review gate required/i.test(input.executionGuard)
  const browserRecommended = /browser qa/i.test(input.executionGuard)

  return [
    {
      id: 'readiness',
      label: 'Launch readiness',
      value: `${input.readinessSummary.readyCount}/${input.readinessSummary.totalCount}`,
      detail: input.readinessSummary.label,
      tone:
        input.readinessSummary.blockedCount > 0
          ? 'danger'
          : input.readinessSummary.warningCount > 0
            ? 'warning'
            : 'good',
      progress: readinessProgress,
    },
    {
      id: 'workers',
      label: 'Worker lane',
      value:
        workerTotal > 0
          ? `${input.activeWorkerCount}/${workerTotal}`
          : input.workerAvailabilitySummary,
      detail:
        workerTotal > 0
          ? `${input.activeWorkerCount} active workers`
          : 'Pool available for the next mission',
      tone: /stale/i.test(input.workerAvailabilitySummary)
        ? 'warning'
        : input.activeWorkerCount > 0
          ? 'good'
          : 'neutral',
      progress: workerProgress,
    },
    {
      id: 'guardrail',
      label: 'Guardrail',
      value: guardNeedsReview
        ? 'review'
        : browserRecommended
          ? 'browser'
          : 'dry run',
      detail: input.executionGuard,
      tone: guardNeedsReview ? 'warning' : 'good',
      progress: guardNeedsReview ? 55 : 100,
    },
    {
      id: 'activity',
      label: 'Mission queue',
      value: String(input.activityCount),
      detail: input.goalPresent
        ? 'Draft captured for launch'
        : 'No goal drafted yet',
      tone: input.goalPresent ? 'good' : 'neutral',
      progress: input.goalPresent
        ? 100
        : Math.min(100, input.activityCount * 12),
    },
  ]
}

export function buildConductorRouteDiagnostics(input: {
  phase: ConductorPhase
  sessionKey: string | null
  streamEventCount: number
  streamText: string
  lastError: string | null
  workerCount: number
  activeWorkers: number
  projectsDir: string
  goal: string
}): string {
  return JSON.stringify(
    {
      route: '/workspace/conductor',
      phase: input.phase,
      sessionKey: input.sessionKey ?? 'none',
      streamState:
        input.streamEventCount > 0 || input.streamText.trim()
          ? 'receiving'
          : 'idle',
      lastError: input.lastError ?? 'none',
      workerCount: input.workerCount,
      activeWorkers: input.activeWorkers,
      cwd: input.projectsDir.trim() || 'unlocked',
      goalPresent: input.goal.trim().length > 0,
      secretsIncluded: false,
    },
    null,
    2,
  )
}

export function buildPortablePlanPreview(
  draft: MissionLaunchDraft,
  readinessItems: Array<MissionReadinessItem>,
): string {
  const readiness = readinessItems
    .map((item) => `- ${item.label}: ${item.detail}`)
    .join('\n')
  return [
    'Portable Conductor Plan',
    '',
    buildMissionPrompt(draft),
    '',
    'Readiness:',
    readiness,
    '',
    'Includes: mission goal, constraints, verification, handoff, readiness checklist.',
    'Excludes: secrets, credentials, local tokens, hidden environment values.',
  ].join('\n')
}

export function serializeMissionLaunchDraft(
  draft: MissionLaunchDraft,
): MissionDraftEnvelope {
  return {
    schema: 'conductor.launchDraft.v1',
    draft: {
      goal: draft.goal,
      constraints: draft.constraints,
      verification: draft.verification,
      handoffTarget: draft.handoffTarget,
    },
  }
}

export function parseMissionLaunchDraft(
  value: string | null,
): MissionLaunchDraft | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<MissionDraftEnvelope>
    if (parsed.schema !== 'conductor.launchDraft.v1') return null
    const draft = parsed.draft
    if (!draft) return null
    if (
      typeof draft.goal !== 'string' ||
      typeof draft.constraints !== 'string' ||
      typeof draft.verification !== 'string' ||
      typeof draft.handoffTarget !== 'string'
    ) {
      return null
    }
    return draft
  } catch {
    return null
  }
}
