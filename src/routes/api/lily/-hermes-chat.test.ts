import { describe, expect, it } from 'vitest'
import { normalizeLilyChatOptions } from './hermes-chat'

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
})
