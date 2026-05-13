import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ClawosEmbedScreen } from '@/components/legacy/clawos-embed-screen'

export const Route = createFileRoute('/barry')({
  ssr: false,
  component: BarryRoute,
})

function BarryRoute() {
  usePageTitle('Barry')
  return <ClawosEmbedScreen path="/barry" title="Barry" />
}
