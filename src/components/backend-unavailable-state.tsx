import { Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

type Props = {
  feature: string
  description?: string
}

export function BackendUnavailableState({ feature, description }: Props) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center p-4">
      <div className="flex w-full max-w-lg items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/70 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-600 shadow-sm">
          <HugeiconsIcon icon={Alert02Icon} size={24} strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-500">
            Backend unavailable
          </div>
          <h2 className="truncate text-base font-semibold text-primary-900">
            {feature}
          </h2>
          <p className="text-sm text-primary-600">Hermes Agent gateway needed.</p>
          {description ? (
            <p className="text-xs leading-5 text-primary-500">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default BackendUnavailableState
