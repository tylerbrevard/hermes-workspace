import type { SettingsNavId } from '@/components/settings/settings-sidebar'
import type { StudioSettings } from '@/hooks/use-settings'
import { SETTINGS_NAV_ITEMS } from '@/components/settings/settings-sidebar'
import { defaultStudioSettings } from '@/hooks/use-settings'

const SETTINGS_SECTION_KEYWORDS: Record<SettingsNavId, string> = {
  connection: 'connection auth gateway health tokens endpoint',
  claude: 'model provider api key base url anthropic openai local',
  agent: 'agent behavior turns timeout approvals system prompt',
  routing: 'routing models fallback local cloud cost quality',
  voice: 'voice tts stt microphone speaker livekit speech',
  display: 'display streaming markdown compact cost usage',
  appearance: 'appearance theme palette color dark light',
  chat: 'chat composer sessions title messages',
  notifications: 'notifications alerts usage threshold suggestions',
  language: 'language locale translation interface',
}

export const SETTINGS_SECTION_KEYS: Record<
  SettingsNavId,
  Array<keyof StudioSettings>
> = {
  connection: ['claudeUrl', 'claudeToken'],
  claude: ['claudeUrl', 'claudeToken'],
  agent: [],
  routing: [
    'smartSuggestionsEnabled',
    'preferredBudgetModel',
    'preferredPremiumModel',
    'onlySuggestCheaper',
  ],
  voice: [],
  display: ['showUsageMeter', 'showSystemMetricsFooter'],
  appearance: ['theme', 'accentColor'],
  chat: ['mobileChatNavMode'],
  notifications: [
    'notificationsEnabled',
    'usageThreshold',
    'smartSuggestionsEnabled',
  ],
  language: [],
}

export type SettingsValidationStatus = 'ok' | 'warning' | 'missing' | 'stale'

export type SettingsValidationItem = {
  id: 'auth' | 'model' | 'provider' | 'voice' | 'display' | 'notifications'
  label: string
  status: SettingsValidationStatus
  detail: string
}

export type SettingsRecoveryAction = {
  id: SettingsValidationItem['id']
  section: SettingsNavId
  label: string
  detail: string
  severity: 'critical' | 'warning' | 'ok'
}

export type SettingsCockpitTile = {
  id: SettingsValidationItem['id']
  label: string
  section: SettingsNavId
  status: SettingsValidationStatus
  metric: string
  detail: string
}

export type SettingsImportValidationResult =
  | { ok: true; settings: Partial<StudioSettings>; errors: [] }
  | { ok: false; settings?: undefined; errors: Array<string> }

const SETTINGS_SCHEMA_VERSION = 1

const SETTINGS_MOBILE_GROUPS: Record<SettingsNavId, string> = {
  connection: 'Core',
  claude: 'AI',
  agent: 'AI',
  routing: 'AI',
  voice: 'Voice',
  display: 'Look',
  appearance: 'Look',
  chat: 'Core',
  notifications: 'Alerts',
  language: 'Core',
}

const DEFAULT_MOBILE_SETTINGS_SECTIONS: ReadonlyArray<SettingsNavId> = [
  'connection',
  'claude',
  'voice',
  'appearance',
  'notifications',
]

export function searchSettingsSections(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) {
    return SETTINGS_NAV_ITEMS.map((item) => ({
      ...item,
      match: 'All settings sections',
    }))
  }
  return SETTINGS_NAV_ITEMS.filter((item) =>
    [item.label, item.id, SETTINGS_SECTION_KEYWORDS[item.id]]
      .join(' ')
      .toLowerCase()
      .includes(q),
  ).map((item) => ({
    ...item,
    match: SETTINGS_SECTION_KEYWORDS[item.id],
  }))
}

export function getSettingsSearchSummary(
  query: string,
  matches = searchSettingsSections(query),
) {
  const trimmed = query.trim()
  const count = matches.length
  if (!trimmed) return `${count} sections`
  if (count === 0) return `No matches for "${trimmed}"`
  return `${count} ${count === 1 ? 'match' : 'matches'} for "${trimmed}"`
}

export function getSettingsValidationStates(
  settings: Partial<StudioSettings> = {},
): Array<SettingsValidationItem> {
  const merged = { ...defaultStudioSettings, ...settings }
  return [
    {
      id: 'auth',
      label: 'Auth',
      status: merged.claudeToken || merged.claudeUrl ? 'ok' : 'warning',
      detail:
        merged.claudeToken || merged.claudeUrl
          ? 'Auth override saved; secrets stay hidden.'
          : 'Using env or gateway auth.',
    },
    {
      id: 'model',
      label: 'Model',
      status:
        merged.preferredBudgetModel || merged.preferredPremiumModel
          ? 'ok'
          : 'warning',
      detail:
        merged.preferredBudgetModel || merged.preferredPremiumModel
          ? 'Fallback model pinned.'
          : 'Routing is auto-detect.',
    },
    {
      id: 'provider',
      label: 'Provider',
      status: merged.claudeUrl ? 'ok' : 'missing',
      detail: merged.claudeUrl
        ? 'Endpoint override saved.'
        : 'Using server provider config.',
    },
    {
      id: 'voice',
      label: 'Voice',
      status: 'ok',
      detail: 'Voice secrets stay masked.',
    },
    {
      id: 'display',
      label: 'Display',
      status: merged.theme === 'system' ? 'warning' : 'ok',
      detail:
        merged.theme === 'system'
          ? 'Theme follows system preference; preview exact light/dark behavior before demos.'
          : `Theme is pinned to ${merged.theme}.`,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      status: merged.notificationsEnabled ? 'ok' : 'warning',
      detail: merged.notificationsEnabled
        ? `Alerts enabled at ${merged.usageThreshold}% usage threshold.`
        : 'Alerts are disabled; usage and automation warnings can be missed.',
    },
  ]
}

export function getSettingsSectionForValidation(
  id: SettingsValidationItem['id'],
): SettingsNavId {
  const sections: Record<SettingsValidationItem['id'], SettingsNavId> = {
    auth: 'connection',
    provider: 'claude',
    model: 'routing',
    voice: 'voice',
    display: 'appearance',
    notifications: 'notifications',
  }
  return sections[id]
}

export function getPrimarySettingsRecoveryAction(
  settings: Partial<StudioSettings> = {},
): SettingsRecoveryAction {
  const health = getSettingsValidationStates(settings)
  const ranked = [...health].sort((a, b) => {
    const rank: Record<SettingsValidationStatus, number> = {
      missing: 0,
      stale: 1,
      warning: 2,
      ok: 3,
    }
    return rank[a.status] - rank[b.status]
  })
  const first = ranked[0]
  return {
    id: first.id,
    section: getSettingsSectionForValidation(first.id),
    label:
      first.status === 'ok'
        ? 'Configuration is healthy'
        : `Fix ${first.label.toLowerCase()}`,
    detail: first.detail,
    severity:
      first.status === 'missing'
        ? 'critical'
        : first.status === 'ok'
          ? 'ok'
          : 'warning',
  }
}

export function calculateSettingsHealthScore(
  settings: Partial<StudioSettings> = {},
) {
  const penalty: Record<SettingsValidationStatus, number> = {
    ok: 0,
    warning: 9,
    stale: 14,
    missing: 24,
  }
  const totalPenalty = getSettingsValidationStates(settings).reduce(
    (total, item) => total + penalty[item.status],
    0,
  )
  return Math.max(0, Math.min(100, 100 - totalPenalty))
}

export function getSettingsCockpitTiles(
  settings: Partial<StudioSettings> = {},
): Array<SettingsCockpitTile> {
  const health = getSettingsValidationStates(settings)
  const labelById: Record<SettingsValidationItem['id'], string> = {
    auth: 'Auth',
    provider: 'Endpoint',
    model: 'Routing',
    voice: 'Voice',
    display: 'Theme',
    notifications: 'Alerts',
  }
  const metricByStatus: Record<SettingsValidationStatus, string> = {
    ok: 'Ready',
    warning: 'Review',
    stale: 'Refresh',
    missing: 'Fix',
  }
  const rank: Record<SettingsValidationStatus, number> = {
    missing: 0,
    stale: 1,
    warning: 2,
    ok: 3,
  }

  return health
    .map((item) => ({
      id: item.id,
      label: labelById[item.id],
      section: getSettingsSectionForValidation(item.id),
      status: item.status,
      metric: metricByStatus[item.status],
      detail: item.detail,
    }))
    .sort((a, b) => rank[a.status] - rank[b.status])
}

export function getSettingsPrioritySections(
  settings: Partial<StudioSettings> = {},
) {
  const sectionIds = new Set<SettingsNavId>()
  getSettingsCockpitTiles(settings).forEach((tile) => {
    if (tile.status !== 'ok') sectionIds.add(tile.section)
  })
  ;(['connection', 'routing', 'notifications'] as Array<SettingsNavId>).forEach(
    (section) => sectionIds.add(section),
  )
  return SETTINGS_NAV_ITEMS.filter((item) => sectionIds.has(item.id)).slice(
    0,
    5,
  )
}

export function getSettingsMobileGroup(section: SettingsNavId) {
  return SETTINGS_MOBILE_GROUPS[section]
}

export function getDefaultMobileSettingsSections() {
  return [...DEFAULT_MOBILE_SETTINGS_SECTIONS]
}

export function getSettingsSchemaReport(settings: Partial<StudioSettings>) {
  const knownKeys = new Set(Object.keys(defaultStudioSettings))
  const unknownKeys = Object.keys(settings).filter((key) => !knownKeys.has(key))
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    migrationCount: 0,
    unknownKeys,
    status: unknownKeys.length === 0 ? 'current' : 'review-required',
  }
}

export function validateSettingsImportPayload(
  payload: unknown,
): SettingsImportValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['Import payload must be an object.'] }
  }
  const source = payload as {
    values?: unknown
    secretsIncluded?: unknown
  }
  const values =
    source.values &&
    typeof source.values === 'object' &&
    !Array.isArray(source.values)
      ? (source.values as Record<string, unknown>)
      : (payload as Record<string, unknown>)
  const knownKeys = new Set(Object.keys(defaultStudioSettings))
  const errors: Array<string> = []
  const settings: Partial<StudioSettings> = {}
  for (const [key, value] of Object.entries(values)) {
    if (!knownKeys.has(key)) continue
    if (key === 'claudeToken' && value && value !== '[set]') {
      errors.push('Import payload contains an unredacted Claude token.')
      continue
    }
    settings[key as keyof StudioSettings] = value as never
  }
  if (source.secretsIncluded === true) {
    errors.push('Import payload claims to include secrets.')
  }
  if (Object.keys(settings).length === 0 && errors.length === 0) {
    errors.push('Import payload does not contain recognized settings.')
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, settings, errors: [] }
}

export function buildSettingsDiagnosticBundle(settings: StudioSettings) {
  return {
    generatedAt: new Date().toISOString(),
    persistenceTarget: 'localStorage:claude-settings + ~/.hermes config APIs',
    secretsIncluded: false,
    schema: getSettingsSchemaReport(settings),
    primaryRecovery: getPrimarySettingsRecoveryAction(settings),
    health: getSettingsValidationStates(settings),
    values: {
      ...settings,
      claudeToken: settings.claudeToken ? '[set]' : '',
    },
  }
}
