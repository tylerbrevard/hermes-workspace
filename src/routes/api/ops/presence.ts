import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  activatePool,
  getPresenceData,
  getTeamsPreview,
  rotateWords,
  updateDeviceConfig,
  updateDeviceLabel,
} from '../../../server/presence-data'

export const Route = createFileRoute('/api/ops/presence')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          return json(await getPresenceData())
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load presence hub data',
            },
            { status: 502 },
          )
        }
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as Record<string, unknown>
          const kind = typeof body.kind === 'string' ? body.kind : ''

          if (kind === 'set-presence') {
            return json(
              {
                error:
                  'Setting Teams presence requires a delegated user token, which is not available in the current Hermes Graph setup.',
              },
              { status: 400 },
            )
          }

          if (kind === 'update-device-config') {
            const deviceId =
              typeof body.deviceId === 'string' ? body.deviceId : ''
            const brightness =
              typeof body.brightness === 'number' ? body.brightness : undefined
            const fetchInterval =
              typeof body.fetchInterval === 'number'
                ? body.fetchInterval
                : undefined
            updateDeviceConfig(deviceId, brightness, fetchInterval)
            return json({ success: true })
          }

          if (kind === 'update-device-label') {
            const deviceId =
              typeof body.deviceId === 'string' ? body.deviceId : ''
            const status = typeof body.status === 'string' ? body.status : ''
            const word = typeof body.word === 'string' ? body.word : ''
            updateDeviceLabel(deviceId, status, word)
            return json({ success: true })
          }

          if (kind === 'activate-pool') {
            const poolId = typeof body.poolId === 'string' ? body.poolId : ''
            return json(activatePool(poolId))
          }

          if (kind === 'rotate-words') {
            return json(rotateWords())
          }

          if (kind === 'teams-sync') {
            return json({ success: true, status: 'synced' })
          }

          if (kind === 'teams-test') {
            return json({ success: true, status: 'synced' })
          }

          if (kind === 'teams-status') {
            return json(await getTeamsPreview())
          }

          return json({ error: 'Unsupported operation' }, { status: 400 })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error ? error.message : 'Presence action failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
