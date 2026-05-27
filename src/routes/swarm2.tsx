import { createFileRoute } from '@tanstack/react-router'
import {
  RouteErrorFallback,
  RouteLoadingState,
} from '@/components/route-error-fallback'
import { usePageTitle } from '@/hooks/use-page-title'
import { Swarm2Screen } from '@/screens/swarm2/swarm2-screen'

export const Route = createFileRoute('/swarm2')({
  ssr: false,
  component: function Swarm2Route() {
    usePageTitle('Swarm')
    return <Swarm2Screen />
  },
  errorComponent: function Swarm2Error({ error }) {
    return (
      <RouteErrorFallback
        error={error}
        title="Failed to load Swarm"
        description="Retry the swarm route first. If runtime state is stale, reload after checking the workspace service."
      />
    )
  },
  pendingComponent: function Swarm2Pending() {
    return <RouteLoadingState label="Loading Swarm..." />
  },
})
