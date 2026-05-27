import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { buildOpsIntelligenceSnapshot } from '../../server/ops-intelligence'

export const Route = createFileRoute('/api/ops-intelligence')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          return json(await buildOpsIntelligenceSnapshot())
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load ops intelligence',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
