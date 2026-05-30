import { Link } from '@tanstack/react-router'
import {
  Add01Icon,
  PinIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cx, dotClass } from './lib/phone-cockpit-helpers'
import type { ComponentProps, ReactNode } from 'react'
import type { PhoneAttentionItem } from '@/server/phone-cockpit'
import type { PhoneCardId } from './lib/phone-cockpit-helpers'

type HugeIcon = ComponentProps<typeof HugeiconsIcon>['icon']

export function StatusDot({ tone }: { tone: 'ok' | 'warn' | 'bad' | 'muted' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block size-2.5 shrink-0 rounded-full',
        dotClass(tone),
      )}
    />
  )
}

export function IconTile({
  to,
  label,
  detail,
  icon,
  tone = 'muted',
}: {
  to: string
  label: string
  detail?: string
  icon: HugeIcon
  tone?: 'ok' | 'warn' | 'bad' | 'muted'
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[72px] min-w-0 items-center gap-2.5 rounded-[18px] border border-white/10 bg-white/[0.055] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.98]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-black/25 text-[#8ee7d5]">
        <HugeiconsIcon icon={icon} size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <StatusDot tone={tone} />
          <span className="truncate text-sm font-semibold text-white">
            {label}
          </span>
        </span>
        {detail ? (
          <span className="mt-0.5 block truncate text-xs text-[#9fb0b4]">
            {detail}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

export function Card({
  cardId,
  title,
  kicker,
  freshness,
  icon,
  children,
  className,
  collapsed,
  pinned,
  onToggleCollapsed,
  onTogglePinned,
}: {
  cardId?: PhoneCardId
  title: string
  kicker?: string
  freshness?: string
  icon?: HugeIcon
  children: ReactNode
  className?: string
  collapsed?: boolean
  pinned?: boolean
  onToggleCollapsed?: (cardId: PhoneCardId) => void
  onTogglePinned?: (cardId: PhoneCardId) => void
}) {
  return (
    <section
      className={cx(
        'rounded-[24px] border border-white/10 bg-[#111820]/90 p-3.5 shadow-[0_18px_44px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-[#eef3f4]">
          {icon ? (
            <HugeiconsIcon
              icon={icon}
              size={16}
              className="shrink-0 text-[#8ee7d5]"
              aria-hidden="true"
            />
          ) : null}
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {kicker ? (
          <span className="hidden shrink-0 rounded border border-[#6ec6b8]/30 bg-[#6ec6b8]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#b8fff3] sm:inline-flex">
            {kicker}
          </span>
        ) : null}
        {cardId && onToggleCollapsed ? (
          <div className="flex shrink-0 gap-1">
            {onTogglePinned ? (
              <button
                type="button"
                onClick={() => onTogglePinned(cardId)}
                aria-pressed={pinned}
                aria-label={`${pinned ? 'Unpin' : 'Pin'} ${title}`}
                className="grid size-8 place-items-center rounded-[7px] border border-white/10 text-[#b7c6c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
              >
                <HugeiconsIcon
                  icon={pinned ? PinIcon : Add01Icon}
                  size={14}
                  aria-hidden="true"
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onToggleCollapsed(cardId)}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
              className="grid size-8 place-items-center rounded-[7px] border border-white/10 text-[#b7c6c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
            >
              <HugeiconsIcon
                icon={collapsed ? ViewIcon : ViewOffIcon}
                size={14}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : null}
      </div>
      {freshness ? (
        <div className="mb-2 text-[11px] leading-4 text-[#8ea0a4]">
          {freshness}
        </div>
      ) : null}
      {collapsed ? null : children}
    </section>
  )
}

export function ActionLink({
  to,
  label,
  children,
  className,
}: {
  to: string
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cx(
        'inline-flex min-h-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055] px-3 text-sm font-semibold text-[#dbe7e8] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.98]',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function ExternalAction({ item }: { item: PhoneAttentionItem }) {
  if (!item.href) return null
  const label = item.actionLabel || 'Open'
  if (item.href.startsWith('/')) {
    return (
      <ActionLink
        to={item.href}
        label={`${label}: ${item.title}`}
        className="shrink-0 px-3"
      >
        {label}
      </ActionLink>
    )
  }
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055] px-3 text-sm font-semibold text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.98]"
    >
      {label}
    </a>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-[#b7c6c9]">
      {children}
    </p>
  )
}

export function StatPill({
  icon,
  label,
  value,
}: {
  icon: HugeIcon
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[16px] bg-white/[0.055] px-2.5 py-2">
      <HugeiconsIcon
        icon={icon}
        size={15}
        className="shrink-0 text-[#8ee7d5]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="truncate text-[11px] leading-4 text-[#b7c6c9]">{label}</p>
        <p className="text-lg font-semibold leading-5 tabular-nums text-white">
          {value}
        </p>
      </div>
    </div>
  )
}
