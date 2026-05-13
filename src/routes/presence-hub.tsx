import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/presence-hub')({
  beforeLoad() {
    throw redirect({
      to: '/presence',
      replace: true,
    })
  },
  component: () => null,
})
