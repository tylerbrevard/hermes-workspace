import type React from 'react'
import type { WorkspaceStatusTone } from '@/lib/source-freshness'
import {
  formatWorkspaceFreshness,
  workspaceStatusClass,
} from '@/lib/source-freshness'
import { cn } from '@/lib/utils'

type PageStatusTone = WorkspaceStatusTone

export type PageStatusItem = {
  label: string
  value: React.ReactNode
  tone?: PageStatusTone
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
            workspaceStatusClass(item.tone ?? 'info', 'dark'),
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
  return formatWorkspaceFreshness(timestamp)
}
