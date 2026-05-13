import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { PresenceHubScreen } from '@/screens/presence/presence-hub-screen'

export const Route = createFileRoute('/presence-hub')({
  component: PresenceHubRoute,
})

function PresenceHubRoute() {
  usePageTitle('Presence Hub')
  return <PresenceHubScreen />
}
