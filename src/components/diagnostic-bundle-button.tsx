import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { writeTextToClipboard } from '@/lib/clipboard'
import { buildDiagnosticBundle } from '@/lib/page-diagnostics'
import { cn } from '@/lib/utils'

type DiagnosticBundleButtonProps = {
  className?: string
  label?: string
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  size?: 'default' | 'sm'
  context?: Record<string, unknown>
}

export function DiagnosticBundleButton({
  className,
  label = 'Copy diagnostics',
  variant = 'outline',
  size = 'sm',
  context,
}: DiagnosticBundleButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copyDiagnostics() {
    const bundle = buildDiagnosticBundle(context)
    await writeTextToClipboard(JSON.stringify(bundle, null, 2))
    setCopied(true)
    toast('Diagnostic bundle copied', { type: 'success' })
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={cn('font-mono text-[11px]', className)}
      onClick={() => {
        void copyDiagnostics().catch((error) => {
          toast(
            error instanceof Error
              ? error.message
              : 'Failed to copy diagnostic bundle',
            { type: 'error' },
          )
        })
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}
