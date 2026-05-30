import { describe, expect, it } from 'vitest'
import routes from '../../config/workspace-visible-routes.json'
import {
  WORKSPACE_ROUTE_REGISTRY,
  findWorkspaceRouteRegistryEntry,
  getWorkspaceRouteRegistryByOwner,
} from './workspace-route-registry'

describe('workspace route registry', () => {
  it('covers every visible smoke route', () => {
    expect(WORKSPACE_ROUTE_REGISTRY.map((entry) => entry.route)).toEqual(
      routes.map((route) => route.route),
    )
  })

  it('keeps smoke text aligned with visible route config', () => {
    for (const route of routes) {
      const entry = findWorkspaceRouteRegistryEntry(route.route)
      expect(entry?.smokeText).toBe(route.smokeText)
      expect(entry?.mobileSmokeText).toBe(route.mobileSmokeText)
    }
  })

  it('groups routes by owner for menu and escalation work', () => {
    expect(
      getWorkspaceRouteRegistryByOwner('agent-ops').length,
    ).toBeGreaterThan(5)
    expect(getWorkspaceRouteRegistryByOwner('settings')).toHaveLength(1)
  })
})
