import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  createBarryMeeting,
  deleteBarryMeeting,
  getBarryData,
  updateBarryMeeting,
} from '../../../server/barry-data'

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

export const Route = createFileRoute('/api/ops/barry')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          return json(await getBarryData())
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
        try {
          const body = (await request.json()) as BarryMeeting
          createBarryMeeting(body)
          return json({ success: true })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to create Barry meeting',
            },
            { status: 500 },
          )
        }
      },

      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await request.json()) as Partial<BarryMeeting> & {
            id: string
          }
          updateBarryMeeting(body)
          return json({ success: true })
        } catch (error) {
          const status =
            typeof (error as { status?: unknown })?.status === 'number'
              ? ((error as { status: number }).status)
              : 500
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update Barry meeting',
            },
            { status },
          )
        }
      },

      DELETE: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        const url = new URL(request.url)
        const id = url.searchParams.get('id') || ''
        try {
          deleteBarryMeeting(id)
          return json({ success: true })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to delete Barry meeting',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
