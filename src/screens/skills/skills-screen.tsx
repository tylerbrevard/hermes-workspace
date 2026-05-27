import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  DEFAULT_CATEGORIES,
  PAGE_LIMIT,
  buildSkillInventoryExport,
  buildSkillInvocationCommand,
  formatRefreshTime,
  formatSkillOrigin,
  getSkillCompatibility,
  getSkillDiagnostics,
  getSkillMutationRisk,
  getSkillProvenance,
  getSkillRouteLinks,
  getSkillSearchSnippet,
  isSkillBrokenOrReview,
  normalizeSkillUsageKey,
  resolveSkillDataSourceState,
  resolveSkillSearchTier,
} from './skills-workflow'
import type {
  HubSearchResponse,
  HubSkill,
  SkillSummary,
  SkillsApiResponse,
  SkillsFocus,
  SkillsSort,
  SkillsTab,
  SkillsUsageResponse,
} from './skills-workflow'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { Markdown } from '@/components/prompt-kit/markdown'
import { cn } from '@/lib/utils'
import { writeTextToClipboard } from '@/lib/clipboard'
import { toast } from '@/components/ui/toast'

export function SkillsScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SkillsTab>('installed')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedMarketplaceSearch, setDebouncedMarketplaceSearch] =
    useState('')
  const [category, setCategory] = useState('All')
  const [origin, setOrigin] = useState<string>('All')
  const [sort, setSort] = useState<SkillsSort>('name')
  const [focus, setFocus] = useState<SkillsFocus>('all')
  const [page, setPage] = useState(1)
  const [actionSkillId, setActionSkillId] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pinnedSkillIds, setPinnedSkillIds] = useState<Array<string>>([])

  useEffect(() => {
    if (tab !== 'marketplace') return

    const timeout = window.setTimeout(() => {
      setDebouncedMarketplaceSearch(searchInput)
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [searchInput, tab])

  const skillsQuery = useQuery({
    queryKey: [
      'skills-browser',
      tab,
      searchInput,
      category,
      origin,
      page,
      sort,
    ],
    queryFn: async function fetchSkills(): Promise<SkillsApiResponse> {
      const params = new URLSearchParams()
      params.set('tab', tab)
      params.set('search', searchInput)
      params.set('category', category)
      params.set('origin', origin)
      params.set('page', String(page))
      params.set('limit', String(PAGE_LIMIT))
      params.set('sort', sort)

      const response = await fetch(`/api/skills?${params.toString()}`)
      const payload = (await response.json()) as SkillsApiResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch skills')
      }
      return payload
    },
  })

  const hubQuery = useQuery({
    queryKey: ['skills-hub-search', debouncedMarketplaceSearch],
    enabled: tab === 'marketplace',
    queryFn: async function fetchHubResults(): Promise<HubSearchResponse> {
      const params = new URLSearchParams()
      params.set('q', debouncedMarketplaceSearch)
      params.set('source', 'all')
      params.set('limit', '20')

      const response = await fetch(
        `/api/skills/hub-search?${params.toString()}`,
      )
      const payload = (await response.json()) as HubSearchResponse
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to search skills hub')
      }
      return payload
    },
  })

  const usageQuery = useQuery({
    queryKey: ['skills-browser', 'usage'],
    queryFn: async function fetchSkillsUsage(): Promise<SkillsUsageResponse> {
      const response = await fetch('/api/dashboard/overview')
      const payload = (await response.json()) as SkillsUsageResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch skills usage')
      }
      return payload
    },
  })

  const categories = useMemo(
    function resolveCategories() {
      const fromApi = skillsQuery.data?.categories
      if (Array.isArray(fromApi) && fromApi.length > 0) {
        return fromApi
      }
      return DEFAULT_CATEGORIES
    },
    [skillsQuery.data?.categories],
  )

  const totalPages = Math.max(
    1,
    Math.ceil((skillsQuery.data?.total || 0) / PAGE_LIMIT),
  )

  const skills = useMemo(
    function resolveVisibleSkills() {
      const sourceSkills = skillsQuery.data?.skills || []
      const normalizedQuery = searchInput.trim().toLowerCase()
      if (!normalizedQuery) {
        return sourceSkills
      }

      return sourceSkills
        .map(function mapSkillToTier(skill, index) {
          return {
            skill,
            index,
            tier: resolveSkillSearchTier(skill, normalizedQuery),
          }
        })
        .sort(function sortByTierThenOriginalOrder(a, b) {
          if (a.tier !== b.tier) return a.tier - b.tier
          return a.index - b.index
        })
        .map(function unwrapSkill(entry) {
          return entry.skill
        })
    },
    [searchInput, skillsQuery.data?.skills],
  )

  const skillCounts = useMemo(
    function resolveSkillCounts() {
      const sourceSkills = skillsQuery.data?.skills || []
      return sourceSkills.reduce(
        (counts, skill) => {
          if (skill.installed) counts.installed += 1
          if (skill.enabled) counts.enabled += 1
          if (skill.origin === 'builtin') counts.builtin += 1
          if (skill.origin === 'agent-created') counts.agentCreated += 1
          if (
            skill.security?.level === 'medium' ||
            skill.security?.level === 'high'
          ) {
            counts.review += 1
          }
          return counts
        },
        { installed: 0, enabled: 0, builtin: 0, agentCreated: 0, review: 0 },
      )
    },
    [skillsQuery.data?.skills],
  )

  const marketplaceSkills = useMemo<Array<SkillSummary>>(
    function resolveMarketplaceSkills() {
      return (hubQuery.data?.results || []).map(function mapHubSkill(skill) {
        // Gateway returns: name, description, source, identifier, trust_level, repo, path, tags, extra, installed
        const skillId = skill.id || skill.name
        const extra = skill.extra as Record<string, unknown>
        const author =
          skill.author ||
          (skill.repo ? skill.repo.split('/')[0] : null) ||
          extra.author ||
          skill.source ||
          'Community'
        const homepage = skill.homepage || skill.repo || extra.homepage || null
        const skillCategory = skill.category || extra.category || 'Productivity'

        return {
          id: skillId,
          slug: skillId,
          name: skill.name || skillId,
          description: skill.description,
          author: String(author),
          triggers: skill.tags,
          tags: skill.tags,
          homepage: typeof homepage === 'string' ? homepage : null,
          category: String(skillCategory),
          icon:
            skill.source === 'github'
              ? '🐙'
              : skill.source === 'official' || skill.trust_level === 'builtin'
                ? '✅'
                : skill.source === 'skills-sh'
                  ? '📦'
                  : skill.source === 'lobehub'
                    ? '🧊'
                    : skill.source === 'claude-marketplace'
                      ? '🤖'
                      : '🧩',
          content: [
            skill.description,
            skill.identifier ? `Identifier: ${skill.identifier}` : '',
            skill.trust_level ? `Trust: ${skill.trust_level}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          fileCount: 0,
          sourcePath:
            skill.identifier ||
            (typeof homepage === 'string' ? homepage : '') ||
            skill.source,
          installed: skill.installed,
          enabled: skill.installed,
          featuredGroup: undefined,
          security: {
            level:
              skill.trust_level === 'builtin'
                ? 'safe'
                : skill.trust_level === 'trusted'
                  ? 'safe'
                  : 'medium',
            flags: [],
            score: 0,
          },
          origin: 'marketplace' as const,
        }
      })
    },
    [hubQuery.data?.results],
  )

  const usageLookup = useMemo(() => {
    const lookup = new Map<string, number>()
    for (const item of usageQuery.data?.skillsUsage?.topSkills ?? []) {
      lookup.set(normalizeSkillUsageKey(item.skill), item.totalCount)
    }
    return lookup
  }, [usageQuery.data?.skillsUsage?.topSkills])

  const recentlyUsedSkills = useMemo(() => {
    return skills
      .map((skill) => {
        const usage =
          usageLookup.get(normalizeSkillUsageKey(skill.id)) ??
          usageLookup.get(normalizeSkillUsageKey(skill.name)) ??
          usageLookup.get(normalizeSkillUsageKey(skill.slug)) ??
          0
        return { skill, usage }
      })
      .filter((entry) => entry.usage > 0)
      .sort((left, right) => right.usage - left.usage)
  }, [skills, usageLookup])
  const recentlyUsedIds = useMemo(
    () => new Set(recentlyUsedSkills.map((entry) => entry.skill.id)),
    [recentlyUsedSkills],
  )

  const brokenSkills = useMemo(
    () => skills.filter((skill) => isSkillBrokenOrReview(skill)),
    [skills],
  )
  const dataSourceState = resolveSkillDataSourceState({
    loading: skillsQuery.isPending,
    error: skillsQuery.isError,
    count: skills.length,
  })
  const recommendedSkills = useMemo(() => {
    const source = skills.length > 0 ? skills : marketplaceSkills
    return source
      .filter((skill) => {
        const text =
          `${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase()
        return (
          text.includes('memory') ||
          text.includes('workspace') ||
          text.includes('agent') ||
          text.includes('browser')
        )
      })
      .slice(0, 4)
  }, [marketplaceSkills, skills])

  const visibleInstalledSkills = useMemo(() => {
    const base =
      focus === 'recent'
        ? recentlyUsedSkills.map((entry) => entry.skill)
        : focus === 'broken'
          ? brokenSkills
          : skills
    if (sort !== 'lastUsed') return base
    return [...base].sort((left, right) => {
      const leftUsage =
        usageLookup.get(normalizeSkillUsageKey(left.id)) ??
        usageLookup.get(normalizeSkillUsageKey(left.name)) ??
        0
      const rightUsage =
        usageLookup.get(normalizeSkillUsageKey(right.id)) ??
        usageLookup.get(normalizeSkillUsageKey(right.name)) ??
        0
      if (leftUsage !== rightUsage) return rightUsage - leftUsage
      return left.name.localeCompare(right.name)
    })
  }, [brokenSkills, focus, recentlyUsedSkills, skills, sort, usageLookup])

  const visibleMarketplaceSkills = useMemo(() => {
    if (focus === 'available') {
      return marketplaceSkills.filter((skill) => !skill.installed)
    }
    return marketplaceSkills
  }, [focus, marketplaceSkills])

  async function copyCommandAndToast(command: string, message: string) {
    try {
      await writeTextToClipboard(command)
      toast(`${message} Copied: ${command}`, {
        type: 'warning',
        icon: '📋',
      })
    } catch {
      toast(`${message} ${command}`, {
        type: 'warning',
        icon: '📋',
        duration: 7000,
      })
    }
  }

  async function copySkillCommand(skill: SkillSummary) {
    await copyCommandAndToast(
      buildSkillInvocationCommand(skill),
      'Command palette integration and LILY/voice mapping ready.',
    )
  }

  async function exportSkillInventory() {
    try {
      await writeTextToClipboard(buildSkillInventoryExport(skills))
      toast('Exported skill inventory', { type: 'success', icon: '📋' })
    } catch {
      toast('Skill inventory export unavailable', { type: 'warning' })
    }
  }

  function togglePinnedSkill(skillId: string) {
    setPinnedSkillIds((current) =>
      current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId],
    )
  }

  async function runSkillAction(
    action: 'install' | 'uninstall' | 'toggle',
    payload: {
      skillId: string
      enabled?: boolean
      source?: HubSkill['source']
    },
  ) {
    setActionError(null)
    setActionSkillId(payload.skillId)

    try {
      const endpoint =
        action === 'install'
          ? '/api/skills/install'
          : action === 'uninstall'
            ? '/api/skills/uninstall'
            : '/api/skills/toggle'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          skillId: payload.skillId,
          name: payload.skillId,
          identifier: payload.skillId,
          enabled: payload.enabled,
          source: payload.source,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        command?: string
        ok?: boolean
      }
      if (!response.ok) {
        throw new Error(data.error || 'Action failed')
      }

      if (
        (action === 'install' || action === 'uninstall') &&
        data.ok === false
      ) {
        if (data.command) {
          await copyCommandAndToast(
            data.command,
            data.error || 'Gateway action unavailable.',
          )
          return
        }
        throw new Error(data.error || 'Action failed')
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['skills-browser'] }),
        queryClient.invalidateQueries({ queryKey: ['skills-hub-search'] }),
      ])
      setSelectedSkill(function updateSelectedSkill(current) {
        if (!current || current.id !== payload.skillId) return current
        if (action === 'install') {
          return {
            ...current,
            installed: true,
            enabled: true,
          }
        }
        if (action === 'uninstall') {
          return {
            ...current,
            installed: false,
            enabled: false,
          }
        }
        return {
          ...current,
          enabled: payload.enabled ?? current.enabled,
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setActionError(errorMessage)
      toast(errorMessage, { type: 'error', icon: '❌' })
    } finally {
      setActionSkillId(null)
    }
  }

  function handleTabChange(nextTab: string) {
    const parsedTab: SkillsTab =
      nextTab === 'installed' ||
      nextTab === 'marketplace' ||
      nextTab === 'featured'
        ? nextTab
        : 'installed'

    setTab(parsedTab)
    setFocus('all')
    setPage(1)
    if (parsedTab !== 'marketplace') {
      setCategory('All')
      setSort('name')
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategory(value)
    setPage(1)
  }

  function handleOriginChange(value: string) {
    setOrigin(value)
    setPage(1)
  }

  function handleSortChange(value: SkillsSort) {
    setSort(value)
    setPage(1)
  }

  function handleFocusChange(nextFocus: SkillsFocus) {
    setFocus(nextFocus)
    setPage(1)
    if (nextFocus === 'available') {
      setTab('marketplace')
      return
    }
    if (tab === 'marketplace') {
      setTab('installed')
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                Hermes Workspace Marketplace
              </p>
              <h1 className="text-2xl font-medium text-ink text-balance sm:text-3xl">
                Skills Browser
              </h1>
              <p className="text-sm text-primary-500 text-pretty sm:text-base">
                Discover, install, and manage skills across your local workspace
                and Skills Hub.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {[
              ['Installed', skillCounts.installed],
              ['Enabled', skillCounts.enabled],
              ['Built-in', skillCounts.builtin],
              ['Agent-created', skillCounts.agentCreated],
              ['Review', skillCounts.review],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-primary-200 bg-primary-100/60 px-3 py-2"
              >
                <span className="text-primary-500">{label}</span>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-primary-500">
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Source: local skill registry and Skills Hub
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Owner: Hermes Skills
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Last refreshed: {formatRefreshTime(skillsQuery.dataUpdatedAt)}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Health:{' '}
              {skillsQuery.isError
                ? 'installed skills unavailable'
                : hubQuery.isError && tab === 'marketplace'
                  ? 'hub search unavailable'
                  : 'catalog reachable'}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Data source state: {dataSourceState} · loading · empty ·
              unavailable · disabled
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Provenance: bundled · curated plugin · local · project · generated
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Actions: dry-run install/update/remove with confirmation
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Security review: mutates files · calls network
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Compatibility: workspace tools checked per skill
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Card telemetry: Broken-skill health · last invoked · Route links ·
              latest curated version
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Command palette invocation mapped
            </span>
            <button
              type="button"
              onClick={() => void exportSkillInventory()}
              className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-200"
            >
              Export skill inventory
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2">
              <div className="font-semibold text-primary-700">
                Recommended skills for current visible page
              </div>
              <div className="mt-1 text-primary-500">
                {recommendedSkills.length > 0
                  ? recommendedSkills.map((skill) => skill.name).join(', ')
                  : 'No recommendation yet'}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2">
              <div className="font-semibold text-primary-700">
                Mobile compact launcher
              </div>
              <div className="mt-1 text-primary-500">
                Top skills:{' '}
                {recentlyUsedSkills
                  .slice(0, 3)
                  .map((entry) => entry.skill.name)
                  .join(', ') || 'pinned skills will appear here'}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2">
              <div className="font-semibold text-primary-700">
                Create skill onboarding wizard
              </div>
              <div className="mt-1 text-primary-500">
                Task intent search, docs preview, latest curated compare, and
                LILY/voice command mapping are surfaced on each card.
              </div>
            </div>
          </div>
          {pinnedSkillIds.length > 0 ? (
            <div className="mt-3 rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2 text-xs text-primary-600">
              <div className="font-semibold text-primary-700">
                Favorite skills
              </div>
              <div className="mt-1">
                {skills
                  .filter((skill) => pinnedSkillIds.includes(skill.id))
                  .map((skill) => skill.name)
                  .join(', ') || 'Pinned skills will appear here'}
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs sm:grid-cols-4">
            {[
              {
                key: 'recent' as const,
                label: 'Recently Used',
                value: recentlyUsedSkills.length,
                hint:
                  usageQuery.data?.skillsUsage?.distinctSkills != null
                    ? `${usageQuery.data.skillsUsage.distinctSkills} used in window`
                    : 'usage loading',
              },
              {
                key: 'installed' as const,
                label: 'Installed',
                value: skillCounts.installed,
                hint: `${skillCounts.enabled} enabled`,
              },
              {
                key: 'available' as const,
                label: 'Available',
                value:
                  tab === 'marketplace'
                    ? visibleMarketplaceSkills.filter(
                        (skill) => !skill.installed,
                      ).length
                    : 'Hub',
                hint: 'open marketplace',
              },
              {
                key: 'broken' as const,
                label: 'Broken / Review',
                value: brokenSkills.length,
                hint: 'disabled or risky',
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleFocusChange(item.key)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-colors',
                  focus === item.key ||
                    (item.key === 'available' && tab === 'marketplace')
                    ? 'border-accent-500/50 bg-accent-500/10 text-ink'
                    : 'border-primary-200 bg-primary-100/50 text-primary-600 hover:bg-primary-100',
                )}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-wide">
                  {item.label}
                </span>
                <span className="mt-1 block text-xl font-semibold text-ink">
                  {String(item.value)}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-primary-500">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        </header>

        <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={
                  tab === 'marketplace'
                    ? 'Search Skills Hub, GitHub, and local fallback'
                    : 'Search by task intent, skill name, tags, or description'
                }
                className="h-9 w-full min-w-0 flex-1 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none transition-colors focus:border-primary sm:min-w-[220px]"
              />

              {tab === 'installed' ? (
                <select
                  value={category}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="h-9 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : null}

              {tab === 'installed' ? (
                <select
                  value={origin}
                  onChange={(event) => handleOriginChange(event.target.value)}
                  className="h-9 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none"
                >
                  <option value="All">All Origins</option>
                  <option value="builtin">Built-in</option>
                  <option value="agent-created">Agent-created</option>
                  <option value="marketplace">Marketplace</option>
                </select>
              ) : null}

              {tab === 'installed' ? (
                <select
                  value={sort}
                  onChange={(event) =>
                    handleSortChange(
                      event.target.value === 'category'
                        ? 'category'
                        : event.target.value === 'lastUsed'
                          ? 'lastUsed'
                          : 'name',
                    )
                  }
                  className="h-9 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none"
                >
                  <option value="name">Name A-Z</option>
                  <option value="category">Category</option>
                  <option value="lastUsed">Last used</option>
                </select>
              ) : null}

              <TabsList
                className="ml-auto rounded-xl border border-primary-200 bg-primary-100/60 p-1"
                variant="default"
              >
                <TabsTab value="installed" className="min-w-[110px]">
                  Installed
                </TabsTab>
                <TabsTab value="marketplace" className="min-w-[120px]">
                  Marketplace
                </TabsTab>
              </TabsList>
            </div>

            {actionError ? (
              <p className="rounded-lg border border-primary-200 bg-primary-100/60 px-3 py-2 text-sm text-ink">
                {actionError}
              </p>
            ) : null}

            <TabsPanel value="installed" className="pt-2">
              {focus === 'recent' && recentlyUsedSkills.length > 0 ? (
                <div className="mb-3 rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2 text-xs text-primary-600">
                  Showing recently used skills first:{' '}
                  {recentlyUsedSkills
                    .slice(0, 5)
                    .map((entry) => `${entry.skill.name} (${entry.usage})`)
                    .join(', ')}
                </div>
              ) : null}
              <SkillsGrid
                skills={visibleInstalledSkills}
                loading={skillsQuery.isPending}
                actionSkillId={actionSkillId}
                pinnedSkillIds={pinnedSkillIds}
                recentlyUsedIds={recentlyUsedIds}
                searchInput={searchInput}
                tab="installed"
                emptyState={
                  focus === 'recent'
                    ? {
                        title: 'No recently used skills on this page',
                        description:
                          'Clear the focus or search by a skill name from the dashboard usage card.',
                      }
                    : focus === 'broken'
                      ? {
                          title: 'No broken or review-needed skills',
                          description:
                            'Disabled skills and medium/high risk skills appear here.',
                        }
                      : undefined
                }
                onOpenDetails={setSelectedSkill}
                onTogglePinned={togglePinnedSkill}
                onCopyCommand={(skill) => void copySkillCommand(skill)}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="marketplace" className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                {hubQuery.data?.source ? (
                  <div className="text-xs text-primary-500">
                    Source: {hubQuery.data.source}
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {hubQuery.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {hubQuery.error instanceof Error
                    ? hubQuery.error.message
                    : 'Failed to load marketplace skills.'}
                </div>
              ) : hubQuery.data &&
                (hubQuery.data.source === 'installed-fallback' ||
                  hubQuery.data.source === 'error') ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  Skills Hub search unavailable — showing installed skills
                  instead. Ensure the Hermes Agent gateway is running.
                </div>
              ) : null}

              <SkillsGrid
                skills={visibleMarketplaceSkills}
                loading={hubQuery.isPending}
                actionSkillId={actionSkillId}
                pinnedSkillIds={pinnedSkillIds}
                recentlyUsedIds={recentlyUsedIds}
                searchInput={searchInput}
                tab="marketplace"
                emptyState={{
                  title: searchInput.trim()
                    ? 'No hub skills found'
                    : 'Search the Skills Hub',
                  description: searchInput.trim()
                    ? 'Try a different search term. If Skills Hub is unavailable, local installed skills are used as fallback.'
                    : 'Start typing to search Skills Hub and other skill sources.',
                }}
                onOpenDetails={setSelectedSkill}
                onTogglePinned={togglePinnedSkill}
                onCopyCommand={(skill) => void copySkillCommand(skill)}
                onInstall={(skillId) => {
                  const skill = hubQuery.data?.results.find(
                    (entry) => entry.id === skillId,
                  )
                  runSkillAction('install', {
                    skillId,
                    source: skill?.source,
                  })
                }}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>
          </Tabs>
        </section>

        {tab !== 'marketplace' ? (
          <footer className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2.5 text-sm text-primary-500 tabular-nums">
            <span>
              {(skillsQuery.data?.total || 0).toLocaleString()} total skills
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || skillsQuery.isPending}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="min-w-[82px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || skillsQuery.isPending}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          </footer>
        ) : null}
      </div>

      <DialogRoot
        open={Boolean(selectedSkill)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkill(null)
          }
        }}
      >
        <DialogContent className="w-[min(960px,95vw)] border-primary-200 bg-primary-50/95 backdrop-blur-sm">
          {selectedSkill ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-primary-200 px-5 py-4">
                <DialogTitle className="text-balance">
                  {selectedSkill.icon} {selectedSkill.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-pretty">
                  by {selectedSkill.author} • {selectedSkill.category} •{' '}
                  {selectedSkill.fileCount.toLocaleString()} files
                </DialogDescription>
                {selectedSkill.security && (
                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50/80 overflow-hidden">
                    <SecurityBadge
                      security={selectedSkill.security}
                      compact={false}
                    />
                  </div>
                )}
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <MetadataPill
                    label="Provenance"
                    value={getSkillProvenance(selectedSkill)}
                  />
                  <MetadataPill
                    label="Compatibility"
                    value={getSkillCompatibility(selectedSkill)}
                  />
                  <MetadataPill
                    label="Last invoked"
                    value={
                      selectedSkill.enabled
                        ? 'usage stats tracked'
                        : 'disabled or unavailable'
                    }
                  />
                </div>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <MetadataPill
                    label="Route links"
                    value={getSkillRouteLinks(selectedSkill).join(' · ')}
                  />
                  <MetadataPill
                    label="Diagnostics"
                    value={
                      getSkillDiagnostics(selectedSkill).join(', ') || 'clear'
                    }
                  />
                  <MetadataPill
                    label="Latest curated"
                    value="compare installed vs latest"
                  />
                </div>
              </div>

              <ScrollAreaRoot className="h-[56vh]">
                <ScrollAreaViewport className="px-5 py-4">
                  <div className="space-y-3">
                    {selectedSkill.homepage ? (
                      <p className="text-sm text-primary-500 text-pretty">
                        Homepage:{' '}
                        <a
                          href={selectedSkill.homepage}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-border underline-offset-4 hover:decoration-primary"
                        >
                          {selectedSkill.homepage}
                        </a>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {selectedSkill.triggers.length > 0 ? (
                        selectedSkill.triggers.slice(0, 8).map((trigger) => (
                          <span
                            key={trigger}
                            className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                          >
                            {trigger}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                          No triggers listed
                        </span>
                      )}
                    </div>

                    <article className="rounded-xl border border-primary-200 bg-primary-100/30 p-4 backdrop-blur-sm">
                      <Markdown>
                        {selectedSkill.content ||
                          `# ${selectedSkill.name}\n\n${selectedSkill.description}`}
                      </Markdown>
                    </article>
                  </div>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar>
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollAreaRoot>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-200 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSkill.origin ? (
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                        selectedSkill.origin === 'builtin' &&
                          'border-primary-200 bg-primary-100/60 text-primary-500',
                        selectedSkill.origin === 'agent-created' &&
                          'border-amber-300/70 bg-amber-100/60 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200',
                        selectedSkill.origin === 'marketplace' &&
                          'border-emerald-300/70 bg-emerald-100/60 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-200',
                      )}
                    >
                      {selectedSkill.origin === 'builtin'
                        ? 'Built-in'
                        : selectedSkill.origin === 'agent-created'
                          ? 'Agent-created'
                          : 'Marketplace'}
                    </span>
                  ) : null}
                  <p className="text-sm text-primary-500 text-pretty">
                    Source:{' '}
                    <code className="inline-code">
                      {selectedSkill.sourcePath}
                    </code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copySkillCommand(selectedSkill)}
                  >
                    Copy invocation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void writeTextToClipboard(selectedSkill.sourcePath).then(
                        () =>
                          toast('Copied skill source path', {
                            type: 'success',
                          }),
                        () =>
                          toast(selectedSkill.sourcePath, {
                            type: 'warning',
                            duration: 7000,
                          }),
                      )
                    }}
                  >
                    Copy source
                  </Button>
                  {selectedSkill.installed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() => {
                        runSkillAction('uninstall', {
                          skillId: selectedSkill.id,
                        })
                      }}
                    >
                      Dry-run remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() =>
                        runSkillAction('install', { skillId: selectedSkill.id })
                      }
                    >
                      Dry-run install
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSkill(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>
    </div>
  )
}

type SkillsGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  actionSkillId: string | null
  pinnedSkillIds: Array<string>
  recentlyUsedIds: Set<string>
  searchInput: string
  tab: 'installed' | 'marketplace'
  emptyState?: {
    title: string
    description: string
  }
  onOpenDetails: (skill: SkillSummary) => void
  onTogglePinned: (skillId: string) => void
  onCopyCommand: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
  onToggle: (skillId: string, enabled: boolean) => void
}

const SECURITY_BADGE: Record<
  string,
  { label: string; badgeClass: string; confidence: string }
> = {
  safe: {
    label: 'Benign',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    confidence: 'HIGH CONFIDENCE',
  },
  low: {
    label: 'Benign',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    confidence: 'MODERATE',
  },
  medium: {
    label: 'Caution',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    confidence: 'REVIEW RECOMMENDED',
  },
  high: {
    label: 'Warning',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    confidence: 'MANUAL REVIEW',
  },
}

function SecurityBadge({
  security,
  compact = true,
}: {
  security?: SecurityRisk
  compact?: boolean
}) {
  if (!security) return null
  const config = SECURITY_BADGE[security.level]

  const [expanded, setExpanded] = useState(false)

  // Compact badge for card grid
  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
            config.badgeClass,
          )}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {config.label}
        </button>
        {expanded && (
          <div
            className="absolute left-0 bottom-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-xl border border-primary-200 p-0 shadow-xl"
            style={{ backgroundColor: 'var(--color-primary-50)' }}
          >
            <SecurityScanCard security={security} />
          </div>
        )}
      </div>
    )
  }

  // Full card for detail dialog
  return <SecurityScanCard security={security} />
}

function SecurityScanCard({ security }: { security: SecurityRisk }) {
  const [showDetails, setShowDetails] = useState(false)
  const config = SECURITY_BADGE[security.level]

  const summaryText =
    security.flags.length === 0
      ? 'No risky patterns detected. This skill appears safe to install.'
      : security.level === 'high'
        ? `Found ${security.flags.length} potential security concern${security.flags.length !== 1 ? 's' : ''}. Review before installing.`
        : `The skill's code was scanned for common risk patterns. ${security.flags.length} item${security.flags.length !== 1 ? 's' : ''} noted.`

  return (
    <div className="text-xs">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-400 mb-2">
          Security Scan
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-primary-500 font-medium w-16 shrink-0">
              Hermes Workspace
            </span>
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                config.badgeClass,
              )}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-primary-400 uppercase tracking-wide font-medium">
              {config.confidence}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-primary-500 text-pretty leading-relaxed">
          {summaryText}
        </p>
      </div>
      {security.flags.length > 0 && (
        <div className="border-t border-primary-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowDetails((v) => !v)
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-accent-500 hover:text-accent-600 transition-colors"
          >
            <span className="text-[11px] font-medium">Details</span>
            <span className="text-[10px]">{showDetails ? '▲' : '▼'}</span>
          </button>
          {showDetails && (
            <div className="px-3 pb-3 space-y-1">
              {security.flags.map((flag) => (
                <div
                  key={flag}
                  className="flex items-start gap-2 text-primary-600"
                >
                  <span className="mt-0.5 text-[9px] text-primary-400">●</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="border-t border-primary-100 px-3 py-2">
        <p className="text-[10px] text-primary-400 italic">
          Security scans are advisory. Review code before you run it.
        </p>
      </div>
    </div>
  )
}

function SkillsGrid({
  skills,
  loading,
  actionSkillId,
  pinnedSkillIds,
  recentlyUsedIds,
  searchInput,
  tab,
  emptyState,
  onOpenDetails,
  onTogglePinned,
  onCopyCommand,
  onInstall,
  onUninstall,
  onToggle,
}: SkillsGridProps) {
  if (loading) {
    return <SkillsSkeleton count={tab === 'installed' ? 6 : 9} />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-100/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-primary-700">
          {emptyState?.title || 'No skills found'}
        </p>
        <p className="mt-1 text-xs text-primary-500 text-pretty max-w-sm mx-auto">
          {emptyState?.description ||
            'Try adjusting filters, clearing search, or switching to Marketplace for installable skills.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {skills.map((skill) => {
          const isActing = actionSkillId === skill.id
          const provenance = getSkillProvenance(skill)
          const diagnostics = getSkillDiagnostics(skill)
          const routeLinks = getSkillRouteLinks(skill)
          const pinned = pinnedSkillIds.includes(skill.id)
          const recentlyUsed = recentlyUsedIds.has(skill.id)
          const usageHint = skill.enabled
            ? 'last invoked: usage tracked'
            : 'last invoked: disabled'
          const installRisk = getSkillMutationRisk('install', skill)
          const removeRisk = getSkillMutationRisk('uninstall', skill)
          const toggleRisk = getSkillMutationRisk('toggle', skill)

          return (
            <motion.article
              key={`${tab}-${skill.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={cn(
                'relative z-0 flex min-h-[220px] min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur-sm hover:z-20 focus-within:z-20',
                recentlyUsed
                  ? 'border-accent-500/50 bg-accent-500/10'
                  : skill.installed
                    ? 'border-primary-300 bg-primary-50/90'
                    : 'border-emerald-300/70 bg-emerald-50/70',
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{skill.icon}</span>
                    <h3 className="line-clamp-1 min-w-0 text-base font-medium text-ink text-balance">
                      {skill.name}
                    </h3>
                  </div>
                  {skill.author ? (
                    <p className="line-clamp-1 text-xs text-primary-500">
                      by {skill.author}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                  {skill.origin ? (
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                        skill.origin === 'builtin' &&
                          'border-primary-200 bg-primary-100/60 text-primary-500',
                        skill.origin === 'agent-created' &&
                          'border-amber-300/70 bg-amber-100/60 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200',
                        skill.origin === 'marketplace' &&
                          'border-emerald-300/70 bg-emerald-100/60 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-200',
                      )}
                    >
                      {skill.origin === 'builtin'
                        ? 'Built-in'
                        : skill.origin === 'agent-created'
                          ? 'Agent-created'
                          : 'Marketplace'}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                      skill.installed
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-primary-200 bg-primary-100/60 text-primary-500',
                    )}
                  >
                    {skill.installed ? 'Installed' : 'Available'}
                  </span>
                  {recentlyUsed ? (
                    <span className="rounded-md border border-accent-500/40 bg-accent-500/10 px-2 py-0.5 text-xs text-ink">
                      Recent
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="line-clamp-3 min-h-[58px] text-sm text-primary-500 text-pretty">
                {skill.description}
              </p>
              <p className="mt-2 rounded-lg border border-primary-200 bg-primary-100/50 px-2 py-1 text-xs text-primary-600">
                {getSkillSearchSnippet(skill, searchInput)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <SecurityBadge security={skill.security} />
                <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                  {skill.category}
                </span>
                <span
                  className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                  title={skill.sourcePath || undefined}
                >
                  {sourceTail(skill.sourcePath)}
                </span>
                {skill.triggers.slice(0, 2).map((trigger) => (
                  <span
                    key={`${skill.id}-${trigger}`}
                    className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                  >
                    {trigger}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDetails(skill)}
                >
                  Docs preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTogglePinned(skill.id)}
                >
                  {pinned ? 'Pinned' : 'Pin'}
                </Button>

                {tab === 'installed' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-primary-500">
                      <Switch
                        checked={skill.enabled}
                        disabled={isActing}
                        onCheckedChange={(checked) =>
                          onToggle(skill.id, checked)
                        }
                        aria-label={`Toggle ${skill.name}`}
                      />
                      {skill.enabled ? 'Enabled' : 'Disabled'} · toggle risk{' '}
                      {toggleRisk}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing}
                      onClick={() => onUninstall(skill.id)}
                    >
                      Remove risk {removeRisk}
                    </Button>
                  </div>
                ) : skill.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isActing}
                    onClick={() => onUninstall(skill.id)}
                  >
                    Remove risk {removeRisk}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => onInstall(skill.id)}
                  >
                    Install risk {installRisk}
                  </Button>
                )}
              </div>
              <div className="mt-3 space-y-2 border-t border-primary-200 pt-3 text-xs text-primary-500">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5">
                    Provenance: {provenance}
                  </span>
                  <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5">
                    {getSkillCompatibility(skill)}
                  </span>
                  <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5">
                    {usageHint}
                  </span>
                  <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5">
                    latest curated version: compare pending
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5">
                    Broken-skill health:{' '}
                    {diagnostics.length > 0 ? diagnostics.join(', ') : 'clear'}
                  </span>
                  <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5">
                    Route links: {routeLinks.join(' · ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCopyCommand(skill)}
                  >
                    Command palette
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCopyCommand(skill)}
                  >
                    LILY / voice
                  </Button>
                </div>
              </div>
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function MetadataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-100/50 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-primary-400">
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-primary-800">
        {value}
      </div>
    </div>
  )
}

type FeaturedGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  actionSkillId: string | null
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
}

function FeaturedGrid({
  skills,
  loading,
  actionSkillId,
  onOpenDetails,
  onInstall,
  onUninstall,
}: FeaturedGridProps) {
  if (loading) {
    return <SkillsSkeleton count={6} large />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-100/40 px-4 py-10 text-center text-sm text-primary-500 text-pretty">
        Featured picks are currently unavailable.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-2 lg:grid-cols-2">
      {skills.map((skill) => {
        const isActing = actionSkillId === skill.id
        return (
          <article
            key={skill.id}
            className="flex min-h-0 flex-col rounded-2xl border border-primary-200 bg-primary-50/85 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                  {skill.featuredGroup || 'Staff Pick'}
                </p>
                <h3 className="text-lg font-medium text-ink text-balance">
                  {skill.icon} {skill.name}
                </h3>
                <p className="text-sm text-primary-500">by {skill.author}</p>
              </div>

              <span
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                  skill.installed
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-primary-200 bg-primary-100/60 text-primary-500',
                )}
              >
                {skill.installed ? 'Installed' : 'Staff Pick'}
              </span>
            </div>

            <p className="line-clamp-3 mb-3 text-sm text-primary-500 text-pretty">
              {skill.description}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(skill)}
              >
                Details
              </Button>
              {skill.installed ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isActing}
                  onClick={() => onUninstall(skill.id)}
                >
                  Uninstall
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isActing}
                  onClick={() => onInstall(skill.id)}
                >
                  Install
                </Button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SkillsSkeleton({
  count,
  large = false,
}: {
  count: number
  large?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        large
          ? 'grid-cols-1 lg:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'animate-pulse rounded-2xl border border-primary-200 bg-primary-50/70 p-4',
            large ? 'min-h-[120px]' : 'min-h-[100px]',
          )}
        >
          <div className="mb-3 h-5 w-2/5 rounded-md bg-primary-100" />
          <div className="mb-2 h-4 w-3/4 rounded-md bg-primary-100" />
          <div className="h-4 w-1/2 rounded-md bg-primary-100" />
          <div className="mt-4 h-20 rounded-xl bg-primary-100/80" />
          <div className="mt-4 h-8 w-1/3 rounded-md bg-primary-100" />
        </div>
      ))}
    </div>
  )
}
