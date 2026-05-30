import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/providers')({
  ssr: false,
  beforeLoad() {
    throw redirect({
      to: '/settings',
      search: { section: 'claude' },
      replace: true,
    })
  },
  component: () => null,
})
