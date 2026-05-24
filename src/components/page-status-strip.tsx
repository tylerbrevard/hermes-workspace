import type React from 'react'
import { cn } from '@/lib/utils'

type PageStatusTone = 'ok' | 'warn' | 'error' | 'info'

export type PageStatusItem = {
  label: string
  value: React.ReactNode
  tone?: PageStatusTone
}

const toneClass: Record<PageStatusTone, string> = {
  ok: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
  warn: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  error: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
  info: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
}

export function PageStatusStrip({
  items,
  className,
}: {
  items: Array<PageStatusItem>
  className?: string
}) {
  if (!items.length) return null
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
            toneClass[item.tone ?? 'info'],
          )}
        >
          <span className="opacity-70">{item.label}</span>
          <span>{item.value}</span>
        </span>
      ))}
    </div>
  )
}

export function formatStatusTime(
  timestamp: number | string | null | undefined,
) {
  if (!timestamp) return 'never'
  const date =
    typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
