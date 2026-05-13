import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ClawosEmbedScreen } from '@/components/legacy/clawos-embed-screen'

export const Route = createFileRoute('/lily')({
  ssr: false,
  component: LilyRoute,
})

function LilyRoute() {
  usePageTitle('Lily')
  return <ClawosEmbedScreen path="/lily" title="Lily" />
}
