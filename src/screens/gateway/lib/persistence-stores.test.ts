// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadApprovals, saveApprovals } from './approvals-store'
import {
  archiveMissionToHistory,
  loadMissionCheckpoint,
  loadMissionHistory,
  saveMissionCheckpoint,
} from './mission-checkpoint'
import { loadCustomTemplates, saveCustomTemplates } from './workflow-templates'
import type { MissionCheckpoint } from './mission-checkpoint'

const mission: MissionCheckpoint = {
  id: 'mission-1',
  label: 'Review workspace',
  processType: 'sequential',
  team: [],
  tasks: [],
  agentSessionMap: {},
  status: 'running',
  startedAt: 100,
  updatedAt: 100,
}

describe('gateway typed persistence stores', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('recovers malformed mission checkpoint and history storage', () => {
    window.localStorage.setItem('clawsuite:mission-checkpoint', '{bad json')
    window.localStorage.setItem('clawsuite:mission-history', '[{"id":1}]')

    expect(loadMissionCheckpoint()).toBeNull()
    expect(loadMissionHistory()).toEqual([])
    expect(
      window.localStorage.getItem('clawsuite:mission-checkpoint'),
    ).toBeNull()
    expect(window.localStorage.getItem('clawsuite:mission-history')).toBeNull()
  })

  it('persists current mission checkpoints and bounded history', () => {
    saveMissionCheckpoint(mission)
    archiveMissionToHistory({ ...mission, status: 'completed' })

    expect(loadMissionCheckpoint()).toMatchObject({
      id: 'mission-1',
      status: 'running',
    })
    expect(loadMissionHistory()[0]).toMatchObject({
      id: 'mission-1',
      status: 'completed',
    })
  })

  it('recovers malformed approvals and workflow templates', () => {
    window.localStorage.setItem('clawsuite:approvals', '[{"id":1}]')
    window.localStorage.setItem('clawsuite:workflow-templates', '{bad json')

    expect(loadApprovals()).toEqual([])
    expect(loadCustomTemplates()).toEqual([])
    expect(window.localStorage.getItem('clawsuite:approvals')).toBeNull()
    expect(
      window.localStorage.getItem('clawsuite:workflow-templates'),
    ).toBeNull()
  })

  it('persists valid approvals and custom workflow templates', () => {
    saveApprovals([
      {
        id: 'approval-1',
        agentId: 'agent',
        agentName: 'Agent',
        action: 'Run command',
        context: 'Needs approval',
        requestedAt: Date.now(),
        status: 'pending',
      },
    ])
    saveCustomTemplates([
      {
        id: 'tpl-1',
        name: 'Template',
        description: 'Reusable work',
        icon: 'T',
        goal: 'Do the work',
        tasks: [{ title: 'Start' }],
        createdAt: 1,
        updatedAt: 1,
      },
    ])

    expect(loadApprovals()).toHaveLength(1)
    expect(loadCustomTemplates()[0]).toMatchObject({
      id: 'tpl-1',
      name: 'Template',
    })
  })
})
