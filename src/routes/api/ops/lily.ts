import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  fetchClawos,
  fetchClawosJson,
} from '../../../server/clawos-internal'

type LilyContext = {
  summary?: {
    enabledJobs: number
    failingJobs: number
    warningJobs: number
    healthyJobs: number
    nextJob?: { name: string; when: string } | null
    nextJobs?: Array<{ name: string; when: string }>
    meetingsToday?: number
    nextMeeting?: { title: string; when: string } | null
    transientIssue?: {
      type: string
      jobs: number
      when: string
      summary: string
    } | null
  }
  recentFailures?: Array<{ name: string; error: string; when: string }>
}

type LilyParseResponse = {
  content?: string
  source?: string
  error?: string
}

export const Route = createFileRoute('/api/ops/lily')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const context = await fetchClawosJson<LilyContext>('/api/lily/context')
          return json({ context })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Lily context',
            },
            { status: 502 },
          )
        }
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.text()
        const response = await fetchClawos('/api/lily/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })

        const payload = (await response.json().catch(() => ({}))) as LilyParseResponse
        return json(payload, { status: response.status })
      },
    },
  },
})
