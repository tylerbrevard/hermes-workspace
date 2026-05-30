import { createFileRoute } from '@tanstack/react-router'
import { AppleHealthDashboardPage } from './-apple-health-dashboard'

export const Route = createFileRoute('/apple-health')({
  ssr: false,
  component: AppleHealthDashboardPage,
})
