import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getLegacyIotDevices,
  recordLegacyIotTelemetry,
} from '../../server/presence-data'

export const Route = createFileRoute('/api/iot')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(getLegacyIotDevices())
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : 'Failed to fetch IoT devices',
            },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
          if (!body || typeof body !== 'object') {
            return json({ error: 'Invalid JSON body' }, { status: 400 })
          }
          return json(recordLegacyIotTelemetry(body))
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : 'Failed to process IoT data',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
