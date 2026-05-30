import { describe, expect, it } from 'vitest'

import {
  TERMINAL_ENV_BADGES,
  TERMINAL_FAILURE_PARSERS,
  TERMINAL_WORKFLOW_PRESETS,
  WORKSPACE_QUICK_COMMANDS,
  buildTerminalCockpitTiles,
  buildTerminalDiagnosticBundle,
  classifyTerminalSessionState,
  isDangerousTerminalCommand,
  truncateTerminalOutputForCopy,
} from './terminal-workspace'

describe('terminal workspace quick commands', () => {
  it('keeps workspace maintenance commands available from the terminal chrome', () => {
    expect(WORKSPACE_QUICK_COMMANDS.map((item) => item.label)).toEqual([
      'Build',
      'Tests',
      'Mobile',
      'Restart',
      'Ping',
    ])
    expect(
      WORKSPACE_QUICK_COMMANDS.map((item) => item.command).join('\n'),
    ).toContain('pnpm build')
    expect(
      WORKSPACE_QUICK_COMMANDS.map((item) => item.command).join('\n'),
    ).toContain('pnpm smoke:routes:mobile')
  })

  it('keeps workflow presets, environment badges, and failure parser cards available', () => {
    expect(TERMINAL_WORKFLOW_PRESETS.map((item) => item.label)).toEqual([
      'Daily',
      'Agent Ops',
      'Knowledge',
      'Runtime',
    ])
    expect(
      [...TERMINAL_WORKFLOW_PRESETS, ...WORKSPACE_QUICK_COMMANDS]
        .map((item) => item.command)
        .join('\n'),
    ).not.toContain('/workspace/health')
    expect(TERMINAL_ENV_BADGES).toContain('launchd')
    expect(TERMINAL_ENV_BADGES).toContain('shell zsh')
    expect(TERMINAL_FAILURE_PARSERS.map((item) => item.label)).toEqual([
      'Build',
      'Test',
      'Runtime',
    ])
  })

  it('classifies session state and exports safe diagnostics', () => {
    const tab = {
      id: 'tab-1',
      title: 'Workspace',
      cwd: '/Users/tylerlyon/hermes-workspace',
      sessionId: 'session-123456',
      status: 'active' as const,
    }

    expect(classifyTerminalSessionState(tab)).toEqual({
      label: 'connected',
      detail: 'PTY stream',
    })
    expect(classifyTerminalSessionState(null).label).toBe('detached')

    const diagnostics = JSON.parse(
      buildTerminalDiagnosticBundle({
        tab,
        transport: 'sse',
        lastCloseReason: 'client close',
      }),
    )
    expect(diagnostics).toMatchObject({
      route: '/workspace/terminal',
      sessionId: 'session-123456',
      shell: 'zsh',
      cwd: '/Users/tylerlyon/hermes-workspace',
      transport: 'sse',
      state: 'connected',
      secretsIncluded: false,
    })
    expect(JSON.stringify(diagnostics)).not.toContain('token')
  })

  it('builds terminal cockpit tiles for first-viewport app chrome', () => {
    const tab = {
      id: 'tab-1',
      title: 'Workspace',
      cwd: '/Users/tylerlyon/hermes-workspace',
      sessionId: 'session-123456',
      status: 'active' as const,
    }

    expect(
      buildTerminalCockpitTiles({
        activeTab: tab,
        tabCount: 2,
        terminalMode: 'shell',
        debugOpen: false,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'state',
          label: 'PTY',
          value: 'connected',
          tone: 'ok',
        }),
        expect.objectContaining({
          id: 'tabs',
          value: '2',
          detail: 'Workspace',
        }),
        expect.objectContaining({
          id: 'safety',
          value: 'Guarded',
        }),
      ]),
    )
  })

  it('detects dangerous commands and truncates copied output with redaction', () => {
    expect(isDangerousTerminalCommand('git reset --hard HEAD')).toBe(true)
    expect(isDangerousTerminalCommand('pnpm build')).toBe(false)

    const result = truncateTerminalOutputForCopy(
      `api_key=abc123\n${'x'.repeat(9000)}`,
    )
    expect(result.truncated).toBe(true)
    expect(result.text).toContain('[terminal output truncated to last 8KB]')
    expect(result.text).not.toContain('abc123')
  })
})
