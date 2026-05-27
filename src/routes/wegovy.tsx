import { createFileRoute } from '@tanstack/react-router'
import { WegovyTrackerPage } from './-personal-health-trackers'

export const Route = createFileRoute('/wegovy')({
  ssr: false,
  component: WegovyTrackerPage,
})
