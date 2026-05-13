import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  fetchClawos,
  fetchClawosJson,
} from '../../../server/clawos-internal'

type BarryMeetingStatus = 'upcoming' | 'completed' | 'archived'

type BarryMeeting = {
  id: string
  date: string
  status: BarryMeetingStatus
  agenda: Array<{ text: string; discussed: boolean }>
  winsDiscussed: string[]
  actionItems: Array<{ text: string; owner: string; done: boolean }>
  notes: string
}

type BarryWin = {
  id: string
  win: string
  category: string
  date: string
  shareWithBarry?: boolean
  status?: string
}

async function proxyMutation(
  request: Request,
  path: string,
  init: Parameters<typeof fetchClawos>[1],
) {
  const response = await fetchClawos(path, init)
  const payload = await response.json().catch(() => ({}))
  return json(payload, { status: response.status })
}

export const Route = createFileRoute('/api/ops/barry')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const [meetingsData, winsData, settingsData] = await Promise.all([
            fetchClawosJson<{ meetings?: BarryMeeting[] }>('/api/barry'),
            fetchClawosJson<{ wins?: BarryWin[] }>('/api/wins'),
            fetchClawosJson<{ profile?: { name?: string } }>('/api/settings'),
          ])

          const profileName = settingsData?.profile?.name?.trim()
          const currentUser =
            profileName && profileName.length > 0
              ? profileName.split(/\s+/)[0]
              : 'Tyler'

          return json({
            meetings: meetingsData.meetings || [],
            wins: (winsData.wins || []).filter(
              (win) => win.shareWithBarry && win.status === 'Active',
            ),
            currentUser,
            refreshedAt: new Date().toISOString(),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Barry data',
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
        return proxyMutation(request, '/api/barry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      },

      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        const body = await request.text()
        return proxyMutation(request, '/api/barry', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      },

      DELETE: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        const url = new URL(request.url)
        const id = url.searchParams.get('id') || ''
        return proxyMutation(request, '/api/barry', {
          method: 'DELETE',
          searchParams: { id },
        })
      },
    },
  },
})
