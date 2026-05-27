import { describe, expect, it } from 'vitest'
import {
  MOBILE_HAMBURGER_NAV_ITEMS,
  MOBILE_PINNED_NAV_IDS,
  groupMobileNavItems,
} from './mobile-hamburger-menu'
import { MOBILE_NAV_TABS } from './mobile-tab-bar'
import {
  DESKTOP_SIDEBAR_BACKDROP_CLASS,
  getWorkspaceMobilePageTitle,
} from './workspace-shell'

describe('workspace shell sidebar backdrop', () => {
  it('only spans the desktop sidebar width, not the full viewport', () => {
    expect(DESKTOP_SIDEBAR_BACKDROP_CLASS).toContain('w-[300px]')
    expect(DESKTOP_SIDEBAR_BACKDROP_CLASS).not.toContain('inset-0')
  })
})

describe('workspace mobile page titles', () => {
  it('covers every secondary visible workspace menu page', () => {
    expect(getWorkspaceMobilePageTitle('/tasks')).toBe('Tasks')
    expect(getWorkspaceMobilePageTitle('/pto-tracker')).toBe('PTO Tracker')
    expect(getWorkspaceMobilePageTitle('/wegovy')).toBe('Wegovy Shots')
    expect(getWorkspaceMobilePageTitle('/zyn-tracker')).toBe('Zyn Tracker')
    expect(getWorkspaceMobilePageTitle('/food-log')).toBe('Food Log')
    expect(getWorkspaceMobilePageTitle('/meetings')).toBe('Meetings')
    expect(getWorkspaceMobilePageTitle('/presence')).toBe('Presence')
    expect(getWorkspaceMobilePageTitle('/it-ops')).toBe('ConnectWise')
    expect(getWorkspaceMobilePageTitle('/barry')).toBe('Barry')
  })
})

describe('swarm2 navigation alias handling', () => {
  it('keeps /swarm as the only user-visible swarm entry in the mobile hamburger menu', () => {
    const swarm = MOBILE_HAMBURGER_NAV_ITEMS.find((item) => item.id === 'swarm')
    const swarm2 = MOBILE_HAMBURGER_NAV_ITEMS.find(
      (item) => item.id === 'swarm2',
    )

    expect(swarm?.to).toBe('/swarm')
    expect(swarm2).toBeUndefined()
  })

  it('keeps /swarm as the only user-visible swarm tab', () => {
    const swarm = MOBILE_NAV_TABS.find((item) => item.id === 'swarm')
    const swarm2 = MOBILE_NAV_TABS.find((item) => item.id === 'swarm2')

    expect(swarm?.to).toBe('/swarm')
    expect(swarm2).toBeUndefined()
  })

  it('keeps the mobile tab bar compact and leaves secondary pages in the drawer', () => {
    expect(MOBILE_NAV_TABS.map((item) => item.id)).toEqual([
      'phone',
      'chat',
      'lily',
      'files',
      'terminal',
      'swarm',
    ])
    expect(MOBILE_HAMBURGER_NAV_ITEMS.some((item) => item.id === 'files')).toBe(
      true,
    )
    expect(
      MOBILE_HAMBURGER_NAV_ITEMS.some((item) => item.id === '75-tracker'),
    ).toBe(true)
    expect(
      MOBILE_HAMBURGER_NAV_ITEMS.some((item) => item.id === 'pto-tracker'),
    ).toBe(true)
    expect(
      MOBILE_HAMBURGER_NAV_ITEMS.some((item) => item.id === 'wegovy'),
    ).toBe(true)
    expect(
      MOBILE_HAMBURGER_NAV_ITEMS.some((item) => item.id === 'zyn-tracker'),
    ).toBe(true)
    expect(
      MOBILE_HAMBURGER_NAV_ITEMS.some((item) => item.id === 'food-log'),
    ).toBe(true)
  })

  it('groups drawer navigation around Tyler workflow modes with five pinned pages', () => {
    expect(Array.from(MOBILE_PINNED_NAV_IDS)).toEqual([
      'dashboard',
      'phone',
      'chat',
      'lily',
      'tasks',
    ])

    const groups = groupMobileNavItems(MOBILE_HAMBURGER_NAV_ITEMS)
    expect(groups.map((group) => group.label)).toEqual([
      'Pinned',
      'Daily',
      'Agent Ops',
      'Knowledge',
      'Systems',
      'Settings',
    ])
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      'chat',
      'lily',
      'dashboard',
      'phone',
      'tasks',
    ])
    expect(
      groups
        .find((group) => group.label === 'Agent Ops')
        ?.items.map((item) => item.id),
    ).toContain('conductor')
  })
})
