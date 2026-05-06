import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { HermesWorldEmbed } from '@/screens/playground/hermes-world-embed'

export const Route = createFileRoute('/play')({
  ssr: false,
  component: PlayRoute,
})

function PlayRoute() {
  usePageTitle('Play HermesWorld')
  return <HermesWorldEmbed />
}
