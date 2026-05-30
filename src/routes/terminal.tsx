import { createFileRoute } from '@tanstack/react-router'
import { RouteErrorFallback } from '@/components/route-error-fallback'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/terminal')({
  ssr: false,
  component: TerminalRoute,
  errorComponent: function TerminalError({ error }) {
    return (
      <RouteErrorFallback
        error={error}
        title="Terminal error"
        description="Retry terminal. If PTY is down, reload after workspace health."
      />
    )
  },
})

function TerminalRoute() {
  usePageTitle('Terminal')
  // Terminal is rendered persistently in WorkspaceShell — return null here to avoid double mount
  return null
}
