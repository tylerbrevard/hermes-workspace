import { describe, expect, it } from 'vitest'
import {
  normalizeLilyChatOptions,
  sanitizeLilyMemoryEvents,
} from './hermes-chat'

describe('normalizeLilyChatOptions', () => {
  it('keeps supported LILY model, personality, and memory settings', () => {
    expect(
      normalizeLilyChatOptions({
        model: 'gpt-4.1-mini',
        personality: 'operator',
        useWorkspaceMemory: false,
        useConversationMemory: false,
      }),
    ).toEqual({
      model: 'gpt-4.1-mini',
      personality: 'operator',
      useWorkspaceMemory: false,
      useConversationMemory: false,
    })
  })

  it('falls back to safe defaults for unsupported options', () => {
    expect(
      normalizeLilyChatOptions({
        model: 'unknown-model',
        personality: 'pirate',
      }),
    ).toEqual({
      model: undefined,
      personality: 'concise',
      useWorkspaceMemory: true,
      useConversationMemory: true,
    })
  })

  it('sanitizes transcript and decision memory events before persistence', () => {
    expect(
      sanitizeLilyMemoryEvents([
        {
          kind: 'transcript',
          label: 'Prompt',
          detail: 'Prep my next meeting.',
          source: 'typed',
        },
        {
          kind: 'decision',
          label: 'Reply',
          detail: 'Start with the board review.',
          source: 'hands-free',
        },
        {
          kind: 'bogus',
          label: 'Drop',
          detail: 'Nope',
          source: 'typed',
        },
      ]),
    ).toEqual([
      {
        kind: 'transcript',
        label: 'Prompt',
        detail: 'Prep my next meeting.',
        source: 'typed',
      },
      {
        kind: 'decision',
        label: 'Reply',
        detail: 'Start with the board review.',
        source: 'hands-free',
      },
    ])
  })
})
