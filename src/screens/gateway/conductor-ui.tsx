import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  PlayIcon,
  Rocket01Icon,
  Search01Icon,
  TaskDone01Icon,
} from '@hugeicons/core-free-icons'
import {
  CONDUCTOR_GOAL_DRAFT_STORAGE_KEY,
  CONDUCTOR_LAUNCH_DRAFT_STORAGE_KEY,
  DEFAULT_MISSION_CONSTRAINTS,
  DEFAULT_MISSION_HANDOFF,
  DEFAULT_MISSION_VERIFICATION,
  TYLER_RECURRING_WORKFLOW_TEMPLATES,
  parseMissionLaunchDraft,
  serializeMissionLaunchDraft,
} from './conductor-workflow'
import type { useConductorGateway } from './hooks/use-conductor-gateway'
import type { CSSProperties } from 'react'
import type { GatewaySession } from '@/lib/gateway-api'
import type { MissionLaunchDraft } from './conductor-workflow'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/prompt-kit/markdown'

export type QuickActionId = 'research' | 'build' | 'review' | 'deploy'

export type HistoryMessage = {
  role?: string
  content?: string | Array<{ type?: string; text?: string }>
}

export type MissionCostWorker = {
  id: string
  label: string
  totalTokens: number
  personaEmoji: string
  personaName: string
}

export type AvailableModel = {
  id?: string
  provider?: string
  name?: string
}

export type FileBrowserEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: Array<FileBrowserEntry>
}

export const THEME_STYLE: CSSProperties = {
  ['--theme-bg' as string]: 'var(--color-surface)',
  ['--theme-card' as string]: 'var(--color-primary-50)',
  ['--theme-card2' as string]: 'var(--color-primary-100)',
  ['--theme-border' as string]: 'var(--color-primary-200)',
  ['--theme-border2' as string]: 'var(--color-primary-400)',
  ['--theme-text' as string]: 'var(--color-ink)',
  ['--theme-muted' as string]: 'var(--color-primary-700)',
  ['--theme-muted-2' as string]: 'var(--color-primary-600)',
  ['--theme-accent' as string]: 'var(--color-accent-500)',
  ['--theme-accent-strong' as string]: 'var(--color-accent-600)',
  ['--theme-accent-soft' as string]:
    'color-mix(in srgb, var(--color-accent-500) 12%, transparent)',
  ['--theme-accent-soft-strong' as string]:
    'color-mix(in srgb, var(--color-accent-500) 18%, transparent)',
  ['--theme-shadow' as string]:
    'color-mix(in srgb, var(--color-primary-950) 14%, transparent)',
  ['--theme-danger' as string]: 'var(--color-red-600, #dc2626)',
  ['--theme-danger-soft' as string]:
    'color-mix(in srgb, var(--theme-danger) 12%, transparent)',
  ['--theme-danger-soft-strong' as string]:
    'color-mix(in srgb, var(--theme-danger) 18%, transparent)',
  ['--theme-danger-border' as string]:
    'color-mix(in srgb, var(--theme-danger) 35%, white)',
  ['--theme-warning' as string]: 'var(--color-amber-600, #d97706)',
  ['--theme-warning-soft' as string]:
    'color-mix(in srgb, var(--theme-warning) 12%, transparent)',
  ['--theme-warning-soft-strong' as string]:
    'color-mix(in srgb, var(--theme-warning) 18%, transparent)',
  ['--theme-warning-border' as string]:
    'color-mix(in srgb, var(--theme-warning) 35%, white)',
}

export const QUICK_ACTIONS: Array<{
  id: QuickActionId
  label: string
  icon: typeof Search01Icon
  prompt: string
}> = [
  {
    id: 'research',
    label: 'Research',
    icon: Search01Icon,
    prompt:
      'Research the problem space, gather constraints, compare approaches, and propose the most viable plan.',
  },
  {
    id: 'build',
    label: 'Build',
    icon: PlayIcon,
    prompt:
      'Build the requested feature end-to-end, including implementation, validation, and a concise delivery summary.',
  },
  {
    id: 'review',
    label: 'Review',
    icon: TaskDone01Icon,
    prompt:
      'Review the current implementation for correctness, regressions, missing tests, and release risks.',
  },
  {
    id: 'deploy',
    label: 'Deploy',
    icon: Rocket01Icon,
    prompt:
      'Prepare the work for deployment, verify readiness, and summarize any operational follow-ups.',
  },
]

const AGENT_NAMES = [
  'Nova',
  'Pixel',
  'Blaze',
  'Echo',
  'Sage',
  'Drift',
  'Flux',
  'Volt',
]
const AGENT_EMOJIS = ['🤖', '⚡', '🔥', '🌊', '🌿', '💫', '🔮', '⭐']
const BLENDED_COST_PER_MILLION_TOKENS = 5

export function loadConductorGoalDraft(): string {
  try {
    return loadConductorLaunchDraft().goal
  } catch {
    return ''
  }
}

export function loadConductorLaunchDraft(): MissionLaunchDraft {
  try {
    const saved = parseMissionLaunchDraft(
      globalThis.localStorage?.getItem(CONDUCTOR_LAUNCH_DRAFT_STORAGE_KEY) ??
        null,
    )
    if (saved) return saved
    const legacyGoal =
      globalThis.localStorage?.getItem(CONDUCTOR_GOAL_DRAFT_STORAGE_KEY) ?? ''
    return {
      goal: legacyGoal,
      constraints: DEFAULT_MISSION_CONSTRAINTS,
      verification: DEFAULT_MISSION_VERIFICATION,
      handoffTarget: DEFAULT_MISSION_HANDOFF,
    }
  } catch {
    return {
      goal: '',
      constraints: DEFAULT_MISSION_CONSTRAINTS,
      verification: DEFAULT_MISSION_VERIFICATION,
      handoffTarget: DEFAULT_MISSION_HANDOFF,
    }
  }
}

export function persistConductorGoalDraft(value: string): void {
  try {
    if (value.trim()) {
      globalThis.localStorage?.setItem(CONDUCTOR_GOAL_DRAFT_STORAGE_KEY, value)
    } else {
      globalThis.localStorage?.removeItem(CONDUCTOR_GOAL_DRAFT_STORAGE_KEY)
    }
  } catch {
    // Ignore storage failures; the in-memory state still works.
  }
}

export function persistConductorLaunchDraft(draft: MissionLaunchDraft): void {
  try {
    const hasDraft = Object.values(draft).some((value) => value.trim())
    if (hasDraft) {
      globalThis.localStorage?.setItem(
        CONDUCTOR_LAUNCH_DRAFT_STORAGE_KEY,
        JSON.stringify(serializeMissionLaunchDraft(draft)),
      )
      persistConductorGoalDraft(draft.goal)
    } else {
      globalThis.localStorage?.removeItem(CONDUCTOR_LAUNCH_DRAFT_STORAGE_KEY)
      persistConductorGoalDraft('')
    }
  } catch {
    // Ignore storage failures; the in-memory state still works.
  }
}

export function getAgentPersona(index: number) {
  return {
    name: AGENT_NAMES[index % AGENT_NAMES.length],
    emoji: AGENT_EMOJIS[index % AGENT_EMOJIS.length],
  }
}

export function estimateTokenCost(totalTokens: number): number {
  return (
    (Math.max(0, totalTokens) / 1_000_000) * BLENDED_COST_PER_MILLION_TOKENS
  )
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(value >= 0.1 ? 2 : 3)}`
}

export function MissionCostSection({
  totalTokens,
  workers,
  expanded,
  onToggle,
}: {
  totalTokens: number
  workers: Array<MissionCostWorker>
  expanded: boolean
  onToggle: () => void
}) {
  const estimatedCost = estimateTokenCost(totalTokens)

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
            Mission Cost
          </p>
          <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
            Approximate at $5 / 1M tokens blended from input/output pricing.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2 text-xs font-medium text-[var(--theme-text)]">
          {expanded ? 'Hide' : 'Show'}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={1.7}
            className={cn(
              'transition-transform duration-200',
              expanded ? 'rotate-180' : 'rotate-0',
            )}
          />
        </span>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                Total Tokens
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--theme-text)]">
                {totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                Estimated Cost
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--theme-text)]">
                {formatUsd(estimatedCost)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
              <span>Workers</span>
              <span>Cost</span>
            </div>
            {workers.length > 0 ? (
              <div className="divide-y divide-[var(--theme-border)]">
                {workers.map((worker) => (
                  <div
                    key={worker.id}
                    className="flex items-center gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-[var(--theme-text)]">
                      {worker.personaEmoji} {worker.personaName}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--theme-muted)]">
                      {worker.label}
                    </span>
                    <span className="text-xs text-[var(--theme-muted)]">
                      {worker.totalTokens.toLocaleString()} tok
                    </span>
                    <span className="min-w-[4.5rem] text-right font-medium text-[var(--theme-text)]">
                      {formatUsd(estimateTokenCost(worker.totalTokens))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-[var(--theme-muted)]">
                Per-worker token details were not captured for this mission.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const PLANNING_STEPS = [
  'Planning the mission…',
  'Analyzing requirements…',
  'Preparing agents…',
  'Writing the spec…',
]
const WORKING_STEPS = [
  '📋 Reviewing the brief…',
  '🔍 Scanning existing patterns…',
  '✏️ Drafting the implementation…',
  '☕ Grabbing a coffee…',
  '🧠 Thinking through edge cases…',
  '🎨 Polishing the design…',
  '🔧 Wiring up components…',
  '📐 Checking the layout…',
  '🚀 Almost there…',
]

export function CyclingStatus({
  steps,
  intervalMs = 3000,
  isPaused = false,
}: {
  steps: Array<string>
  intervalMs?: number
  isPaused?: boolean
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isPaused) return
    const timer = window.setInterval(
      () => setStep((current) => (current + 1) % steps.length),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [isPaused, steps.length, intervalMs])

  if (isPaused) {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="flex size-3.5 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/10 text-[9px] text-amber-300">
          ||
        </div>
        <p className="text-sm text-[var(--theme-muted)]">Paused</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="size-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      <p className="text-sm text-[var(--theme-muted)] transition-opacity duration-500">
        {steps[step]}
      </p>
    </div>
  )
}

export function PlanningIndicator() {
  return <CyclingStatus steps={PLANNING_STEPS} intervalMs={2500} />
}

export function getOutputDisplayName(
  projectPath: string | null | undefined,
): string {
  if (!projectPath) return 'Output ready'
  return projectPath.split('/').pop() || 'index.html'
}

export function formatMissionTimestamp(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function buildProjectPathCandidates(
  workers: Array<{ label: string }>,
  missionStartedAt: string | null | undefined,
): Array<string> {
  const timestamp = formatMissionTimestamp(missionStartedAt)
  const candidates = new Set<string>()

  for (const worker of workers) {
    const label = worker.label ?? ''
    const slug = label.replace(/^worker-/, '').trim()
    if (!slug) continue

    candidates.add(`/tmp/dispatch-${slug}`)
    candidates.add(`/tmp/dispatch-${slug}-page`)

    if (timestamp) {
      candidates.add(`/tmp/dispatch-${slug}-${timestamp}`)
      candidates.add(`/tmp/dispatch-${slug}-${timestamp}-page`)
    }
  }

  return [...candidates]
}

export function formatElapsedTime(
  startIso: string | null | undefined,
  now: number,
): string {
  if (!startIso) return '0s'
  const startMs = new Date(startIso).getTime()
  if (!Number.isFinite(startMs)) return '0s'
  return formatElapsedMilliseconds(now - startMs)
}

export function formatElapsedMilliseconds(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatDurationRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  now: number,
): string {
  const endMs = endIso ? new Date(endIso).getTime() : now
  if (!Number.isFinite(endMs)) return formatElapsedTime(startIso, now)
  return formatElapsedTime(startIso, endMs)
}

export function formatRelativeTime(
  value: string | null | undefined,
  now: number,
): string {
  if (!value) return 'just now'
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return 'just now'
  const diffSeconds = Math.max(0, Math.floor((now - ms) / 1000))
  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}h ago`
}

export function truncateContinuationText(text: string, limit = 500): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function getWorkerDot(status: 'running' | 'complete' | 'stale' | 'idle') {
  if (status === 'complete')
    return { dotClass: 'bg-emerald-400', label: 'Complete' }
  if (status === 'running')
    return { dotClass: 'bg-sky-400 animate-pulse', label: 'Running' }
  if (status === 'idle') return { dotClass: 'bg-amber-400', label: 'Idle' }
  return { dotClass: 'bg-red-400', label: 'Stale' }
}

function getWorkerBorderClass(
  status: 'running' | 'complete' | 'stale' | 'idle',
) {
  if (status === 'complete') return 'border-l-emerald-400'
  if (status === 'running') return 'border-l-sky-400'
  if (status === 'idle') return 'border-l-amber-400'
  return 'border-l-red-400'
}

export function WorkerCard({
  worker,
  index,
  conductor,
  now,
}: {
  worker: ReturnType<typeof useConductorGateway>['workers'][number]
  index: number
  conductor: Pick<
    ReturnType<typeof useConductorGateway>,
    'workerOutputs' | 'isPaused' | 'pausedAtMs' | 'missionStartedAt'
  >
  now: number
}) {
  const dot = getWorkerDot(worker.status)
  const persona = getAgentPersona(index)
  const workerOutput =
    conductor.workerOutputs[worker.key] ??
    getLastAssistantMessage(
      worker.raw.messages as Array<HistoryMessage> | undefined,
    )
  const workerStartedAt =
    typeof worker.raw.createdAt === 'string'
      ? worker.raw.createdAt
      : typeof worker.raw.startedAt === 'string'
        ? worker.raw.startedAt
        : conductor.missionStartedAt
  const workerEndTime =
    worker.status === 'complete' || worker.status === 'stale'
      ? new Date(worker.updatedAt ?? new Date().toISOString()).getTime()
      : conductor.isPaused
        ? (conductor.pausedAtMs ?? now)
        : now

  return (
    <div
      key={worker.key}
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--theme-border)] border-l-4 bg-[var(--theme-card)] px-4 py-3',
        getWorkerBorderClass(worker.status),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('size-2.5 rounded-full', dot.dotClass)} />
            <p className="truncate text-sm font-medium text-[var(--theme-text)]">
              {persona.emoji} {persona.name}{' '}
              <span className="text-[var(--theme-muted)]">·</span>{' '}
              {worker.label}
            </p>
          </div>
          <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
            {worker.displayName}
          </p>
        </div>
        <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
          {dot.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
          <p className="text-[var(--theme-muted)]">Model</p>
          <p className="mt-1 truncate text-[var(--theme-text)]">
            {getShortModelName(worker.model)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
          <p className="text-[var(--theme-muted)]">Tokens</p>
          <p className="mt-1 text-[var(--theme-text)]">
            {worker.tokenUsageLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
          <p className="text-[var(--theme-muted)]">Elapsed</p>
          <p className="mt-1 text-[var(--theme-text)]">
            {formatElapsedTime(workerStartedAt, workerEndTime)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
          <p className="text-[var(--theme-muted)]">Last update</p>
          <p className="mt-1 text-[var(--theme-text)]">
            {formatRelativeTime(worker.updatedAt, now)}
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-4">
        {workerOutput ? (
          <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">
            {workerOutput}
          </Markdown>
        ) : (
          <CyclingStatus
            steps={WORKING_STEPS}
            intervalMs={3500}
            isPaused={conductor.isPaused}
          />
        )}
      </div>
    </div>
  )
}

export function usePreviewAvailability(
  previewUrl: string | null,
  enabled: boolean,
) {
  const [failedProbes, setFailedProbes] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const lastProbeRef = useRef(0)

  useEffect(() => {
    setFailedProbes(0)
    setTimedOut(false)
    lastProbeRef.current = 0
  }, [enabled, previewUrl])

  useEffect(() => {
    if (!enabled || !previewUrl) return
    const timer = window.setTimeout(() => setTimedOut(true), 6_000)
    return () => window.clearTimeout(timer)
  }, [enabled, previewUrl])

  const exhausted = enabled && !!previewUrl && (failedProbes >= 4 || timedOut)

  const probeQuery = useQuery({
    queryKey: ['conductor', 'preview-probe', previewUrl],
    queryFn: async () => {
      if (!previewUrl) return false
      try {
        const res = await fetch(previewUrl)
        if (!res.ok) return false
        const text = await res.text()
        return text.length > 20 && (text.includes('<') || text.includes('html'))
      } catch {
        return false
      }
    },
    enabled: enabled && !!previewUrl && !exhausted,
    retry: false,
    refetchInterval: (query) =>
      query.state.data === true || exhausted ? false : 1_500,
    staleTime: 5_000,
  })

  useEffect(() => {
    if (
      !enabled ||
      !previewUrl ||
      probeQuery.data === true ||
      probeQuery.dataUpdatedAt === 0
    )
      return
    if (lastProbeRef.current === probeQuery.dataUpdatedAt) return
    lastProbeRef.current = probeQuery.dataUpdatedAt
    setFailedProbes((current) => current + 1)
  }, [enabled, previewUrl, probeQuery.data, probeQuery.dataUpdatedAt])

  return {
    ready: probeQuery.data === true,
    loading: enabled && !!previewUrl && !exhausted && probeQuery.data !== true,
    unavailable:
      enabled && !!previewUrl && exhausted && probeQuery.data !== true,
  }
}

export function getShortModelName(model: string | null | undefined): string {
  if (!model) return 'Unknown'
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

export function getModelDisplayName(
  model: AvailableModel | undefined,
  modelId: string | null | undefined,
): string {
  if (!modelId) return 'Default (auto)'
  return model?.name?.trim() || model?.id?.trim() || modelId
}

export function getProviderLabel(provider: string | null | undefined): string {
  const raw = provider?.trim()
  if (!raw) return 'Unknown'
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export function groupModelsByProvider(models: Array<AvailableModel>) {
  const groups = new Map<string, Array<AvailableModel>>()

  for (const model of models) {
    const provider = getProviderLabel(model.provider)
    const existing = groups.get(provider)
    if (existing) {
      existing.push(model)
    } else {
      groups.set(provider, [model])
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([provider, providerModels]) => ({
      provider,
      models: [...providerModels].sort((a, b) =>
        getModelDisplayName(a, a.id).localeCompare(
          getModelDisplayName(b, b.id),
        ),
      ),
    }))
}

export function getDirectoryPathSegments(pathValue: string): Array<string> {
  const normalized = pathValue.trim()
  if (!normalized) return ['~']
  if (normalized === '~') return ['~']
  if (normalized.startsWith('~/')) {
    return ['~', ...normalized.slice(2).split('/').filter(Boolean)]
  }
  if (normalized === '/') return ['/']
  if (normalized.startsWith('/')) {
    return ['/', ...normalized.slice(1).split('/').filter(Boolean)]
  }
  return normalized.split('/').filter(Boolean)
}

export function buildDirectoryPathFromSegments(
  segments: Array<string>,
): string {
  if (segments.length === 0) return '~'
  if (segments[0] === '~') {
    return segments.length === 1 ? '~' : `~/${segments.slice(1).join('/')}`
  }
  if (segments[0] === '/') {
    return segments.length === 1 ? '/' : `/${segments.slice(1).join('/')}`
  }
  return segments.join('/')
}

export function getParentDirectory(pathValue: string): string {
  const segments = getDirectoryPathSegments(pathValue)
  if (segments.length <= 1) return pathValue.startsWith('/') ? '/' : '~'
  return buildDirectoryPathFromSegments(segments.slice(0, -1))
}

export function getDirectorySuggestions() {
  return ['~/conductor-projects', '~/Projects', '/tmp', '~/Desktop']
}

export function ModelSelectorDropdown({
  label,
  value,
  onChange,
  models,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (nextValue: string) => void
  models: Array<AvailableModel>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const selectedModel = models.find((model) => (model.id ?? '') === value)
  const groupedModels = useMemo(() => groupModelsByProvider(models), [models])

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-[var(--theme-text)]">
        {label}
      </span>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            if (disabled) return
            setOpen((current) => !current)
          }}
          className={cn(
            'inline-flex min-h-[3rem] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-left text-sm text-[var(--theme-text)] shadow-[0_8px_24px_color-mix(in_srgb,var(--theme-shadow)_18%,transparent)] transition-colors',
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'hover:border-[var(--theme-accent)] focus:border-[var(--theme-accent)]',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1 text-xs font-medium text-[var(--theme-text)]">
              <span
                className={cn(
                  'size-2 rounded-full',
                  value
                    ? 'bg-[var(--theme-accent)]'
                    : 'bg-[var(--theme-border2)]',
                )}
              />
              <span className="truncate">
                {getModelDisplayName(selectedModel, value)}
              </span>
            </span>
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={1.8}
            className={cn(
              'shrink-0 text-[var(--theme-muted)] transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {open ? (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[80] w-full overflow-hidden rounded-2xl border border-[var(--theme-border2)] bg-[var(--theme-card)] shadow-[0_24px_80px_var(--theme-shadow)]">
            <div className="max-h-80 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  !value
                    ? 'bg-[var(--theme-accent-soft)] text-[var(--theme-text)]'
                    : 'text-[var(--theme-text)] hover:bg-[var(--theme-bg)]',
                )}
                role="option"
                aria-selected={!value}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    !value
                      ? 'bg-[var(--theme-accent)]'
                      : 'bg-[var(--theme-border2)]',
                  )}
                />
                <span className="min-w-0 flex-1 truncate">Default (auto)</span>
                <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                  Auto
                </span>
              </button>

              {groupedModels.map((group) => (
                <div key={group.provider} className="mt-2 first:mt-3">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                    {group.provider}
                  </div>
                  <div className="space-y-1">
                    {group.models.map((model) => {
                      const modelId = model.id ?? ''
                      const active = modelId === value
                      return (
                        <button
                          key={`${group.provider}-${modelId}`}
                          type="button"
                          onClick={() => {
                            onChange(modelId)
                            setOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                            active
                              ? 'bg-[var(--theme-accent-soft)] text-[var(--theme-text)]'
                              : 'text-[var(--theme-text)] hover:bg-[var(--theme-bg)]',
                          )}
                          role="option"
                          aria-selected={active}
                        >
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              active
                                ? 'bg-[var(--theme-accent)]'
                                : 'bg-[var(--theme-border2)]',
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {getModelDisplayName(model, modelId)}
                          </span>
                          <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                            {group.provider}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function extractMessageText(
  message: HistoryMessage | undefined,
): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function getLastAssistantMessage(
  messages: Array<HistoryMessage> | undefined,
): string {
  if (!Array.isArray(messages)) return ''
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'assistant') continue
    const text = extractMessageText(message)
    if (text.trim()) return text.trim()
  }
  return ''
}

export function extractProjectPath(text: string): string | null {
  const structuredPatterns = [
    /\b(?:Created|Output|Wrote|Saved to|Built|Generated|Written to)\s+(\/tmp\/dispatch-[^\s"')`\]>]+)/gi,
    /\b(?:Created|Output|Wrote|Saved to|Built|Generated|Written to)\s*:\s*(\/tmp\/dispatch-[^\s"')`\]>]+)/gi,
  ]

  for (const pattern of structuredPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1]
      if (!raw) continue
      const cleaned = raw.replace(/[.,;:!?`]+$/, '')
      const normalized = cleaned.replace(/\/(index\.html|dist|build)\/?$/i, '')
      if (normalized.startsWith('/tmp/dispatch-')) return normalized
    }
  }

  const matches = text.match(/\/tmp\/dispatch-[^\s"')`\]>]+/g) ?? []
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?\-`]+$/, '')
    const normalized = cleaned.replace(/\/(index\.html|dist|build)\/?$/i, '')
    if (normalized.startsWith('/tmp/dispatch-')) return normalized
  }

  const tmpMatches = text.match(/\/tmp\/[a-zA-Z0-9][^\s"')`\]>]+/g) ?? []
  for (const raw of tmpMatches) {
    const cleaned = raw.replace(/[.,;:!?\-`]+$/, '')
    const normalized = cleaned.replace(/\/(index\.html|dist|build)\/?$/i, '')
    if (normalized.length > 5) return normalized
  }

  return null
}

export function deriveSessionStatus(
  session: GatewaySession,
): 'running' | 'completed' | 'failed' {
  const updatedMs = new Date(session.updatedAt as string).getTime()
  const staleness = Number.isFinite(updatedMs) ? Date.now() - updatedMs : 0
  const tokens =
    typeof session.totalTokens === 'number' ? session.totalTokens : 0
  const statusText =
    `${session.status ?? ''} ${session.state ?? ''}`.toLowerCase()

  if (statusText.includes('error') || statusText.includes('failed'))
    return 'failed'
  if (tokens > 0 && staleness > 30_000) return 'completed'
  if (staleness > 120_000 && tokens === 0) return 'failed'
  return 'running'
}
