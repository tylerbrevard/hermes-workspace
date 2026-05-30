import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  getLilyGeminiLiveConfig,
  readLilyRuntimeSecret,
} from '../../../server/lily-livekit'

function buildGeminiLiveSystemInstruction() {
  return [
    'You are LILY, Tyler Lyon’s realtime voice companion inside Hermes Workspace.',
    'Sound natural, concise, and interruptible. Prefer short spoken replies.',
    'Tyler is speaking through the Lily page. Treat each user message as spoken conversation.',
    'If Tyler asks you to inspect, change, summarize, or operate Workspace/Hermes/OpenClaw state, call ask_hermes_workspace instead of pretending you did it.',
    'When using ask_hermes_workspace, summarize the result in one brief spoken answer.',
  ].join(' ')
}

function buildGeminiLiveTools() {
  return [
    {
      functionDeclarations: [
        {
          name: 'ask_hermes_workspace',
          description:
            'Delegate an operational request to the Hermes Workspace gateway and return the result.',
          parameters: {
            type: 'OBJECT',
            properties: {
              request: {
                type: 'STRING',
                description:
                  'The exact task or question Tyler wants Hermes Workspace to handle.',
              },
            },
            required: ['request'],
          },
        },
      ],
    },
  ]
}

function withModelPrefix(model: string) {
  return model.startsWith('models/') ? model : `models/${model}`
}

export const Route = createFileRoute('/api/lily/gemini-live-token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const apiKey =
          readLilyRuntimeSecret('GEMINI_API_KEY') ||
          readLilyRuntimeSecret('GOOGLE_API_KEY')
        if (!apiKey) {
          return json(
            {
              ok: false,
              error:
                'Gemini Live is not configured. Add GEMINI_API_KEY to ~/.hermes/secrets/runtime-secrets.json.',
            },
            { status: 501 },
          )
        }

        const gemini = getLilyGeminiLiveConfig()
        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        const newSessionExpireTime = new Date(
          Date.now() + 60 * 1000,
        ).toISOString()

        try {
          const tokenResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${encodeURIComponent(
              apiKey,
            )}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                uses: 1,
                expireTime,
                newSessionExpireTime,
                bidiGenerateContentSetup: {
                  model: withModelPrefix(gemini.model),
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: gemini.voice },
                      },
                    },
                  },
                  systemInstruction: {
                    parts: [{ text: buildGeminiLiveSystemInstruction() }],
                  },
                  outputAudioTranscription: {},
                  tools: buildGeminiLiveTools(),
                },
                fieldMask: [
                  'generationConfig.responseModalities',
                  'generationConfig.speechConfig',
                  'systemInstruction',
                  'tools',
                ],
              }),
            },
          )
          const token = (await tokenResponse.json().catch(() => ({}))) as {
            name?: string
            error?: { message?: string }
          }
          if (!tokenResponse.ok || !token.name) {
            throw new Error(
              token.error?.message ||
                `Gemini Live token failed ${tokenResponse.status}`,
            )
          }

          return json({
            ok: true,
            token: token.name,
            model: gemini.model,
            voice: gemini.voice,
            expireTime,
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Gemini Live token failed',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
