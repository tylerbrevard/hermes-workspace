import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ItOpsScreen } from '@/screens/it-ops/it-ops-screen'

export const Route = createFileRoute('/it-ops')({
  component: ItOpsRoute,
})

function ItOpsRoute() {
  usePageTitle('IT Ops')
  return <ItOpsScreen />
}
