import { createFileRoute } from '@tanstack/react-router'
import {
  RouteErrorFallback,
  RouteLoadingState,
} from '@/components/route-error-fallback'
import { usePageTitle } from '@/hooks/use-page-title'
import { Swarm2Screen } from '@/screens/swarm2/swarm2-screen'

export const Route = createFileRoute('/swarm')({
  ssr: false,
  component: function SwarmRoute() {
    usePageTitle('Swarm')
    return <Swarm2Screen />
  },
  errorComponent: function SwarmError({ error }) {
    return (
      <RouteErrorFallback
        error={error}
        title="Failed to load Swarm"
        description="Retry the swarm route first. If runtime state is stale, reload after checking the workspace service."
      />
    )
  },
  pendingComponent: function SwarmPending() {
    return <RouteLoadingState label="Loading swarm..." />
  },
})
