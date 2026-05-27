import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getLegacyIotConfigWithWeather,
  updateLegacyIotConfig,
} from '../../../server/presence-data'

export const Route = createFileRoute('/api/iot/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          return json(await getLegacyIotConfigWithWeather(url.searchParams))
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : 'Failed to fetch config',
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
          return json(updateLegacyIotConfig(body))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update config'
          return json(
            {
              error: message,
            },
            { status: message.includes('required') ? 400 : 500 },
          )
        }
      },
    },
  },
})
