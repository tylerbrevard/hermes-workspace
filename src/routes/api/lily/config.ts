import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  getLilyLiveKitConfig,
  getLilyVoiceWorkerHealth,
} from '../../../server/lily-livekit'

export const Route = createFileRoute('/api/lily/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const config = getLilyLiveKitConfig()
        const voiceWorker = await getLilyVoiceWorkerHealth()
        return json({ ok: true, ...config, voiceWorker })
      },
    },
  },
})
