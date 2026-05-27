import { createFileRoute, useNavigate  } from '@tanstack/react-router'
import { useEffect } from 'react'
import { usePageTitle } from '@/hooks/use-page-title'
import { DashboardScreen } from '@/screens/dashboard/dashboard-screen'

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  component: DashboardRoute,
})

function DashboardRoute() {
  const navigate = useNavigate()
  usePageTitle('Dashboard')

  useEffect(() => {
    if (!shouldUsePhoneMobileHome(window.innerWidth)) return
    void navigate({ to: '/phone', replace: true })
  }, [navigate])

  return <DashboardScreen />
}

export function shouldUsePhoneMobileHome(viewportWidth: number) {
  return viewportWidth < 768
}
