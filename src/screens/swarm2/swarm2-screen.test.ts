import { describe, expect, it } from 'vitest'
import {
  SWARM2_CARD_DENSITY_CONTRACT,
  SWARM2_INFORMATION_HIERARCHY,
  SWARM2_OPERATIONS_REUSE,
  SWARM2_REAL_API_ENDPOINTS,
  SWARM2_SURFACE_CONTRACT,
  buildActiveMissionQueue,
  buildSwarm2CockpitTiles,
  buildWorkerOperatorStates,
  chooseRecommendedWorker,
  commandForRuntime,
  displayTaskTitle,
  formatAssignedModel,
  getSwarmSurfaceDistinction,
  isRuntimeActive,
  progressForRuntime,
  recentRuntimeLines,
} from './lib/swarm2-workflow'

describe('Swarm2 surface contract', () => {
  it('keeps Aurora as the primary hub above wired operational worker cards', () => {
    expect(SWARM2_INFORMATION_HIERARCHY[0]).toContain('Status header')
    expect(SWARM2_INFORMATION_HIERARCHY[1]).toContain('Active missions strip')
    expect(SWARM2_INFORMATION_HIERARCHY[2]).toContain('Orchestrator hub card')
    expect(SWARM2_INFORMATION_HIERARCHY[3]).toContain('Visible routing wires')
    expect(SWARM2_INFORMATION_HIERARCHY[4]).toContain(
      'Operations-style worker node cards',
    )
    expect(SWARM2_INFORMATION_HIERARCHY[5]).toContain('Minimal attention rail')
    expect(SWARM2_INFORMATION_HIERARCHY[6]).toContain(
      'Central bottom router chat',
    )
    expect(SWARM2_INFORMATION_HIERARCHY).toContainEqual(
      expect.stringContaining('Kanban view'),
    )
    expect(SWARM2_INFORMATION_HIERARCHY).toContainEqual(
      expect.stringContaining('Runtime view'),
    )
  })

  it('documents the operational surfaces without replacing /swarm', () => {
    expect(SWARM2_SURFACE_CONTRACT.route).toBe('/swarm2')
    expect(SWARM2_SURFACE_CONTRACT.keepsLegacySwarmRoute).toBe(true)
    expect(SWARM2_SURFACE_CONTRACT.primarySurface).toBe(
      'orchestrator-card-topology',
    )
    expect(SWARM2_SURFACE_CONTRACT.workerSurface).toBe(
      'operations-card-patterns',
    )
    expect(SWARM2_SURFACE_CONTRACT.connectionLayer).toBe(
      'visible-routing-wires',
    )
    expect(SWARM2_SURFACE_CONTRACT.alternateSurface).toBe('runtime-tmux')
    expect(SWARM2_SURFACE_CONTRACT.routerPlacement).toBe('bottom-center')
    expect(SWARM2_SURFACE_CONTRACT.cardInlineChat).toBe(true)
    expect(SWARM2_SURFACE_CONTRACT.routerDefaultOpen).toBe(false)
  })

  it('summarizes worker operator status, stale heartbeats, cost guard, and recommendation fit', () => {
    const originalNow = Date.now
    Date.now = () => 1_800_000
    try {
      const states = buildWorkerOperatorStates({
        members: [
          {
            id: 'swarm1',
            displayName: 'Swarm1',
            role: 'Builder',
            model: 'gpt-5.5',
            provider: 'openai',
          },
          {
            id: 'swarm2',
            displayName: 'Swarm2',
            role: 'Reviewer',
            model: 'local',
            provider: 'ollama',
          },
        ],
        runtimes: [
          {
            workerId: 'swarm1',
            currentTask: 'Build route',
            recentLogTail: null,
            pid: 123,
            startedAt: null,
            lastOutputAt: 1_700_000,
            cwd: null,
            blockedReason: null,
            checkpointStatus: 'running',
            state: 'active',
            needsHuman: false,
            assignedTaskCount: 2,
            cronJobCount: 0,
            tmuxSession: null,
            tmuxAttachable: false,
          },
          {
            workerId: 'swarm2',
            currentTask: 'Review handoff',
            recentLogTail: null,
            pid: null,
            startedAt: null,
            lastOutputAt: 0,
            cwd: null,
            blockedReason: 'Missing token',
            checkpointStatus: 'blocked',
            state: 'blocked',
            needsHuman: true,
            assignedTaskCount: 1,
            cronJobCount: 0,
            tmuxSession: null,
            tmuxAttachable: false,
          },
        ],
        roster: [
          {
            id: 'swarm1',
            name: 'Swarm1',
            role: 'Builder',
            capabilities: ['frontend'],
          },
          {
            id: 'swarm2',
            name: 'Swarm2',
            role: 'Reviewer',
            capabilities: ['review'],
          },
        ],
      })

      expect(getSwarmSurfaceDistinction()).toContain('Workers live here')
      expect(states[0]).toMatchObject({
        id: 'swarm1',
        status: 'active',
        queueDepth: 2,
        costGuard: 'paid/model guard',
      })
      expect(states[1]).toMatchObject({
        id: 'swarm2',
        status: 'blocked',
        assignment: 'Missing token',
      })
      expect(chooseRecommendedWorker(states, 'frontend')).toBe('swarm1')
    } finally {
      Date.now = originalNow
    }
  })

  it('only depends on existing first-party APIs', () => {
    expect(SWARM2_REAL_API_ENDPOINTS).toEqual([
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
    ])
  })

  it('documents Operations card primitives reused for Swarm2 worker nodes', () => {
    expect(SWARM2_OPERATIONS_REUSE).toEqual([
      'centered-card-header-with-status-dot',
      'agent-progress-avatar-stack',
      'compact-operational-metadata-panel',
      'inline-direct-chat-panel',
      'bottom-card-action-row',
    ])
  })

  it('keeps the default control plane denser than a terminal wall on laptop screens', () => {
    expect(SWARM2_CARD_DENSITY_CONTRACT.defaultView).toBe('cards')
    expect(SWARM2_CARD_DENSITY_CONTRACT.runtimeView).toBe('separate-mode')
    expect(
      SWARM2_CARD_DENSITY_CONTRACT.workerCardMinHeightRem,
    ).toBeLessThanOrEqual(30)
    expect(
      SWARM2_CARD_DENSITY_CONTRACT.laptopGridColumns,
    ).toBeGreaterThanOrEqual(2)
    expect(SWARM2_CARD_DENSITY_CONTRACT.duplicateEmptyStates).toBe(false)
  })

  it('sorts active missions ahead of completed missions and prioritizes blockers', () => {
    const rows = buildActiveMissionQueue([
      {
        id: 'done-1',
        title: 'Done mission',
        state: 'completed',
        updatedAt: 300,
        assignments: [],
      },
      {
        id: 'run-1',
        title: 'Running mission',
        state: 'running',
        updatedAt: 200,
        assignments: [{ state: 'running', task: 'Keep building' }],
      },
      {
        id: 'blocked-1',
        title: 'Blocked mission',
        state: 'running',
        updatedAt: 100,
        assignments: [
          {
            state: 'blocked',
            task: 'Fix auth',
            checkpoint: { blocker: 'Missing token' },
          },
        ],
      },
    ])

    expect(rows.map((row) => row.id)).toEqual(['blocked-1', 'run-1'])
    expect(rows[0]?.blockedCount).toBe(1)
    expect(rows[0]?.nextAction).toContain('Missing token')
  })

  it('builds cockpit tiles for workers, runtime, review, mission, and router lanes', () => {
    const tiles = buildSwarm2CockpitTiles({
      memberCount: 6,
      activeRuntimeCount: 3,
      blockedWorkerCount: 1,
      reviewWorkerCount: 2,
      staleWorkerCount: 1,
      terminalTargetCount: 2,
      notificationCount: 1,
      recommendedWorker: 'swarm4',
      latestMission: {
        title: 'Ship dashboard cockpit',
        state: 'running',
        assignmentCount: 4,
        checkpointedCount: 2,
      },
    })

    expect(tiles).toMatchObject([
      { id: 'workers', label: 'Worker map', value: '6', tone: 'warning' },
      { id: 'runtime', label: 'Runtime lane', value: '3/6' },
      { id: 'review', label: 'Review queue', value: '3', tone: 'danger' },
      { id: 'mission', label: 'Latest mission', value: 'running' },
      { id: 'router', label: 'Router pick', value: 'swarm4' },
    ])
  })
})

describe('Swarm2 runtime tab command resolution', () => {
  it('prefers tmux attach when an attachable session exists', () => {
    const result = commandForRuntime({
      workerId: 'swarm4',
      currentTask: null,
      recentLogTail: null,
      pid: null,
      startedAt: null,
      lastOutputAt: null,
      cwd: '/tmp',
      tmuxSession: 'swarm-swarm4',
      tmuxAttachable: true,
      logPath: '/tmp/agent.log',
      terminalKind: 'tmux',
    })
    expect(result.kind).toBe('tmux')
    expect(result.command).toEqual(['tmux', 'attach', '-t', 'swarm-swarm4'])
    expect(result.label).toContain('tmux:swarm-swarm4')
  })

  it('prefers a chat-able shell over read-only log tail when no tmux is available', () => {
    const result = commandForRuntime({
      workerId: 'swarm4',
      currentTask: null,
      recentLogTail: null,
      pid: null,
      startedAt: null,
      lastOutputAt: null,
      cwd: '/tmp/work',
      tmuxSession: null,
      tmuxAttachable: false,
      logPath: '/tmp/agent.log',
      terminalKind: 'shell',
    })
    expect(result.kind).toBe('shell')
    expect(result.command[0]).toBe('zsh')
    expect(result.command.join(' ')).toContain('cd "/tmp/work"')
  })

  it('falls back to tail -F when no tmux and no cwd are available', () => {
    const result = commandForRuntime({
      workerId: 'swarm4',
      currentTask: null,
      recentLogTail: null,
      pid: null,
      startedAt: null,
      lastOutputAt: null,
      cwd: null,
      tmuxSession: null,
      tmuxAttachable: false,
      logPath: '/tmp/agent.log',
      terminalKind: 'log-tail',
    })
    expect(result.kind).toBe('log-tail')
    expect(result.command).toEqual([
      'tail',
      '-n',
      '200',
      '-F',
      '/tmp/agent.log',
    ])
  })

  it('falls back to a workspace shell when no tmux and no log file exist', () => {
    const result = commandForRuntime({
      workerId: 'swarm4',
      currentTask: null,
      recentLogTail: null,
      pid: null,
      startedAt: null,
      lastOutputAt: null,
      cwd: '/tmp/work',
      tmuxSession: null,
      tmuxAttachable: false,
      logPath: null,
      terminalKind: 'shell',
    })
    expect(result.kind).toBe('shell')
    expect(result.command[0]).toBe('zsh')
    expect(result.command.join(' ')).toContain('cd "/tmp/work"')
  })

  it('handles entirely missing runtime metadata gracefully', () => {
    const result = commandForRuntime(undefined)
    expect(result.kind).toBe('shell')
    expect(result.command[0]).toBe('zsh')
  })

  it('mode=logs forces tail -F even when a cwd would normally win', () => {
    const result = commandForRuntime(
      {
        workerId: 'swarm4',
        currentTask: null,
        recentLogTail: null,
        pid: null,
        startedAt: null,
        lastOutputAt: null,
        cwd: '/tmp/work',
        tmuxSession: null,
        tmuxAttachable: false,
        logPath: '/tmp/agent.log',
        terminalKind: 'shell',
      },
      'logs',
    )
    expect(result.kind).toBe('log-tail')
    expect(result.command).toContain('-F')
  })

  it('mode=shell skips tmux attach in favor of a workspace shell', () => {
    const result = commandForRuntime(
      {
        workerId: 'swarm4',
        currentTask: null,
        recentLogTail: null,
        pid: null,
        startedAt: null,
        lastOutputAt: null,
        cwd: '/tmp/work',
        tmuxSession: 'swarm-swarm4',
        tmuxAttachable: true,
        logPath: '/tmp/agent.log',
        terminalKind: 'tmux',
      },
      'shell',
    )
    expect(result.kind).toBe('shell')
    expect(result.command[0]).toBe('zsh')
  })

  it('keeps runtime display helpers deterministic after route extraction', () => {
    const originalNow = Date.now
    Date.now = () => 1_800_000
    try {
      const runtime = {
        workerId: 'swarm4',
        currentTask: 'Implement billing patch',
        recentLogTail: 'one\n\ntwo\nthree\nfour\nfive',
        pid: 456,
        startedAt: null,
        lastOutputAt: 1_790_000,
        cwd: '/tmp/work',
        tmuxSession: null,
        tmuxAttachable: false,
        checkpointStatus: 'running',
        phase: 'implement',
      }

      expect(recentRuntimeLines(runtime)).toEqual([
        'two',
        'three',
        'four',
        'five',
      ])
      expect(isRuntimeActive(runtime)).toBe(true)
      expect(progressForRuntime(runtime)).toBe(64)
      expect(displayTaskTitle(runtime, 'Fallback')).toBe(
        'Implement billing patch',
      )
      expect(formatAssignedModel('claude-opus-4-7', 'anthropic')).toBe(
        'Opus 4.7',
      )
    } finally {
      Date.now = originalNow
    }
  })
})
