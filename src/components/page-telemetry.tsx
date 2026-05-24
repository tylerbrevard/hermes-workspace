import { useEffect, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'
import {
  installPageDiagnostics,
  recordDiagnosticEvent,
} from '@/lib/page-diagnostics'

export function PageTelemetry() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const previousRoute = useRef<string | null>(null)
  const routeStart = useRef<number>(0)

  useEffect(() => {
    installPageDiagnostics()
  }, [])

  useEffect(() => {
    const now = performance.now()
    if (previousRoute.current) {
      recordDiagnosticEvent({
        type: 'route',
        name: 'route-visible-duration',
        route: previousRoute.current,
        durationMs: Math.round(now - routeStart.current),
      })
    }

    previousRoute.current = pathname
    routeStart.current = now
    recordDiagnosticEvent({
      type: 'route',
      name: 'route-enter',
      route: pathname,
    })

    return () => {
      recordDiagnosticEvent({
        type: 'route',
        name: 'route-leave',
        route: pathname,
        durationMs: Math.round(performance.now() - now),
      })
    }
  }, [pathname])

  return null
}
