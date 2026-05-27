import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  Folder01Icon,
  Key01Icon,
  SparklesIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { DialogContent, DialogRoot, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { writeTextToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { withBasePath } from '@/lib/base-path'

type ProfileSummary = {
  name: string
  path: string
  active: boolean
  exists: boolean
  model?: string
  provider?: string
  description?: string
  skillCount: number
  sessionCount: number
  hasEnv: boolean
  updatedAt?: string
}

type ProfileDetail = {
  name: string
  path: string
  active: boolean
  config: Record<string, unknown>
  description: string
  envPath?: string
  hasEnv: boolean
  sessionsDir?: string
  skillsDir?: string
}

export function getProfileHealth(profile: ProfileSummary) {
  const issues: Array<string> = []
  if (!profile.provider) issues.push('missing provider')
  if (!profile.model) issues.push('missing model')
  if (!profile.description?.trim()) issues.push('stale prompt')
  if (!profile.exists) issues.push('missing files')
  if (!profile.hasEnv) issues.push('env not isolated')
  return {
    score: Math.max(0, 100 - issues.length * 18),
    issues,
    riskyPermissions: /admin|delete|destructive|shell|sudo|filesystem/i.test(
      `${profile.name} ${profile.description ?? ''}`,
    ),
  }
}

export function detectDuplicateProfiles(profiles: Array<ProfileSummary>) {
  const byKey = new Map<string, Array<string>>()
  for (const profile of profiles) {
    const key =
      `${profile.provider ?? 'none'}:${profile.model ?? 'none'}:${profile.description ?? ''}`
        .toLowerCase()
        .trim()
    byKey.set(key, [...(byKey.get(key) ?? []), profile.name])
  }
  return [...byKey.values()].filter((names) => names.length > 1)
}

export function buildProfileBundleExport(profiles: Array<ProfileSummary>) {
  return JSON.stringify(
    profiles.map((profile) => ({
      name: profile.name,
      active: profile.active,
      provider: profile.provider ?? null,
      model: profile.model ?? null,
      description: profile.description ?? '',
      health: getProfileHealth(profile),
      tags: getProfileTags(profile),
    })),
    null,
    2,
  )
}

export function getProfileTags(profile: ProfileSummary) {
  const text = `${profile.name} ${profile.description ?? ''}`.toLowerCase()
  const tags = new Set<string>()
  if (text.includes('ops') || text.includes('operation')) tags.add('role:ops')
  if (text.includes('research')) tags.add('role:research')
  if (text.includes('build') || text.includes('code')) tags.add('role:builder')
  if (profile.provider) tags.add(`provider:${profile.provider}`)
  if (profile.model) tags.add(`model:${profile.model}`)
  if (profile.skillCount > 0) tags.add('tool access:skills')
  if (profile.hasEnv) tags.add('tool access:env')
  if (tags.size === 0) tags.add('workflow:general')
  return [...tags]
}

export function getSuggestedProfile(
  profiles: Array<ProfileSummary>,
  workflow = 'workspace',
) {
  const lower = workflow.toLowerCase()
  return (
    profiles.find((profile) =>
      `${profile.name} ${profile.description ?? ''}`
        .toLowerCase()
        .includes(lower),
    ) ??
    profiles.find((profile) => profile.active) ??
    profiles[0] ??
    null
  )
}

export function getProfileValidationBadges(profile: ProfileSummary) {
  return [
    {
      label: 'provider',
      status: profile.provider ? 'ok' : 'missing',
      route: '/settings/providers',
    },
    {
      label: 'model',
      status: profile.model ? 'ok' : 'missing',
      route: '/settings',
    },
    {
      label: 'tools',
      status: profile.skillCount > 0 ? 'ok' : 'missing',
      route: '/skills',
    },
    {
      label: 'routing',
      status: profile.exists && profile.hasEnv ? 'ok' : 'review',
      route: '/operations',
    },
  ]
}

export function getProfileUsedByRoutes(profile: ProfileSummary) {
  const routes = [
    { label: 'Chat', route: '/chat/main' },
    { label: 'Operations', route: '/operations' },
    { label: 'Conductor', route: '/conductor' },
    { label: 'Jobs', route: '/jobs' },
  ]
  if (!profile.provider || !profile.model) {
    routes.push({ label: 'Settings', route: '/settings/providers' })
  }
  return routes
}

export function canDeleteProfile(
  profile: Pick<ProfileSummary, 'name' | 'active'>,
) {
  if (profile.name === 'default') return false
  if (profile.active) return false
  return true
}

export function buildProfileDiffPreview(
  currentDescription: string,
  nextDescription: string,
) {
  const before = currentDescription.trim()
  const after = nextDescription.trim()
  if (before === after) return 'No description changes.'
  return [
    'Description diff',
    `- ${before || '(empty)'}`,
    `+ ${after || '(empty)'}`,
  ].join('\n')
}

export function getProfileTopCapabilities(profile: ProfileSummary) {
  return getProfileTags(profile)
    .filter((tag) => tag.startsWith('role:') || tag.startsWith('tool access:'))
    .slice(0, 3)
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

function formatRefreshTime(updatedAt: number): string {
  if (!updatedAt) return 'not loaded yet'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(updatedAt)
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-100/60 px-2.5 py-1 text-xs text-primary-700">
      <span className="font-semibold text-primary-900">{value}</span> {label}
    </div>
  )
}

function ProfileStat({
  label,
  value,
  truncate,
}: {
  label: string
  value: string | number
  truncate?: boolean
}) {
  return (
    <div className="flex flex-col items-center py-2.5 px-1">
      <div
        className={cn(
          'text-sm font-bold text-primary-900 dark:text-neutral-100',
          truncate && 'max-w-[72px] truncate text-xs',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-400 dark:text-neutral-500">
        {label}
      </div>
    </div>
  )
}

export function ProfilesScreen() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsName, setDetailsName] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProfileSummary | null>(null)
  const [newProfileName, setNewProfileName] = useState('')
  const [wizardStep, setWizardStep] = useState(1)
  const [cloneFrom, setCloneFrom] = useState('')
  const [wizardProvider, setWizardProvider] = useState('')
  const [wizardModel, setWizardModel] = useState('')
  const [allModels, setAllModels] = useState<
    Array<{ id: string; name?: string; provider?: string }>
  >([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [busyName, setBusyName] = useState<string | null>(null)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const [profileSearch, setProfileSearch] = useState('')
  const [pinnedProfiles, setPinnedProfiles] = useState<Array<string>>([])

  const profilesQuery = useQuery({
    queryKey: ['profiles', 'list'],
    queryFn: () =>
      readJson<{ profiles: Array<ProfileSummary>; activeProfile: string }>(
        '/api/profiles/list',
      ),
  })

  const detailQuery = useQuery({
    queryKey: ['profiles', 'read', detailsName],
    queryFn: () =>
      readJson<{ profile: ProfileDetail }>(
        `/api/profiles/read?name=${encodeURIComponent(detailsName || '')}`,
      ),
    enabled: Boolean(detailsName),
  })

  const profiles = profilesQuery.data?.profiles ?? []
  const activeProfile = profilesQuery.data?.activeProfile ?? 'default'

  const duplicateProfiles = useMemo(
    () => detectDuplicateProfiles(profiles),
    [profiles],
  )
  const suggestedProfile = useMemo(
    () => getSuggestedProfile(profiles, profileSearch || 'workspace'),
    [profileSearch, profiles],
  )
  const sorted = useMemo(() => {
    const normalized = profileSearch.trim().toLowerCase()
    const source = normalized
      ? profiles.filter((profile) => {
          const haystack = [
            profile.name,
            profile.description ?? '',
            profile.model ?? '',
            profile.provider ?? '',
            getProfileTags(profile).join(' '),
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(normalized)
        })
      : profiles
    return [...source].sort((left, right) => {
      const leftPinned = pinnedProfiles.includes(left.name) ? 0 : 1
      const rightPinned = pinnedProfiles.includes(right.name) ? 0 : 1
      if (leftPinned !== rightPinned) return leftPinned - rightPinned
      if (left.active !== right.active) return left.active ? -1 : 1
      return left.name.localeCompare(right.name)
    })
  }, [pinnedProfiles, profileSearch, profiles])
  const profileStats = useMemo(
    () =>
      profiles.reduce(
        (counts, profile) => {
          counts.skills += profile.skillCount
          counts.sessions += profile.sessionCount
          if (profile.hasEnv) counts.withEnv += 1
          if (!profile.provider) counts.missingProvider += 1
          return counts
        },
        { skills: 0, sessions: 0, withEnv: 0, missingProvider: 0 },
      ),
    [profiles],
  )

  async function refreshProfiles() {
    await queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  async function copyProfileBundle() {
    try {
      await writeTextToClipboard(buildProfileBundleExport(profiles))
      toast('Exported profile bundle', { type: 'success' })
    } catch {
      toast('Profile export unavailable', { type: 'warning' })
    }
  }

  function togglePinnedProfile(name: string) {
    setPinnedProfiles((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    )
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.error) {
      throw new Error(payload?.error || `Request failed (${response.status})`)
    }
    return payload
  }

  const fetchAllModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const res = await fetch('/api/models')
      if (res.ok) {
        const result = (await res.json()) as {
          models?: Array<{ id: string; name?: string; provider?: string }>
        }
        setAllModels(result.models || [])
      }
    } catch {
      /* ignore */
    }
    setLoadingModels(false)
  }, [])

  useEffect(() => {
    if (createOpen && wizardStep === 2 && allModels.length === 0) {
      void fetchAllModels()
    }
  }, [createOpen, wizardStep, allModels.length, fetchAllModels])

  useEffect(() => {
    setDescriptionDraft(detailQuery.data?.profile.description ?? '')
  }, [detailQuery.data?.profile.description, detailsName])

  const nameValid =
    /^[A-Za-z0-9_-]+$/.test(newProfileName.trim()) &&
    newProfileName.trim() !== 'default'

  function resetWizard() {
    setNewProfileName('')
    setCloneFrom('')
    setWizardProvider('')
    setWizardModel('')
    setWizardStep(1)
    setAllModels([])
  }

  async function handleCreate() {
    if (!newProfileName.trim()) return
    setBusyName('__create__')
    try {
      await postJson('/api/profiles/create', {
        name: newProfileName.trim(),
        ...(cloneFrom ? { cloneFrom } : {}),
        ...(wizardModel ? { model: wizardModel } : {}),
        ...(wizardProvider ? { provider: wizardProvider } : {}),
      })
      toast(`Created profile ${newProfileName.trim()}`, { type: 'success' })
      setCreateOpen(false)
      resetWizard()
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to create profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleActivate(name: string) {
    setBusyName(name)
    try {
      await postJson('/api/profiles/activate', { name })
      toast(`Activated profile ${name}`, { type: 'success' })
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to activate profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleDelete(name: string) {
    const target = profiles.find((profile) => profile.name === name)
    if (target && !canDeleteProfile(target)) {
      toast('Default or active profiles cannot be deleted.', { type: 'error' })
      return
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete profile ${name}?`)
    )
      return
    setBusyName(name)
    try {
      await postJson('/api/profiles/delete', { name })
      toast(`Deleted profile ${name}`, { type: 'success' })
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to delete profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    setBusyName(renameTarget.name)
    try {
      await postJson('/api/profiles/rename', {
        oldName: renameTarget.name,
        newName: renameValue.trim(),
      })
      toast(`Renamed ${renameTarget.name} → ${renameValue.trim()}`, {
        type: 'success',
      })
      setRenameTarget(null)
      setRenameValue('')
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to rename profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleSaveDescription() {
    if (!detailsName) return
    setSavingDescription(true)
    try {
      await postJson('/api/profiles/update', {
        name: detailsName,
        patch: { description: descriptionDraft.trim() || null },
      })
      toast(`Saved description for ${detailsName}`, { type: 'success' })
      await Promise.all([
        refreshProfiles(),
        queryClient.invalidateQueries({
          queryKey: ['profiles', 'read', detailsName],
        }),
      ])
      await detailQuery.refetch()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to save description',
        { type: 'error' },
      )
    } finally {
      setSavingDescription(false)
    }
  }

  function startClone(profile: ProfileSummary) {
    setCloneFrom(profile.name)
    setNewProfileName(`${profile.name}-copy`)
    setWizardProvider(profile.provider ?? '')
    setWizardModel(profile.model ?? '')
    setWizardStep(1)
    setCreateOpen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-primary-50/80 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={UserGroupIcon} size={22} strokeWidth={1.7} />
            <h1 className="text-lg font-semibold text-primary-900">Profiles</h1>
          </div>
          <p className="mt-1 text-sm text-primary-600">
            Browse and manage Hermes profiles stored under{' '}
            <span className="font-mono">~/.hermes/profiles</span>.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-primary-500">
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Source: ~/.hermes/profiles
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Last refreshed: {formatRefreshTime(profilesQuery.dataUpdatedAt)}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Health:{' '}
              {profilesQuery.isError
                ? 'profile list unavailable'
                : profileStats.missingProvider > 0
                  ? `${profileStats.missingProvider} without provider`
                  : 'profiles reachable'}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Active: {activeProfile}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Duplicate profile detection: {duplicateProfiles.length} groups
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Suggested profile for current page/action:{' '}
              {suggestedProfile?.name ?? 'none'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void copyProfileBundle()}>
            Import/export profile bundle
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
            Create profile
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={profileSearch}
            onChange={(event) => setProfileSearch(event.target.value)}
            placeholder="Search by capability, workflow, role, model, or tool access"
            className="h-10 min-w-0 flex-1"
          />
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 text-xs text-primary-500">
            Tags: role · workflow · model preference · tool access
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">
              Active profile
            </div>
            <div className="mt-1 text-lg font-semibold text-primary-900">
              {activeProfile}
            </div>
            <div className="mt-1 text-sm text-primary-600">
              Used by Chat, Operations, Conductor, Jobs, LILY, tools, and
              routing.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {getProfileUsedByRoutes(
              profiles.find((profile) => profile.name === activeProfile) ??
                profiles[0] ?? {
                  name: activeProfile,
                  path: '',
                  active: true,
                  exists: true,
                  skillCount: 0,
                  sessionCount: 0,
                  hasEnv: false,
                },
            ).map((link) => (
              <a
                key={link.label}
                href={withBasePath(link.route)}
                className="rounded-lg border border-primary-200 bg-primary-100/70 px-2 py-1 text-primary-700"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-2 md:hidden">
        {sorted.slice(0, 3).map((profile) => (
          <article
            key={`mobile-${profile.name}`}
            className="rounded-xl border border-primary-200 bg-primary-50/85 px-3 py-2 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-primary-900">
                  {profile.name}
                </div>
                <div className="mt-1 text-xs text-primary-500">
                  {profile.active ? 'active' : 'inactive'} ·{' '}
                  {profile.provider || 'no provider'} ·{' '}
                  {profile.model || 'no model'}
                </div>
              </div>
              <button
                type="button"
                disabled={profile.active || busyName === profile.name}
                onClick={() => void handleActivate(profile.name)}
                className="rounded-lg border border-primary-200 bg-primary-100/70 px-2 py-1 text-xs text-primary-700 disabled:opacity-50"
              >
                Activate
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-primary-500">
              {getProfileTopCapabilities(profile).map((capability) => (
                <span
                  key={`${profile.name}-${capability}`}
                  className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5"
                >
                  {capability}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <StatChip label="profiles" value={profiles.length} />
        <StatChip label="skills" value={profileStats.skills} />
        <StatChip label="sessions" value={profileStats.sessions} />
        <StatChip label="with env" value={profileStats.withEnv} />
      </div>

      {profilesQuery.isLoading ? (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/70 p-8 text-center text-sm text-primary-600">
          Loading profiles...
        </div>
      ) : profilesQuery.error instanceof Error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {profilesQuery.error.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((profile) => {
          const busy = busyName === profile.name
          const health = getProfileHealth(profile)
          const tags = getProfileTags(profile)
          const pinned = pinnedProfiles.includes(profile.name)
          return (
            <article
              key={profile.name}
              className="group relative overflow-hidden rounded-2xl border border-primary-200 bg-primary-50/80 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              {/* Active glow accent */}
              {profile.active && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-accent-500 to-emerald-400" />
              )}

              {/* Centered avatar hero */}
              <div className="flex flex-col items-center pt-6 pb-1">
                <div className="relative">
                  <div
                    className={cn(
                      'rounded-full p-1',
                      profile.active
                        ? 'bg-gradient-to-br from-emerald-400 via-accent-500 to-emerald-500 shadow-lg shadow-emerald-500/20'
                        : 'bg-gradient-to-br from-primary-200 to-primary-300 dark:from-neutral-700 dark:to-neutral-600',
                    )}
                  >
                    <img
                      src="/claude-avatar.webp"
                      alt={profile.name}
                      className={cn(
                        'size-20 rounded-full border-2 object-cover',
                        profile.active
                          ? 'border-white dark:border-neutral-950'
                          : 'border-primary-50 dark:border-neutral-950',
                      )}
                      style={{
                        filter: profile.active
                          ? 'none'
                          : 'grayscale(0.5) brightness(0.9)',
                      }}
                    />
                  </div>
                  {profile.active && (
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border-2 border-white bg-emerald-500 px-2 py-0.5 dark:border-neutral-950">
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        size={10}
                        strokeWidth={2.5}
                        className="text-white"
                      />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white">
                        Active
                      </span>
                    </div>
                  )}
                </div>

                {/* Name + provider */}
                <h2 className="mt-3 text-center text-lg font-bold text-primary-900 dark:text-neutral-100">
                  {profile.name}
                </h2>
                <span className="mt-1 inline-block rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-medium text-primary-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {profile.provider || 'no provider'}
                </span>
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] px-6 text-center text-xs text-primary-500 dark:text-neutral-400">
                  {profile.description?.trim() || 'No description yet'}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-4 text-[11px]">
                  <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600">
                    Health score: {health.score}
                  </span>
                  <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600">
                    Last used:{' '}
                    {profile.active ? 'current session' : 'usage tracked'}
                  </span>
                  <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600">
                    Success stats: sessions {profile.sessionCount}
                  </span>
                  {health.riskyPermissions ? (
                    <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                      Destructive actions warning
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-4 text-[11px]">
                  {tags.slice(0, 4).map((tag) => (
                    <span
                      key={`${profile.name}-${tag}`}
                      className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-primary-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-4 text-[11px]">
                  {getProfileValidationBadges(profile).map((badge) => (
                    <a
                      key={`${profile.name}-${badge.label}`}
                      href={withBasePath(badge.route)}
                      className={cn(
                        'rounded-md border px-2 py-0.5',
                        badge.status === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700',
                      )}
                    >
                      {badge.label}: {badge.status}
                    </a>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-4 text-[11px]">
                  {getProfileUsedByRoutes(profile).map((link) => (
                    <a
                      key={`${profile.name}-${link.label}`}
                      href={withBasePath(link.route)}
                      className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-primary-500"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Stats ring */}
              <div className="mx-4 mt-4 grid grid-cols-4 divide-x divide-primary-200 rounded-xl border border-primary-200 bg-primary-100/50 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/50">
                <ProfileStat label="Skills" value={profile.skillCount} />
                <ProfileStat label="Sessions" value={profile.sessionCount} />
                <ProfileStat
                  label="Model"
                  value={profile.model || '\u2014'}
                  truncate
                />
                <ProfileStat
                  label="Env"
                  value={profile.hasEnv ? '\u2713' : '\u2014'}
                />
              </div>

              {/* Updated timestamp */}
              <div className="mx-4 mt-3 flex items-center justify-center gap-1.5 text-xs text-primary-400 dark:text-neutral-500">
                <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.7} />
                {formatDate(profile.updatedAt)}
              </div>

              {/* Actions */}
              <div className="mt-4 flex border-t border-primary-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => void handleActivate(profile.name)}
                  disabled={profile.active || busy}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 border-r border-primary-200 py-2.5 text-xs font-semibold transition-colors dark:border-neutral-800',
                    profile.active
                      ? 'cursor-default text-primary-300 dark:text-neutral-600'
                      : 'text-primary-700 hover:bg-primary-100 dark:text-neutral-300 dark:hover:bg-neutral-900',
                  )}
                >
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Activate
                </button>
                <button
                  type="button"
                  onClick={() => togglePinnedProfile(profile.name)}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r border-primary-200 py-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  {pinned ? 'Pinned' : 'Pin'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsName(profile.name)}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r border-primary-200 py-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenameTarget(profile)
                    setRenameValue(profile.name)
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r border-primary-200 py-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  <HugeiconsIcon
                    icon={Edit02Icon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => startClone(profile)}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r border-primary-200 py-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(profile.name)}
                  disabled={!canDeleteProfile(profile) || busy}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
                    !canDeleteProfile(profile)
                      ? 'cursor-default text-primary-300 dark:text-neutral-600'
                      : 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20',
                  )}
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Delete
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {sorted.length === 0 && !profilesQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/70 p-8 text-center text-sm text-primary-600">
          Clear empty state: ~/.hermes/profiles is missing, unreadable, or has
          no matching profile. Create a profile, import a profile bundle, or
          clear search. Do not route Chat, LILY, or agents to an unknown
          profile. The active profile is{' '}
          <span className="font-semibold">{activeProfile}</span>.
        </div>
      ) : null}

      <DialogRoot
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetWizard()
        }}
      >
        <DialogContent className="w-[min(560px,94vw)] max-w-none p-0">
          {/* ── Header ─────────────────────────────────── */}
          <div className="border-b border-primary-200 px-6 pb-4 pt-5 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-xl border border-primary-200 bg-primary-100/70 dark:border-neutral-700 dark:bg-neutral-900">
                <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.7} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Create profile
                </DialogTitle>
                <p className="mt-0.5 text-xs text-primary-500 dark:text-neutral-400">
                  {wizardStep === 1
                    ? 'Name & template'
                    : wizardStep === 2
                      ? 'Choose model'
                      : 'Review & create'}
                </p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      wizardStep > step
                        ? 'bg-emerald-500 text-white'
                        : wizardStep === step
                          ? 'bg-accent-500 text-white'
                          : 'border border-primary-200 bg-primary-100 text-primary-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500',
                    )}
                  >
                    {wizardStep > step ? (
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        size={16}
                        strokeWidth={2}
                      />
                    ) : (
                      step
                    )}
                  </div>
                  {step < 3 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 rounded-full transition-colors',
                        wizardStep > step
                          ? 'bg-emerald-400'
                          : 'bg-primary-200 dark:bg-neutral-700',
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Body ──────────────────────────────────── */}
          <div className="px-6 py-5">
            {wizardStep === 1 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-neutral-400">
                    Profile name
                  </label>
                  <Input
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="e.g. builder, researcher, ops"
                    className="h-11 text-sm"
                    autoFocus
                  />
                  {newProfileName.trim() && !nameValid ? (
                    <p className="text-xs text-red-500">
                      Use letters, numbers, underscores, or hyphens. Cannot be
                      &quot;default&quot;.
                    </p>
                  ) : newProfileName.trim() && nameValid ? (
                    <p className="text-xs text-emerald-600">✓ Valid name</p>
                  ) : (
                    <p className="text-xs text-primary-400 dark:text-neutral-500">
                      Choose a short, memorable identifier
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        size={13}
                        strokeWidth={1.8}
                      />
                      Clone from existing
                    </span>
                  </label>
                  <select
                    value={cloneFrom}
                    onChange={(e) => setCloneFrom(e.target.value)}
                    className="h-11 w-full rounded-xl border border-primary-200 bg-primary-50 px-3 text-sm text-primary-900 outline-none transition-colors focus:border-accent-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  >
                    <option value="">Start fresh — empty config</option>
                    {profiles.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.model ? `(${p.model})` : ''}{' '}
                        {p.active ? '• active' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-primary-400 dark:text-neutral-500">
                    Copies config, skills path, and env from the selected
                    profile
                  </p>
                </div>

                <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <p className="text-xs text-primary-500 dark:text-neutral-400">
                    Profiles are stored under{' '}
                    <code className="rounded bg-primary-100 px-1 py-0.5 font-mono text-[11px] dark:bg-neutral-800">
                      ~/.hermes/profiles/&lt;name&gt;/
                    </code>{' '}
                    with their own config, skills, sessions, and env.
                  </p>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-neutral-400">
                    Default model
                  </label>
                  {loadingModels ? (
                    <div className="flex h-11 items-center rounded-xl border border-primary-200 bg-primary-50 px-3 text-sm text-primary-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
                      Loading configured models…
                    </div>
                  ) : allModels.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      No models found. Make sure Hermes Agent is running and has
                      models configured.
                    </div>
                  ) : (
                    <select
                      value={wizardModel}
                      onChange={(e) => {
                        const modelId = e.target.value
                        setWizardModel(modelId)
                        const matched = allModels.find((m) => m.id === modelId)
                        setWizardProvider(matched?.provider || '')
                      }}
                      className="h-11 w-full rounded-xl border border-primary-200 bg-primary-50 px-3 text-sm text-primary-900 outline-none transition-colors focus:border-accent-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      <option value="">Skip — configure later</option>
                      {allModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                          {m.provider ? ` (${m.provider})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {wizardModel && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ {wizardModel}
                      {wizardProvider ? ` via ${wizardProvider}` : ''}
                    </p>
                  )}
                </div>

                {!wizardModel && !loadingModels && allModels.length > 0 && (
                  <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <p className="text-xs text-primary-500 dark:text-neutral-400">
                      Select a model or skip to configure later from profile
                      details or config.yaml.
                    </p>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary-200 bg-primary-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary-500 dark:text-neutral-400">
                    Profile summary with validation and preview
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SummaryField label="Name" value={newProfileName.trim()} />
                    <SummaryField
                      label="Template"
                      value={cloneFrom || 'Fresh start'}
                    />
                    <SummaryField
                      label="Model"
                      value={
                        wizardModel
                          ? `${wizardModel}${wizardProvider ? ` (${wizardProvider})` : ''}`
                          : 'Not set'
                      }
                      muted={!wizardModel}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    This will create{' '}
                    <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-[11px] dark:bg-emerald-900/40">
                      ~/.hermes/profiles/{newProfileName.trim()}/
                    </code>{' '}
                    with config.yaml
                    {cloneFrom ? ` cloned from ${cloneFrom}` : ''}, skills/, and
                    sessions/ directories.
                  </p>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <p className="text-xs text-primary-500 dark:text-neutral-400">
                    Create/edit validation preview checks malformed profile
                    files, duplicate names, missing provider/model, and risky
                    permissions before write.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-primary-200 px-6 py-4 dark:border-neutral-800">
            <div>
              {wizardStep > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep((s) => (s - 1) as 1 | 2 | 3)}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateOpen(false)
                  resetWizard()
                }}
              >
                Cancel
              </Button>
              {wizardStep < 3 ? (
                <Button
                  size="sm"
                  onClick={() => setWizardStep((s) => (s + 1) as 1 | 2 | 3)}
                  disabled={wizardStep === 1 && !nameValid}
                  className="gap-1.5"
                >
                  Next
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={1.8}
                  />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={busyName === '__create__'}
                  className="gap-1.5"
                >
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    size={14}
                    strokeWidth={1.8}
                  />
                  Create Profile
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null)
            setRenameValue('')
          }
        }}
      >
        <DialogContent className="w-[min(440px,94vw)] max-w-none p-0">
          <div className="border-b border-primary-200 px-6 pb-4 pt-5 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-xl border border-primary-200 bg-primary-100/70 dark:border-neutral-700 dark:bg-neutral-900">
                <HugeiconsIcon icon={Edit02Icon} size={20} strokeWidth={1.7} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Rename profile
                </DialogTitle>
                <p className="mt-0.5 text-xs text-primary-500 dark:text-neutral-400">
                  Renaming{' '}
                  <span className="font-semibold text-primary-700 dark:text-neutral-200">
                    {renameTarget?.name}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-neutral-400">
                New name
              </label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="new-profile-name"
                className="h-11 text-sm"
                autoFocus
              />
              {renameValue.trim() &&
                !/^[A-Za-z0-9_-]+$/.test(renameValue.trim()) && (
                  <p className="text-xs text-red-500">
                    Use letters, numbers, underscores, or hyphens.
                  </p>
                )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-primary-200 px-6 py-3 dark:border-neutral-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRenameTarget(null)
                setRenameValue('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRename()}
              disabled={
                !renameTarget ||
                !renameValue.trim() ||
                !/^[A-Za-z0-9_-]+$/.test(renameValue.trim())
              }
            >
              Rename
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={Boolean(detailsName)}
        onOpenChange={(open) => !open && setDetailsName(null)}
      >
        <DialogContent className="w-[min(640px,94vw)] max-w-none p-0 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-primary-200 px-6 pb-4 pt-5 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/claude-avatar.webp"
                  alt={detailsName || ''}
                  className="size-12 rounded-full border-2 border-primary-200 object-cover dark:border-neutral-700"
                />
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold">
                    {detailsName}
                  </DialogTitle>
                  <p className="mt-0.5 text-xs text-primary-500 dark:text-neutral-400">
                    Profile details &amp; configuration
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void detailQuery.refetch()}
                disabled={detailQuery.isFetching}
              >
                {detailQuery.isFetching ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {detailQuery.data?.profile ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Name"
                    value={detailQuery.data.profile.name}
                  />
                  <DetailField
                    label="Active"
                    value={detailQuery.data.profile.active ? 'Yes' : 'No'}
                    accent={detailQuery.data.profile.active}
                  />
                </div>
                <DetailField
                  label="Path"
                  value={detailQuery.data.profile.path}
                  mono
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const pathValue = detailQuery.data.profile.path
                      void writeTextToClipboard(pathValue).then(
                        () => toast('Copied profile path', { type: 'success' }),
                        () =>
                          toast(pathValue, {
                            type: 'warning',
                            duration: 7000,
                          }),
                      )
                    }}
                    className="gap-1.5"
                  >
                    <HugeiconsIcon
                      icon={Copy01Icon}
                      size={14}
                      strokeWidth={1.8}
                    />
                    Copy path
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailField
                    label="Env file"
                    value={detailQuery.data.profile.envPath || 'Not set'}
                    mono
                    muted={!detailQuery.data.profile.envPath}
                  />
                  <DetailField
                    label="Sessions"
                    value={detailQuery.data.profile.sessionsDir || 'Not set'}
                    mono
                    muted={!detailQuery.data.profile.sessionsDir}
                  />
                  <DetailField
                    label="Skills"
                    value={detailQuery.data.profile.skillsDir || 'Not set'}
                    mono
                    muted={!detailQuery.data.profile.skillsDir}
                  />
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <DetailField
                    label="Operations agents"
                    value="Conductor · Swarm · Jobs"
                  />
                  <DetailField
                    label="Audit history"
                    value="created · activated · edited · monitored"
                  />
                  <DetailField
                    label="LILY voice persona"
                    value={`Use ${detailQuery.data.profile.name} for daily voice handoff`}
                  />
                  <DetailField
                    label="Comparison"
                    value={`Active ${detailQuery.data.profile.active ? 'matches' : 'differs from'} selected profile`}
                  />
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary-500 dark:text-neutral-400">
                      Description
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void handleSaveDescription()}
                      disabled={savingDescription}
                    >
                      {savingDescription ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  <textarea
                    value={descriptionDraft}
                    onChange={(event) =>
                      setDescriptionDraft(event.target.value)
                    }
                    placeholder="What this profile is for, how it should behave, or what makes it different"
                    className="min-h-[96px] w-full rounded-lg border border-primary-200 bg-primary-100/70 p-3 text-sm text-primary-900 outline-none transition-colors focus:border-accent-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  <p className="mt-2 text-xs text-primary-400 dark:text-neutral-500">
                    Saved into the profile config, so manual file edits show up
                    here after refresh.
                  </p>
                  <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-primary-200 bg-primary-100/70 p-3 text-xs text-primary-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                    {buildProfileDiffPreview(
                      detailQuery.data.profile.description,
                      descriptionDraft,
                    )}
                  </pre>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-500 dark:text-neutral-400">
                    <HugeiconsIcon
                      icon={Key01Icon}
                      size={14}
                      strokeWidth={1.8}
                    />{' '}
                    Config
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-primary-200 bg-primary-100/70 p-3 text-xs leading-relaxed text-primary-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                    {JSON.stringify(detailQuery.data.profile.config, null, 2)}
                  </pre>
                </div>
              </div>
            ) : detailQuery.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-primary-500 dark:text-neutral-400">
                Loading profile\u2026
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-red-500">
                Failed to load profile.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex justify-end border-t border-primary-200 px-6 py-3 dark:border-neutral-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailsName(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}

function SummaryField({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-100/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-800/60">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-400 dark:text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 text-sm font-medium',
          muted
            ? 'text-primary-400 dark:text-neutral-500'
            : 'text-primary-900 dark:text-neutral-100',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
  muted,
  accent,
  full,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
  accent?: boolean
  full?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60',
        full && 'sm:col-span-2',
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-400 dark:text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-sm break-all',
          mono && 'font-mono text-xs',
          muted
            ? 'text-primary-400 dark:text-neutral-500'
            : accent
              ? 'font-semibold text-emerald-600 dark:text-emerald-400'
              : 'text-primary-900 dark:text-neutral-100',
        )}
      >
        {value}
      </div>
    </div>
  )
}
