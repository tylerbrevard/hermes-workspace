import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  RouteErrorFallback,
  RouteLoadingState,
} from '@/components/route-error-fallback'
import { usePageTitle } from '@/hooks/use-page-title'
import { OperationsScreen } from '@/screens/agents/operations-screen'

const searchSchema = z.object({
  create: z.enum(['agent']).optional(),
})

export const Route = createFileRoute('/operations')({
  ssr: false,
  validateSearch: searchSchema,
  component: function OperationsRoute() {
    usePageTitle('Operations')
    return <OperationsScreen />
  },
  errorComponent: function OperationsError({ error }) {
    return (
      <RouteErrorFallback
        error={error}
        title="Failed to load Operations"
        description="Retry the operations route first. If agent or profile data is unavailable, reload after checking the workspace service."
      />
    )
  },
  pendingComponent: function OperationsPending() {
    return <RouteLoadingState label="Loading operations..." />
  },
})
