export type SkillsTab = 'installed' | 'marketplace' | 'featured'
export type SkillsSort = 'name' | 'category' | 'lastUsed'
export type SkillsFocus =
  | 'all'
  | 'recent'
  | 'installed'
  | 'available'
  | 'broken'
export type SkillDataSourceState =
  | 'loading'
  | 'empty'
  | 'unavailable'
  | 'disabled'

export type SecurityRisk = {
  level: 'safe' | 'low' | 'medium' | 'high'
  flags: Array<string>
  score: number
}

export type SkillSummary = {
  id: string
  slug: string
  name: string
  description: string
  author: string
  triggers: Array<string>
  tags: Array<string>
  homepage: string | null
  category: string
  icon: string
  content: string
  fileCount: number
  sourcePath: string
  installed: boolean
  enabled: boolean
  featuredGroup?: string
  security?: SecurityRisk
  origin?: 'builtin' | 'agent-created' | 'marketplace'
}

export type SkillsApiResponse = {
  skills: Array<SkillSummary>
  total: number
  page: number
  categories: Array<string>
}

export type SkillSearchTier = 0 | 1 | 2 | 3

export type HubSkill = {
  id: string
  name: string
  description: string
  author: string
  category: string
  tags: Array<string>
  downloads?: number
  stars?: number
  source: string
  identifier?: string
  trust_level?: string
  repo?: string | null
  installCommand?: string
  homepage?: string | null
  installed: boolean
  extra?: Record<string, unknown>
}

export type HubSearchResponse = {
  results: Array<HubSkill>
  source: string
  total?: number
  error?: string
}

export type SkillsUsageResponse = {
  skillsUsage?: {
    distinctSkills?: number
    topSkills?: Array<{
      skill: string
      totalCount: number
      percentage?: number
    }>
  } | null
}

export const PAGE_LIMIT = 30

export const DEFAULT_CATEGORIES = [
  'All',
  'Web & Frontend',
  'Coding Agents',
  'Git & GitHub',
  'DevOps & Cloud',
  'Browser & Automation',
  'Image & Video',
  'Search & Research',
  'AI & LLMs',
  'Productivity',
  'Marketing & Sales',
  'Communication',
  'Data & Analytics',
  'Finance & Crypto',
]

export function formatRefreshTime(updatedAt: number): string {
  if (!updatedAt) return 'not loaded yet'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(updatedAt)
}

export function formatSkillOrigin(origin?: SkillSummary['origin']): string {
  if (origin === 'builtin') return 'Built-in'
  if (origin === 'agent-created') return 'Agent-created'
  if (origin === 'marketplace') return 'Marketplace'
  return 'Unknown'
}

export function getSkillProvenance(
  skill: Pick<SkillSummary, 'origin' | 'sourcePath'>,
): string {
  const source = skill.sourcePath.toLowerCase()
  if (skill.origin === 'builtin') return 'bundled'
  if (source.includes('plugins/cache') || source.includes('curated')) {
    return 'curated plugin'
  }
  if (
    source.includes('/documents/new project') ||
    source.startsWith('workspace/')
  ) {
    return 'project'
  }
  if (source.includes('generated') || source.includes('agent-created')) {
    return 'generated'
  }
  return 'local'
}

export function resolveSkillDataSourceState(input: {
  loading: boolean
  disabled?: boolean
  error?: boolean
  count: number
}): SkillDataSourceState | 'ready' {
  if (input.disabled) return 'disabled'
  if (input.loading) return 'loading'
  if (input.error) return 'unavailable'
  if (input.count === 0) return 'empty'
  return 'ready'
}

export function getSkillCompatibility(skill: SkillSummary): string {
  const text =
    `${skill.description} ${skill.tags.join(' ')} ${skill.triggers.join(' ')}`.toLowerCase()
  if (text.includes('browser') || text.includes('playwright'))
    return 'workspace tools: browser-ready'
  if (text.includes('github') || text.includes('git'))
    return 'workspace tools: git-ready'
  if (text.includes('email') || text.includes('outlook'))
    return 'workspace tools: outlook-ready'
  if (text.includes('image') || text.includes('vision'))
    return 'workspace tools: media-ready'
  return 'workspace tools: general'
}

export function getSkillDiagnostics(skill: SkillSummary): Array<string> {
  const diagnostics: Array<string> = []
  if (!skill.sourcePath) diagnostics.push('missing files')
  if (!skill.name || !skill.description) diagnostics.push('bad metadata')
  if (!skill.enabled) diagnostics.push('disabled')
  if (skill.security?.level === 'medium' || skill.security?.level === 'high') {
    diagnostics.push('security review')
  }
  return diagnostics
}

export function getSkillRouteLinks(skill: SkillSummary): Array<string> {
  const text =
    `${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase()
  const links = new Set<string>()
  if (text.includes('browser') || text.includes('frontend'))
    links.add('/playground')
  if (text.includes('github') || text.includes('git')) links.add('/files')
  if (text.includes('email') || text.includes('outlook')) links.add('/tasks')
  if (text.includes('mcp') || text.includes('tool') || text.includes('server'))
    links.add('/mcp')
  if (text.includes('memory') || text.includes('knowledge'))
    links.add('/memory')
  if (text.includes('agent') || text.includes('swarm')) links.add('/swarm')
  links.add('/chat/main')
  return [...links]
}

export function buildSkillInvocationCommand(
  skill: Pick<SkillSummary, 'name' | 'id'>,
): string {
  return `Invoke skill: ${skill.name || skill.id}`
}

export function buildSkillInventoryExport(skills: Array<SkillSummary>): string {
  return JSON.stringify(
    skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      installed: skill.installed,
      enabled: skill.enabled,
      provenance: getSkillProvenance(skill),
      compatibility: getSkillCompatibility(skill),
      diagnostics: getSkillDiagnostics(skill),
      routeLinks: getSkillRouteLinks(skill),
    })),
    null,
    2,
  )
}

export function getSkillSearchSnippet(skill: SkillSummary, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return `Category: ${skill.category}`
  if (skill.name.toLowerCase().includes(normalized)) {
    return `Name match: ${skill.name}`
  }
  const tag = skill.tags.find((item) => item.toLowerCase().includes(normalized))
  if (tag) return `Tag match: ${tag}`
  const trigger = skill.triggers.find((item) =>
    item.toLowerCase().includes(normalized),
  )
  if (trigger) return `Trigger match: ${trigger}`
  const description = skill.description.trim()
  if (description.toLowerCase().includes(normalized)) {
    const index = description.toLowerCase().indexOf(normalized)
    const start = Math.max(0, index - 36)
    const end = Math.min(description.length, index + normalized.length + 72)
    return `Description match: ${description.slice(start, end)}`
  }
  return `Source match: ${sourceTail(skill.sourcePath)}`
}

export function getSkillMutationRisk(
  action: 'install' | 'uninstall' | 'toggle',
  skill: Pick<SkillSummary, 'installed' | 'origin' | 'security' | 'sourcePath'>,
): 'safe' | 'low' | 'medium' | 'high' {
  if (action === 'toggle') return 'low'
  if (action === 'install') {
    if (skill.security?.level === 'high') return 'high'
    if (skill.security?.level === 'medium') return 'medium'
    return skill.origin === 'marketplace' ? 'low' : 'safe'
  }
  if (skill.origin === 'builtin') return 'medium'
  if (getSkillProvenance(skill) === 'project') return 'high'
  return skill.installed ? 'medium' : 'low'
}

export function sourceTail(sourcePath: string): string {
  if (!sourcePath) return 'unknown source'
  const parts = sourcePath.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || sourcePath
}

export function resolveSkillSearchTier(
  skill: SkillSummary,
  query: string,
): SkillSearchTier {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0

  if (skill.name.toLowerCase().includes(normalizedQuery)) return 0

  const tagText = skill.tags.join(' ').toLowerCase()
  const triggerText = skill.triggers.join(' ').toLowerCase()
  if (
    tagText.includes(normalizedQuery) ||
    triggerText.includes(normalizedQuery)
  ) {
    return 1
  }

  if (skill.description.toLowerCase().includes(normalizedQuery)) return 2
  return 3
}

export function normalizeSkillUsageKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

export function isSkillBrokenOrReview(skill: SkillSummary): boolean {
  return (
    !skill.enabled ||
    skill.security?.level === 'medium' ||
    skill.security?.level === 'high'
  )
}
