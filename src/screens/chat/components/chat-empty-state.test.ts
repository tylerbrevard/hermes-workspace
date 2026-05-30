import { describe, expect, it } from 'vitest'
import { buildChatLaunchTiles } from './chat-empty-state'

describe('chat empty state launchpad', () => {
  it('summarizes profile, gateway, and tool readiness as launch tiles', () => {
    const tiles = buildChatLaunchTiles({
      profileName: 'Ops',
      profileModel: 'gpt-5',
      gatewayLabel: 'Gateway ready',
      gatewayTone: 'ok',
    })

    expect(tiles.map((tile) => tile.label)).toEqual([
      'Profile',
      'Gateway',
      'Tools',
    ])
    expect(tiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Profile',
          value: 'Ops',
          detail: 'gpt-5',
          tone: 'ok',
        }),
        expect.objectContaining({
          label: 'Gateway',
          value: 'Ready',
          detail: 'Gateway ready',
          tone: 'ok',
        }),
      ]),
    )
  })

  it('keeps defaults useful when profile or gateway state is missing', () => {
    expect(
      buildChatLaunchTiles({
        gatewayLabel: 'Gateway status unavailable',
        gatewayTone: 'warn',
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Profile',
          value: 'Default',
          tone: 'neutral',
        }),
        expect.objectContaining({
          label: 'Gateway',
          value: 'Check',
          tone: 'warn',
        }),
      ]),
    )
  })
})
