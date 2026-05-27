import { createFileRoute } from '@tanstack/react-router'
import { FoodLogPage } from './-personal-health-trackers'

export const Route = createFileRoute('/food-log')({
  ssr: false,
  component: FoodLogPage,
})
