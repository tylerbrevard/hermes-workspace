import { describe, expect, it } from 'vitest'
import {
  buildDndPresetPayload,
  buildPresenceCockpitTiles,
  buildPresenceDiagnosticsExport,
  buildPresenceShareText,
  getPresenceNextStep,
  getPresencePrimaryAction,
  getPresenceRouteDiagnostics,
  getPresenceSourceSeparation,
  getPresenceUnavailableState,
  normalizePresenceDefaultMode,
} from './presence-hub-screen'

describe('PresenceHubScreen helpers', () => {
  it('reports Graph auth required state and next step', () => {
    const data = {
      presence: { authRequired: true },
      devices: [],
      pools: [],
    }

    expect(getPresenceUnavailableState(data)).toBe('Graph auth required')
    expect(getPresenceNextStep(data)).toContain('Repair Graph auth')
  })

  it('reports M5 unavailable when there are no devices', () => {
    const data = {
      presence: { availability: 'Available' },
      devices: [],
      pools: [],
    }

    expect(getPresenceUnavailableState(data)).toBe('M5 unavailable')
    expect(getPresenceSourceSeparation(data).graph).toBe('Graph')
  })

  it('exports device diagnostics and stale-device action', () => {
    const data = {
      presence: { availability: 'Busy' },
      syncDiagnostics: { driftReason: 'device_stale', deviceName: 'desk-m5' },
      devices: [
        {
          id: 'm5-1',
          name: 'desk-m5',
          status: 'Busy',
          lastSeenMinutesAgo: 30,
        },
      ],
      pools: [],
      refreshedAt: '2026-05-26T12:00:00.000Z',
    }

    expect(getPresenceNextStep(data)).toContain('desk-m5')
    expect(buildPresenceDiagnosticsExport(data)).toContain('"name": "desk-m5"')
  })

  it('chooses a primary action for stale, auth, and healthy states', () => {
    expect(
      getPresencePrimaryAction({
        presence: { authRequired: true },
        devices: [],
        pools: [],
      }),
    ).toMatchObject({ label: 'Auth', kind: 'teams-status' })
    expect(
      getPresencePrimaryAction({
        presence: { availability: 'Available' },
        syncDiagnostics: { driftReason: 'device_stale' },
        devices: [
          {
            id: 'm5-1',
            name: 'desk-m5',
            status: 'Busy',
            lastSeenMinutesAgo: 12,
          },
        ],
        pools: [],
      }),
    ).toMatchObject({ label: 'Sync', kind: 'teams-status' })
    expect(
      getPresencePrimaryAction({
        presence: { availability: 'Available' },
        syncDiagnostics: { inSync: true },
        devices: [
          {
            id: 'm5-1',
            name: 'desk-m5',
            status: 'Available',
            lastSeenMinutesAgo: 1,
          },
        ],
        pools: [],
      }),
    ).toMatchObject({ label: 'Refresh', kind: 'refresh' })
  })

  it('builds share text and route diagnostics', () => {
    const data = {
      presence: { availability: 'Busy', activity: 'In a call' },
      syncDiagnostics: { inSync: false, teamsError: 'Graph timeout' },
      devices: [],
      pools: [],
      refreshedAt: '2026-05-27T14:00:00.000Z',
    }

    expect(buildPresenceShareText(data)).toContain('Tyler is Busy')
    expect(getPresenceRouteDiagnostics(data)).toMatchObject({
      teamsAuth: 'degraded',
      sourceError: 'Graph timeout',
    })
  })

  it('builds app-like cockpit tiles from Graph and M5 state', () => {
    const tiles = buildPresenceCockpitTiles(
      {
        presence: { availability: 'Available', activity: 'Available' },
        syncDiagnostics: {
          inSync: false,
          driftReason: 'label_mismatch',
          presenceSource: 'Graph',
          deviceWord: 'Focus',
          deviceFreshness: 2,
        },
        devices: [
          {
            id: 'm5-1',
            name: 'Desk M5',
            status: 'Available',
            lastSeenMinutesAgo: 1,
          },
          {
            id: 'm5-2',
            name: 'Door M5',
            status: 'Busy',
            lastSeenMinutesAgo: 20,
          },
        ],
        pools: [],
      },
      {
        freshDeviceCount: 1,
        staleDeviceCount: 1,
        mismatchDeviceCount: 1,
      },
    )

    expect(tiles).toMatchObject([
      { id: 'availability', label: 'Availability', value: 'Available' },
      { id: 'sync-trust', label: 'Sync trust', tone: 'warning' },
      {
        id: 'm5-devices',
        label: 'M5 devices',
        value: '1/2',
        action: 'mismatches',
      },
      { id: 'graph-source', label: 'Graph source', value: 'healthy' },
      { id: 'display-word', label: 'Display word', value: 'Focus' },
    ])
  })

  it('normalizes default mode and creates DND preset payloads', () => {
    expect(normalizePresenceDefaultMode('manual')).toBe('manual')
    expect(normalizePresenceDefaultMode('unknown')).toBe('graph')
    expect(
      buildDndPresetPayload(30, new Date('2026-05-27T14:00:00.000Z')),
    ).toMatchObject({
      kind: 'set-presence',
      availability: 'DoNotDisturb',
      expiresAt: '2026-05-27T14:30:00.000Z',
    })
  })
})
