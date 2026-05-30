import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'

export type FeatureNotReadyProps = {
  feature: string
  reason: string
  action?: string
  learnMoreUrl?: string
  learnMoreLabel?: string
}

export function FeatureNotReady({
  feature,
  reason,
  action,
  learnMoreUrl,
  learnMoreLabel = 'Details',
}: FeatureNotReadyProps) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-4">
      <div
        className="flex w-full max-w-xl items-start gap-3 rounded-xl border p-4"
        style={{
          borderColor: 'var(--theme-border, rgba(255,255,255,0.1))',
          background: 'rgba(8,12,20,0.72)',
          color: 'var(--theme-text, white)',
        }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(251,191,36,0.12)',
            color: '#fbbf24',
            border: '1px solid rgba(251,191,36,0.35)',
          }}
        >
          <HugeiconsIcon icon={Alert02Icon} size={22} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300/80">
            Upstream not ready
          </div>
          <div className="mt-1 text-lg font-bold">{feature}</div>
          <p className="mt-1 text-sm leading-5 text-white/70">{reason}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/80">
            {action ? (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                Next: {action}
              </span>
            ) : null}
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/10"
              >
                {learnMoreLabel}
                <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
