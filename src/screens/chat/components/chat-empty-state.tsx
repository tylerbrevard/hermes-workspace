import { HugeiconsIcon } from '@hugeicons/react'
import {
  BrainIcon,
  CodeIcon,
  DashboardSquare01Icon,
  Database01Icon,
  Message01Icon,
  PuzzleIcon,
  Route01Icon,
} from '@hugeicons/core-free-icons'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

type ProfileSummary = {
  name: string
  model?: string
  active?: boolean
}

type SuggestionChip = {
  label: string
  prompt: string
  icon: unknown
}

type ChatLaunchTile = {
  label: string
  value: string
  detail: string
  icon: unknown
  tone: 'ok' | 'warn' | 'neutral'
}

const SUGGESTIONS: Array<SuggestionChip> = [
  {
    label: 'Analyze workspace',
    prompt:
      'Analyze this workspace structure and give me 3 engineering risks. Use tools and keep it concise.',
    icon: CodeIcon,
  },
  {
    label: 'Save a preference',
    prompt:
      'Save this to memory exactly: "For status updates, respond in 3 bullets max and put risk first." Then confirm saved.',
    icon: BrainIcon,
  },
  {
    label: 'Create a file',
    prompt: 'Create launch-checklist.md with 5 launch checks for this app.',
    icon: PuzzleIcon,
  },
]

export function buildChatLaunchTiles(input: {
  profileName?: string | null
  profileModel?: string | null
  gatewayLabel: string
  gatewayTone: 'ok' | 'warn'
}): Array<ChatLaunchTile> {
  return [
    {
      label: 'Profile',
      value: input.profileName || 'Default',
      detail: input.profileModel || 'Model follows active routing',
      icon: Database01Icon,
      tone: input.profileName ? 'ok' : 'neutral',
    },
    {
      label: 'Gateway',
      value: input.gatewayTone === 'ok' ? 'Ready' : 'Check',
      detail: input.gatewayLabel,
      icon: Route01Icon,
      tone: input.gatewayTone,
    },
    {
      label: 'Tools',
      value: 'Available',
      detail: 'Files, terminal, memory, and workspace actions',
      icon: PuzzleIcon,
      tone: 'ok',
    },
  ]
}

type ChatEmptyStateProps = {
  onSuggestionClick?: (prompt: string) => void
  compact?: boolean
}

export function ChatEmptyState({
  onSuggestionClick,
  compact = false,
}: ChatEmptyStateProps) {
  const [activeProfile, setActiveProfile] = useState<ProfileSummary | null>(
    null,
  )
  const [gatewayHint, setGatewayHint] = useState<{
    label: string
    detail: string
    tone: 'ok' | 'warn'
  }>({
    label: 'Checking gateway',
    detail: 'Checking sessions and model',
    tone: 'warn',
  })

  useEffect(() => {
    fetch('/api/profiles/list')
      .then((res) => res.json())
      .then((data) => {
        const profiles = data?.profiles as Array<ProfileSummary> | undefined
        const active = profiles?.find((p) => p.active)
        if (active) setActiveProfile(active)
      })
      .catch(() => {
        // silently ignore — profile info is cosmetic
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/session-status')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const ok = data?.ok !== false
        setGatewayHint({
          label: ok ? 'Gateway ready' : 'Gateway needs attention',
          detail: ok
            ? 'Sessions, tools, streaming ready'
            : 'Retry if sends stall',
          tone: ok ? 'ok' : 'warn',
        })
      })
      .catch(() => {
        if (cancelled) return
        setGatewayHint({
          label: 'Gateway status unavailable',
          detail: 'Retry if first send fails',
          tone: 'warn',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const launchTiles = buildChatLaunchTiles({
    profileName: activeProfile?.name,
    profileModel: activeProfile?.model,
    gatewayLabel: gatewayHint.label,
    gatewayTone: gatewayHint.tone,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-full flex-col items-center justify-center px-4 py-8"
    >
      <div
        className="grid w-full max-w-4xl gap-3 rounded-lg border p-3 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]"
        style={{
          background: 'var(--theme-card)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div
          className="rounded-md border p-4"
          style={{
            background: 'var(--theme-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <img
              src="/claude-avatar.webp"
              alt="Hermes Agent"
              className="size-14 rounded-md"
              style={{
                border: '1px solid var(--theme-border)',
                padding: '4px',
                background: 'var(--theme-card)',
              }}
            />
            <HugeiconsIcon
              icon={DashboardSquare01Icon}
              size={20}
              strokeWidth={1.5}
              style={{ color: 'var(--theme-accent)' }}
            />
          </div>
          <p
            className="micro-label mt-4"
            style={{ color: 'var(--theme-muted)' }}
          >
            Chat launchpad
          </p>
          <h2
            className="mt-1 text-2xl font-semibold"
            style={{ color: 'var(--theme-text)' }}
          >
            Begin a session
          </h2>
          <p className="mt-3 text-sm" style={{ color: 'var(--theme-muted)' }}>
            Start with context, tools, and workspace actions already attached.
          </p>
        </div>

        <div className="grid gap-3">
          {!compact ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {launchTiles.map((tile) => (
                <div
                  key={tile.label}
                  className="min-h-28 rounded-md border p-3"
                  style={{
                    background: 'var(--theme-bg)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <HugeiconsIcon
                      icon={tile.icon as any}
                      size={17}
                      strokeWidth={1.5}
                      style={{ color: 'var(--theme-accent)' }}
                    />
                    <span
                      className="size-2 rounded-full"
                      style={{
                        background:
                          tile.tone === 'ok'
                            ? '#10b981'
                            : tile.tone === 'warn'
                              ? '#f59e0b'
                              : 'var(--theme-muted)',
                      }}
                    />
                  </div>
                  <p
                    className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    {tile.label}
                  </p>
                  <p
                    className="mt-1 truncate text-sm font-semibold"
                    style={{ color: 'var(--theme-text)' }}
                    title={tile.value}
                  >
                    {tile.value}
                  </p>
                  <p
                    className="mt-1 line-clamp-2 text-xs leading-5"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    {tile.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion.prompt)}
                className="flex min-h-24 cursor-pointer flex-col items-start gap-3 rounded-md border p-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:-translate-y-0.5"
                style={{
                  background: 'var(--theme-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--theme-card2)'
                  e.currentTarget.style.borderColor =
                    'var(--theme-accent-border)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--theme-bg)'
                  e.currentTarget.style.borderColor = 'var(--theme-border)'
                }}
              >
                <span
                  className="inline-flex size-8 items-center justify-center rounded-md"
                  style={{
                    background: 'var(--theme-card)',
                    border: '1px solid var(--theme-border)',
                  }}
                >
                  <HugeiconsIcon
                    icon={suggestion.icon as any}
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: 'var(--theme-accent)' }}
                  />
                </span>
                <span className="text-sm font-semibold">
                  {suggestion.label}
                </span>
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
            style={{
              background: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-muted)',
            }}
          >
            <HugeiconsIcon
              icon={Message01Icon}
              size={15}
              strokeWidth={1.5}
              style={{ color: 'var(--theme-accent)' }}
            />
            <span>
              {gatewayHint.detail}
              {activeProfile?.model ? ` · ${activeProfile.model}` : ''}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
