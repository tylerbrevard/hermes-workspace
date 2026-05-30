import { readJsonStorage, writeJsonStorage } from './typed-storage'
import { buildWorkspaceRouteDiagnosticContext } from './workspace-route-registry'

export type DiagnosticEvent = {
  id: string
  type:
    | 'api'
    | 'api-error'
    | 'console-error'
    | 'error'
    | 'route'
    | 'vital'
    | 'navigation'
  route: string
  timestamp: string
  durationMs?: number
  status?: number
  ok?: boolean
  name?: string
  message?: string
  url?: string
  method?: string
  value?: number
}

const STORAGE_KEY = 'hermes:page-diagnostics:v1'
const MAX_EVENTS = 80
let fetchPatched = false
let consolePatched = false

function isDiagnosticEvent(value: unknown): value is DiagnosticEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Partial<Record<keyof DiagnosticEvent, unknown>>
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.route === 'string' &&
    typeof event.timestamp === 'string'
  )
}

function isDiagnosticEventArray(
  value: unknown,
): value is Array<DiagnosticEvent> {
  return Array.isArray(value) && value.every(isDiagnosticEvent)
}

function nowIso() {
  return new Date().toISOString()
}

function currentRoute() {
  if (typeof window === 'undefined') return 'server'
  return `${window.location.pathname}${window.location.search}`
}

function makeId() {
  return crypto.randomUUID()
}

export function readDiagnosticEvents(): Array<DiagnosticEvent> {
  return readJsonStorage(STORAGE_KEY, [], isDiagnosticEventArray).value.slice(
    -MAX_EVENTS,
  )
}

export function recordDiagnosticEvent(
  event: Omit<DiagnosticEvent, 'id' | 'route' | 'timestamp'> & {
    route?: string
    timestamp?: string
  },
) {
  try {
    const events = readDiagnosticEvents()
    events.push({
      id: makeId(),
      route: event.route ?? currentRoute(),
      timestamp: event.timestamp ?? nowIso(),
      ...event,
    })
    writeJsonStorage(STORAGE_KEY, events.slice(-MAX_EVENTS))
  } catch {
    // Diagnostics must never affect the page being diagnosed.
  }
}

function summarizeInput(input: RequestInfo | URL, init?: RequestInit) {
  const method =
    init?.method ??
    (typeof Request !== 'undefined' && input instanceof Request
      ? input.method
      : 'GET')
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  try {
    const url = new URL(rawUrl, window.location.origin)
    return {
      method,
      url:
        url.origin === window.location.origin
          ? `${url.pathname}${url.search}`
          : url.origin,
    }
  } catch {
    return { method, url: String(rawUrl) }
  }
}

export function installPageDiagnostics() {
  if (typeof window === 'undefined') return

  if (!fetchPatched) {
    fetchPatched = true
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const start = performance.now()
      const request = summarizeInput(input, init)
      try {
        const response = await nativeFetch(input, init)
        const durationMs = Math.round(performance.now() - start)
        if (
          request.url.startsWith('/api/') ||
          durationMs > 1500 ||
          !response.ok
        ) {
          recordDiagnosticEvent({
            type: response.ok ? 'api' : 'api-error',
            durationMs,
            status: response.status,
            ok: response.ok,
            method: request.method,
            url: request.url,
          })
        }
        return response
      } catch (error) {
        recordDiagnosticEvent({
          type: 'api-error',
          durationMs: Math.round(performance.now() - start),
          ok: false,
          method: request.method,
          url: request.url,
          message: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }
  }

  if (!consolePatched) {
    consolePatched = true
    const nativeError = console.error.bind(console)
    console.error = (...args) => {
      recordDiagnosticEvent({
        type: 'console-error',
        message: args
          .map((arg) =>
            arg instanceof Error ? `${arg.message}\n${arg.stack}` : String(arg),
          )
          .join(' ')
          .slice(0, 2000),
      })
      nativeError(...args)
    }

    window.addEventListener('error', (event) => {
      recordDiagnosticEvent({
        type: 'error',
        message:
          event.error instanceof Error ? event.error.message : event.message,
        name: event.error instanceof Error ? event.error.name : 'Error',
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      recordDiagnosticEvent({
        type: 'error',
        name: reason instanceof Error ? reason.name : 'UnhandledRejection',
        message: reason instanceof Error ? reason.message : String(reason),
      })
    })
  }

  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined
  if (navigation) {
    recordDiagnosticEvent({
      type: 'navigation',
      name: 'initial-load',
      durationMs: Math.round(navigation.duration),
      value: Math.round(navigation.domContentLoadedEventEnd),
    })
  }

  void import('web-vitals')
    .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const capture = (metric: { name: string; value: number }) => {
        recordDiagnosticEvent({
          type: 'vital',
          name: metric.name,
          value: Number(metric.value.toFixed(2)),
        })
      }
      onCLS(capture)
      onFCP(capture)
      onINP(capture)
      onLCP(capture)
      onTTFB(capture)
    })
    .catch(() => undefined)
}

export function buildDiagnosticBundle(extra?: Record<string, unknown>) {
  const route = currentRoute()
  const routePath = route.split('?')[0] || route
  const routeContext = buildWorkspaceRouteDiagnosticContext(routePath)
  const performanceEntries =
    typeof performance === 'undefined'
      ? []
      : performance
          .getEntriesByType('navigation')
          .slice(-1)
          .map((entry) => {
            return {
              name: entry.name,
              duration: Math.round(entry.duration),
              domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
              load: Math.round(entry.loadEventEnd),
            }
          })

  return {
    capturedAt: nowIso(),
    route,
    routeRegistry: routeContext.registry,
    routeContext,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    viewport:
      typeof window === 'undefined'
        ? null
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
    diagnostics: readDiagnosticEvents(),
    performance: performanceEntries,
    extra,
  }
}
