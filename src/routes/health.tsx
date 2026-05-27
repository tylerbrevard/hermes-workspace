import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { WorkspaceHealthScreen } from '@/screens/health/workspace-health-screen'

export const Route = createFileRoute('/health')({
  ssr: false,
  component: HealthRoute,
})

function HealthRoute() {
  usePageTitle('Workspace Health')
  return <WorkspaceHealthScreen />
}
