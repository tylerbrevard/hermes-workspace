import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import type { Settings02Icon } from '@hugeicons/core-free-icons'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// `IconSvgObject` isn't exported from @hugeicons/react; reuse the
// inferred type from a real icon import for prop typing.
export type HugeIcon = typeof Settings02Icon

export function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function themeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

export function alpha(color: string, amount: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(amount * 100)))
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

export function readDashboardPalette() {
  return {
    accent: themeColor('--theme-accent', '#6366f1'),
    accentSecondary: themeColor('--theme-accent-secondary', '#8b5cf6'),
    success: themeColor('--theme-success', '#22c55e'),
    warning: themeColor('--theme-warning', '#f59e0b'),
    danger: themeColor('--theme-danger', '#ef4444'),
    muted: themeColor('--theme-muted', '#6b7280'),
    border: themeColor('--theme-border', '#333333'),
    card: themeColor('--theme-card', '#1a1a2e'),
    text: themeColor('--theme-text', '#e5e7eb'),
  }
}

export function useDashboardPalette() {
  const [palette, setPalette] = useState(readDashboardPalette)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const refresh = () => setPalette(readDashboardPalette())
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class'],
    })
    return () => observer.disconnect()
  }, [])

  return palette
}

export function GlassCard({
  title,
  titleRight,
  accentColor,
  noPadding,
  className,
  children,
}: {
  title?: string
  titleRight?: ReactNode
  accentColor?: string
  noPadding?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border transition-colors',
        className,
      )}
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
      }}
    >
      {accentColor && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)`,
          }}
        />
      )}
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            {title}
          </h3>
          {titleRight}
        </div>
      )}
      <div className={cn('flex-1', noPadding ? '' : 'px-5 pb-4 pt-3')}>
        {children}
      </div>
      <div className="border-t border-[var(--theme-border)] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Source workspace · freshness live · owner Hermes · last success recent
      </div>
    </div>
  )
}

export function EnhancedBadge({ label = 'Enhanced API' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        border: `1px solid ${themeColor('--theme-accent-border', 'rgba(245, 158, 11, 0.28)')}`,
        background: themeColor(
          '--theme-accent-subtle',
          'rgba(245, 158, 11, 0.12)',
        ),
        color: themeColor('--theme-accent', '#f59e0b'),
      }}
    >
      {label}
    </span>
  )
}

export function UnavailableWidget({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <GlassCard
      title={title}
      titleRight={<EnhancedBadge />}
      accentColor={themeColor('--theme-warning', '#f59e0b')}
      className="h-full"
    >
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-card2)] px-4 text-center">
        <p className="text-sm text-muted">{description}</p>
      </div>
    </GlassCard>
  )
}

export function SecondaryAction({
  label,
  icon,
  onClick,
  disabled,
  title,
}: {
  label: string
  icon: HugeIcon
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={title ?? label}
      className="group inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em] transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.015] hover:bg-[var(--theme-card)]/70 hover:text-[var(--theme-text)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-muted)',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--theme-card) 80%, transparent), transparent)',
      }}
    >
      <HugeiconsIcon
        icon={icon}
        size={14}
        strokeWidth={1.6}
        className="transition-colors group-hover:text-[var(--theme-accent)]"
      />
      <span>{label}</span>
    </button>
  )
}
