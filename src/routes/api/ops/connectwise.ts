import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getItOpsData } from '../../../server/it-ops-data'

export const Route = createFileRoute('/api/ops/connectwise')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          return json(await getItOpsData())
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load ConnectWise data',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
