import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ClawosEmbedScreen } from '@/components/legacy/clawos-embed-screen'

export const Route = createFileRoute('/kindle')({
  ssr: false,
  component: KindleRoute,
})

function KindleRoute() {
  usePageTitle('Kindle')
  return <ClawosEmbedScreen path="/kindle" title="Kindle" />
}
