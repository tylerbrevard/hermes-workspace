import { describe, expect, it } from 'vitest'
import {
  buildAgentConfigDraft,
  buildAgentConfigPatchPayload,
  deriveAgentStatus,
  formatTokenCount,
  getSessionFriendlyId,
  getSessionModelName,
  getSessionStatusBadgeClasses,
  getSessionTitle,
  getSessionTokenCount,
  matchesAgentCronJob,
  parseAgentDefinitions,
  scoreSessionMatch,
  serializeAgentConfigDraft,
} from './agents-workflow'
import type { AgentConfigData, AgentRuntime } from './agents-workflow'

describe('Agents workflow helpers', () => {
  it('parses gateway agent definitions and infers category metadata', () => {
    const definitions = parseAgentDefinitions({
      agents: [
        {
          id: 'codex-worker',
          name: 'Codex Worker',
          description: 'Writes code',
        },
        {
          id: 'telegram-bridge',
          name: 'Telegram Bridge',
          category: 'integration',
        },
      ],
    })

    expect(definitions?.map((agent) => agent.category)).toEqual([
      'Coding',
      'Integrations',
    ])
    expect(definitions?.[0]?.aliases).toContain('codex-worker')
    expect(definitions?.[1]?.role).toBe('Integration agent')
  })

  it('scores session matches and derives status from current activity', () => {
    const now = Date.parse('2026-05-27T14:00:00.000Z')
    const originalNow = Date.now
    Date.now = () => now
    try {
      const agent = {
        id: 'codex',
        name: 'Codex',
        category: 'Coding',
        role: 'Coding agent',
        color: 'blue' as const,
        aliases: ['codex'],
      }
      const session = {
        key: 'codex-session-1',
        title: 'Fix route split',
        status: 'running',
        updatedAt: now - 5_000,
        totalTokens: 1234,
        model: 'gpt-5',
      }

      expect(scoreSessionMatch(agent, session)).toBe(85)
      expect(deriveAgentStatus(session, undefined)).toBe('active')
      expect(deriveAgentStatus(session, true)).toBe('paused')
      expect(getSessionFriendlyId(session)).toBe('codex-session-1')
      expect(getSessionTitle(session)).toBe('Fix route split')
      expect(getSessionTokenCount(session)).toBe(1234)
      expect(formatTokenCount(1234)).toBe('1,234')
      expect(getSessionModelName(session)).toBe('gpt-5')
      expect(getSessionStatusBadgeClasses(session)).toContain('accent')
    } finally {
      Date.now = originalNow
    }
  })

  it('serializes config drafts and builds patch payloads', () => {
    const config: AgentConfigData = {
      agentId: 'codex',
      name: 'Codex',
      workspacePath: '/workspace',
      primaryModel: 'gpt-5',
      fallbackModels: ['gpt-5-mini'],
      modelOverride: ' gpt-5.1 ',
      tools: [{ id: 'shell', enabled: true, source: 'allowed' }],
      skills: [{ id: 'review', enabled: false }],
      channels: [{ id: 'slack', enabled: true, config: { room: 'ops' } }],
      readOnly: false,
      supportsPatch: true,
    }

    const draft = buildAgentConfigDraft(config)
    expect(serializeAgentConfigDraft(draft)).toContain('"shell":true')
    expect(buildAgentConfigPatchPayload(draft)).toEqual({
      modelOverride: 'gpt-5.1',
      tools: { shell: true },
      skills: { review: false },
      channels: { slack: { room: 'ops', enabled: true } },
    })
  })

  it('matches cron jobs against runtime agent aliases', () => {
    const runtimeAgent: AgentRuntime = {
      id: 'telegram-gateway',
      name: 'Telegram gateway',
      category: 'Integrations',
      role: 'Channel bridge',
      color: 'cyan',
      status: 'available',
      controlKey: 'telegram-gateway',
      matchedSessions: [],
    }

    expect(
      matchesAgentCronJob(
        {
          id: 'job-1',
          name: 'telegram-gateway daily sweep',
          description: '',
          schedule: '0 9 * * *',
          enabled: true,
          payload: {},
          deliveryConfig: {},
        },
        null,
        runtimeAgent,
      ),
    ).toBe(true)
  })
})
