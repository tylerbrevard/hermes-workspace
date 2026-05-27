import { createFileRoute } from '@tanstack/react-router'
import { ZynTrackerPage } from './-personal-health-trackers'

export const Route = createFileRoute('/zyn-tracker')({
  ssr: false,
  component: ZynTrackerPage,
})
