import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ClawosEmbedScreen } from '@/components/legacy/clawos-embed-screen'

export const Route = createFileRoute('/it-ops')({
  ssr: false,
  component: ItOpsRoute,
})

function ItOpsRoute() {
  usePageTitle('IT Ops')
  return <ClawosEmbedScreen path="/it-ops" title="IT Ops" />
}
