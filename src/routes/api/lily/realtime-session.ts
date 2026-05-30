import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  getLilyRealtimeConfig,
  readLilyRuntimeSecret,
} from '../../../server/lily-livekit'

const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

function buildRealtimeSessionConfig() {
  const realtime = getLilyRealtimeConfig()
  return {
    type: 'realtime',
    model: realtime.model,
    instructions: [
      'You are LILY, Tyler Lyon’s realtime voice companion inside Hermes Workspace.',
      'Sound natural, concise, and interruptible. Prefer short spoken replies.',
      'If Tyler asks you to inspect, change, summarize, or operate Workspace/Hermes/OpenClaw state, call ask_hermes_workspace instead of pretending you did it.',
      'When using ask_hermes_workspace, summarize the result in one brief spoken answer.',
    ].join(' '),
    audio: {
      input: {
        turn_detection: null,
        transcription: { model: 'gpt-4o-mini-transcribe' },
      },
      output: {
        voice: realtime.voice,
      },
    },
    tools: [
      {
        type: 'function',
        name: 'ask_hermes_workspace',
        description:
          'Delegate an operational request to the Hermes Workspace gateway and return the result.',
        parameters: {
          type: 'object',
          properties: {
            request: {
              type: 'string',
              description:
                'The exact task or question Tyler wants Hermes Workspace to handle.',
            },
          },
          required: ['request'],
          additionalProperties: false,
        },
      },
    ],
  }
}

export const Route = createFileRoute('/api/lily/realtime-session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            {
              status: 401,
              headers: { 'content-type': 'application/json' },
            },
          )
        }

        const apiKey = readLilyRuntimeSecret('OPENAI_API_KEY')
        if (!apiKey) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                'OpenAI Realtime is not configured. Add OPENAI_API_KEY to ~/.hermes/secrets/runtime-secrets.json.',
            }),
            {
              status: 501,
              headers: { 'content-type': 'application/json' },
            },
          )
        }

        const sdp = await request.text()
        if (!sdp.trim()) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: 'WebRTC SDP offer is required',
            }),
            {
              status: 400,
              headers: { 'content-type': 'application/json' },
            },
          )
        }

        const form = new FormData()
        form.set('sdp', sdp)
        form.set('session', JSON.stringify(buildRealtimeSessionConfig()))

        const response = await fetch(REALTIME_CALLS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'OpenAI-Safety-Identifier': 'hermes-workspace-lily',
          },
          body: form,
        })
        const answer = await response.text()
        if (!response.ok) {
          return new Response(answer || 'OpenAI Realtime session failed', {
            status: response.status,
            headers: {
              'content-type':
                response.headers.get('content-type') || 'text/plain',
            },
          })
        }

        return new Response(answer, {
          status: 200,
          headers: { 'content-type': 'application/sdp' },
        })
      },
    },
  },
})
