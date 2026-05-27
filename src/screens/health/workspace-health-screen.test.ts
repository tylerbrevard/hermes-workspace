import { describe, expect, it } from 'vitest'
import { summarizeWorkspaceHealth } from './workspace-health-screen'

describe('summarizeWorkspaceHealth', () => {
  it('promotes failures over warnings and counts passed probes', () => {
    const summary = summarizeWorkspaceHealth([
      {
        id: 'auth',
        label: 'Auth',
        endpoint: '/api/auth-check',
        group: 'Core',
        required: true,
        severity: 'ok',
        status: 200,
        latencyMs: 10,
        evidence: 'ok',
      },
      {
        id: 'gateway',
        label: 'Gateway',
        endpoint: '/api/gateway-status',
        group: 'Core',
        required: true,
        severity: 'fail',
        status: 503,
        latencyMs: 10,
        evidence: 'down',
      },
      {
        id: 'lily',
        label: 'LILY',
        endpoint: '/api/lily/config',
        group: 'Daily flow',
        severity: 'warn',
        status: 200,
        latencyMs: 10,
        evidence: 'worker offline',
      },
    ])

    expect(summary.severity).toBe('fail')
    expect(summary.failed).toBe(1)
    expect(summary.warnings).toBe(1)
    expect(summary.passed).toBe(1)
  })
})
