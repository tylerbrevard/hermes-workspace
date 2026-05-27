import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { buildPhoneCockpitSnapshot } from '../../server/phone-cockpit'
import { buildPhoneWidgetSummary } from '../../server/phone-summary'

export const Route = createFileRoute('/api/phone-summary')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const snapshot = await buildPhoneCockpitSnapshot()
          return json(buildPhoneWidgetSummary(snapshot), {
            headers: {
              'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
            },
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load phone summary',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
