import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { LilyScreen } from '@/screens/ops/lily-screen'

export const Route = createFileRoute('/lily')({
  ssr: false,
  component: LilyRoute,
})

function LilyRoute() {
  usePageTitle('Lily')
  return <LilyScreen />
}
