import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { synthesizeLilySpeech } from '../../../server/lily-services'

export const Route = createFileRoute('/api/ops/lily-speak')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json().catch(() => null)) as {
            text?: string
            voice?: string
          } | null
          if (!body || typeof body !== 'object') {
            return json({ error: 'Invalid JSON body' }, { status: 400 })
          }

          const { audio, contentType } = await synthesizeLilySpeech(body)
          return new Response(audio, {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Length': String(audio.byteLength),
              'Content-Type': contentType,
            },
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error ? error.message : 'Speech synthesis failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
