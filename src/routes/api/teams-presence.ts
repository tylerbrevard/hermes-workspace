import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getLegacyTeamsPresence } from '../../server/presence-data'

export const Route = createFileRoute('/api/teams-presence')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await getLegacyTeamsPresence())
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : 'Teams presence unavailable',
            },
            { status: 503 },
          )
        }
      },
      POST: async () =>
        json(
          {
            error:
              'Updating Teams presence requires a delegated user token; Hermes currently exposes read-only Graph presence.',
          },
          { status: 400 },
        ),
    },
  },
})
