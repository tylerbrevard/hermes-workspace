import { Button } from '@/components/ui/button'
import { recordDiagnosticEvent } from '@/lib/page-diagnostics'

type RouteErrorFallbackProps = {
  error: unknown
  title?: string
  description?: string
  reset?: () => void
  className?: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error || 'An unexpected error occurred')
}

function getErrorStack(error: unknown) {
  if (error instanceof Error) return error.stack
  return undefined
}

export function RouteErrorFallback({
  error,
  title = 'Page failed',
  description = 'Retry, then reload.',
  reset,
  className,
}: RouteErrorFallbackProps) {
  const message = getErrorMessage(error)
  const stack = getErrorStack(error)

  function retryRoute() {
    recordDiagnosticEvent({
      type: 'route',
      name: 'route-error-retry',
      message,
    })
    reset?.()
  }

  function reloadPage() {
    recordDiagnosticEvent({
      type: 'route',
      name: 'route-error-reload',
      message,
    })
    window.location.reload()
  }

  return (
    <div
      className={[
        'flex h-full min-h-[360px] items-center justify-center bg-primary-50 p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <section className="w-full max-w-2xl rounded-lg border border-primary-200 bg-primary-100 p-6 text-left shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-red-700">
          Route error
        </p>
        <h2 className="mt-2 text-xl font-semibold text-primary-950">{title}</h2>
        <p className="mt-2 text-sm text-primary-700">{description}</p>
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="font-mono text-xs font-semibold text-red-900">
            {message}
          </p>
          {stack ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-red-800">
              {stack.split('\n').slice(0, 8).join('\n')}
            </pre>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {reset ? (
            <Button onClick={retryRoute} size="sm">
              Retry route
            </Button>
          ) : null}
          <Button
            onClick={reloadPage}
            size="sm"
            variant={reset ? 'secondary' : 'default'}
          >
            Reload page
          </Button>
        </div>
      </section>
    </div>
  )
}

export function RouteLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-sm text-primary-500 dark:text-neutral-400">
      <div className="text-center">
        <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent" />
        <p>{label}</p>
      </div>
    </div>
  )
}
