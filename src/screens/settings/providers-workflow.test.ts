import { describe, expect, it } from 'vitest'
import {
  buildModelOptions,
  buildProviderSummaries,
  getDraftValue,
  parseNumberValue,
  parseStringList,
  readFallbackModelConfig,
  readPath,
  readPerformanceConfig,
  readPrimaryModelConfig,
  searchMatchesSetting,
  stripProviderPrefix,
} from './providers-workflow'
import type { SettingDefinition } from './providers-workflow'

describe('providers workflow helpers', () => {
  it('normalizes provider-prefixed models and provider summaries', () => {
    expect(stripProviderPrefix('openrouter/anthropic/claude-sonnet')).toBe(
      'anthropic/claude-sonnet',
    )
    expect(stripProviderPrefix('custom/team/model')).toBe('custom/team/model')

    expect(
      buildProviderSummaries({
        configuredProviders: ['OpenAI'],
        models: [
          { id: 'gpt-4.1', provider: 'openai', name: 'GPT 4.1' },
          { id: 'claude-sonnet', provider: 'anthropic', name: 'Sonnet' },
        ],
      }).map((provider) => ({
        id: provider.id,
        modelCount: provider.modelCount,
        status: provider.status,
      })),
    ).toEqual([
      { id: 'anthropic', modelCount: 1, status: 'active' },
      { id: 'openai', modelCount: 1, status: 'active' },
    ])
  })

  it('reads and parses settings values deterministically', () => {
    const setting: SettingDefinition = {
      id: 'memory-paths',
      tab: 'memory',
      label: 'Memory paths',
      description: 'Indexed paths',
      path: 'agents.defaults.memory.paths',
      kind: 'multiline',
      parser: parseStringList,
    }

    const config = {
      agents: {
        defaults: {
          memory: {
            paths: ['docs', ' src '],
          },
        },
      },
    }

    expect(readPath(config, 'agents.defaults.memory.paths')).toEqual([
      'docs',
      ' src ',
    ])
    expect(getDraftValue(setting, config, {})).toBe('')
    expect(parseStringList('docs, src\nscripts')).toEqual([
      'docs',
      'src',
      'scripts',
    ])
    expect(parseNumberValue('45')).toBe(45)
    expect(parseNumberValue('nope')).toBeNull()
    expect(searchMatchesSetting(setting, 'indexed')).toBe(true)
  })

  it('builds model options and config drafts from mixed config shapes', () => {
    expect(
      buildModelOptions([
        'claude-3-5-sonnet',
        { id: 'gpt-4.1', provider: 'openai', name: 'GPT 4.1' },
      ]),
    ).toEqual([
      { label: 'claude-3-5-sonnet', value: 'claude-3-5-sonnet' },
      { label: 'GPT 4.1', value: 'gpt-4.1' },
    ])

    const config = {
      provider: 'openrouter',
      model: {
        default: 'anthropic/claude-sonnet',
        base_url: 'https://openrouter.ai/api/v1',
      },
      fallback_model: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
      },
      performance: {
        stream_stale_timeout: 120,
      },
    }

    expect(readPrimaryModelConfig(config)).toEqual({
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet',
      baseUrl: 'https://openrouter.ai/api/v1',
    })
    expect(readFallbackModelConfig(config)).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      baseUrl: '',
    })
    expect(readPerformanceConfig(config)).toEqual({
      streamStaleTimeout: '120',
      streamReadTimeout: '60',
    })
  })
})
