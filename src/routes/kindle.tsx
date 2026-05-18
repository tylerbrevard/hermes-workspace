import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/kindle')({
  beforeLoad() {
    throw redirect({
      to: '/it-ops',
      replace: true,
    })
  },
  component: () => null,
})
