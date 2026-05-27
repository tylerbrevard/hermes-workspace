import { describe, expect, it, vi } from 'vitest'

import {
  buildChatCommandRail,
  buildChatRouteDiagnostics,
  buildChatWorkflowSummary,
  buildResumeLatestContext,
  classifyChatTimeline,
  detectChatFlowRisks,
} from './chat-workflow'
import type { ChatMessage } from './types'

function message(
  role: string,
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    role,
    content: [{ type: 'text', text }],
    ...extra,
  }
}

describe('chat workflow summary', () => {
  it('splits timeline counts across user messages, tools, decisions, and artifacts', () => {
    const messages: Array<ChatMessage> = [
      message('user', 'Please create the release note.'),
      message('assistant', 'Decision: ship after tests.', {
        content: [
          { type: 'text', text: 'Decision: ship after tests.' },
          { type: 'toolCall', id: '1', name: 'apply_patch' },
        ],
      }),
      message('assistant', 'Updated markdown artifact.'),
    ]

    expect(classifyChatTimeline(messages)).toEqual({
      userMessages: 1,
      assistantMessages: 2,
      toolCalls: 1,
      decisions: 1,
      artifacts: 2,
    })
  })

  it('detects owner blockers, waiting items, risky mutations, and task candidates', () => {
    const summary = detectChatFlowRisks([
      message(
        'assistant',
        'Needs Tyler approval. Waiting on Alex. Next step: do not run rm -rf in production.',
      ),
    ])

    expect(summary).toEqual({
      blockedByMe: true,
      waitingOnOthers: true,
      riskyMutation: true,
      taskCandidates: 1,
    })
  })

  it('builds model, fallback, freshness, loading, and cost guard copy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'))

    const summary = buildChatWorkflowSummary({
      messages: [message('user', 'hello')],
      label: 'Agent Ops',
      modelLabel: 'openai/gpt-5',
      updatedAt: Date.parse('2026-05-26T11:30:00Z'),
      saving: false,
      waiting: true,
      error: 'stream failed',
      connectionState: 'disconnected',
    })

    expect(summary).toMatchObject({
      label: 'Agent Ops',
      model: 'gpt-5',
      provider: 'openai',
      fallback: 'HTTP refresh fallback armed',
      sessionFreshness: 'Fresh 30m ago',
      lastSave: 'Last save synced',
      loadingCopy:
        'Hermes is thinking, streaming tools, and reconciling history',
      errorRecovery: 'Retry or refresh history',
      costGuard: 'Cost guard: confirm before long paid runs',
    })

    vi.useRealTimers()
  })

  it('builds safe route diagnostics for chat recovery and mutation state', () => {
    const diagnostics = buildChatRouteDiagnostics({
      activeSessionKey: 'session-123',
      activeFriendlyId: 'main',
      messages: [message('assistant', 'Do not delete production data.')],
      modelLabel: 'anthropic/claude-sonnet',
      connectionState: 'connected',
      waiting: true,
      sending: false,
      error: null,
    })

    expect(diagnostics).toMatchObject({
      route: '/workspace/chat/main',
      activeSession: 'session-123',
      provider: 'anthropic',
      model: 'claude-sonnet',
      recoveryState: 'armed',
      riskyMutationGate: 'review-first',
      secretsIncluded: false,
    })
    expect(JSON.stringify(diagnostics)).not.toContain('token')
  })

  it('summarizes resume-latest context and hides first-run rail after success', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'))

    expect(
      buildResumeLatestContext([
        {
          key: 'abc',
          friendlyId: 'daily',
          title: 'Daily Ops',
          updatedAt: Date.parse('2026-05-26T11:00:00Z'),
        },
      ]),
    ).toMatchObject({
      available: true,
      target: 'daily',
      label: 'Resume Daily Ops',
    })
    expect(buildResumeLatestContext([])).toMatchObject({
      available: false,
      target: null,
    })
    expect(buildChatCommandRail(false).map((item) => item.id)).toEqual([
      'task',
      'note',
      'draft',
      'agent-job',
    ])
    expect(buildChatCommandRail(true)).toEqual([])

    vi.useRealTimers()
  })
})
