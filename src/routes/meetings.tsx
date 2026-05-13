import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { MeetingsScreen } from '@/screens/meetings/meetings-screen'

export const Route = createFileRoute('/meetings')({
  component: MeetingsRoute,
})

function MeetingsRoute() {
  usePageTitle('Meetings')
  return <MeetingsScreen />
}
