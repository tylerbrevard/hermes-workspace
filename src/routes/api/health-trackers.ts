import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  HealthTrackersConflictError,
  readHealthTrackersState,
  writeHealthTrackersPatch,
} from '../../server/health-trackers'
import type { HealthTrackersPatch } from '../../server/health-trackers'

type HealthTrackersPatchRequest = HealthTrackersPatch & {
  expectedUpdatedAt?: string | null
}

export const Route = createFileRoute('/api/health-trackers')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        return json(readHealthTrackersState())
      },

      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as HealthTrackersPatchRequest
          const { expectedUpdatedAt, ...patch } = body
          return json(writeHealthTrackersPatch(patch, expectedUpdatedAt))
        } catch (error) {
          if (error instanceof HealthTrackersConflictError) {
            return json(
              {
                error: error.message,
                current: error.current,
              },
              { status: 409 },
            )
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update health trackers',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
