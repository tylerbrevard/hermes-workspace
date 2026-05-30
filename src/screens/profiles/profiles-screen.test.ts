import { describe, expect, it } from 'vitest'
import {
  buildProfileBundleExport,
  buildProfileDiffPreview,
  canDeleteProfile,
  detectDuplicateProfiles,
  getProfileHealth,
  getProfileTags,
  getProfileTopCapabilities,
  getProfileUsedByRoutes,
  getProfileValidationBadges,
  getSuggestedProfile,
} from './profiles-screen'

const baseProfile = {
  name: 'ops',
  path: '/Users/tylerlyon/.hermes/profiles/ops',
  active: false,
  exists: true,
  skillCount: 2,
  sessionCount: 4,
  hasEnv: true,
}

describe('ProfilesScreen helpers', () => {
  it('scores malformed profiles and risky permissions', () => {
    const health = getProfileHealth({
      ...baseProfile,
      name: 'admin-shell',
      exists: false,
      hasEnv: false,
      description: 'Can run destructive shell actions',
    })

    expect(health.score).toBeLessThan(100)
    expect(health.issues).toContain('missing provider')
    expect(health.issues).toContain('missing files')
    expect(health.riskyPermissions).toBe(true)
  })

  it('detects duplicate profile shape and exports bundles', () => {
    const profiles = [
      { ...baseProfile, name: 'ops-a', provider: 'openai', model: 'gpt-5' },
      { ...baseProfile, name: 'ops-b', provider: 'openai', model: 'gpt-5' },
    ]

    expect(detectDuplicateProfiles(profiles)[0]).toEqual(['ops-a', 'ops-b'])
    expect(buildProfileBundleExport(profiles)).toContain('"name": "ops-a"')
  })

  it('tags and suggests profiles by capability or active fallback', () => {
    const profiles = [
      {
        ...baseProfile,
        name: 'builder',
        description: 'Build code',
        active: false,
      },
      {
        ...baseProfile,
        name: 'researcher',
        description: 'Research workflow',
        active: true,
      },
    ]

    expect(getProfileTags(profiles[0])).toContain('role:builder')
    expect(getSuggestedProfile(profiles, 'research')?.name).toBe('researcher')
    expect(getSuggestedProfile(profiles, 'missing')?.name).toBe('researcher')
  })

  it('builds validation badges, used-by links, delete guards, and diff previews', () => {
    const profile = {
      ...baseProfile,
      name: 'builder',
      description: 'Build code with tools',
      provider: '',
      model: '',
      active: false,
    }

    expect(getProfileValidationBadges(profile)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'provider',
          route: '/settings?section=claude',
          status: 'missing',
        }),
        expect.objectContaining({ label: 'tools', status: 'ok' }),
      ]),
    )
    expect(getProfileUsedByRoutes(profile).map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Chat',
        'Ops',
        'Conductor',
        'Jobs',
        'Settings',
      ]),
    )
    expect(canDeleteProfile({ name: 'default', active: false })).toBe(false)
    expect(canDeleteProfile({ name: 'builder', active: true })).toBe(false)
    expect(canDeleteProfile({ name: 'builder', active: false })).toBe(true)
    expect(buildProfileDiffPreview('old', 'new')).toContain('+ new')
    expect(getProfileTopCapabilities(profile)).toContain('role:builder')
  })
})
