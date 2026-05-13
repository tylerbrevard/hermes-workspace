import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { transcribeLilyAudio } from '../../../server/lily-services'

type TranscribePayload = {
  text?: string
  error?: string
  detail?: string
}

export const Route = createFileRoute('/api/ops/lily-transcribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const formData = await request.formData()
          const payload = (await transcribeLilyAudio(formData)) as TranscribePayload
          return json(payload)
        } catch (error) {
          return json(
            {
              error: 'Transcription failed',
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
