import type {
  AgentRegistryCardData,
  AgentRegistryStatus,
} from '@/components/agent-view/agent-registry-card'
import type { fetchCronJobs } from '@/lib/cron-api'

export type AgentGatewayEntry = {
  id?: string
  name?: string
  role?: string
  category?: string
  color?: string
  [key: string]: unknown
}

export type AgentsData = {
  defaultId?: string
  mainKey?: string
  scope?: string
  agents?: Array<AgentGatewayEntry>
  [key: string]: unknown
}

export type SessionEntry = {
  key?: string
  friendlyId?: string
  label?: string
  displayName?: string
  title?: string
  derivedTitle?: string
  task?: string
  status?: string
  updatedAt?: number | string
  enabled?: boolean
  [key: string]: unknown
}

export type AgentDefinition = {
  id: string
  name: string
  category: string
  role: string
  color: AgentRegistryCardData['color']
  aliases: Array<string>
}

export type AgentRuntime = AgentRegistryCardData & {
  matchedSessions: Array<SessionEntry>
}

export type AgentConfigToolEntry = {
  id: string
  enabled: boolean
  source: 'allowed' | 'denied' | 'explicit' | 'unknown'
}

export type AgentConfigSkillEntry = {
  id: string
  enabled: boolean
}

export type AgentConfigChannelEntry = {
  id: string
  enabled: boolean | null
  config: Record<string, unknown>
}

export type AgentConfigData = {
  agentId: string
  name: string
  workspacePath: string
  primaryModel: string
  fallbackModels: Array<string>
  modelOverride: string
  tools: Array<AgentConfigToolEntry>
  skills: Array<AgentConfigSkillEntry>
  channels: Array<AgentConfigChannelEntry>
  readOnly: boolean
  supportsPatch: boolean
  sourceMethod?: string
  warning?: string
}

export type AgentConfigDraft = {
  modelOverride: string
  tools: Record<string, boolean>
  skills: Record<string, boolean>
  channels: Record<
    string,
    { enabled: boolean | null; config: Record<string, unknown> }
  >
}

export type AgentConfigPatchPayload = {
  modelOverride?: string
  tools: Record<string, boolean>
  skills: Record<string, boolean>
  channels: Record<string, Record<string, unknown>>
}

export const CATEGORY_ORDER = [
  'Core',
  'Coding',
  'System',
  'Integrations',
] as const

export const STATUS_SORT_ORDER: Record<AgentRegistryStatus, number> = {
  active: 0,
  idle: 1,
  available: 2,
  paused: 3,
}

export const RUNNING_STATUSES = new Set([
  'running',
  'active',
  'thinking',
  'processing',
  'streaming',
  'in-progress',
  'inprogress',
])

export const PAUSED_STATUSES = new Set(['paused', 'pause', 'suspended'])

const ACTIVE_HEARTBEAT_MS = 30_000

// Temporary fallback registry until the gateway exposes a dedicated agent registry schema.
export const FALLBACK_AGENT_REGISTRY: Array<AgentDefinition> = [
  {
    id: 'aurora-main',
    name: 'Main Agent',
    category: 'Core',
    role: 'Orchestrator',
    color: 'orange',
    aliases: ['aurora-main', 'aurora'],
  },
  {
    id: 'codex',
    name: 'Codex',
    category: 'Coding',
    role: 'Coding specialist',
    color: 'blue',
    aliases: ['codex', 'coding'],
  },
  {
    id: 'memory-consolidator',
    name: 'Memory consolidator',
    category: 'System',
    role: 'Memory service',
    color: 'violet',
    aliases: ['memory-consolidator', 'memory'],
  },
  {
    id: 'telegram-gateway',
    name: 'Telegram gateway',
    category: 'Integrations',
    role: 'Channel bridge',
    color: 'cyan',
    aliases: ['telegram-gateway', 'telegram'],
  },
]

export function readString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function readTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return 0
}

export function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function deriveFriendlyIdFromKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(':')
  const tail = parts[parts.length - 1]
  return tail && tail.trim().length > 0 ? tail.trim() : trimmed
}

export function inferCategoryFromText(text: string): string {
  const normalized = normalizeToken(text)
  if (
    normalized.includes('codex') ||
    normalized.includes('coding') ||
    normalized.includes('developer')
  ) {
    return 'Coding'
  }
  if (
    normalized.includes('memory') ||
    normalized.includes('system') ||
    normalized.includes('ops')
  ) {
    return 'System'
  }
  if (
    normalized.includes('telegram') ||
    normalized.includes('discord') ||
    normalized.includes('slack') ||
    normalized.includes('integration') ||
    normalized.includes('gateway')
  ) {
    return 'Integrations'
  }
  return 'Core'
}

export function normalizeCategoryLabel(category: string): string {
  const normalized = normalizeToken(category)
  if (normalized === 'core') return 'Core'
  if (normalized === 'coding') return 'Coding'
  if (normalized === 'system') return 'System'
  if (normalized === 'integrations' || normalized === 'integration') {
    return 'Integrations'
  }
  return category
}

export function inferRoleFromCategory(category: string): string {
  if (category === 'Coding') return 'Coding agent'
  if (category === 'System') return 'System agent'
  if (category === 'Integrations') return 'Integration agent'
  return 'Core agent'
}

export function inferColorFromCategory(
  category: string,
): AgentRegistryCardData['color'] {
  if (category === 'Coding') return 'blue'
  if (category === 'System') return 'violet'
  if (category === 'Integrations') return 'cyan'
  return 'orange'
}

export function dedupe(values: Array<string>): Array<string> {
  const result: Array<string> = []
  const seen = new Set<string>()

  values.forEach((value) => {
    const normalized = normalizeToken(value)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    result.push(normalized)
  })

  return result
}

export function prettyLabel(value: string): string {
  return value
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function buildAgentConfigDraft(
  config: AgentConfigData,
): AgentConfigDraft {
  return {
    modelOverride: config.modelOverride,
    tools: Object.fromEntries(
      config.tools.map((entry) => [entry.id, entry.enabled]),
    ),
    skills: Object.fromEntries(
      config.skills.map((entry) => [entry.id, entry.enabled]),
    ),
    channels: Object.fromEntries(
      config.channels.map((entry) => [
        entry.id,
        { enabled: entry.enabled, config: entry.config },
      ]),
    ),
  }
}

export function serializeAgentConfigDraft(
  draft: AgentConfigDraft | null,
): string {
  return JSON.stringify(draft ?? null)
}

export function buildAgentConfigPatchPayload(
  draft: AgentConfigDraft,
): AgentConfigPatchPayload {
  return {
    ...(draft.modelOverride.trim()
      ? { modelOverride: draft.modelOverride.trim() }
      : {}),
    tools: draft.tools,
    skills: draft.skills,
    channels: Object.fromEntries(
      Object.entries(draft.channels).map(([id, value]) => [
        id,
        {
          ...value.config,
          ...(value.enabled === null ? {} : { enabled: value.enabled }),
        },
      ]),
    ),
  }
}

export function matchesAgentCronJob(
  job: Awaited<ReturnType<typeof fetchCronJobs>>[number],
  definition: AgentDefinition | null,
  runtimeAgent: AgentRuntime | null,
): boolean {
  if (!runtimeAgent) return false

  const tokens = dedupe([
    runtimeAgent.id,
    runtimeAgent.name,
    ...(definition?.aliases ?? []),
  ])

  const searchBlob = normalizeToken(
    [
      job.id,
      job.name,
      job.description ?? '',
      safeStringify(job.payload),
      safeStringify(job.deliveryConfig),
    ].join(' '),
  )

  return tokens.some((token) => {
    const normalized = normalizeToken(token)
    return normalized.length > 0 && searchBlob.includes(normalized)
  })
}

export function toAgentDefinition(
  value: unknown,
  index: number,
): AgentDefinition | null {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null

  if (!record) return null

  const id = readString(record.id || record.key || record.agentId)
  const name = readString(record.name || record.label || record.displayName)

  const fallbackId = normalizeToken(id || name)
  if (!fallbackId) return null

  const categoryRaw = readString(record.category || record.group || record.kind)
  const roleRaw = readString(record.role || record.description)
  const colorRaw = normalizeToken(readString(record.color))

  const category = normalizeCategoryLabel(
    categoryRaw.length > 0
      ? categoryRaw
      : inferCategoryFromText(`${fallbackId} ${name}`),
  )

  let color = inferColorFromCategory(category)
  if (
    colorRaw === 'orange' ||
    colorRaw === 'blue' ||
    colorRaw === 'cyan' ||
    colorRaw === 'purple' ||
    colorRaw === 'violet'
  ) {
    color = colorRaw
  }

  const aliasParts = [
    id,
    name,
    fallbackId,
    readString(record.profile),
    readString(record.handle),
  ]

  const primaryNameToken = normalizeToken(name).split('-')[0] || ''
  if (primaryNameToken) aliasParts.push(primaryNameToken)

  return {
    id: fallbackId || `agent-${index + 1}`,
    name: name || id || `Agent ${index + 1}`,
    category,
    role: roleRaw || inferRoleFromCategory(category),
    color,
    aliases: dedupe(aliasParts),
  }
}

export function parseAgentDefinitions(
  data: AgentsData | undefined,
): Array<AgentDefinition> | null {
  if (!data || typeof data !== 'object') return null

  const directAgents = Array.isArray(data.agents) ? data.agents : null
  if (directAgents) {
    return directAgents
      .map((entry, index) => toAgentDefinition(entry, index))
      .filter((entry): entry is AgentDefinition => entry !== null)
  }

  const record = data as Record<string, unknown>
  const alternateLists = ['registry', 'agentDefinitions']

  for (const key of alternateLists) {
    const list = record[key]
    if (!Array.isArray(list)) continue

    return list
      .map((entry, index) => toAgentDefinition(entry, index))
      .filter((entry): entry is AgentDefinition => entry !== null)
  }

  const profiles = record.profiles
  if (profiles && typeof profiles === 'object' && !Array.isArray(profiles)) {
    const entries = Object.entries(profiles).map(
      ([profileId, profileValue]) => {
        const profileRecord =
          profileValue &&
          typeof profileValue === 'object' &&
          !Array.isArray(profileValue)
            ? (profileValue as Record<string, unknown>)
            : {}
        return {
          ...profileRecord,
          id: profileId,
          name: readString(profileRecord.name) || profileId,
        }
      },
    )

    return entries
      .map((entry, index) => toAgentDefinition(entry, index))
      .filter((entry): entry is AgentDefinition => entry !== null)
  }

  return null
}

export function getSessionSearchBlob(session: SessionEntry): string {
  const values = [
    readString(session.key),
    readString(session.friendlyId),
    readString(session.label),
    readString(session.displayName),
    readString(session.title),
    readString(session.derivedTitle),
    readString(session.task),
    readString(session.agentId),
    readString(session.agent),
    readString(session.profile),
  ]

  return normalizeToken(values.join(' '))
}

export function getSessionFriendlyId(
  session: SessionEntry | undefined,
): string {
  if (!session) return ''
  const friendlyId = readString(session.friendlyId)
  if (friendlyId) return friendlyId
  return deriveFriendlyIdFromKey(readString(session.key))
}

export function getSessionTitle(session: SessionEntry): string {
  return (
    readString(session.label) ||
    readString(session.displayName) ||
    readString(session.title) ||
    readString(session.derivedTitle) ||
    getSessionFriendlyId(session) ||
    readString(session.key) ||
    'Session'
  )
}

export function scoreSessionMatch(
  agent: AgentDefinition,
  session: SessionEntry,
): number {
  const sessionKey = normalizeToken(readString(session.key))
  const friendlyId = normalizeToken(readString(session.friendlyId))
  const blob = getSessionSearchBlob(session)

  let best = 0

  for (const alias of agent.aliases) {
    if (!alias) continue

    if (sessionKey === alias || friendlyId === alias) {
      best = Math.max(best, 100)
      continue
    }

    if (
      sessionKey.startsWith(`${alias}-`) ||
      sessionKey.includes(`:${alias}:`) ||
      sessionKey.endsWith(`:${alias}`) ||
      friendlyId.startsWith(`${alias}-`)
    ) {
      best = Math.max(best, 85)
      continue
    }

    if (blob.includes(alias)) {
      best = Math.max(best, 65)
    }
  }

  return best
}

export function isPausedSession(session: SessionEntry): boolean {
  const status = normalizeToken(readString(session.status))
  if (PAUSED_STATUSES.has(status)) return true
  if (typeof session.enabled === 'boolean') return session.enabled === false
  return false
}

export function deriveAgentStatus(
  session: SessionEntry | undefined,
  pausedOverride: boolean | undefined,
): AgentRegistryStatus {
  if (typeof pausedOverride === 'boolean') {
    if (pausedOverride) return 'paused'
    if (!session) return 'available'
  }

  if (!session) return 'available'

  if (isPausedSession(session)) return 'paused'

  const status = normalizeToken(readString(session.status))
  const updatedAt = readTimestamp(session.updatedAt)
  const staleMs = updatedAt > 0 ? Date.now() - updatedAt : 0
  const runningLike = RUNNING_STATUSES.has(status) || status.length === 0

  if (runningLike && (updatedAt <= 0 || staleMs <= ACTIVE_HEARTBEAT_MS)) {
    return 'active'
  }

  return 'idle'
}

export function formatRelativeTime(value: unknown): string {
  const timestamp = readTimestamp(value)
  if (!timestamp) return 'No activity timestamp'

  const diffMs = Math.max(0, Date.now() - timestamp)
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function getSessionTokenCount(session: SessionEntry): number {
  const rawValue =
    typeof session.totalTokens === 'number'
      ? session.totalTokens
      : typeof session.tokenCount === 'number'
        ? session.tokenCount
        : 0

  return Number.isFinite(rawValue) ? rawValue : 0
}

export function getSessionModelName(session: SessionEntry): string {
  return readString(session.model) || readString(session.agentModel)
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(value)))
}

export function getSessionStatusBadgeClasses(session: SessionEntry): string {
  const status = normalizeToken(readString(session.status))
  if (PAUSED_STATUSES.has(status)) {
    return 'border border-primary-700 bg-primary-800 text-primary-200'
  }
  if (RUNNING_STATUSES.has(status) || status.length === 0) {
    return 'border border-accent-500/40 bg-accent-500/15 text-accent-300'
  }
  return 'border border-primary-800 bg-primary-900 text-primary-300'
}
