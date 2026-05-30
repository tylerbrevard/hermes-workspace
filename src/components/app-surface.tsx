import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import type { HugeIcon } from '@/screens/dashboard/dashboard-ui'
import { cn } from '@/lib/utils'

type AppTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple'

const TONE_CLASS: Record<AppTone, string> = {
  neutral:
    'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)]',
  blue: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-500',
  green: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-500',
  amber: 'border-amber-300/30 bg-amber-300/10 text-amber-500',
  red: 'border-red-300/30 bg-red-300/10 text-red-500',
  purple: 'border-violet-300/25 bg-violet-300/10 text-violet-500',
}

export function AppSurface({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-[var(--theme-border)] bg-[var(--theme-card)]/86 p-3 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function AppSectionHeader({
  title,
  action,
  meta,
}: {
  title: string
  action?: ReactNode
  meta?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-bold text-[var(--theme-text)] md:text-base">
          {title}
        </h2>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-[var(--theme-muted)]">
            {meta}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function AppStatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: AppTone
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  )
}

export function AppTile({
  title,
  value,
  detail,
  icon,
  tone = 'neutral',
  onClick,
  actionLabel,
  className,
}: {
  title: string
  value?: string
  detail?: string
  icon: HugeIcon
  tone?: AppTone
  onClick?: () => void
  actionLabel?: string
  className?: string
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[132px] w-full flex-col justify-between overflow-hidden rounded-[22px] border p-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] duration-200',
        'border-[var(--theme-border)] bg-[var(--theme-card2)] shadow-[0_12px_30px_-26px_rgba(0,0,0,0.5)]',
        onClick
          ? 'touch-manipulation hover:-translate-y-0.5 hover:border-[var(--theme-accent-border)] active:scale-[0.985]'
          : '',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-[16px] border',
            TONE_CLASS[tone],
          )}
        >
          <HugeiconsIcon icon={icon} size={20} strokeWidth={1.8} />
        </span>
        {value ? (
          <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--theme-text)]">
            {value}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold text-[var(--theme-text)]">
          {title}
        </div>
        {detail ? (
          <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--theme-muted)]">
            {detail}
          </p>
        ) : null}
        {actionLabel ? (
          <div className="mt-2 text-[11px] font-semibold text-[var(--theme-accent)]">
            {actionLabel}
          </div>
        ) : null}
      </div>
    </Wrapper>
  )
}

export function AppSkeletonTile() {
  return (
    <div className="min-h-[132px] rounded-[22px] border border-[var(--theme-border)] bg-[var(--theme-card2)] p-3">
      <div className="animate-shimmer size-10 rounded-[16px]" />
      <div className="mt-8 h-4 w-24 rounded-full animate-shimmer" />
      <div className="mt-3 h-3 w-32 rounded-full animate-shimmer" />
    </div>
  )
}
