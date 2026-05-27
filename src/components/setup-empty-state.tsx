import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SetupEmptyStateProps = {
  title: string
  description: string
  nextAction: string
  detail?: string
  action?: ReactNode
  className?: string
}

export function SetupEmptyState({
  title,
  description,
  nextAction,
  detail,
  action,
  className,
}: SetupEmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-primary-300 bg-primary-100/70 px-3 py-4 text-sm text-primary-600 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-400',
        className,
      )}
    >
      <div className="font-medium text-primary-800 dark:text-neutral-100">
        {title}
      </div>
      <div className="mt-1">{description}</div>
      <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
        <span className="font-semibold">Next setup action: </span>
        {nextAction}
        {detail ? (
          <div className="mt-1 font-mono text-[11px] text-primary-500 dark:text-neutral-500">
            {detail}
          </div>
        ) : null}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
