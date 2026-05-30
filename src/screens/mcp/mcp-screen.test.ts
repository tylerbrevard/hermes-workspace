import { describe, expect, it } from 'vitest'
import {
  buildMcpDiagnosticsExport,
  buildMcpGuidedSetupSteps,
  getMcpCapabilityMatrixRows,
  getMcpConfigPaths,
  getMcpEmptyStateCopy,
  getMcpOwnership,
  getMcpPrimaryAction,
  getMcpSecurityIndicators,
  getMcpSkillRoute,
  sortMcpServersForAttention,
} from './mcp-screen'
import type { McpServer } from '@/types/mcp'

function server(overrides: Partial<McpServer>): McpServer {
  return {
    id: overrides.name || 'server',
    name: overrides.name || 'server',
    enabled: true,
    transportType: 'stdio',
    command: 'npx',
    args: [],
    env: {},
    headers: {},
    authType: 'none',
    hasBearerToken: false,
    hasOAuthClientSecret: false,
    toolMode: 'all',
    includeTools: [],
    excludeTools: [],
    discoveredToolsCount: 0,
    discoveredTools: [],
    status: 'unknown',
    source: 'configured',
    ...overrides,
  }
}

describe('McpScreen helpers', () => {
  it('sorts failed and erroring servers before stale and healthy servers', () => {
    const sorted = sortMcpServersForAttention([
      server({
        name: 'healthy',
        status: 'connected',
        lastTestedAt: new Date().toISOString(),
      }),
      server({
        name: 'stale',
        status: 'unknown',
        lastTestedAt: '2026-01-01T00:00:00.000Z',
      }),
      server({ name: 'failed', status: 'failed' }),
      server({ name: 'errored', lastError: 'tool call failed' }),
    ])

    expect(sorted.map((item) => item.name)).toEqual([
      'failed',
      'errored',
      'stale',
      'healthy',
    ])
  })

  it('summarizes config paths, security, ownership, and diagnostics export', () => {
    const github = server({
      name: 'github',
      status: 'failed',
      transportType: 'http',
      url: 'https://api.github.example/mcp',
      authType: 'bearer',
      hasBearerToken: true,
      discoveredToolsCount: 7,
      lastError: 'startup failed',
    })

    expect(getMcpConfigPaths('fallback')).toMatchObject({
      expected: '/Users/tylerlyon/.hermes/config.yaml',
      detected: '/Users/tylerlyon/.hermes/config.yaml',
    })
    expect(getMcpSecurityIndicators(github)).toEqual(
      expect.arrayContaining(['remote tools', 'credentialed']),
    )
    expect(getMcpOwnership(github)).toBe(
      'GitHub workflows and code review jobs',
    )
    expect(buildMcpDiagnosticsExport([github])).toContain('startup failed')
    expect(getMcpEmptyStateCopy('fallback')).toContain('config fallback')
  })

  it('builds capability matrix rows, primary actions, and skill handoff routes', () => {
    const github = server({
      name: 'github',
      status: 'failed',
      transportType: 'http',
      authType: 'bearer',
      hasBearerToken: true,
      discoveredToolsCount: 2,
      discoveredTools: [
        { name: 'create_issue', description: 'Create GitHub issue' },
        { name: 'prompt_review', description: 'Review prompt template' },
      ],
      lastError: '401 unauthorized',
    })
    const browser = server({
      name: 'browser',
      status: 'connected',
      discoveredTools: [{ name: 'open_browser' }],
      lastTestedAt: new Date().toISOString(),
    })

    expect(getMcpPrimaryAction(github)).toBe('Logs')
    expect(getMcpSkillRoute(github)).toBe('/skills?search=github')
    expect(getMcpSkillRoute(browser)).toBe('/skills?search=browser')
    expect(getMcpCapabilityMatrixRows([browser, github])[0]).toMatchObject({
      name: 'github',
      tools: 2,
      prompts: 'yes',
      auth: 'bearer',
      action: 'Logs',
    })
  })

  it('builds guided setup steps from config mode, health, discovery, and auth state', () => {
    const github = server({
      name: 'github',
      status: 'failed',
      transportType: 'http',
      authType: 'bearer',
      hasBearerToken: true,
      discoveredToolsCount: 0,
      lastError: '401 unauthorized',
    })

    const steps = buildMcpGuidedSetupSteps([github], 'fallback')

    expect(steps.map((step) => step.id)).toEqual([
      'config-source',
      'connection-test',
      'tool-discovery',
      'security-review',
    ])
    expect(steps[0]).toMatchObject({ status: 'needs review' })
    expect(steps[1]).toMatchObject({
      status: '1 failing',
      action: 'Open logs',
    })
    expect(steps[2]).toMatchObject({ status: '1 missing' })
    expect(steps[3]).toMatchObject({ status: '1 credentialed' })
  })
})
