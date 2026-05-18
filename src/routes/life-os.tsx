import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { LifeOsScreen } from '@/screens/life-os/life-os-screen'

export const Route = createFileRoute('/life-os')({
  ssr: false,
  component: LifeOsRoute,
})

function LifeOsRoute() {
  usePageTitle('Life OS')
  return <LifeOsScreen />
}
