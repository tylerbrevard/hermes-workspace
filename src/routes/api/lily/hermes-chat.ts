import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { requireJsonContentType } from '../../../server/rate-limit'
import { BEARER_TOKEN, CLAUDE_API } from '../../../server/gateway-capabilities'
import { readLilyRuntimeSecret } from '../../../server/lily-livekit'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const LILY_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'claude-3-5-haiku-latest',
] as const

const LILY_PERSONALITIES = {
  concise:
    'You are LILY, a concise futuristic voice companion inside Hermes Workspace. Reply naturally in one or two short paragraphs.',
  operator:
    'You are LILY, a calm operations copilot inside Hermes Workspace. Be direct, prioritize next actions, and call out blockers clearly.',
  warm: 'You are LILY, a warm but efficient voice companion inside Hermes Workspace. Keep replies natural, practical, and brief.',
} as const

export type LilyChatOptions = {
  model?: string
  personality: keyof typeof LILY_PERSONALITIES
  useWorkspaceMemory: boolean
  useConversationMemory: boolean
}

function cleanMessages(value: unknown): Array<ChatMessage> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry): ChatMessage | null => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const role = record.role === 'assistant' ? 'assistant' : 'user'
      const content =
        typeof record.content === 'string' ? record.content.trim() : ''
      if (!content) return null
      return { role, content }
    })
    .filter((entry): entry is ChatMessage => Boolean(entry))
    .slice(-12)
}

export function normalizeLilyChatOptions(value: unknown): LilyChatOptions {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawPersonality =
    typeof record.personality === 'string' ? record.personality : ''
  const personality = Object.prototype.hasOwnProperty.call(
    LILY_PERSONALITIES,
    rawPersonality,
  )
    ? (rawPersonality as keyof typeof LILY_PERSONALITIES)
    : 'concise'
  const rawModel = typeof record.model === 'string' ? record.model.trim() : ''
  const model =
    rawModel && LILY_MODELS.some((candidate) => candidate === rawModel)
      ? rawModel
      : undefined

  return {
    model,
    personality,
    useWorkspaceMemory: record.useWorkspaceMemory !== false,
    useConversationMemory: record.useConversationMemory !== false,
  }
}

function buildLilySystemPrompt(options: LilyChatOptions): string {
  const memoryRules = [
    options.useWorkspaceMemory
      ? 'You may use relevant Hermes Workspace memory when the gateway provides it.'
      : 'Do not use workspace memory; answer only from the current request and visible conversation.',
    options.useConversationMemory
      ? 'Use the visible conversation for continuity.'
      : 'Treat this as a fresh exchange and do not rely on earlier messages except the latest user request.',
  ]
  return `${LILY_PERSONALITIES[options.personality]} ${memoryRules.join(' ')}`
}

function getHermesBearerToken(): string {
  return (
    process.env.HERMES_API_TOKEN ||
    process.env.CLAUDE_API_TOKEN ||
    readLilyRuntimeSecret('HERMES_API_TOKEN') ||
    readLilyRuntimeSecret('CLAUDE_API_TOKEN') ||
    BEARER_TOKEN ||
    ''
  )
}

async function chooseModel(selectedModel?: string): Promise<string> {
  if (selectedModel) return selectedModel
  const configured =
    process.env.LILY_MODEL ||
    process.env.HERMES_MODEL ||
    process.env.CLAUDE_MODEL
  if (configured?.trim()) return configured.trim()
  try {
    const headers: Record<string, string> = {}
    const bearer = getHermesBearerToken()
    if (bearer) headers.Authorization = `Bearer ${bearer}`
    const response = await fetch(`${CLAUDE_API}/v1/models`, { headers })
    if (!response.ok) throw new Error(`models failed ${response.status}`)
    const payload = (await response.json()) as { data?: Array<{ id?: string }> }
    const first = payload.data?.find(
      (model) => typeof model.id === 'string',
    )?.id
    if (first) return first
  } catch {
    // The gateway will return a precise model error if this fallback is invalid.
  }
  return 'gpt-4o-mini'
}

export const Route = createFileRoute('/api/lily/hermes-chat')({
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
            messages?: unknown
            model?: unknown
            personality?: unknown
            useWorkspaceMemory?: unknown
            useConversationMemory?: unknown
          }
          const messages = cleanMessages(body.messages)
          if (messages.length === 0) {
            return json(
              { ok: false, error: 'Message content is required' },
              { status: 400 },
            )
          }
          const options = normalizeLilyChatOptions(body)
          const scopedMessages = options.useConversationMemory
            ? messages
            : messages.slice(-1)

          const bearer = getHermesBearerToken()
          const response = await fetch(`${CLAUDE_API}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
            },
            body: JSON.stringify({
              model: await chooseModel(options.model),
              temperature: 0.7,
              messages: [
                {
                  role: 'system',
                  content: buildLilySystemPrompt(options),
                },
                ...scopedMessages,
              ],
            }),
          })

          const payload = (await response.json().catch(() => ({}))) as {
            choices?: Array<{ message?: { content?: string } }>
            error?: { message?: string } | string
          }
          if (!response.ok) {
            const error =
              typeof payload.error === 'string'
                ? payload.error
                : payload.error?.message ||
                  `Hermes gateway returned ${response.status}`
            return json({ ok: false, error }, { status: response.status })
          }
          const reply = payload.choices?.[0]?.message?.content?.trim()
          return json({
            ok: Boolean(reply),
            reply: reply || 'I did not receive a response from Hermes.',
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to contact Hermes gateway',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
