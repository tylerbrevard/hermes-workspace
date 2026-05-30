import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { getAppleHealthDashboard } from '../../server/apple-health-data'

export const Route = createFileRoute('/api/apple-health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          return json(getAppleHealthDashboard())
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Apple Health dashboard',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
