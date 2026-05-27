import { describe, expect, it } from 'vitest'
import {
  TYLER_RECURRING_WORKFLOW_TEMPLATES,
  buildConductorRouteDiagnostics,
  buildMissionPrompt,
  buildMissionReadinessChecklist,
  buildPortablePlanPreview,
  getMissionExecutionGuard,
  getMissionReadinessSummary,
  getWorkerAvailabilitySummary,
  parseMissionLaunchDraft,
  serializeMissionLaunchDraft,
  validateMissionLaunchDraft,
} from './conductor'

describe('Conductor Tyler workflow templates', () => {
  it('includes recurring workflows with built-in verification and preservation language', () => {
    expect(
      TYLER_RECURRING_WORKFLOW_TEMPLATES.map((template) => template.id),
    ).toEqual([
      'workspace-page-polish',
      'ops-runtime-check',
      'mobile-glance-pass',
      'lily-implementation-pass',
    ])
    expect(TYLER_RECURRING_WORKFLOW_TEMPLATES[0]?.prompt).toContain(
      'Update the workspace-flow backlog',
    )
    expect(TYLER_RECURRING_WORKFLOW_TEMPLATES[1]?.prompt).toContain(
      'Preserve all local changes',
    )
    expect(TYLER_RECURRING_WORKFLOW_TEMPLATES[2]?.prompt).toContain(
      '390px width',
    )
    expect(TYLER_RECURRING_WORKFLOW_TEMPLATES[3]?.prompt).toContain(
      'Lily page implementation',
    )
  })

  it('validates the launch form and composes goal, constraints, verification, and handoff', () => {
    expect(
      validateMissionLaunchDraft({
        goal: 'Fix route',
        constraints: '',
        verification: 'Run tests',
        handoffTarget: 'Tasks',
      }),
    ).toEqual({ valid: false, missing: ['constraints'] })

    const prompt = buildMissionPrompt({
      goal: 'Fix route',
      constraints: 'Preserve local changes',
      verification: 'Run tests and build',
      handoffTarget: 'Chat summary',
    })

    expect(prompt).toContain('Goal: Fix route')
    expect(prompt).toContain('Constraints: Preserve local changes')
    expect(prompt).toContain('Verification: Run tests and build')
    expect(prompt).toContain('Handoff target: Chat summary')
  })

  it('surfaces offline worker state and write/browser launch guards', () => {
    expect(
      getWorkerAvailabilitySummary({
        workers: 3,
        activeWorkers: 0,
        staleGateway: true,
      }),
    ).toBe('Worker pool stale: verify gateway before launch')
    expect(getMissionExecutionGuard('Patch production settings')).toBe(
      'Review gate required before write/destructive action',
    )
    expect(getMissionExecutionGuard('QA frontend route')).toBe(
      'Browser QA launch option recommended',
    )
  })

  it('builds a launch readiness checklist from draft and settings state', () => {
    const checklist = buildMissionReadinessChecklist({
      draft: {
        goal: 'Patch route',
        constraints: 'Preserve changes',
        verification: 'Run tests',
        handoffTarget: 'Summary',
      },
      projectsDir: '/Users/tylerlyon/hermes-workspace',
      orchestratorModel: '',
      workerModel: 'gpt-5-codex',
      supervised: false,
      workerAvailabilitySummary: 'Worker availability: standing by',
      executionGuard: getMissionExecutionGuard('Patch route'),
    })

    expect(checklist.map((item) => item.id)).toEqual([
      'goal',
      'cwd',
      'model',
      'tools',
      'approvals',
    ])
    expect(checklist.find((item) => item.id === 'cwd')?.detail).toContain(
      '/Users/tylerlyon/hermes-workspace',
    )
    expect(checklist.find((item) => item.id === 'approvals')?.severity).toBe(
      'warning',
    )
    expect(getMissionReadinessSummary(checklist)).toMatchObject({
      readyCount: 4,
      totalCount: 5,
      warningCount: 1,
    })
  })

  it('exports route diagnostics without secrets', () => {
    const diagnostics = JSON.parse(
      buildConductorRouteDiagnostics({
        phase: 'active',
        sessionKey: 'mission-123',
        streamEventCount: 2,
        streamText: 'working',
        lastError: null,
        workerCount: 3,
        activeWorkers: 2,
        projectsDir: '/tmp/work',
        goal: 'Build feature',
      }),
    )

    expect(diagnostics).toMatchObject({
      route: '/workspace/conductor',
      phase: 'active',
      sessionKey: 'mission-123',
      streamState: 'receiving',
      secretsIncluded: false,
      goalPresent: true,
    })
    expect(JSON.stringify(diagnostics)).not.toContain('token')
  })

  it('previews portable plan contents and versioned draft persistence', () => {
    const draft = {
      goal: 'Review page',
      constraints: 'Preserve local changes',
      verification: 'Run route smoke',
      handoffTarget: 'Tasks',
    }
    const checklist = buildMissionReadinessChecklist({
      draft,
      projectsDir: '',
      orchestratorModel: '',
      workerModel: '',
      supervised: true,
      workerAvailabilitySummary: 'Worker availability: standing by',
      executionGuard: 'Dry-run estimate available before launch',
    })

    const preview = buildPortablePlanPreview(draft, checklist)
    expect(preview).toContain('Portable Conductor Plan')
    expect(preview).toContain('Excludes: secrets')
    expect(preview).toContain('Goal: Review page')

    const serialized = serializeMissionLaunchDraft(draft)
    expect(parseMissionLaunchDraft(JSON.stringify(serialized))).toEqual(draft)
    expect(parseMissionLaunchDraft(JSON.stringify({ schema: 'old' }))).toBeNull()
  })
})
