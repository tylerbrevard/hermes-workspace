import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/lily')({
  beforeLoad() {
    throw redirect({
      to: '/chat/$sessionKey',
      params: { sessionKey: 'main' },
      replace: true,
    })
  },
  component: () => null,
})
