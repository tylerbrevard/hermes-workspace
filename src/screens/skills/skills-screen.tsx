import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppStoreIcon,
  Clock01Icon,
  CommandIcon,
  PackageIcon,
  Shield01Icon,
} from '@hugeicons/core-free-icons'
import {
  DEFAULT_CATEGORIES,
  PAGE_LIMIT,
  buildSkillInventoryExport,
  buildSkillInvocationCommand,
  formatRefreshTime,
  formatSkillOrigin,
  getSkillCompatibility,
  getSkillDiagnostics,
  getSkillProvenance,
  getSkillRouteLinks,
  isSkillBrokenOrReview,
  normalizeSkillUsageKey,
  resolveSkillDataSourceState,
  resolveSkillSearchTier,
} from './skills-workflow'
import {
  FeaturedGrid,
  MetadataPill,
  SecurityBadge,
  SkillsGrid,
} from './skills-grid'
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
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'

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
      .slice(0, 3)
  }, [marketplaceSkills, skills])

  const commandCenterSkills = useMemo(() => {
    const pinned = skills.filter((skill) => pinnedSkillIds.includes(skill.id))
    const recent = recentlyUsedSkills.map((entry) => entry.skill)
    const review = brokenSkills
    const combined = [...pinned, ...recent, ...recommendedSkills, ...review]
    const seen = new Set<string>()
    return combined
      .filter((skill) => {
        if (seen.has(skill.id)) return false
        seen.add(skill.id)
        return true
      })
      .slice(0, 3)
  }, [
    brokenSkills,
    pinnedSkillIds,
    recentlyUsedSkills,
    recommendedSkills,
    skills,
  ])

  const commandCenterPosture = useMemo(() => {
    if (brokenSkills.length > 0) return `${brokenSkills.length} need review`
    if (recentlyUsedSkills.length > 0) {
      return `${recentlyUsedSkills.length} recently used`
    }
    if (recommendedSkills.length > 0) return 'Recommended stack ready'
    return 'Build a working set'
  }, [brokenSkills.length, recentlyUsedSkills.length, recommendedSkills.length])

  const visibleInstalledSkills = useMemo(() => {
    const base =
      focus === 'recent'
        ? recentlyUsedSkills.map((entry) => entry.skill)
        : focus === 'broken'
          ? brokenSkills
          : skills
    const sorted =
      sort !== 'lastUsed'
        ? base
        : [...base].sort((left, right) => {
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
    return sorted.slice(0, 6)
  }, [brokenSkills, focus, recentlyUsedSkills, skills, sort, usageLookup])

  const visibleMarketplaceSkills = useMemo(() => {
    const base =
      focus === 'available'
        ? marketplaceSkills.filter((skill) => !skill.installed)
        : marketplaceSkills
    return base.slice(0, 6)
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
      'Command ready.',
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface text-ink">
      <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col gap-3 px-3 py-3 pb-[calc(var(--tabbar-h,80px)+0.75rem)] sm:gap-5 sm:px-6 sm:py-6 sm:pb-[calc(var(--tabbar-h,80px)+1.5rem)] lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                Hermes Workspace Marketplace
              </p>
              <h1 className="text-2xl font-medium text-ink text-balance sm:text-3xl">
                Skills Browser
              </h1>
              <p className="text-sm text-primary-500 text-pretty sm:text-base">
                Local skills, hub, safety.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 text-xs [-webkit-overflow-scrolling:touch] sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {[
              ['Installed', skillCounts.installed],
              ['Enabled', skillCounts.enabled],
              ['Built-in', skillCounts.builtin],
              ['Agent', skillCounts.agentCreated],
              ['Review', brokenSkills.length],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="min-w-[112px] rounded-2xl border border-primary-200 bg-primary-100/60 px-3 py-2 sm:min-w-0"
              >
                <span className="text-primary-500">{label}</span>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
          <AppSurface className="mt-4">
            <AppSectionHeader
              title="Skill command center"
              meta={`${commandCenterPosture} · ${formatRefreshTime(skillsQuery.dataUpdatedAt)}`}
              action={
                <AppStatusPill
                  tone={
                    dataSourceState === 'ready'
                      ? 'green'
                      : dataSourceState === 'unavailable'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {dataSourceState}
                </AppStatusPill>
              }
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AppTile
                title="Installed"
                value={String(skillCounts.installed)}
                detail="Local stack"
                icon={PackageIcon}
                tone="blue"
                actionLabel="Browse"
                className="min-h-[118px]"
                onClick={() => handleFocusChange('installed')}
              />
              <AppTile
                title="Recent"
                value={String(recentlyUsedSkills.length)}
                detail="Used skills"
                icon={Clock01Icon}
                tone="green"
                actionLabel="Open"
                className="min-h-[118px]"
                onClick={() => handleFocusChange('recent')}
              />
              <AppTile
                title="Review"
                value={String(brokenSkills.length)}
                detail="Needs attention"
                icon={Shield01Icon}
                tone={brokenSkills.length > 0 ? 'amber' : 'green'}
                actionLabel="Check"
                className="min-h-[118px]"
                onClick={() => handleFocusChange('broken')}
              />
              <AppTile
                title="Hub"
                value={String(marketplaceSkills.length)}
                detail="Find skills"
                icon={AppStoreIcon}
                tone="purple"
                actionLabel="Search"
                className="min-h-[118px]"
                onClick={() => handleFocusChange('available')}
              />
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {(commandCenterSkills.length
                ? commandCenterSkills
                : recommendedSkills
              ).map((skill) => (
                <article
                  key={`command-${skill.id}`}
                  className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-1 text-xs font-semibold text-ink">
                        {skill.icon} {skill.name}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-[11px] text-primary-500">
                        {getSkillCompatibility(skill)}
                      </p>
                    </div>
                    <SecurityBadge security={skill.security} compact />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copySkillCommand(skill)}
                      className="rounded-md border border-primary-200 px-2 py-1 text-[10px] font-medium text-primary-700 transition-colors hover:bg-primary-100"
                    >
                      Invoke
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSkill(skill)}
                      className="rounded-md px-2 py-1 text-[10px] text-primary-500 transition-colors hover:bg-primary-100"
                    >
                      Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {[
                { key: 'recent' as const, label: 'Recent' },
                { key: 'broken' as const, label: 'Review' },
                { key: 'available' as const, label: 'Find new' },
                { key: 'installed' as const, label: 'Installed' },
              ].map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleFocusChange(action.key)}
                  className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                >
                  {action.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void exportSkillInventory()}
                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                title="Export skill inventory"
              >
                Export
              </button>
            </div>
          </AppSurface>
        </header>

        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-primary-200 bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={
                  tab === 'marketplace'
                    ? 'Search hub, GitHub, local'
                    : 'Search skill, tag, task'
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
                  <option value="All">All</option>
                  <option value="builtin">Built-in</option>
                  <option value="agent-created">Agent</option>
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
                  <option value="name">Name</option>
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

            <TabsPanel value="installed" className="min-h-0 overflow-y-auto pt-2">
              {focus === 'recent' && recentlyUsedSkills.length > 0 ? (
                <div className="mb-3 rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2 text-xs text-primary-600">
                  Recent first:{' '}
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
                        title: 'No recent skills',
                        description: 'Clear focus or search by skill name.',
                      }
                    : focus === 'broken'
                      ? {
                          title: 'No review skills',
                          description: 'Disabled and risky skills appear here.',
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

            <TabsPanel value="marketplace" className="min-h-0 space-y-3 overflow-y-auto pt-2">
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
                  Hub unavailable. Showing installed skills.
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
                  title: searchInput.trim() ? 'No hub skills' : 'Search hub',
                  description: searchInput.trim()
                    ? 'Try another term.'
                    : 'Type to search hub + local.',
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
            <span>{(skillsQuery.data?.total || 0).toLocaleString()} total</span>
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
                    value={selectedSkill.enabled ? 'tracked' : 'disabled'}
                  />
                </div>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <MetadataPill
                    label="Routes"
                    value={getSkillRouteLinks(selectedSkill).join(' · ')}
                  />
                  <MetadataPill
                    label="Diagnostics"
                    value={
                      getSkillDiagnostics(selectedSkill).join(', ') || 'clear'
                    }
                  />
                  <MetadataPill label="Latest" value="compare" />
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
                          No triggers
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
                          ? 'Agent'
                          : 'Marketplace'}
                    </span>
                  ) : null}
                  <p className="text-sm text-primary-500 text-pretty">
                    Src{' '}
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
                    Copy
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
                    Source
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
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() =>
                        runSkillAction('install', { skillId: selectedSkill.id })
                      }
                    >
                      Install
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
