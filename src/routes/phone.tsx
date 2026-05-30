import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle } from '@/hooks/use-page-title'
import { PhoneCockpitScreen } from '@/screens/phone/phone-cockpit-screen'

const searchSchema = z.object({
  capture: z.enum(['note', 'task', 'draft']).optional(),
  text: z.string().optional(),
})

export const Route = createFileRoute('/phone')({
  ssr: false,
  validateSearch: searchSchema,
  component: PhoneRoute,
})

function PhoneRoute() {
  usePageTitle('Phone')
  return <PhoneCockpitScreen />
}
