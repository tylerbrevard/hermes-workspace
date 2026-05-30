import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BookmarkAddIcon,
  BookmarkRemoveIcon,
  CommandIcon,
  Delete02Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import {
  getSkillCompatibility,
  getSkillDiagnostics,
  getSkillMutationRisk,
  getSkillProvenance,
  getSkillRouteLinks,
  getSkillSearchSnippet,
  sourceTail,
} from './skills-workflow'
import type { SecurityRisk, SkillSummary } from './skills-workflow'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

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

export function SecurityBadge({
  security,
  compact = true,
}: {
  security?: SecurityRisk
  compact?: boolean
}) {
  if (!security) return null
  const config = SECURITY_BADGE[security.level]

  const [expanded, setExpanded] = useState(false)

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
            setExpanded((value) => !value)
          }}
        >
          {config.label}
        </button>
        {expanded && (
          <div
            className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-72 overflow-hidden rounded-xl border border-primary-200 p-0 shadow-xl"
            style={{ backgroundColor: 'var(--color-primary-50)' }}
          >
            <SecurityScanCard security={security} />
          </div>
        )}
      </div>
    )
  }

  return <SecurityScanCard security={security} />
}

function SecurityScanCard({ security }: { security: SecurityRisk }) {
  const [showDetails, setShowDetails] = useState(false)
  const config = SECURITY_BADGE[security.level]

  const summaryText =
    security.flags.length === 0
      ? 'No risky patterns detected.'
      : security.level === 'high'
        ? `${security.flags.length} security concern${security.flags.length !== 1 ? 's' : ''}. Review first.`
        : `${security.flags.length} risk item${security.flags.length !== 1 ? 's' : ''} noted.`

  return (
    <div className="text-xs">
      <div className="px-3 pt-3 pb-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary-400">
          Security
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-medium text-primary-500">
              Workspace
            </span>
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                config.badgeClass,
              )}
            >
              {config.label}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary-400">
              {config.confidence}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-pretty leading-relaxed text-primary-500">
          {summaryText}
        </p>
      </div>
      {security.flags.length > 0 && (
        <div className="border-t border-primary-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowDetails((value) => !value)
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-accent-500 transition-colors hover:text-accent-600"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                size={13}
                strokeWidth={1.7}
              />
              Risk
            </span>
            <span className="text-[10px]">{showDetails ? '▲' : '▼'}</span>
          </button>
          {showDetails && (
            <div className="space-y-1 px-3 pb-3">
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
        <p className="text-[10px] italic text-primary-400">
          Advisory scan. Review code before run.
        </p>
      </div>
    </div>
  )
}

export function SkillsGrid({
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
          {emptyState?.title || 'No skills'}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-pretty text-xs text-primary-500">
          {emptyState?.description ||
            'Adjust filters, clear search, or open Marketplace.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {skills.map((skill) => {
          const isActing = actionSkillId === skill.id
          const provenance = getSkillProvenance(skill)
          const diagnostics = getSkillDiagnostics(skill)
          const routeLinks = getSkillRouteLinks(skill)
          const pinned = pinnedSkillIds.includes(skill.id)
          const recentlyUsed = recentlyUsedIds.has(skill.id)
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
                'relative z-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border p-3 shadow-sm backdrop-blur-sm hover:z-20 focus-within:z-20 sm:min-h-[220px] sm:rounded-2xl sm:p-4',
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
                    <h3 className="line-clamp-1 min-w-0 text-balance text-base font-medium text-ink">
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
                          ? 'Agent'
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

              <p className="line-clamp-1 text-pretty text-sm text-primary-500 sm:line-clamp-2 sm:min-h-[42px]">
                {skill.description}
              </p>
              {searchInput.trim() ? (
                <p className="mt-2 rounded-lg border border-primary-200 bg-primary-100/50 px-2 py-1 text-xs text-primary-600">
                  {getSkillSearchSnippet(skill, searchInput)}
                </p>
              ) : null}

              <div className="mt-2 hidden flex-wrap items-center gap-1.5 sm:flex">
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
                <span
                  className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                  title={[
                    getSkillCompatibility(skill),
                    diagnostics.length > 0 ? diagnostics.join(', ') : 'clear',
                    routeLinks.join(' · '),
                  ].join(' · ')}
                >
                  {provenance}
                </span>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 sm:pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDetails(skill)}
                  aria-label={`Open docs preview for ${skill.name}`}
                >
                  <HugeiconsIcon icon={InformationCircleIcon} size={14} />
                  Docs
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTogglePinned(skill.id)}
                  aria-label={`${pinned ? 'Unpin' : 'Pin'} ${skill.name}`}
                >
                  <HugeiconsIcon
                    icon={pinned ? BookmarkRemoveIcon : BookmarkAddIcon}
                    size={14}
                  />
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
                      {skill.enabled ? 'On' : 'Off'} · risk {toggleRisk}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing}
                      onClick={() => onUninstall(skill.id)}
                      aria-label={`Remove ${skill.name}; risk ${removeRisk}`}
                      title={`Remove risk ${removeRisk}`}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </Button>
                  </div>
                ) : skill.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isActing}
                    onClick={() => onUninstall(skill.id)}
                    aria-label={`Remove ${skill.name}; risk ${removeRisk}`}
                    title={`Remove risk ${removeRisk}`}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => onInstall(skill.id)}
                    aria-label={`Install ${skill.name}; risk ${installRisk}`}
                    title={`Install risk ${installRisk}`}
                  >
                    Install
                  </Button>
                )}
              </div>
              <div className="mt-3 hidden border-t border-primary-200 pt-3 text-xs text-primary-500 sm:block">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCopyCommand(skill)}
                    aria-label={`Copy command for ${skill.name}`}
                  >
                    <HugeiconsIcon icon={CommandIcon} size={14} />
                    Copy
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

export function MetadataPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
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

export function FeaturedGrid({
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
      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-100/40 px-4 py-10 text-center text-pretty text-sm text-primary-500">
        No featured picks.
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
                <h3 className="text-balance text-lg font-medium text-ink">
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

            <p className="mb-3 line-clamp-3 text-pretty text-sm text-primary-500">
              {skill.description}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(skill)}
                aria-label={`Open details for ${skill.name}`}
              >
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  size={15}
                  strokeWidth={1.7}
                />
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
