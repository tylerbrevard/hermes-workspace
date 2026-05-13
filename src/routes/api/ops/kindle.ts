import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getKindleData } from '../../../server/kindle-data'

export const Route = createFileRoute('/api/ops/kindle')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          return json(await getKindleData())
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Kindle data',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
