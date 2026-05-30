import { useMemo } from 'react'

import { computeDiff } from './file-ui'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type DiffModalProps = {
  open: boolean
  fileName: string
  original: string
  updated: string
  onSave: () => void
  onCancel: () => void
}

export function DiffModal({
  open,
  fileName,
  original,
  updated,
  onSave,
  onCancel,
}: DiffModalProps) {
  const diffLines = useMemo(
    () => (open ? computeDiff(original, updated) : []),
    [open, original, updated],
  )

  const addedCount = diffLines.filter((line) => line.kind === 'added').length
  const removedCount = diffLines.filter(
    (line) => line.kind === 'removed',
  ).length
  const leftLines = diffLines.filter((line) => line.kind !== 'added')
  const rightLines = diffLines.filter((line) => line.kind !== 'removed')

  if (!open) return null

  return (
    <DialogRoot
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <DialogContent className="max-w-5xl w-full">
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary-200 px-5 py-3 dark:border-neutral-800">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
                Review changes — {fileName}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-primary-500 dark:text-neutral-400">
                <span className="font-medium text-emerald-600">
                  +{addedCount} added
                </span>
                {' · '}
                <span className="font-medium text-red-600">
                  −{removedCount} removed
                </span>
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave}>
                Save anyway
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 divide-x divide-primary-200 overflow-hidden dark:divide-neutral-800">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-primary-200 bg-primary-100/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                Original
              </div>
              <div className="flex-1 overflow-auto">
                <div className="font-mono text-[11px] leading-relaxed">
                  {leftLines.map((line, index) => (
                    <div
                      key={`${line.leftNum ?? 'left'}-${index}`}
                      className={cn(
                        'flex items-start gap-0',
                        line.kind === 'removed'
                          ? 'bg-red-50 dark:bg-red-950/25'
                          : '',
                      )}
                    >
                      <span className="w-10 shrink-0 select-none border-r border-primary-200 px-2 text-right text-[10px] leading-relaxed text-primary-300 dark:border-neutral-800 dark:text-neutral-600">
                        {line.leftNum ?? ''}
                      </span>
                      <span
                        className={cn(
                          'w-5 shrink-0 select-none text-center leading-relaxed',
                          line.kind === 'removed'
                            ? 'text-red-500'
                            : 'text-transparent',
                        )}
                      >
                        {line.kind === 'removed' ? '−' : ' '}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all px-1',
                          line.kind === 'removed'
                            ? 'text-red-800 dark:text-red-300'
                            : 'text-primary-800 dark:text-neutral-300',
                        )}
                      >
                        {line.text || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-primary-200 bg-primary-100/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                New
              </div>
              <div className="flex-1 overflow-auto">
                <div className="font-mono text-[11px] leading-relaxed">
                  {rightLines.map((line, index) => (
                    <div
                      key={`${line.rightNum ?? 'right'}-${index}`}
                      className={cn(
                        'flex items-start gap-0',
                        line.kind === 'added'
                          ? 'bg-emerald-50 dark:bg-emerald-950/25'
                          : '',
                      )}
                    >
                      <span className="w-10 shrink-0 select-none border-r border-primary-200 px-2 text-right text-[10px] leading-relaxed text-primary-300 dark:border-neutral-800 dark:text-neutral-600">
                        {line.rightNum ?? ''}
                      </span>
                      <span
                        className={cn(
                          'w-5 shrink-0 select-none text-center leading-relaxed',
                          line.kind === 'added'
                            ? 'text-emerald-600'
                            : 'text-transparent',
                        )}
                      >
                        {line.kind === 'added' ? '+' : ' '}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all px-1',
                          line.kind === 'added'
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-primary-800 dark:text-neutral-300',
                        )}
                      >
                        {line.text || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
