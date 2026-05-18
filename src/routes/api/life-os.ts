import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { buildLifeOsSnapshot } from '../../server/life-os-snapshot'

export const Route = createFileRoute('/api/life-os')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        return json(await buildLifeOsSnapshot())
      },
    },
  },
})
