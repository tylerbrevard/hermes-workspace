import { textFromMessage } from './utils'
import type { ChatMessage, SessionMeta } from './types'

export type ChatTimelineSummary = {
  userMessages: number
  assistantMessages: number
  toolCalls: number
  decisions: number
  artifacts: number
}

export type ChatFlowRiskSummary = {
  blockedByMe: boolean
  waitingOnOthers: boolean
  riskyMutation: boolean
  taskCandidates: number
}

export type ChatWorkflowSummary = {
  timeline: ChatTimelineSummary
  risks: ChatFlowRiskSummary
  label: string
  model: string
  provider: string
  fallback: string
  sessionFreshness: string
  lastSave: string
  loadingCopy: string
  errorRecovery: string
  costGuard: string
}

export type ChatRouteDiagnostics = {
  route: '/workspace/chat/main'
  activeSession: string
  friendlyId: string
  model: string
  provider: string
  connectionState: string
  messageCount: number
  waiting: boolean
  sending: boolean
  recoveryState: string
  riskyMutationGate: 'clear' | 'review-first'
  secretsIncluded: false
}

export type ResumeLatestContext = {
  available: boolean
  target: string | null
  label: string
  detail: string
}

export type ChatCommandRailItem = {
  id: 'task' | 'note' | 'draft' | 'agent-job'
  label: string
  prompt: string
}

function countMessageToolCalls(message: ChatMessage): number {
  const content = Array.isArray(message.content) ? message.content : []
  const contentToolCalls = content.filter((part) => part.type === 'toolCall')
  const streamToolCalls = Array.isArray((message as any).__streamToolCalls)
    ? (message as any).__streamToolCalls
    : []
  return contentToolCalls.length + streamToolCalls.length
}

function textIncludesAny(text: string, patterns: Array<RegExp>): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

export function classifyChatTimeline(
  messages: Array<ChatMessage>,
): ChatTimelineSummary {
  return messages.reduce<ChatTimelineSummary>(
    (summary, message) => {
      const text = textFromMessage(message).toLowerCase()
      const toolCalls = countMessageToolCalls(message)
      if (message.role === 'user') summary.userMessages += 1
      if (message.role === 'assistant') summary.assistantMessages += 1
      summary.toolCalls += toolCalls
      if (
        textIncludesAny(text, [
          /\bdecision\b/,
          /\bdecided\b/,
          /\bapproved\b/,
          /\bship\b/,
          /\bdo this\b/,
        ])
      ) {
        summary.decisions += 1
      }
      if (
        toolCalls > 0 ||
        (Array.isArray(message.attachments) &&
          message.attachments.length > 0) ||
        textIncludesAny(text, [
          /\bcreated\b/,
          /\bupdated\b/,
          /\bexport\b/,
          /\bmarkdown\b/,
          /\bartifact\b/,
          /```/,
        ])
      ) {
        summary.artifacts += 1
      }
      return summary
    },
    {
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      decisions: 0,
      artifacts: 0,
    },
  )
}

export function detectChatFlowRisks(
  messages: Array<ChatMessage>,
): ChatFlowRiskSummary {
  const text = messages.map((message) => textFromMessage(message)).join('\n')
  const normalized = text.toLowerCase()
  return {
    blockedByMe: textIncludesAny(normalized, [
      /\bblocked by (you|me|tyler)\b/,
      /\bneeds? (your|tyler|tyler'?s) (approval|input|answer|decision)\b/,
      /\bwaiting for (you|tyler)\b/,
    ]),
    waitingOnOthers: textIncludesAny(normalized, [
      /\bwaiting on\b/,
      /\bfollow up\b/,
      /\bneeds reply\b/,
      /\bpending from\b/,
    ]),
    riskyMutation: textIncludesAny(normalized, [
      /\brm -rf\b/,
      /\bgit reset --hard\b/,
      /\bforce push\b/,
      /\bdrop table\b/,
      /\bdelete\b/,
      /\boverwrite\b/,
      /\bproduction\b/,
    ]),
    taskCandidates: (
      normalized.match(/\b(todo|task|follow up|next step)\b/g) ?? []
    ).length,
  }
}

function parseModelProvider(modelLabel: string): {
  model: string
  provider: string
} {
  const trimmed = modelLabel.trim()
  if (!trimmed) return { model: 'Gateway default', provider: 'Hermes Agent' }
  const parts = trimmed.split('/')
  if (parts.length >= 2) {
    return {
      provider: parts[0]?.trim() || 'Configured provider',
      model: parts.slice(1).join('/').trim() || trimmed,
    }
  }
  return { model: trimmed, provider: 'Configured provider' }
}

function formatChatAge(timestamp: number | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return 'Freshness unknown'
  const ageMs = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return 'Fresh just now'
  if (minutes < 60) return `Fresh ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Fresh ${hours}h ago`
  return `Fresh ${Math.floor(hours / 24)}d ago`
}

export function buildChatWorkflowSummary(payload: {
  messages: Array<ChatMessage>
  label?: string
  modelLabel?: string
  updatedAt?: number
  saving?: boolean
  waiting?: boolean
  error?: string | null
  connectionState?: string
}): ChatWorkflowSummary {
  const timeline = classifyChatTimeline(payload.messages)
  const risks = detectChatFlowRisks(payload.messages)
  const modelInfo = parseModelProvider(payload.modelLabel ?? '')
  const isLocal =
    /local|lmstudio|ollama|hermes/i.test(modelInfo.provider) ||
    /local|lmstudio|ollama|hermes/i.test(modelInfo.model)
  return {
    timeline,
    risks,
    label: payload.label || 'Daily',
    model: modelInfo.model,
    provider: modelInfo.provider,
    fallback:
      payload.connectionState === 'connected'
        ? 'SSE stream connected'
        : 'HTTP refresh fallback armed',
    sessionFreshness: formatChatAge(payload.updatedAt),
    lastSave: payload.saving ? 'Saving current turn' : 'Last save synced',
    loadingCopy: payload.waiting
      ? 'Hermes is thinking, streaming tools, and reconciling history'
      : 'Ready for the next turn',
    errorRecovery: payload.error
      ? 'Retry or refresh history'
      : 'Recovery ready if send fails',
    costGuard: isLocal
      ? 'Cost guard: local/default model'
      : 'Cost guard: confirm before long paid runs',
  }
}

export function buildChatRouteDiagnostics(payload: {
  activeSessionKey?: string | null
  activeFriendlyId: string
  messages: Array<ChatMessage>
  modelLabel?: string
  connectionState?: string
  waiting?: boolean
  sending?: boolean
  error?: string | null
}): ChatRouteDiagnostics {
  const modelInfo = parseModelProvider(payload.modelLabel ?? '')
  const risks = detectChatFlowRisks(payload.messages)
  return {
    route: '/workspace/chat/main',
    activeSession: payload.activeSessionKey || 'new',
    friendlyId: payload.activeFriendlyId || 'main',
    model: modelInfo.model,
    provider: modelInfo.provider,
    connectionState: payload.connectionState || 'unknown',
    messageCount: payload.messages.length,
    waiting: Boolean(payload.waiting),
    sending: Boolean(payload.sending),
    recoveryState: payload.error ? 'retry-or-refresh' : 'armed',
    riskyMutationGate: risks.riskyMutation ? 'review-first' : 'clear',
    secretsIncluded: false,
  }
}

export function buildResumeLatestContext(
  sessions: Array<
    Pick<SessionMeta, 'key' | 'friendlyId' | 'title' | 'updatedAt'>
  >,
): ResumeLatestContext {
  const latest = sessions[0]
  if (!latest) {
    return {
      available: false,
      target: null,
      label: 'Start a new session',
      detail: 'No previous chat session is available to restore.',
    }
  }
  const target = latest.friendlyId || latest.key
  return {
    available: Boolean(target),
    target: target || null,
    label: `Resume ${latest.title || latest.friendlyId || latest.key}`,
    detail: `Restores the latest session shell, message history, model context, and recovery state from ${formatChatAge(latest.updatedAt)}.`,
  }
}

export function buildChatCommandRail(
  hasSuccessfulMessage: boolean,
): Array<ChatCommandRailItem> {
  if (hasSuccessfulMessage) return []
  return [
    {
      id: 'task',
      label: 'Task capture',
      prompt:
        'Help me capture the next task. Ask only for missing owner, due date, and desired outcome.',
    },
    {
      id: 'note',
      label: 'Knowledge note',
      prompt:
        'Turn this into a reusable workspace note with context, decision, and next action.',
    },
    {
      id: 'draft',
      label: 'Draft reply',
      prompt:
        'Draft a concise reply with the ask, decision, blocker, and deadline.',
    },
    {
      id: 'agent-job',
      label: 'Agent job',
      prompt:
        'Create an agent job with objective, constraints, verification, and stop conditions.',
    },
  ]
}
