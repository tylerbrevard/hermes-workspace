import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { OpsIntelligenceScreen } from '@/screens/ops-intelligence/ops-intelligence-screen'

export const Route = createFileRoute('/ops-intelligence')({
  ssr: false,
  component: OpsIntelligenceRoute,
})

function OpsIntelligenceRoute() {
  usePageTitle('Ops Intelligence')
  return <OpsIntelligenceScreen />
}
