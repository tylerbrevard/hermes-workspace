import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { PresenceHubScreen } from '@/screens/presence/presence-hub-screen'

export const Route = createFileRoute('/presence')({
  component: PresenceRoute,
})

function PresenceRoute() {
  usePageTitle('Presence')
  return <PresenceHubScreen />
}
