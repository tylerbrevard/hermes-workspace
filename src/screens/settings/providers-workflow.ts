import type { ModelCatalogEntry } from '@/lib/model-types'
import {
  getProviderDisplayName,
  getProviderInfo,
  normalizeProviderId,
} from '@/lib/provider-catalog'

export type ProviderStatus = 'active' | 'configured'
export type SettingsTabId =
  | 'providers'
  | 'models'
  | 'agents'
  | 'session'
  | 'memory'
export type SettingKind = 'text' | 'number' | 'select' | 'boolean' | 'multiline'

export type ProviderSummary = {
  id: string
  name: string
  description: string
  modelCount: number
  status: ProviderStatus
}

export type ProvidersScreenProps = {
  embedded?: boolean
}

export type ClaudeConfig = Record<string, unknown>

export type ConfigQueryResponse = {
  ok?: boolean
  payload?: ClaudeConfig
  error?: string
}

export type ConfigPatchResponse = {
  ok?: boolean
  error?: string
}

export type SelectOption = {
  label: string
  value: string
}

export type SettingDefinition = {
  id: string
  tab: SettingsTabId
  label: string
  description: string
  path?: string
  kind: SettingKind
  options?: Array<SelectOption>
  placeholder?: string
  min?: number
  step?: number
  rows?: number
  unsupported?: boolean
  formatter?: (value: unknown) => string
  parser?: (value: string) => unknown
}

export type SaveSettingPayload = {
  path: string
  value: unknown
  label: string
}

export type ModelProviderOption =
  | 'custom'
  | 'openrouter'
  | 'anthropic'
  | 'openai'

export type ModelConfigDraft = {
  provider: ModelProviderOption
  model: string
  baseUrl: string
}

export type PerformanceDraft = {
  streamStaleTimeout: string
  streamReadTimeout: string
}

const KNOWN_PROVIDER_PREFIXES = [
  'openrouter',
  'anthropic',
  'openai',
  'openai-codex',
  'nous',
  'ollama',
  'atomic-chat',
  'zai',
  'kimi-coding',
  'minimax',
  'minimax-cn',
]

export const MODEL_PROVIDER_OPTIONS: Array<SelectOption> = [
  { label: 'Custom', value: 'custom' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
]

export const MODEL_PRESETS = [
  {
    id: 'atomic-chat',
    label: 'Atomic Chat',
    provider: 'custom' as const,
    baseUrl: 'http://127.0.0.1:1337/v1',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    provider: 'custom' as const,
    baseUrl: 'http://127.0.0.1:11434/v1',
  },
  {
    id: 'llama-server',
    label: 'llama-server',
    provider: 'custom' as const,
    baseUrl: 'http://127.0.0.1:8080/v1',
  },
]

export const DEFAULT_STREAM_STALE_TIMEOUT_SECONDS = 90
export const DEFAULT_STREAM_READ_TIMEOUT_SECONDS = 60

const MODEL_PROVIDER_VALUES = new Set<ModelProviderOption>(
  MODEL_PROVIDER_OPTIONS.map((option) => option.value as ModelProviderOption),
)

export function stripProviderPrefix(model: string): string {
  if (!model) return model
  const slash = model.indexOf('/')
  if (slash === -1) return model
  const prefix = model.slice(0, slash)
  if (KNOWN_PROVIDER_PREFIXES.includes(prefix)) {
    return model.slice(slash + 1)
  }
  return model
}

export function formatStringList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

export function parseStringList(value: string): Array<string> {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readProviderId(entry: ModelCatalogEntry): string | null {
  if (typeof entry === 'string') return null
  const provider = typeof entry.provider === 'string' ? entry.provider : ''
  const normalized = normalizeProviderId(provider)
  return normalized || null
}

export function buildProviderSummaries(payload: {
  models?: Array<ModelCatalogEntry>
  configuredProviders?: Array<string>
}): Array<ProviderSummary> {
  const modelCounts = new Map<string, number>()

  for (const entry of payload.models ?? []) {
    const providerId = readProviderId(entry)
    if (!providerId) continue

    const current = modelCounts.get(providerId) ?? 0
    modelCounts.set(providerId, current + 1)
  }

  const configuredSet = new Set<string>()
  for (const providerId of payload.configuredProviders ?? []) {
    const normalized = normalizeProviderId(providerId)
    if (normalized) configuredSet.add(normalized)
  }

  for (const providerId of modelCounts.keys()) {
    configuredSet.add(providerId)
  }

  const summaries: Array<ProviderSummary> = []

  for (const providerId of configuredSet) {
    const metadata = getProviderInfo(providerId)
    const modelCount = modelCounts.get(providerId) ?? 0

    summaries.push({
      id: providerId,
      name: getProviderDisplayName(providerId),
      description:
        metadata?.description ||
        'Configured provider in your local Hermes setup.',
      modelCount,
      status: modelCount > 0 ? 'active' : 'configured',
    })
  }

  summaries.sort(function sortByName(a, b) {
    return a.name.localeCompare(b.name)
  })

  return summaries
}

export function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, source)
}

export function coerceBoolean(value: unknown): boolean {
  return value === true
}

export function coerceString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function coerceNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : ''
}

export function defaultFormatValue(
  setting: SettingDefinition,
  value: unknown,
): string {
  if (setting.kind === 'number') return coerceNumber(value)
  if (setting.kind === 'boolean') return coerceBoolean(value) ? 'true' : 'false'
  return coerceString(value)
}

export function getDraftValue(
  setting: SettingDefinition,
  config: ClaudeConfig | undefined,
  draftValues: Record<string, string>,
): string {
  if (draftValues[setting.id] !== undefined) return draftValues[setting.id]
  if (!setting.path) return ''
  const rawValue = readPath(config, setting.path)
  if (setting.formatter) return setting.formatter(rawValue)
  return defaultFormatValue(setting, rawValue)
}

export function parseTextValue(
  setting: SettingDefinition,
  rawValue: string,
): unknown {
  if (setting.parser) return setting.parser(rawValue)
  return rawValue.trim()
}

export function parseNumberValue(rawValue: string): number | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildModelOptions(
  models: Array<ModelCatalogEntry>,
): Array<SelectOption> {
  const seen = new Set<string>()
  const options: Array<SelectOption> = []

  for (const entry of models) {
    const modelId =
      typeof entry === 'string'
        ? entry
        : typeof entry.id === 'string'
          ? entry.id
          : typeof entry.alias === 'string'
            ? entry.alias
            : typeof entry.model === 'string'
              ? entry.model
              : ''

    if (!modelId.trim() || seen.has(modelId)) continue
    seen.add(modelId)

    const label =
      typeof entry === 'string'
        ? entry
        : typeof entry.displayName === 'string'
          ? entry.displayName
          : typeof entry.label === 'string'
            ? entry.label
            : typeof entry.name === 'string'
              ? entry.name
              : modelId

    options.push({ label, value: modelId })
  }

  options.sort(function sortOptions(a, b) {
    return a.label.localeCompare(b.label)
  })

  return options
}

export function searchMatchesSetting(
  setting: SettingDefinition,
  query: string,
): boolean {
  const haystack = [
    setting.label,
    setting.description,
    setting.path,
    setting.tab,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function parseModelProvider(value: unknown): ModelProviderOption {
  return typeof value === 'string' &&
    MODEL_PROVIDER_VALUES.has(value as ModelProviderOption)
    ? (value as ModelProviderOption)
    : 'custom'
}

export function readPrimaryModelConfig(
  config: ClaudeConfig | undefined,
): ModelConfigDraft {
  const modelBlock = readRecord(config?.model)
  const flatModel = typeof config?.model === 'string' ? config.model : ''

  return {
    provider: parseModelProvider(modelBlock?.provider ?? config?.provider),
    model: coerceString(modelBlock?.default ?? flatModel),
    baseUrl: coerceString(modelBlock?.base_url ?? config?.base_url),
  }
}

export function readFallbackModelConfig(
  config: ClaudeConfig | undefined,
): ModelConfigDraft {
  const fallbackBlock = readRecord(config?.fallback_model)

  return {
    provider: parseModelProvider(fallbackBlock?.provider),
    model: coerceString(fallbackBlock?.model),
    baseUrl: coerceString(fallbackBlock?.base_url),
  }
}

export function readPerformanceConfig(
  config: ClaudeConfig | undefined,
): PerformanceDraft {
  const performanceBlock = readRecord(config?.performance)
  const staleTimeout =
    performanceBlock?.stream_stale_timeout ?? config?.stream_stale_timeout
  const readTimeout =
    performanceBlock?.stream_read_timeout ?? config?.stream_read_timeout

  return {
    streamStaleTimeout:
      typeof staleTimeout === 'number' && Number.isFinite(staleTimeout)
        ? String(staleTimeout)
        : String(DEFAULT_STREAM_STALE_TIMEOUT_SECONDS),
    streamReadTimeout:
      typeof readTimeout === 'number' && Number.isFinite(readTimeout)
        ? String(readTimeout)
        : String(DEFAULT_STREAM_READ_TIMEOUT_SECONDS),
  }
}

export function hasModelConfigValue(value: ModelConfigDraft): boolean {
  return Boolean(value.model.trim() || value.baseUrl.trim())
}

export function parseTimeoutInput(value: string, fallback: number): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
