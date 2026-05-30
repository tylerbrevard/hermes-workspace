// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDiagnosticBundle,
  readDiagnosticEvents,
  recordDiagnosticEvent,
} from './page-diagnostics'

const STORAGE_KEY = 'hermes:page-diagnostics:v1'

describe('page diagnostics storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001',
    )
  })

  it('recovers malformed diagnostic storage through typed storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{bad json')

    expect(readDiagnosticEvents()).toEqual([])
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('persists bounded diagnostic events with required fields', () => {
    recordDiagnosticEvent({
      type: 'api',
      route: '/dashboard',
      timestamp: '2026-05-27T18:30:00.000Z',
      status: 200,
      ok: true,
      url: '/api/status',
    })

    expect(readDiagnosticEvents()).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        type: 'api',
        route: '/dashboard',
        timestamp: '2026-05-27T18:30:00.000Z',
        status: 200,
        ok: true,
        url: '/api/status',
      }),
    ])
  })

  it('adds route fixtures, smoke assertions, and source drilldowns to bundles', () => {
    window.history.pushState({}, '', '/workspace/tasks?create=task')

    const bundle = buildDiagnosticBundle()

    expect(bundle.routeRegistry).toMatchObject({
      route: '/tasks',
      label: 'Tasks',
    })
    expect(bundle.routeContext.smokeAssertions).toMatchObject({
      desktopText: 'Tasks',
      mobileText: 'Tasks',
    })
    expect(bundle.routeContext.routeFixtures).toEqual([
      expect.objectContaining({
        route: '/tasks?create=task',
        label: 'Create task modal',
        smokeText: 'Tasks',
      }),
    ])
    expect(bundle.routeContext.liveSourceDrilldowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'tasks API',
          target: '/workspace/files?path=src/server',
        }),
      ]),
    )
  })
})
