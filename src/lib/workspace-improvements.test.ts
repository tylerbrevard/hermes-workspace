import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_IMPROVEMENT_PAGES,
  countWorkspaceRecommendations,
  findWorkspaceImprovementPage,
} from './workspace-improvements'

type VisibleRoute = {
  route: string
  smokeText: string
  visualText?: string
  screenshotName: string
  mobileOnly?: boolean
}

function readVisibleRoutes(): Array<VisibleRoute> {
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'config', 'workspace-visible-routes.json'),
      'utf8',
    ),
  ) as Array<VisibleRoute>
}

describe('workspace improvement catalog', () => {
  it('tracks 20 recommendations for every visible workspace menu page', () => {
    expect(WORKSPACE_IMPROVEMENT_PAGES).toHaveLength(23)
    expect(countWorkspaceRecommendations()).toBe(460)
    for (const page of WORKSPACE_IMPROVEMENT_PAGES) {
      expect(page.recommendations).toHaveLength(20)
    }
  })

  it('matches the visible workspace routes used by smoke tests', () => {
    const routes = readVisibleRoutes().map((entry) => entry.route)

    expect(
      routes.map((route) => findWorkspaceImprovementPage(route)?.route),
    ).toEqual(routes)
  })

  it('keeps smoke text and screenshot names configured for every visible route', () => {
    for (const route of readVisibleRoutes()) {
      expect(route.route).toMatch(/^\//)
      expect(route.smokeText.trim().length).toBeGreaterThan(0)
      expect(
        (route.visualText ?? route.smokeText).trim().length,
      ).toBeGreaterThan(0)
      expect(route.screenshotName).toMatch(/^[a-z0-9-]+$/)
      expect(
        route.mobileOnly === undefined || typeof route.mobileOnly === 'boolean',
      ).toBe(true)
    }
  })
})
