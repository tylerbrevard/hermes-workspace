import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { BarryScreen } from '@/screens/ops/barry-screen'

export const Route = createFileRoute('/barry')({
  ssr: false,
  component: BarryRoute,
})

function BarryRoute() {
  usePageTitle('Barry')
  return <BarryScreen />
}
