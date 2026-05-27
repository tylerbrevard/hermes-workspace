import { createFileRoute } from '@tanstack/react-router'
import {
  RouteErrorFallback,
  RouteLoadingState,
} from '@/components/route-error-fallback'
import { FilesScreen } from '@/screens/files/files-screen'

export const Route = createFileRoute('/files')({
  ssr: false,
  component: FilesRoute,
  errorComponent: function FilesError({ error }) {
    return (
      <RouteErrorFallback
        error={error}
        title="Failed to load Files"
        description="Retry the file route first. If the workspace root or preview API is unavailable, reload after checking the workspace service."
      />
    )
  },
  pendingComponent: function FilesPending() {
    return <RouteLoadingState label="Loading file explorer..." />
  },
})

function FilesRoute() {
  return <FilesScreen />
}
