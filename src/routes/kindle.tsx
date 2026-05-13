import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { KindleScreen } from '@/screens/ops/kindle-screen'

export const Route = createFileRoute('/kindle')({
  ssr: false,
  component: KindleRoute,
})

function KindleRoute() {
  usePageTitle('Kindle')
  return <KindleScreen />
}
