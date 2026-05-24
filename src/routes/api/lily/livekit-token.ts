import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { requireJsonContentType } from '../../../server/rate-limit'
import { createLilyLiveKitToken } from '../../../server/lily-livekit'

export const Route = createFileRoute('/api/lily/livekit-token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        try {
          const body = (await request.json().catch(() => ({}))) as {
            identity?: string
            roomName?: string
          }
          const credentials = createLilyLiveKitToken(
            body.identity,
            body.roomName,
          )
          return json({ ok: true, ...credentials })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to create LiveKit token',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
