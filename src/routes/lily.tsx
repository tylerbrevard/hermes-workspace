import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { apiPath, withBasePath } from '@/lib/base-path'

type LilyConfig = {
  ok: boolean
  configured: boolean
  serverUrl: string
  agentName: string
  voiceProvider?:
    | 'gemini_live'
    | 'openai_realtime'
    | 'livekit'
    | 'chrome'
    | 'auto'
  gemini?: {
    configured: boolean
    model: string
    voice: string
  }
  realtime?: {
    configured: boolean
    model: string
    voice: string
  }
  voiceWorker?: {
    status: 'online' | 'offline' | 'unknown' | 'not_configured'
    checkedAt: string
    detail: string
    source: string | null
    startCommand?: string
    defaultHealthUrl?: string
    docsPath?: string
    requiredEnv?: Array<string>
  }
  error?: string
}

type LilyMessage = {
  role: 'user' | 'assistant'
  content: string
  localOnly?: boolean
}

type LilyPersonality = 'concise' | 'operator' | 'warm'

type LilyTimelineEvent = {
  id: string
  kind: 'transcript' | 'decision' | 'task' | 'memory'
  label: string
  detail: string
  createdAt: string
}

type LilyMemoryEvent = {
  kind: LilyTimelineEvent['kind']
  label: string
  detail: string
  source:
    | 'typed'
    | 'hands-free'
    | 'push-to-talk'
    | 'realtime'
    | 'gemini'
    | 'test'
}

type LilyConversationPreset = {
  id: string
  label: string
  prompt: string
}

type GeminiLiveSession = {
  sendClientContent: (params: {
    turns?: unknown
    turnComplete?: boolean
  }) => void
  sendToolResponse: (params: { functionResponses: unknown }) => void
  close: () => void
}

type GeminiLiveServerMessage = {
  data?: string
  text?: string
  serverContent?: {
    outputTranscription?: {
      text?: string
      finished?: boolean
    }
    turnComplete?: boolean
    generationComplete?: boolean
    interrupted?: boolean
  }
  toolCall?: {
    functionCalls?: Array<{
      id?: string
      name?: string
      args?: Record<string, unknown>
    }>
  }
}

const LILY_MODEL_OPTIONS = [
  { id: '', label: 'Hermes default' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'claude-3-5-haiku-latest', label: 'Claude Haiku' },
] as const

const LILY_PERSONALITY_OPTIONS: Array<{
  id: LilyPersonality
  label: string
  detail: string
}> = [
  {
    id: 'concise',
    label: 'Concise',
    detail: 'Short voice-first replies.',
  },
  {
    id: 'operator',
    label: 'Operator',
    detail: 'Prioritizes blockers and next actions.',
  },
  {
    id: 'warm',
    label: 'Warm',
    detail: 'Softer tone while staying brief.',
  },
]

export const LILY_CONVERSATION_PRESETS: Array<LilyConversationPreset> = [
  {
    id: 'daily-brief',
    label: 'Brief',
    prompt:
      'Give me a daily brief: meetings, urgent tasks, waiting replies, and the one thing I should do next.',
  },
  {
    id: 'meeting-prep',
    label: 'Prep',
    prompt:
      'Prep me for the next meeting. Include context, likely decisions, open action items, and risks.',
  },
  {
    id: 'task-triage',
    label: 'Triage',
    prompt:
      'Triage my tasks into do now, delegate, schedule, and ignore. Call out anything waiting on me.',
  },
  {
    id: 'system-check',
    label: 'Check',
    prompt:
      'Check Hermes workspace health, voice loop readiness, source freshness, and what changed recently.',
  },
]

export function buildLilyDiagnostics(input: {
  micPermission: string
  browserVoiceLabel: string
  liveKitConnected: boolean
  geminiConnected?: boolean
  realtimeConnected?: boolean
  voiceMode?: string
  tokenStatus: string
  workerStatus?: string
  status: string
  error?: string
}) {
  return [
    'LILY diagnostics',
    `[browser] mic=${input.micPermission}; speech=${input.browserVoiceLabel}`,
    `[worker] status=${input.workerStatus || 'checking'}`,
    `[transport] livekit=${input.liveKitConnected ? 'connected' : 'not connected'}; realtime=${input.realtimeConnected ? 'connected' : 'not connected'}; gemini=${input.geminiConnected ? 'connected' : 'not connected'}; token=${input.tokenStatus}`,
    `[agent] voiceMode=${input.voiceMode || 'unknown'}`,
    `[config] status=${input.status}; error=${input.error || 'none'}`,
  ].join('\n')
}

export function buildLilyVoiceLoopStages(input: {
  handsFreeEnabled: boolean
  pushToTalkActive: boolean
  browserVoiceLabel: string
  micPermission: string
  liveKitConnected: boolean
  realtimeConnected?: boolean
  geminiConnected?: boolean
  workerStatus?: string
  tokenStatus: string
  voiceMode: string
  isSending: boolean
  lastTestStage: string
}) {
  const browserActive = input.handsFreeEnabled || input.pushToTalkActive
  const connectedTransport = input.geminiConnected
    ? 'Gemini Live connected'
    : input.realtimeConnected
      ? 'OpenAI Realtime connected'
      : input.liveKitConnected
        ? 'LiveKit transport connected'
        : input.workerStatus === 'online'
          ? 'Worker online; token pending'
          : 'Browser fallback only'
  const speaking =
    input.voiceMode === 'speaking'
      ? 'Speaking now'
      : input.isSending || input.voiceMode === 'thinking'
        ? 'Thinking'
        : 'Not speaking'

  return [
    {
      id: 'browser',
      label: 'Browser loop',
      value: browserActive ? 'Hands-free' : 'Manual',
      detail:
        input.micPermission === 'denied'
          ? 'Mic blocked'
          : `${input.browserVoiceLabel}; mic ${input.micPermission}`,
      tone:
        input.micPermission === 'denied'
          ? ('unavailable' as const)
          : browserActive
            ? ('ready' as const)
            : ('degraded' as const),
    },
    {
      id: 'transport',
      label: 'Transport',
      value: connectedTransport,
      detail: input.tokenStatus,
      tone:
        input.geminiConnected ||
        input.realtimeConnected ||
        input.liveKitConnected
          ? ('ready' as const)
          : input.workerStatus === 'online'
            ? ('degraded' as const)
            : ('unavailable' as const),
    },
    {
      id: 'agent',
      label: 'Voice agent',
      value: speaking,
      detail: input.voiceMode,
      tone:
        input.voiceMode === 'speaking'
          ? ('ready' as const)
          : input.isSending || input.voiceMode === 'thinking'
            ? ('degraded' as const)
            : ('unavailable' as const),
    },
    {
      id: 'test',
      label: 'Last test',
      value: input.lastTestStage.startsWith('passed')
        ? 'Passed'
        : input.lastTestStage.startsWith('failed')
          ? 'Failed'
          : 'Not passed',
      detail: input.lastTestStage,
      tone: input.lastTestStage.startsWith('passed')
        ? ('ready' as const)
        : input.lastTestStage.startsWith('failed')
          ? ('unavailable' as const)
          : ('degraded' as const),
    },
  ] as const
}

export function getLilyFailureCta(input: {
  micPermission: string
  browserSupported: boolean
  liveKitConnected: boolean
  workerStatus?: string
  tokenStatus: string
}) {
  if (input.micPermission === 'denied') return 'Grant mic'
  if (!input.browserSupported) return 'Switch browser'
  if (input.workerStatus && input.workerStatus !== 'online') {
    return 'Use Chrome loop'
  }
  if (/unavailable|refreshing|no livekit token/i.test(input.tokenStatus)) {
    return 'Refresh token'
  }
  if (!input.liveKitConnected) return 'Use typed fallback'
  return 'Voice loop ready'
}

export function getLilyVoiceReadiness(input: {
  configured: boolean
  geminiConfigured?: boolean
  realtimeConfigured?: boolean
  micPermission: string
  browserSupported: boolean
  workerStatus?: string
  tokenStatus: string
  liveKitConnected: boolean
  geminiConnected?: boolean
  realtimeConnected?: boolean
}) {
  if (
    input.geminiConnected ||
    input.realtimeConnected ||
    input.liveKitConnected
  ) {
    return {
      state: 'ready' as const,
      label: 'Voice',
      blocker: 'none',
      canStart: true,
    }
  }
  if (input.micPermission === 'denied') {
    return {
      state: 'unavailable' as const,
      label: 'Blocked',
      blocker: 'Mic permission blocked',
      canStart: false,
    }
  }
  if (input.geminiConfigured && input.browserSupported) {
    return {
      state: 'ready' as const,
      label: 'Gemini',
      blocker: 'none',
      canStart: true,
    }
  }
  if (input.realtimeConfigured) {
    return {
      state: 'ready' as const,
      label: 'Realtime',
      blocker: 'none',
      canStart: true,
    }
  }
  const canUseChromeLoop = input.browserSupported
  if (
    !input.configured &&
    !input.geminiConfigured &&
    !input.realtimeConfigured &&
    !input.browserSupported
  ) {
    return {
      state: 'unavailable' as const,
      label: 'Blocked',
      blocker: 'Realtime + speech missing',
      canStart: false,
    }
  }
  if (input.realtimeConfigured) {
    return {
      state: 'ready' as const,
      label: 'Realtime',
      blocker: 'none',
      canStart: true,
    }
  }
  if (
    !input.configured ||
    /no livekit token|unavailable/i.test(input.tokenStatus)
  ) {
    if (input.browserSupported) {
      return {
        state: 'degraded' as const,
        label: 'Chrome',
        blocker: input.configured
          ? 'Token inactive; Chrome ready'
          : 'Keys missing; Chrome ready',
        canStart: true,
      }
    }
    return {
      state: 'degraded' as const,
      label: 'Typed',
      blocker: input.configured ? 'Token inactive' : 'Keys missing',
      canStart: canUseChromeLoop,
    }
  }
  if (!input.browserSupported) {
    return {
      state: 'degraded' as const,
      label: 'Transport',
      blocker: 'Listen unavailable',
      canStart: input.configured,
    }
  }
  return {
    state: 'ready' as const,
    label: 'Voice',
    blocker:
      input.workerStatus && input.workerStatus !== 'online'
        ? 'Worker offline; Chrome loop ready'
        : 'none',
    canStart: true,
  }
}

export function getLilySetupChecklist(input: {
  configured: boolean
  realtimeConfigured?: boolean
  micPermission: string
  browserSupported: boolean
  workerStatus?: string
  liveKitConnected: boolean
  realtimeConnected?: boolean
}) {
  return [
    {
      id: 'microphone',
      label: 'Mic',
      status:
        input.micPermission === 'granted'
          ? 'ready'
          : input.micPermission === 'denied'
            ? 'blocked'
            : 'needs action',
      action: input.micPermission === 'denied' ? 'Allow mic.' : 'Approve mic.',
    },
    {
      id: 'speaker',
      label: 'Speaker',
      status: input.browserSupported ? 'ready' : 'degraded',
      action: input.browserSupported
        ? 'Tab audio ready.'
        : 'Use Chrome or type.',
    },
    {
      id: 'realtime',
      label: 'Realtime',
      status:
        input.realtimeConnected ||
        input.realtimeConfigured ||
        input.liveKitConnected ||
        input.workerStatus === 'online'
          ? 'ready'
          : input.browserSupported
            ? 'degraded'
            : 'blocked',
      action: input.realtimeConnected
        ? 'Realtime connected.'
        : input.realtimeConfigured
          ? 'Realtime ready.'
          : input.liveKitConnected || input.workerStatus === 'online'
            ? 'Media ready.'
            : input.browserSupported
              ? 'Chrome loop.'
              : 'Start worker or Chrome.',
    },
  ]
}

export function buildLilyCockpitTiles(input: {
  readiness: ReturnType<typeof getLilyVoiceReadiness>
  micPermission: string
  browserVoiceLabel: string
  tokenStatus: string
  workerStatus?: string
  wakeLockStatus: string
  memoryEnabled: boolean
  conversationMemoryEnabled: boolean
  timelineCount: number
}) {
  return [
    {
      id: 'readiness',
      label: 'Voice',
      value: input.readiness.label,
      detail:
        input.readiness.blocker === 'none'
          ? 'Startable'
          : input.readiness.blocker,
      tone: input.readiness.state,
    },
    {
      id: 'mic',
      label: 'Mic',
      value:
        input.micPermission === 'granted'
          ? 'Ready'
          : input.micPermission === 'denied'
            ? 'Blocked'
            : 'Prompt',
      detail: input.browserVoiceLabel,
      tone:
        input.micPermission === 'granted'
          ? 'ready'
          : input.micPermission === 'denied'
            ? 'unavailable'
            : 'degraded',
    },
    {
      id: 'transport',
      label: 'Transport',
      value: input.workerStatus === 'online' ? 'Worker' : 'Browser',
      detail: input.tokenStatus,
      tone:
        input.workerStatus === 'online' ||
        /active|ready/i.test(input.tokenStatus)
          ? 'ready'
          : 'degraded',
    },
    {
      id: 'memory',
      label: 'Memory',
      value: input.memoryEnabled
        ? input.conversationMemoryEnabled
          ? 'Full'
          : 'Workspace'
        : 'Off',
      detail: `${input.timelineCount} recent event${input.timelineCount === 1 ? '' : 's'} · wake ${input.wakeLockStatus}`,
      tone: input.memoryEnabled ? 'ready' : 'degraded',
    },
  ] as const
}

export function getMicrophonePermissionGuidance(input: {
  micPermission: string
  userAgent: string
}) {
  if (input.micPermission !== 'denied') {
    return 'Approve mic. If no prompt, use site settings.'
  }
  if (/chrome|crios|chromium/i.test(input.userAgent)) {
    return 'Chrome site settings: Mic Allow, then retry.'
  }
  if (/safari/i.test(input.userAgent)) {
    return 'Safari website settings: Mic Allow, then retry.'
  }
  return 'Site settings: Mic Allow, then retry.'
}

export function normalizeLiveKitError(error?: string) {
  const value = error || ''
  if (/expired|token/i.test(value)) return 'LiveKit token expired or invalid'
  if (/network|websocket|timeout|failed to fetch/i.test(value)) {
    return 'LiveKit network connection failed'
  }
  if (/permission|microphone|audio/i.test(value)) {
    return 'Microphone access failed'
  }
  return value || 'LiveKit transport unavailable'
}

function normalizeRealtimeError(error?: string) {
  const value = error || ''
  if (/quota|429|billing/i.test(value)) {
    return 'Realtime quota unavailable.'
  }
  if (/permission|microphone|audio/i.test(value)) return 'Mic unavailable.'
  if (/network|timeout|failed to fetch/i.test(value)) {
    return 'Realtime network unavailable.'
  }
  return 'Realtime unavailable.'
}

export function buildLilySessionSummary(
  messages: Array<LilyMessage>,
  timeline: Array<LilyTimelineEvent>,
) {
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')
  const recentTimeline = timeline
    .slice(0, 3)
    .map((event) => `- ${event.label}: ${event.detail}`)
  return [
    '# LILY session summary',
    '',
    `Last user: ${lastUser?.content || 'none'}`,
    `Last LILY: ${lastAssistant?.content || 'none'}`,
    '',
    'Recent events:',
    recentTimeline.length > 0 ? recentTimeline.join('\n') : '- none',
  ].join('\n')
}

type LiveKitModule = {
  Room: new (options?: Record<string, unknown>) => LiveKitRoom
  RoomEvent: Record<string, string>
  Track: { Source: { Microphone: string } }
}

type LiveKitRoom = {
  connect: (serverUrl: string, token: string) => Promise<void>
  disconnect: () => void
  numParticipants?: number
  remoteParticipants?: Map<string, unknown>
  localParticipant: {
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>
    identity?: string
  }
  on: (event: string, handler: (...args: Array<any>) => void) => LiveKitRoom
}

type LiveKitParticipant = {
  id: string
  label: string
  role: 'tyler' | 'agent' | 'remote'
  audio: 'publishing' | 'subscribed' | 'muted' | 'none'
}

type LiveKitTokenPayload = {
  ok: boolean
  token?: string
  serverUrl?: string
  roomName?: string
  expiresAt?: string
  expiresInSeconds?: number
  error?: string
}

type RealtimeDataChannel = RTCDataChannel & {
  readyState: RTCDataChannelState
}

type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener?: (
    type: 'release',
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void
}

type DustParticle = {
  id: string
  x: number
  y: number
  size: number
  opacity: number
  hue: number
  delay: number
  z?: number
  depth?: number
}

function buildOrbDust(count: number): Array<DustParticle> {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963229728653
    const radius = Math.sqrt((index + 0.5) / count) * 46
    const wobble = Math.sin(index * 1.73) * 4
    return {
      id: `orb-${index}`,
      x: 50 + Math.cos(angle) * (radius + wobble),
      y: 50 + Math.sin(angle) * (radius - wobble * 0.35),
      size: 1.1 + (index % 7) * 0.22,
      opacity: 0.2 + ((index * 13) % 53) / 100,
      hue: 178 + ((index * 19) % 96),
      delay: -index * 0.071,
    }
  })
}

function buildHelixDust(count: number): Array<DustParticle> {
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1)
    const turn = progress * Math.PI * 7.2
    const strand = index % 2 === 0 ? 0 : Math.PI
    const phase = turn + strand
    const depth = Math.cos(phase)
    const radius = 56 + Math.sin(index * 0.67) * 8
    return {
      id: `helix-${index}`,
      x: Math.sin(phase) * radius,
      y: -138 + progress * 276,
      z: depth * 126,
      depth,
      size: 1.4 + (depth + 1) * 0.95 + (index % 5) * 0.12,
      opacity: 0.28 + (depth + 1) * 0.29,
      hue: index % 3 === 0 ? 175 : index % 3 === 1 ? 198 : 292,
      delay: -index * 0.052,
    }
  })
}

const ORB_DUST = buildOrbDust(90)
const HELIX_DUST = buildHelixDust(186)

const STARTER_MESSAGES: Array<LilyMessage> = [
  {
    role: 'assistant',
    content: 'Ready.',
    localOnly: true,
  },
]

export function getSpeechTimeoutMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(30_000, Math.max(4_000, words * 420 + 1_500))
}

function useSpeechSynthesis() {
  return useMemo(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return (text: string) => {
        void text
        return Promise.resolve()
      }
    }
    return (text: string) =>
      new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          window.clearTimeout(timeout)
          resolve()
        }
        const timeout = window.setTimeout(finish, getSpeechTimeoutMs(text))
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.96
        utterance.pitch = 1.08
        utterance.onend = finish
        utterance.onerror = finish
        window.speechSynthesis.speak(utterance)
      })
  }, [])
}

function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  const browserWindow = window as any
  return (
    browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition
  )
}

export function extractWakeCommand(transcript: string): {
  heardWakeWord: boolean
  command: string
} {
  const normalized = transcript
    .trim()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
  const match = normalized.match(/\b(?:hey\s+)?lil(?:y|ly)\b/i)
  if (!match) return { heardWakeWord: false, command: '' }
  return {
    heardWakeWord: true,
    command: normalized.slice(match.index! + match[0].length).trim(),
  }
}

export function isFatalSpeechRecognitionError(error: string): boolean {
  return new Set([
    'audio-capture',
    'not-allowed',
    'service-not-allowed',
    'permission-denied',
  ]).has(error)
}

export function getLiveKitTokenRefreshDelay(
  expiresAt?: string,
  now = Date.now(),
): number | null {
  if (!expiresAt) return null
  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return null
  return Math.max(0, expires - now - 90_000)
}

export function getBrowserVoiceSupportForUserAgent({
  userAgent,
  hasSpeechRecognition,
}: {
  userAgent: string
  hasSpeechRecognition: boolean
}): {
  supported: boolean
  label: string
  detail: string
} {
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
  const isChrome = /chrome|crios|chromium/i.test(userAgent)
  if (hasSpeechRecognition && isChrome) {
    return {
      supported: true,
      label: 'Chrome ready',
      detail: 'Interim transcript after mic approval.',
    }
  }
  if (hasSpeechRecognition && isSafari) {
    return {
      supported: true,
      label: 'Safari ready',
      detail: 'Safari may drop; type if needed.',
    }
  }
  return {
    supported: hasSpeechRecognition,
    label: hasSpeechRecognition ? 'Speech ready' : 'Speech missing',
    detail: hasSpeechRecognition
      ? 'Listen ready.'
      : 'Use Chrome, typed chat, or LiveKit.',
  }
}

function getBrowserVoiceSupport() {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      label: 'Listen unavailable',
      detail: 'Browser required.',
    }
  }
  return getBrowserVoiceSupportForUserAgent({
    userAgent: navigator.userAgent,
    hasSpeechRecognition: Boolean(getSpeechRecognition()),
  })
}

function isPushToTalkIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'button,a,input,textarea,select,[contenteditable="true"],[role="button"],[data-lily-controls]',
    ),
  )
}

function LilyPage() {
  const [config, setConfig] = useState<LilyConfig | null>(null)
  const [messages, setMessages] = useState<Array<LilyMessage>>(STARTER_MESSAGES)
  const [status, setStatus] = useState('Initializing')
  const [typedFallback, setTypedFallback] = useState('')
  const [voiceTestStage, setVoiceTestStage] = useState('Not tested')
  const [, setLastHeardAt] = useState<string | null>(null)
  const [, setLastSpokeAt] = useState<string | null>(null)
  const [retentionMode, setRetentionMode] = useState<
    'session' | 'workspace-memory'
  >('session')
  const [timeline, setTimeline] = useState<Array<LilyTimelineEvent>>([])
  const [voiceMode, setVoiceMode] = useState<
    'idle' | 'armed' | 'listening' | 'thinking' | 'speaking' | 'connected'
  >('idle')
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false)
  const [pushToTalkActive, setPushToTalkActive] = useState(false)
  const [heardWakeWord, setHeardWakeWord] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [liveKitConnected, setLiveKitConnected] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [, setRealtimeStatus] = useState('Realtime not connected')
  const [geminiConnected, setGeminiConnected] = useState(false)
  const [, setGeminiStatus] = useState('Gemini not connected')
  const [micPermission, setMicPermission] = useState<
    'unknown' | 'prompt' | 'requesting' | 'granted' | 'denied'
  >('unknown')
  const [micMuted, setMicMuted] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [speechLevel, setSpeechLevel] = useState(0)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [personality, setPersonality] = useState<LilyPersonality>('concise')
  const [useWorkspaceMemory, setUseWorkspaceMemory] = useState(true)
  const [useConversationMemory, setUseConversationMemory] = useState(true)
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState('No LiveKit token')
  const [participants, setParticipants] = useState<Array<LiveKitParticipant>>([
    { id: 'tyler', label: 'Tyler', role: 'tyler', audio: 'none' },
  ])
  const [wakeLockStatus, setWakeLockStatus] = useState<
    'inactive' | 'active' | 'unsupported' | 'blocked'
  >('inactive')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [lastFailedMessage, setLastFailedMessage] = useState('')
  const audioRootRef = useRef<HTMLDivElement | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const roomRef = useRef<LiveKitRoom | null>(null)
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null)
  const realtimeChannelRef = useRef<RealtimeDataChannel | null>(null)
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null)
  const realtimeAssistantDraftRef = useRef('')
  const realtimeHandledCallIdsRef = useRef<Set<string>>(new Set())
  const realtimeResponseActiveRef = useRef(false)
  const geminiSessionRef = useRef<GeminiLiveSession | null>(null)
  const geminiAssistantDraftRef = useRef('')
  const geminiTurnResolveRef = useRef<((reply: string) => void) | null>(null)
  const geminiTurnRejectRef = useRef<((error: Error) => void) | null>(null)
  const geminiAudioContextRef = useRef<AudioContext | null>(null)
  const geminiAudioCursorRef = useRef(0)
  const currentLiveKitRoomNameRef = useRef<string | null>(null)
  const reconnectingLiveKitRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAnimationRef = useRef<number | null>(null)
  const speechAnimationRef = useRef<number | null>(null)
  const wakeWindowTimeoutRef = useRef<number | null>(null)
  const handsFreeRef = useRef(false)
  const pushToTalkActiveRef = useRef(false)
  const pushToTalkTranscriptRef = useRef('')
  const pushToTalkDraftRef = useRef('')
  const heardWakeWordRef = useRef(false)
  const isSendingRef = useRef(false)
  const restartingRef = useRef(false)
  const speechRecognitionFatalErrorRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const speak = useSpeechSynthesis()
  const browserVoice = useMemo(getBrowserVoiceSupport, [])
  const voiceWorker = config?.voiceWorker
  const visualLevel = Math.max(micLevel, speechLevel)
  const voiceActive =
    handsFreeEnabled ||
    pushToTalkActive ||
    geminiConnected ||
    liveKitConnected ||
    realtimeConnected
  const lastMessage = messages[messages.length - 1]
  const awaitingReply = isSending && lastMessage?.role === 'user'
  const voiceReadiness = getLilyVoiceReadiness({
    configured: Boolean(config?.configured),
    geminiConfigured: Boolean(config?.gemini?.configured),
    realtimeConfigured: Boolean(config?.realtime?.configured),
    micPermission,
    browserSupported: browserVoice.supported,
    workerStatus: voiceWorker?.status,
    tokenStatus,
    liveKitConnected,
    geminiConnected,
    realtimeConnected,
  })
  const lilyCockpitTiles = buildLilyCockpitTiles({
    readiness: voiceReadiness,
    micPermission,
    browserVoiceLabel: browserVoice.label,
    tokenStatus,
    workerStatus: voiceWorker?.status,
    wakeLockStatus,
    memoryEnabled: useWorkspaceMemory,
    conversationMemoryEnabled: useConversationMemory,
    timelineCount: timeline.length,
  })
  const lilyLoopStages = buildLilyVoiceLoopStages({
    handsFreeEnabled,
    pushToTalkActive,
    browserVoiceLabel: browserVoice.label,
    micPermission,
    liveKitConnected,
    realtimeConnected,
    geminiConnected,
    workerStatus: voiceWorker?.status,
    tokenStatus,
    voiceMode,
    isSending,
    lastTestStage: voiceTestStage,
  })
  function addTimeline(event: Omit<LilyTimelineEvent, 'id' | 'createdAt'>) {
    const next: LilyTimelineEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    }
    setTimeline((current) => [next, ...current].slice(0, 8))
  }

  async function persistLilyMemoryEvents(events: Array<LilyMemoryEvent>) {
    if (!useWorkspaceMemory || events.length === 0) return
    await fetch(apiPath('/lily/hermes-chat'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Persist LILY transcript and decision events only. No spoken reply needed.',
          },
        ],
        personality,
        useWorkspaceMemory,
        useConversationMemory: false,
        persistOnly: true,
        memoryEvents: events,
      }),
    }).catch(() => {})
  }

  useEffect(() => {
    handsFreeRef.current = handsFreeEnabled
  }, [handsFreeEnabled])

  useEffect(() => {
    pushToTalkActiveRef.current = pushToTalkActive
  }, [pushToTalkActive])

  useEffect(() => {
    heardWakeWordRef.current = heardWakeWord
  }, [heardWakeWord])

  useEffect(() => {
    isSendingRef.current = isSending
  }, [isSending])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    })
  }, [messages, isSending])

  useEffect(() => {
    if (!config) return
    refreshLiveKitParticipants(
      roomRef.current,
      micMuted ? 'muted' : 'publishing',
    )
  }, [config, micMuted])

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return
    }
    const permissions = (navigator as unknown as Record<string, unknown>)
      .permissions
    if (
      !permissions ||
      typeof (permissions as { query?: unknown }).query !== 'function'
    ) {
      return
    }
    let permissionStatus: PermissionStatus | null = null
    ;(permissions as Permissions)
      .query({ name: 'microphone' as PermissionName })
      .then((microphoneStatus) => {
        permissionStatus = microphoneStatus
        const update = () => {
          setMicPermission(
            microphoneStatus.state === 'granted'
              ? 'granted'
              : microphoneStatus.state === 'denied'
                ? 'denied'
                : 'prompt',
          )
        }
        update()
        microphoneStatus.onchange = update
      })
      .catch(() => {
        setMicPermission('unknown')
      })
    return () => {
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  useEffect(() => {
    if (!liveKitConnected || !tokenExpiresAt) return
    const delay = getLiveKitTokenRefreshDelay(tokenExpiresAt)
    if (delay === null) return
    const timeout = window.setTimeout(() => {
      setTokenStatus('LiveKit token refreshing')
      void connectLiveKit({ reconnect: true })
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [liveKitConnected, tokenExpiresAt])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && handsFreeRef.current) {
        void requestWakeLock()
        if (!recognitionRef.current && !isSendingRef.current) {
          void startHandsFreeListening({ resume: true })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if (isPushToTalkIgnoredTarget(event.target)) return
      event.preventDefault()
      void startPushToTalk()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (isPushToTalkIgnoredTarget(event.target)) return
      event.preventDefault()
      finishPushToTalk()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [browserVoice.supported, isSending])

  useEffect(() => {
    let cancelled = false
    async function loadConfig(options?: { quiet?: boolean }) {
      try {
        const response = await fetch(apiPath('/lily/config'))
        const payload = (await response.json()) as LilyConfig
        if (cancelled) return
        setConfig(payload)
        if (!options?.quiet) {
          setStatus(
            payload.gemini?.configured || payload.configured
              ? 'Ready'
              : 'Voice keys needed',
          )
        }
      } catch (err) {
        if (cancelled) return
        if (!options?.quiet) {
          setError(
            err instanceof Error ? err.message : 'Unable to load LILY config',
          )
          setStatus('Offline')
        }
      }
    }
    void loadConfig()
    const interval = window.setInterval(() => {
      void loadConfig({ quiet: true })
    }, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      roomRef.current?.disconnect()
      disconnectGeminiLive()
      disconnectRealtime()
      recognitionRef.current?.abort?.()
      clearWakeWindow()
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      stopMicMeter()
      stopSpeechPulse()
      void releaseWakeLock()
      handsFreeRef.current = false
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function refreshLiveKitParticipants(
    room: LiveKitRoom | null,
    localAudio: LiveKitParticipant['audio'] = micMuted ? 'muted' : 'publishing',
  ) {
    const next: Array<LiveKitParticipant> = [
      {
        id: 'tyler',
        label: room?.localParticipant.identity || 'Tyler',
        role: 'tyler',
        audio: liveKitConnected || room ? localAudio : 'none',
      },
    ]
    const remotes = room?.remoteParticipants
      ? Array.from(room.remoteParticipants.entries())
      : []
    for (const [id, raw] of remotes) {
      const participant = raw as {
        identity?: string
        name?: string
        audioTrackPublications?: Map<string, unknown>
      }
      const label = participant.name || participant.identity || id
      const agentName = config ? config.agentName.toLowerCase() : 'lily'
      const isAgent =
        label.toLowerCase().includes(agentName) ||
        label.toLowerCase().includes('agent')
      next.push({
        id,
        label,
        role: isAgent ? 'agent' : 'remote',
        audio:
          participant.audioTrackPublications &&
          participant.audioTrackPublications.size > 0
            ? 'subscribed'
            : 'none',
      })
    }
    if (voiceWorker?.status !== 'online') {
      next.push({
        id: 'lily-agent-expected',
        label: `${config?.agentName || 'LILY'} voice agent`,
        role: 'agent',
        audio: 'none',
      })
    }
    setParticipants(next)
  }

  function stopMicMeter() {
    if (micAnimationRef.current !== null) {
      window.cancelAnimationFrame(micAnimationRef.current)
      micAnimationRef.current = null
    }
    void audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    setMicLevel(0)
  }

  function clearWakeWindow() {
    if (wakeWindowTimeoutRef.current !== null) {
      window.clearTimeout(wakeWindowTimeoutRef.current)
      wakeWindowTimeoutRef.current = null
    }
  }

  function armWakeWindow() {
    clearWakeWindow()
    wakeWindowTimeoutRef.current = window.setTimeout(() => {
      wakeWindowTimeoutRef.current = null
      heardWakeWordRef.current = false
      setHeardWakeWord(false)
      setLiveTranscript('')
      if (handsFreeRef.current && !isSendingRef.current) {
        setVoiceMode('listening')
        setStatus('Listening')
      }
    }, 8_000)
  }

  function stopHandsFreeAfterSpeechError(speechError: string) {
    handsFreeRef.current = false
    pushToTalkActiveRef.current = false
    clearWakeWindow()
    setHandsFreeEnabled(false)
    setPushToTalkActive(false)
    heardWakeWordRef.current = false
    setHeardWakeWord(false)
    setLiveTranscript('')
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null
    stopMicMeter()
    void releaseWakeLock()
    setVoiceMode(liveKitConnected ? 'connected' : 'idle')
    setStatus(
      speechError === 'not-allowed' || speechError === 'permission-denied'
        ? 'Microphone permission blocked'
        : 'Browser listening stopped',
    )
  }

  function startSpeechPulse(text: string) {
    stopSpeechPulse()
    if (typeof window === 'undefined') return
    const started = performance.now()
    const syllableWeight = Math.max(0.2, Math.min(1, text.length / 220))
    const animate = (now: number) => {
      const elapsed = (now - started) / 1000
      const wave =
        0.28 +
        Math.abs(Math.sin(elapsed * 7.3)) * 0.38 +
        Math.abs(Math.sin(elapsed * 13.1 + 0.6)) * 0.18
      setSpeechLevel(Math.min(1, wave * syllableWeight + 0.08))
      speechAnimationRef.current = window.requestAnimationFrame(animate)
    }
    speechAnimationRef.current = window.requestAnimationFrame(animate)
  }

  function stopSpeechPulse() {
    if (speechAnimationRef.current !== null) {
      window.cancelAnimationFrame(speechAnimationRef.current)
      speechAnimationRef.current = null
    }
    setSpeechLevel(0)
  }

  async function requestWakeLock() {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
      return
    }
    const wakeLock = (
      navigator as unknown as {
        wakeLock?: {
          request?: (type: 'screen') => Promise<WakeLockSentinelLike>
        }
      }
    ).wakeLock
    if (typeof wakeLock?.request !== 'function') {
      setWakeLockStatus('unsupported')
      return
    }
    if (document.visibilityState !== 'visible') {
      setWakeLockStatus('blocked')
      return
    }
    try {
      wakeLockRef.current = await wakeLock.request('screen')
      wakeLockRef.current.addEventListener?.(
        'release',
        () => {
          wakeLockRef.current = null
          setWakeLockStatus('inactive')
        },
        { once: true },
      )
      setWakeLockStatus('active')
    } catch {
      wakeLockRef.current = null
      setWakeLockStatus('blocked')
    }
  }

  async function releaseWakeLock() {
    const wakeLock = wakeLockRef.current
    wakeLockRef.current = null
    if (wakeLock) {
      await wakeLock.release().catch(() => {})
    }
    setWakeLockStatus('inactive')
  }

  function startMicMeter(stream: MediaStream) {
    if (typeof window === 'undefined') return
    stopMicMeter()
    const context = new window.AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.78
    const source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    const samples = new Uint8Array(analyser.frequencyBinCount)
    audioContextRef.current = context

    const read = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const centered = (sample - 128) / 128
        sum += centered * centered
      }
      const rms = Math.sqrt(sum / samples.length)
      setMicLevel(Math.min(1, Math.max(0, rms * 4)))
      micAnimationRef.current = window.requestAnimationFrame(read)
    }
    read()
  }

  function sendRealtimeEvent(event: Record<string, unknown>) {
    const channel = realtimeChannelRef.current
    if (!channel || channel.readyState !== 'open') return false
    channel.send(JSON.stringify(event))
    return true
  }

  function setRealtimeMicEnabled(enabled: boolean) {
    micStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  function shouldTryVoiceProvider(
    provider: NonNullable<LilyConfig['voiceProvider']>,
  ) {
    const configuredProvider = config?.voiceProvider || 'auto'
    return configuredProvider === 'auto' || configuredProvider === provider
  }

  async function handleRealtimeHermesTool(event: Record<string, unknown>) {
    const callId = typeof event.call_id === 'string' ? event.call_id : ''
    const name = typeof event.name === 'string' ? event.name : ''
    if (!callId || name !== 'ask_hermes_workspace') return
    if (realtimeHandledCallIdsRef.current.has(callId)) return
    realtimeHandledCallIdsRef.current.add(callId)

    let request = ''
    try {
      const args =
        typeof event.arguments === 'string'
          ? (JSON.parse(event.arguments) as Record<string, unknown>)
          : {}
      request = typeof args.request === 'string' ? args.request.trim() : ''
    } catch {
      request = ''
    }

    const toolMessages: Array<LilyMessage> = [
      {
        role: 'user',
        content: request || 'Handle the current Hermes Workspace request.',
      },
    ]
    try {
      const response = await fetch(apiPath('/lily/hermes-chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: toolMessages,
          model: selectedModel,
          personality,
          useWorkspaceMemory,
          useConversationMemory: false,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        reply?: string
        error?: string
      }
      const output =
        response.ok && payload.ok
          ? payload.reply || 'Hermes completed the request.'
          : payload.error || `Hermes returned HTTP ${response.status}`
      sendRealtimeEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output,
        },
      })
      sendRealtimeEvent({ type: 'response.create' })
    } catch (error) {
      sendRealtimeEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output:
            error instanceof Error
              ? `Hermes delegation failed: ${error.message}`
              : 'Hermes delegation failed.',
        },
      })
      sendRealtimeEvent({ type: 'response.create' })
    }
  }

  async function askHermesWorkspace(request: string): Promise<string> {
    const toolMessages: Array<LilyMessage> = [
      {
        role: 'user',
        content: request || 'Handle the current Hermes Workspace request.',
      },
    ]
    const response = await fetch(apiPath('/lily/hermes-chat'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: toolMessages,
        model: selectedModel,
        personality,
        useWorkspaceMemory,
        useConversationMemory: false,
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      reply?: string
      error?: string
    }
    if (!response.ok || !payload.ok) {
      throw new Error(
        payload.error || `Hermes returned HTTP ${response.status}`,
      )
    }
    return payload.reply || 'Hermes completed the request.'
  }

  function getGeminiAudioContext() {
    const ExistingAudioContext =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!ExistingAudioContext) return null
    if (!geminiAudioContextRef.current) {
      geminiAudioContextRef.current = new ExistingAudioContext()
    }
    return geminiAudioContextRef.current
  }

  function playGeminiPcmAudio(base64Audio: string) {
    if (!base64Audio) return
    const audioContext = getGeminiAudioContext()
    if (!audioContext) return
    void audioContext.resume()
    const raw = window.atob(base64Audio)
    const samples = new Int16Array(raw.length / 2)
    for (let index = 0; index < samples.length; index += 1) {
      const low = raw.charCodeAt(index * 2)
      const high = raw.charCodeAt(index * 2 + 1)
      const value = (high << 8) | low
      samples[index] = value >= 0x8000 ? value - 0x10000 : value
    }
    const sampleRate = 24_000
    const buffer = audioContext.createBuffer(1, samples.length, sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < samples.length; index += 1) {
      channel[index] = samples[index] / 32768
    }
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)
    const now = audioContext.currentTime
    const startsAt = Math.max(now + 0.02, geminiAudioCursorRef.current)
    geminiAudioCursorRef.current = startsAt + buffer.duration
    source.start(startsAt)
    setStatus('Replying')
    setVoiceMode('speaking')
    source.onended = () => {
      if (audioContext.currentTime + 0.05 >= geminiAudioCursorRef.current) {
        stopSpeechPulse()
        setStatus(handsFreeRef.current ? 'Listening' : 'Gemini ready')
        setVoiceMode(handsFreeRef.current ? 'listening' : 'connected')
      }
    }
  }

  async function handleGeminiToolCalls(
    functionCalls: NonNullable<
      NonNullable<GeminiLiveServerMessage['toolCall']>['functionCalls']
    >,
  ) {
    const responses = await Promise.all(
      functionCalls.map(async (call) => {
        const request =
          typeof call.args?.request === 'string' ? call.args.request.trim() : ''
        try {
          const output = await askHermesWorkspace(request)
          return {
            id: call.id,
            name: call.name || 'ask_hermes_workspace',
            response: { output },
          }
        } catch (error) {
          return {
            id: call.id,
            name: call.name || 'ask_hermes_workspace',
            response: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Hermes delegation failed.',
            },
          }
        }
      }),
    )
    geminiSessionRef.current?.sendToolResponse({ functionResponses: responses })
  }

  function handleGeminiLiveMessage(message: GeminiLiveServerMessage) {
    const outputText = message.serverContent?.outputTranscription?.text?.trim()
    if (outputText) {
      geminiAssistantDraftRef.current = [
        geminiAssistantDraftRef.current,
        outputText,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    if (message.text?.trim()) {
      geminiAssistantDraftRef.current = [
        geminiAssistantDraftRef.current,
        message.text.trim(),
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    if (message.data) {
      startSpeechPulse('Gemini audio')
      playGeminiPcmAudio(message.data)
    }
    if (message.toolCall?.functionCalls?.length) {
      void handleGeminiToolCalls(message.toolCall.functionCalls)
    }
    if (message.serverContent?.interrupted) {
      geminiAssistantDraftRef.current = ''
      stopSpeechPulse()
      setStatus('Interrupted')
      setVoiceMode(handsFreeRef.current ? 'listening' : 'connected')
    }
    if (message.serverContent?.turnComplete) {
      const reply = geminiAssistantDraftRef.current.trim()
      geminiTurnResolveRef.current?.(reply || 'I am here.')
      geminiTurnResolveRef.current = null
      geminiTurnRejectRef.current = null
      setLastSpokeAt(new Date().toISOString())
    }
  }

  async function connectGeminiLive() {
    if (geminiConnected && geminiSessionRef.current) return true
    if (!config?.gemini?.configured) return false
    setError('')
    setStatus('Opening Gemini voice')
    setGeminiStatus('Opening Gemini Live')
    setVoiceMode('thinking')
    try {
      const response = await fetch(apiPath('/lily/gemini-live-token'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      const payload = (await response.json()) as {
        ok?: boolean
        token?: string
        model?: string
        error?: string
      }
      if (!response.ok || !payload.ok || !payload.token) {
        throw new Error(payload.error || 'Gemini Live token failed')
      }
      const model = payload.model || config.gemini.model
      const modelName = model.startsWith('models/') ? model : `models/${model}`
      const socket = await new Promise<WebSocket>((resolve, reject) => {
        const websocket = new WebSocket(
          `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(
            payload.token || '',
          )}`,
        )
        const timeout = window.setTimeout(() => {
          reject(new Error('Gemini Live connection timed out'))
          websocket.close()
        }, 10_000)
        websocket.onopen = () => {
          window.clearTimeout(timeout)
          websocket.send(
            JSON.stringify({
              setup: {
                model: modelName,
                generationConfig: {
                  responseModalities: ['AUDIO'],
                },
              },
            }),
          )
          resolve(websocket)
        }
        websocket.onerror = () => {
          window.clearTimeout(timeout)
          reject(new Error('Gemini Live WebSocket failed'))
        }
      })
      socket.onmessage = (event) => {
        try {
          handleGeminiLiveMessage(
            JSON.parse(event.data) as GeminiLiveServerMessage,
          )
        } catch {
          // Ignore non-JSON Gemini diagnostics.
        }
      }
      socket.onerror = () => {
        setGeminiStatus('Gemini error')
        geminiTurnRejectRef.current?.(new Error('Gemini Live WebSocket failed'))
      }
      socket.onclose = () => {
        setGeminiConnected(false)
        setGeminiStatus('Gemini not connected')
        if (!handsFreeRef.current && !pushToTalkActiveRef.current) {
          setVoiceMode(liveKitConnected ? 'connected' : 'idle')
        }
      }
      const session: GeminiLiveSession = {
        sendClientContent: (params) => {
          socket.send(
            JSON.stringify({
              clientContent: {
                turns: params.turns ? [params.turns] : undefined,
                turnComplete: params.turnComplete ?? true,
              },
            }),
          )
        },
        sendToolResponse: (params) => {
          socket.send(
            JSON.stringify({
              toolResponse: {
                functionResponses: params.functionResponses,
              },
            }),
          )
        },
        close: () => socket.close(),
      }
      geminiSessionRef.current = session
      setGeminiConnected(true)
      setGeminiStatus('Gemini connected')
      return true
    } catch (error) {
      disconnectGeminiLive()
      setStatus('Gemini unavailable')
      setGeminiStatus('Gemini unavailable')
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setError(error instanceof Error ? error.message : 'Gemini Live failed')
      return false
    }
  }

  function disconnectGeminiLive() {
    geminiSessionRef.current?.close()
    geminiSessionRef.current = null
    geminiTurnRejectRef.current?.(new Error('Gemini Live disconnected'))
    geminiTurnResolveRef.current = null
    geminiTurnRejectRef.current = null
    geminiAssistantDraftRef.current = ''
    geminiAudioCursorRef.current = 0
    setGeminiConnected(false)
    setGeminiStatus('Gemini not connected')
  }

  async function sendGeminiTextTurn(
    content: string,
    nextMessages: Array<LilyMessage>,
    options?: { resumeHandsFree?: boolean },
  ) {
    const session = geminiSessionRef.current
    if (!session) return false
    geminiAssistantDraftRef.current = ''
    setStatus('Thinking')
    setVoiceMode('thinking')
    const reply = await new Promise<string>((resolve, reject) => {
      geminiTurnResolveRef.current = resolve
      geminiTurnRejectRef.current = reject
      window.setTimeout(() => {
        if (geminiTurnRejectRef.current === reject) {
          reject(new Error('Gemini Live timed out'))
        }
      }, 45_000)
      session.sendClientContent({
        turns: { role: 'user', parts: [{ text: content }] },
        turnComplete: true,
      })
    })
    setMessages([...nextMessages, { role: 'assistant', content: reply }])
    addTimeline({
      kind: 'transcript',
      label: 'Gemini voice prompt',
      detail: content,
    })
    setLastFailedMessage('')
    if (options?.resumeHandsFree && handsFreeRef.current) {
      window.setTimeout(() => {
        setStatus('Listening')
        setVoiceMode('listening')
        void startHandsFreeListening({ resume: true })
      }, 250)
    } else {
      setStatus('Gemini ready')
      setVoiceMode('connected')
    }
    return true
  }

  function handleRealtimeEvent(event: Record<string, unknown>) {
    const type = typeof event.type === 'string' ? event.type : ''
    if (!type) return
    if (type === 'session.created' || type === 'session.updated') {
      setRealtimeStatus('Realtime ready')
      return
    }
    if (type === 'input_audio_buffer.speech_started') {
      setStatus('Listening')
      setVoiceMode('listening')
      return
    }
    if (type === 'input_audio_buffer.committed') {
      setStatus('Thinking')
      setVoiceMode('thinking')
      return
    }
    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript =
        typeof event.transcript === 'string' ? event.transcript.trim() : ''
      if (!transcript) return
      setLastHeardAt(new Date().toISOString())
      setLiveTranscript(transcript)
      addTimeline({
        kind: 'transcript',
        label: 'Heard',
        detail: transcript,
      })
      setMessages((current) => [
        ...current,
        { role: 'user', content: transcript },
      ])
      return
    }
    if (type === 'response.created') {
      realtimeResponseActiveRef.current = true
      realtimeAssistantDraftRef.current = ''
      setStatus('Replying')
      setVoiceMode('speaking')
      return
    }
    if (type === 'response.audio_transcript.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      if (!delta) return
      realtimeAssistantDraftRef.current += delta
      return
    }
    if (
      type === 'response.audio_transcript.done' ||
      type === 'response.output_text.done'
    ) {
      const transcript =
        typeof event.transcript === 'string'
          ? event.transcript.trim()
          : typeof event.text === 'string'
            ? event.text.trim()
            : realtimeAssistantDraftRef.current.trim()
      if (transcript) {
        realtimeAssistantDraftRef.current = transcript
        setMessages((current) => [
          ...current,
          { role: 'assistant', content: transcript },
        ])
      }
      return
    }
    if (type === 'response.function_call_arguments.done') {
      void handleRealtimeHermesTool(event)
      return
    }
    if (type === 'response.done') {
      realtimeResponseActiveRef.current = false
      const reply = realtimeAssistantDraftRef.current.trim()
      if (reply) {
        setLastSpokeAt(new Date().toISOString())
      }
      setStatus(pushToTalkActiveRef.current ? 'Hold to talk' : 'Realtime ready')
      setVoiceMode(pushToTalkActiveRef.current ? 'listening' : 'connected')
      return
    }
    if (type === 'response.cancelled') {
      realtimeResponseActiveRef.current = false
      setRealtimeStatus('Realtime reply interrupted')
      setStatus('Interrupted')
      setVoiceMode(pushToTalkActiveRef.current ? 'listening' : 'connected')
      return
    }
    if (type === 'error') {
      const error = event.error as { message?: string } | undefined
      setError(error?.message || 'OpenAI Realtime returned an error')
      setRealtimeStatus('Realtime error')
    }
  }

  async function connectRealtime() {
    if (realtimeConnected) return true
    if (!config?.realtime?.configured) return false
    if (!(await ensureMicrophonePermission())) return false
    if (typeof RTCPeerConnection === 'undefined') {
      setError('This browser does not support WebRTC Realtime voice.')
      return false
    }

    setError('')
    setStatus('Opening Realtime voice')
    setRealtimeStatus('Opening OpenAI Realtime')
    setVoiceMode('thinking')

    try {
      disconnectRealtime()
      const peer = new RTCPeerConnection()
      realtimePeerRef.current = peer
      const channel = peer.createDataChannel(
        'oai-events',
      ) as RealtimeDataChannel
      realtimeChannelRef.current = channel
      realtimeHandledCallIdsRef.current = new Set()

      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', 'true')
      audio.addEventListener('playing', () => {
        setStatus('Replying')
        setVoiceMode('speaking')
      })
      audio.addEventListener('ended', () => {
        setStatus('Realtime ready')
        setVoiceMode('connected')
      })
      realtimeAudioRef.current = audio
      audioRootRef.current?.appendChild(audio)

      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0]
      }
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setRealtimeConnected(true)
          setRealtimeStatus('Realtime connected')
          setStatus('Realtime ready')
          setVoiceMode('connected')
        }
        if (
          peer.connectionState === 'failed' ||
          peer.connectionState === 'disconnected' ||
          peer.connectionState === 'closed'
        ) {
          setRealtimeConnected(false)
          setRealtimeStatus(`Realtime ${peer.connectionState}`)
          if (!pushToTalkActiveRef.current) {
            setVoiceMode(liveKitConnected ? 'connected' : 'idle')
          }
        }
      }
      channel.addEventListener('open', () => {
        setRealtimeStatus('Realtime ready')
      })
      channel.addEventListener('message', (message) => {
        try {
          handleRealtimeEvent(
            JSON.parse(message.data) as Record<string, unknown>,
          )
        } catch {
          // Ignore malformed Realtime diagnostics.
        }
      })
      micStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = false
        peer.addTrack(track, micStreamRef.current as MediaStream)
      })
      peer.addTransceiver('audio', { direction: 'recvonly' })

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      const response = await fetch(apiPath('/lily/realtime-session'), {
        method: 'POST',
        headers: { 'content-type': 'application/sdp' },
        body: offer.sdp || '',
      })
      const answer = await response.text()
      if (!response.ok) {
        throw new Error(answer || `Realtime session failed ${response.status}`)
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: answer })
      return true
    } catch (error) {
      disconnectRealtime()
      setStatus('Realtime unavailable')
      setRealtimeStatus('Realtime unavailable')
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setError(
        normalizeRealtimeError(error instanceof Error ? error.message : ''),
      )
      return false
    }
  }

  function disconnectRealtime() {
    setRealtimeMicEnabled(false)
    realtimeChannelRef.current?.close()
    realtimeChannelRef.current = null
    realtimePeerRef.current?.close()
    realtimePeerRef.current = null
    realtimeAudioRef.current?.remove()
    realtimeAudioRef.current = null
    realtimeAssistantDraftRef.current = ''
    realtimeResponseActiveRef.current = false
    setRealtimeConnected(false)
    setRealtimeStatus('Realtime not connected')
  }

  async function connectLiveKit(options?: { reconnect?: boolean }) {
    if (!config?.configured) return false
    if (liveKitConnected && !options?.reconnect) return true
    setError('')
    setStatus(
      options?.reconnect
        ? 'Refreshing LiveKit transport'
        : 'Opening LiveKit transport',
    )
    setVoiceMode('thinking')
    try {
      if (options?.reconnect) {
        reconnectingLiveKitRef.current = true
        roomRef.current?.disconnect()
        roomRef.current = null
        setLiveKitConnected(false)
      }
      const tokenResponse = await fetch(apiPath('/lily/livekit-token'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          identity: 'tyler',
          roomName: options?.reconnect
            ? currentLiveKitRoomNameRef.current
            : undefined,
        }),
      })
      const tokenPayload = (await tokenResponse.json()) as LiveKitTokenPayload
      if (!tokenResponse.ok || !tokenPayload.ok || !tokenPayload.token) {
        throw new Error(tokenPayload.error || 'LiveKit token request failed')
      }
      currentLiveKitRoomNameRef.current = tokenPayload.roomName || null
      setTokenExpiresAt(tokenPayload.expiresAt || null)
      setTokenStatus(
        tokenPayload.expiresAt
          ? `Token valid until ${new Date(
              tokenPayload.expiresAt,
            ).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}`
          : 'LiveKit token active',
      )

      const livekit = (await import(
        /* @vite-ignore */ withBasePath('/vendor/livekit-client.esm.mjs')
      )) as LiveKitModule
      const room = new livekit.Room({
        adaptiveStream: true,
        dynacast: true,
      })

      room.on(livekit.RoomEvent.TrackSubscribed, (track: any) => {
        if (
          track?.source !== livekit.Track.Source.Microphone ||
          !audioRootRef.current
        ) {
          return
        }
        const element = track.attach()
        element.autoplay = true
        audioRootRef.current.appendChild(element)
        refreshLiveKitParticipants(room)
      })
      room.on(livekit.RoomEvent.TrackUnsubscribed, (track: any) => {
        track?.detach?.().forEach((element: HTMLElement) => element.remove())
        refreshLiveKitParticipants(room)
      })
      room.on(livekit.RoomEvent.Disconnected, () => {
        if (reconnectingLiveKitRef.current) return
        setLiveKitConnected(false)
        setVoiceMode('idle')
        setStatus('Disconnected')
        setMicMuted(false)
        setTokenStatus('No LiveKit token')
        setTokenExpiresAt(null)
        refreshLiveKitParticipants(null, 'none')
      })
      const participantConnected = livekit.RoomEvent.ParticipantConnected
      const participantDisconnected = livekit.RoomEvent.ParticipantDisconnected
      if (participantConnected) {
        room.on(participantConnected, () => refreshLiveKitParticipants(room))
      }
      if (participantDisconnected) {
        room.on(participantDisconnected, () => refreshLiveKitParticipants(room))
      }

      await room.connect(
        tokenPayload.serverUrl || config.serverUrl,
        tokenPayload.token,
      )
      await room.localParticipant.setMicrophoneEnabled(true)
      roomRef.current = room
      setLiveKitConnected(true)
      setMicMuted(false)
      refreshLiveKitParticipants(room, 'publishing')
      setVoiceMode(handsFreeEnabled ? 'armed' : 'connected')
      setStatus(
        options?.reconnect
          ? `LiveKit transport refreshed: ${
              tokenPayload.roomName || 'LILY room'
            }`
          : `LiveKit transport connected: ${
              tokenPayload.roomName || 'LILY room'
            }`,
      )
      return true
    } catch (err) {
      if (!options?.reconnect) currentLiveKitRoomNameRef.current = null
      setVoiceMode('idle')
      setStatus('LiveKit transport unavailable')
      setTokenStatus('LiveKit token unavailable')
      setError(normalizeLiveKitError(err instanceof Error ? err.message : ''))
      return false
    } finally {
      reconnectingLiveKitRef.current = false
    }
  }

  async function ensureMicrophonePermission(): Promise<boolean> {
    const mediaDevices =
      typeof navigator === 'undefined'
        ? null
        : (navigator as Navigator & { mediaDevices?: MediaDevices })
            .mediaDevices
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      setError('This browser does not expose microphone access to LILY.')
      setMicPermission('denied')
      return false
    }
    try {
      setMicPermission('requesting')
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      startMicMeter(micStreamRef.current)
      setMicPermission('granted')
      setError('')
      return true
    } catch (err) {
      setMicPermission('denied')
      setError(
        err instanceof Error
          ? `Microphone permission failed: ${err.message}`
          : 'Microphone permission was not granted.',
      )
      setHandsFreeEnabled(false)
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setStatus(liveKitConnected ? 'LiveKit transport connected' : 'Ready')
      return false
    }
  }

  function stopRecognition() {
    try {
      recognitionRef.current?.stop?.()
    } catch {
      recognitionRef.current?.abort?.()
    }
  }

  async function sendMessage(
    text: string,
    options?: { resumeHandsFree?: boolean },
  ) {
    const content = text.trim()
    if (!content || isSending) return
    isSendingRef.current = true
    clearWakeWindow()
    stopRecognition()
    setLiveTranscript('')
    heardWakeWordRef.current = false
    setHeardWakeWord(false)
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setIsSending(true)
    setError('')
    setStatus('Thinking')
    setVoiceMode('thinking')
    try {
      if (geminiConnected && geminiSessionRef.current) {
        const sent = await sendGeminiTextTurn(content, nextMessages, options)
        if (sent) return
      }
      const response = await fetch(apiPath('/lily/hermes-chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.filter((message) => !message.localOnly),
          model: selectedModel,
          personality,
          useWorkspaceMemory,
          useConversationMemory,
        }),
      })
      const payload = (await response.json()) as {
        ok: boolean
        reply?: string
        error?: string
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Hermes reply failed')
      }
      const reply = payload.reply || 'I am here.'
      setMessages([...nextMessages, { role: 'assistant', content: reply }])
      const memoryEvents: Array<LilyMemoryEvent> = [
        {
          kind: 'transcript',
          label: 'LILY prompt',
          detail: content,
          source: options?.resumeHandsFree ? 'hands-free' : 'typed',
        },
        {
          kind: 'decision',
          label: 'LILY reply',
          detail: reply,
          source: options?.resumeHandsFree ? 'hands-free' : 'typed',
        },
      ]
      addTimeline({
        kind: 'transcript',
        label: 'Typed or voice prompt',
        detail: content,
      })
      addTimeline({
        kind: useWorkspaceMemory ? 'memory' : 'decision',
        label:
          retentionMode === 'workspace-memory'
            ? 'Workspace memory write pending'
            : 'Session transcript retained',
        detail:
          retentionMode === 'workspace-memory'
            ? 'Persist transcript, decisions, accepted suggestions to Hermes/PAI memory surface.'
            : 'Transcript retained only in this browser session.',
      })
      void persistLilyMemoryEvents(memoryEvents)
      setLastFailedMessage('')
      setStatus(
        options?.resumeHandsFree
          ? 'Speaking'
          : liveKitConnected
            ? 'LiveKit connected'
            : 'Ready',
      )
      setVoiceMode('speaking')
      setLastSpokeAt(new Date().toISOString())
      startSpeechPulse(reply)
      await speak(reply)
      stopSpeechPulse()
      if (options?.resumeHandsFree && handsFreeRef.current) {
        setStatus('Listening')
        setVoiceMode('listening')
        window.setTimeout(() => {
          void startHandsFreeListening({ resume: true })
        }, 250)
      } else {
        setStatus(liveKitConnected ? 'LiveKit connected' : 'Ready')
        setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      }
    } catch (err) {
      stopSpeechPulse()
      setLastFailedMessage(content)
      const errorMessage =
        err instanceof Error ? err.message : 'Unable to reach Hermes'
      setError(errorMessage)
      if (options?.resumeHandsFree && handsFreeRef.current) {
        const spokenError = 'I could not reach Hermes. I am listening again.'
        setStatus('Speaking')
        setVoiceMode('speaking')
        startSpeechPulse(spokenError)
        await speak(spokenError)
        stopSpeechPulse()
        setStatus('Listening')
        setVoiceMode('listening')
        window.setTimeout(() => {
          void startHandsFreeListening({ resume: true })
        }, 350)
      } else {
        setStatus('Fallback unavailable')
        setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      }
    } finally {
      setIsSending(false)
      isSendingRef.current = false
    }
  }

  function handleHandsFreeTranscript(transcript: string) {
    const clean = transcript.trim()
    if (!clean || isSendingRef.current) return
    setLastHeardAt(new Date().toISOString())
    addTimeline({
      kind: 'transcript',
      label: 'Heard',
      detail: clean,
    })
    setLiveTranscript(clean)
    clearWakeWindow()
    heardWakeWordRef.current = true
    setHeardWakeWord(true)
    void sendMessage(clean, { resumeHandsFree: true })
  }

  function handlePushToTalkTranscript(transcript: string, final: boolean) {
    const clean = transcript.trim()
    if (!clean) return
    if (final) {
      pushToTalkTranscriptRef.current = [pushToTalkTranscriptRef.current, clean]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      pushToTalkDraftRef.current = ''
    }
    const display = final
      ? pushToTalkTranscriptRef.current
      : [pushToTalkTranscriptRef.current, clean]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
    if (!final) pushToTalkDraftRef.current = display
    setLiveTranscript(display)
  }

  async function startPushToTalk() {
    if (pushToTalkActiveRef.current || isSendingRef.current) return
    if (
      shouldTryVoiceProvider('openai_realtime') &&
      config?.realtime?.configured
    ) {
      const connected = realtimeConnected || (await connectRealtime())
      if (connected) {
        void requestWakeLock()
        pushToTalkTranscriptRef.current = ''
        pushToTalkDraftRef.current = ''
        pushToTalkActiveRef.current = true
        setPushToTalkActive(true)
        setRealtimeMicEnabled(true)
        setError('')
        setStatus('Hold to talk')
        setVoiceMode('listening')
        sendRealtimeEvent({ type: 'input_audio_buffer.clear' })
        if (realtimeResponseActiveRef.current) {
          sendRealtimeEvent({ type: 'response.cancel' })
          sendRealtimeEvent({ type: 'output_audio_buffer.clear' })
        }
        return
      }
    }
    if (!browserVoice.supported) {
      setError('Realtime unavailable. Use Chrome or type.')
      return
    }
    if (!(await ensureMicrophonePermission())) return
    void requestWakeLock()
    pushToTalkTranscriptRef.current = ''
    pushToTalkDraftRef.current = ''
    pushToTalkActiveRef.current = true
    setPushToTalkActive(true)
    setError('')
    setStatus('Hold to talk')
    setVoiceMode('listening')
    await startHandsFreeListening({ resume: true, pushToTalk: true })
  }

  function finishPushToTalk() {
    if (!pushToTalkActiveRef.current) return
    pushToTalkActiveRef.current = false
    setPushToTalkActive(false)
    if (realtimeConnected) {
      setRealtimeMicEnabled(false)
      sendRealtimeEvent({ type: 'input_audio_buffer.commit' })
      sendRealtimeEvent({ type: 'response.create' })
      setStatus('Thinking')
      setVoiceMode('thinking')
      setLiveTranscript('')
      return
    }
    handsFreeRef.current = false
    setHandsFreeEnabled(false)
    stopRecognition()
    const heard =
      pushToTalkTranscriptRef.current.trim() ||
      pushToTalkDraftRef.current.trim()
    pushToTalkTranscriptRef.current = ''
    pushToTalkDraftRef.current = ''
    if (heard) {
      setLiveTranscript(heard)
      void sendMessage(heard)
      return
    }
    setLiveTranscript('')
    setVoiceMode(liveKitConnected || geminiConnected ? 'connected' : 'idle')
    setStatus(
      geminiConnected
        ? 'Gemini ready'
        : liveKitConnected
          ? 'LiveKit connected'
          : 'Ready',
    )
  }

  async function startHandsFreeListening(options?: {
    resume?: boolean
    pushToTalk?: boolean
  }) {
    if (!options?.resume) {
      if (!(await ensureMicrophonePermission())) return
      void requestWakeLock()
    }
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setError('Mic ready, speech missing. Use Chrome or type.')
      setHandsFreeEnabled(false)
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setStatus('Mic ready; listen unavailable')
      return
    }
    if (restartingRef.current) return
    restartingRef.current = true
    window.setTimeout(() => {
      restartingRef.current = false
    }, 200)
    stopRecognition()
    const recognition = new Recognition()
    speechRecognitionFatalErrorRef.current = false
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onstart = () => {
      setError('')
      setHandsFreeEnabled(true)
      setVoiceMode('listening')
      setStatus(options?.pushToTalk ? 'Hold to talk' : 'Listening')
    }
    recognition.onerror = (event: any) => {
      const speechError = event?.error ? String(event.error) : ''
      if (
        (handsFreeRef.current || pushToTalkActiveRef.current) &&
        speechError === 'no-speech'
      ) {
        return
      }
      if (isFatalSpeechRecognitionError(speechError)) {
        speechRecognitionFatalErrorRef.current = true
        stopHandsFreeAfterSpeechError(speechError)
      } else {
        setVoiceMode(
          handsFreeRef.current || pushToTalkActiveRef.current
            ? 'listening'
            : liveKitConnected
              ? 'connected'
              : 'idle',
        )
        setStatus(
          pushToTalkActiveRef.current
            ? 'Hold to talk'
            : handsFreeRef.current
              ? 'Listening'
              : liveKitConnected
                ? 'LiveKit connected'
                : 'Ready',
        )
      }
      if (speechError !== 'aborted') {
        setError(
          speechError
            ? `Speech recognition: ${speechError}`
            : 'Speech recognition failed',
        )
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      if (speechRecognitionFatalErrorRef.current) {
        speechRecognitionFatalErrorRef.current = false
        return
      }
      if (options?.pushToTalk) {
        if (!pushToTalkActiveRef.current) {
          setVoiceMode(liveKitConnected ? 'connected' : 'idle')
          setStatus(liveKitConnected ? 'LiveKit connected' : 'Ready')
        }
        return
      }
      if (handsFreeRef.current && !isSendingRef.current) {
        window.setTimeout(() => {
          void startHandsFreeListening({ resume: true })
        }, 350)
        return
      }
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setStatus(liveKitConnected ? 'LiveKit connected' : 'Ready')
    }
    recognition.onresult = (event: any) => {
      let interim = ''
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const transcript = event.results?.[index]?.[0]?.transcript
        if (typeof transcript !== 'string') continue
        if (options?.pushToTalk) {
          handlePushToTalkTranscript(
            transcript,
            Boolean(event.results[index].isFinal),
          )
        } else if (event.results[index].isFinal) {
          handleHandsFreeTranscript(transcript)
        } else {
          interim += transcript
        }
      }
      if (interim.trim()) setLiveTranscript(interim.trim())
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      recognitionRef.current = null
      handsFreeRef.current = false
      setHandsFreeEnabled(false)
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
      stopMicMeter()
      void releaseWakeLock()
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setStatus(liveKitConnected ? 'LiveKit connected' : 'Ready')
      if (!options?.resume) {
        setError(
          err instanceof Error ? err.message : 'Unable to start listening',
        )
      }
    }
  }

  function stopHandsFree() {
    handsFreeRef.current = false
    pushToTalkActiveRef.current = false
    setRealtimeMicEnabled(false)
    setHandsFreeEnabled(false)
    setPushToTalkActive(false)
    heardWakeWordRef.current = false
    setHeardWakeWord(false)
    clearWakeWindow()
    setLiveTranscript('')
    stopRecognition()
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null
    stopMicMeter()
    stopSpeechPulse()
    void releaseWakeLock()
    setVoiceMode(liveKitConnected ? 'connected' : 'idle')
    setStatus(liveKitConnected ? 'LiveKit connected' : 'Ready')
  }

  async function toggleLiveKitMute() {
    if (!roomRef.current || !liveKitConnected) return
    const nextMuted = !micMuted
    await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted)
    setMicMuted(nextMuted)
    refreshLiveKitParticipants(
      roomRef.current,
      nextMuted ? 'muted' : 'publishing',
    )
    setStatus(
      nextMuted ? 'LiveKit microphone muted' : 'LiveKit microphone live',
    )
  }

  function disconnectLiveKit() {
    reconnectingLiveKitRef.current = false
    roomRef.current?.disconnect()
    roomRef.current = null
    currentLiveKitRoomNameRef.current = null
    setLiveKitConnected(false)
    setMicMuted(false)
    setTokenExpiresAt(null)
    setTokenStatus('No LiveKit token')
    refreshLiveKitParticipants(null, 'none')
    setVoiceMode(handsFreeEnabled ? 'listening' : 'idle')
    setStatus(handsFreeEnabled ? 'Listening' : 'Ready')
  }

  async function startLilyVoice() {
    const micReady = await ensureMicrophonePermission()
    if (!micReady) return
    if (
      shouldTryVoiceProvider('gemini_live') &&
      config?.gemini?.configured &&
      browserVoice.supported
    ) {
      const connected = await connectGeminiLive()
      if (connected) {
        setError('')
        setStatus('Listening')
        setVoiceMode('listening')
        await startHandsFreeListening({ resume: true })
        return
      }
      setError('')
      setStatus('Starting Hermes')
    }
    if (
      shouldTryVoiceProvider('openai_realtime') &&
      config?.realtime?.configured
    ) {
      const connected = await connectRealtime()
      if (connected) {
        setStatus('Ready')
        setVoiceMode('connected')
        return
      }
      setError('')
      setStatus('Starting Hermes')
    }
    if (
      shouldTryVoiceProvider('livekit') &&
      config?.configured &&
      voiceWorker?.status === 'online'
    ) {
      const connected = await connectLiveKit()
      if (connected) {
        setStatus('Ready')
        setVoiceMode('connected')
        return
      }
      setError('')
      setStatus('Starting Hermes')
    }
    await startHandsFreeListening({ resume: true })
  }

  function stopLilyVoice() {
    stopHandsFree()
    disconnectGeminiLive()
    disconnectRealtime()
    disconnectLiveKit()
  }

  async function testMicrophone() {
    setError('')
    const ok = await ensureMicrophonePermission()
    if (ok) setStatus('Microphone ready')
  }

  async function testSpeaker() {
    setStatus('Testing speaker')
    setVoiceMode('speaking')
    startSpeechPulse('LILY speaker test complete.')
    await speak('LILY speaker test complete.')
    stopSpeechPulse()
    setVoiceMode(
      liveKitConnected || geminiConnected
        ? 'connected'
        : handsFreeEnabled
          ? 'listening'
          : 'idle',
    )
    setStatus(
      geminiConnected
        ? 'Gemini ready'
        : liveKitConnected
          ? 'LiveKit connected'
          : handsFreeEnabled
            ? 'Listening'
            : 'Ready',
    )
  }

  async function testVoiceLoop() {
    setError('')
    setVoiceTestStage('browser: checking microphone permission')
    const micReady = await ensureMicrophonePermission()
    if (!micReady) {
      setVoiceTestStage('failed at browser mic permission')
      addTimeline({
        kind: 'decision',
        label: 'Voice loop test failed',
        detail: 'browser mic permission',
      })
      return
    }
    if (config?.gemini?.configured && browserVoice.supported) {
      setVoiceTestStage('transport: opening Gemini Live')
      const connected = await connectGeminiLive()
      if (!connected) {
        setVoiceTestStage('failed at Gemini Live')
        addTimeline({
          kind: 'decision',
          label: 'Voice loop test failed',
          detail: 'Gemini Live transport',
        })
        return
      }
      setVoiceTestStage('passed: browser mic, Gemini Live, and speaker checked')
      void persistLilyMemoryEvents([
        {
          kind: 'decision',
          label: 'Voice loop test passed',
          detail: 'browser mic, Gemini Live, and speaker checked',
          source: 'test',
        },
      ])
      return
    }
    if (config?.realtime?.configured) {
      setVoiceTestStage('transport: opening OpenAI Realtime')
      const connected = await connectRealtime()
      if (!connected) {
        setVoiceTestStage('failed at OpenAI Realtime WebRTC')
        addTimeline({
          kind: 'decision',
          label: 'Voice loop test failed',
          detail: 'OpenAI Realtime WebRTC',
        })
        return
      }
      setVoiceTestStage(
        'passed: browser mic, OpenAI Realtime, and speaker checked',
      )
      void persistLilyMemoryEvents([
        {
          kind: 'decision',
          label: 'Voice loop test passed',
          detail: 'browser mic, OpenAI Realtime, and speaker checked',
          source: 'test',
        },
      ])
      return
    }
    setVoiceTestStage('worker: checking voice worker')
    if (voiceWorker?.status && voiceWorker.status !== 'online') {
      setVoiceTestStage(`failed at worker online: ${voiceWorker.status}`)
      addTimeline({
        kind: 'decision',
        label: 'Voice loop test failed',
        detail: `worker online: ${voiceWorker.status}`,
      })
      return
    }
    setVoiceTestStage('transport: refreshing LiveKit token')
    if (config?.configured) {
      const connected = await connectLiveKit({ reconnect: liveKitConnected })
      if (!connected) {
        setVoiceTestStage('failed at LiveKit transport/token refresh')
        addTimeline({
          kind: 'decision',
          label: 'Voice loop test failed',
          detail: 'LiveKit transport/token refresh',
        })
        return
      }
    }
    setVoiceTestStage('speaker: testing output')
    await testSpeaker()
    setVoiceTestStage('passed: browser, worker, LiveKit, and speaker checked')
    void persistLilyMemoryEvents([
      {
        kind: 'decision',
        label: 'Voice loop test passed',
        detail: 'browser, worker, LiveKit, and speaker checked',
        source: 'test',
      },
    ])
  }

  async function sendTypedFallback() {
    const value = typedFallback.trim()
    if (!value) return
    setTypedFallback('')
    await sendMessage(value)
  }

  async function copySessionSummary() {
    await navigator.clipboard
      .writeText(buildLilySessionSummary(messages, timeline))
      .catch(() => {})
  }

  return (
    <main className="min-h-full overflow-hidden bg-[#070910] text-slate-100">
      <div className="relative min-h-[calc(100vh-1px)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(244,114,182,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(3,7,18,1))]" />
        <div className="absolute inset-0 lily-starfield" />

        <aside
          data-lily-controls
          className="absolute left-3 right-3 top-3 z-20 grid gap-2 rounded-[24px] border border-white/10 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-xl sm:left-4 sm:right-auto sm:top-4 sm:w-[min(520px,calc(100vw-32px))]"
          aria-label="LILY voice cockpit"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Voice cockpit
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {config?.agentName || 'LILY'} · {voiceReadiness.label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void testVoiceLoop()}
              className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-200/20"
            >
              Test loop
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-2 sm:hidden">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {voiceReadiness.canStart ? 'Ready' : voiceReadiness.blocker}
              </p>
              <p className="truncate text-xs text-slate-300">
                {lilyLoopStages
                  .map((stage) => `${stage.label}: ${stage.value}`)
                  .join(' · ')}
              </p>
            </div>
            <span
              className={`size-3 rounded-full ${
                voiceReadiness.canStart ? 'bg-emerald-300' : 'bg-amber-300'
              }`}
              aria-hidden="true"
            />
          </div>
          <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-4">
            {lilyCockpitTiles.map((tile) => (
              <div
                key={tile.id}
                title={tile.detail}
                className={`min-h-20 rounded-xl border p-2.5 ${
                  tile.tone === 'ready'
                    ? 'border-emerald-300/25 bg-emerald-300/10'
                    : tile.tone === 'unavailable'
                      ? 'border-rose-300/25 bg-rose-300/10'
                      : 'border-amber-300/25 bg-amber-300/10'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                  {tile.label}
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-white">
                  {tile.value}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-300">
                  {tile.detail}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden gap-2 sm:grid sm:grid-cols-4">
            {lilyLoopStages.map((stage) => (
              <div
                key={stage.id}
                title={stage.detail}
                className={`rounded-xl border p-2 ${
                  stage.tone === 'ready'
                    ? 'border-cyan-300/25 bg-cyan-300/10'
                    : stage.tone === 'unavailable'
                      ? 'border-rose-300/25 bg-rose-300/10'
                      : 'border-white/10 bg-white/10'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {stage.label}
                </div>
                <div className="mt-1 truncate text-xs font-semibold text-white">
                  {stage.value}
                </div>
                <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-300">
                  {stage.detail}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex flex-wrap gap-1.5">
              {LILY_CONVERSATION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTypedFallback(preset.prompt)}
                  className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-100 transition hover:bg-white/15"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void copySessionSummary()}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/15"
            >
              Copy summary
            </button>
          </div>
        </aside>

        <section
          className="relative flex min-h-[calc(100vh-1px)] items-center justify-center px-4 pb-5 pt-52 sm:px-6 sm:pt-48 lg:px-8"
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return
            if (isPushToTalkIgnoredTarget(event.target)) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            event.preventDefault()
            void startPushToTalk()
          }}
          onPointerUp={(event) => {
            if (isPushToTalkIgnoredTarget(event.target)) return
            event.currentTarget.releasePointerCapture?.(event.pointerId)
            finishPushToTalk()
          }}
          onPointerCancel={() => finishPushToTalk()}
          onPointerLeave={() => finishPushToTalk()}
        >
          <div className="flex min-h-[min(720px,calc(100vh-32px))] w-full max-w-3xl flex-col items-center justify-center p-3 text-center sm:p-5">
            <div
              className={`lily-orb lily-orb-${voiceMode}`}
              style={
                {
                  '--lily-mic-level': visualLevel.toFixed(3),
                } as CSSProperties
              }
              data-state={voiceMode}
              aria-hidden="true"
            >
              <span className="lily-dust-sphere">
                {ORB_DUST.map((particle) => (
                  <span
                    key={particle.id}
                    className="lily-orb-particle"
                    style={
                      {
                        '--x': `${particle.x}%`,
                        '--y': `${particle.y}%`,
                        '--size': `${particle.size}px`,
                        '--opacity': particle.opacity,
                        '--hue': particle.hue,
                        '--delay': `${particle.delay}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
              <span className="lily-helix" aria-hidden="true">
                {HELIX_DUST.map((particle) => (
                  <span
                    key={particle.id}
                    className="lily-helix-particle"
                    style={
                      {
                        '--x': `${particle.x}px`,
                        '--y': `${particle.y}px`,
                        '--z': `${particle.z || 0}px`,
                        '--depth': particle.depth || 0,
                        '--size': `${particle.size}px`,
                        '--opacity': particle.opacity,
                        '--hue': particle.hue,
                        '--delay': `${particle.delay}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            </div>
            <div className="mt-4 flex w-full flex-col items-center">
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">
                LILY
              </h1>
              <div className="mt-3 min-h-6 text-sm text-slate-300">
                {pushToTalkActive ? 'Listening' : status}
              </div>
              <button
                type="button"
                data-testid="lily-mic-control"
                aria-label={
                  voiceActive
                    ? 'Stop LILY voice session'
                    : 'Approve microphone and start LILY'
                }
                onClick={() =>
                  voiceActive ? stopLilyVoice() : void startLilyVoice()
                }
                disabled={!voiceActive && !voiceReadiness.canStart}
                className={`mt-4 hidden min-h-12 rounded-full px-7 text-sm font-semibold transition sm:inline-flex sm:min-w-56 sm:items-center sm:justify-center ${
                  voiceActive
                    ? 'border border-rose-300/40 bg-rose-300/10 text-rose-100 hover:bg-rose-300/20'
                    : voiceReadiness.canStart
                      ? 'border border-emerald-200/60 bg-emerald-300 text-slate-950 shadow-[0_0_42px_rgba(110,231,183,0.28)] hover:bg-emerald-200'
                      : 'cursor-not-allowed border border-white/10 bg-white/10 text-slate-400'
                }`}
              >
                {voiceActive ? 'Stop' : 'Start conversation'}
              </button>
              {!voiceActive && !voiceReadiness.canStart ? (
                <div className="mt-2 text-xs text-amber-100">
                  {voiceReadiness.blocker}
                </div>
              ) : null}

              <div className="mt-3 hidden items-center justify-center gap-2 text-xs text-slate-300 sm:flex">
                <button
                  type="button"
                  onClick={() => void testMicrophone()}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 hover:bg-white/15"
                >
                  Mic
                </button>
                <button
                  type="button"
                  onClick={() => void testSpeaker()}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 hover:bg-white/15"
                >
                  Speaker
                </button>
              </div>

              {liveTranscript ? (
                <div className="mt-4 max-w-xl rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-50">
                  {liveTranscript}
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 max-w-xl rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <div
                className="mt-4 w-full max-w-xl text-center"
                aria-live="polite"
              >
                {awaitingReply || !lastMessage?.localOnly ? (
                  <div className="min-h-12 text-base leading-7 text-slate-100 sm:text-lg">
                    {awaitingReply ? 'Thinking...' : lastMessage?.content}
                  </div>
                ) : null}
                <form
                  className="mt-3 hidden gap-2 sm:flex"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void sendTypedFallback()
                  }}
                >
                  <input
                    value={typedFallback}
                    onChange={(event) => setTypedFallback(event.target.value)}
                    placeholder="Type fallback"
                    className="min-h-11 flex-1 rounded-full border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-200/70"
                    aria-label="Message LILY"
                  />
                  <button
                    type="submit"
                    disabled={!typedFallback.trim() || isSending}
                    className="min-h-11 rounded-full bg-emerald-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Send
                  </button>
                </form>
              </div>

              <div
                className="mt-3 flex h-8 items-end justify-center gap-1"
                aria-label={`Microphone level ${Math.round(micLevel * 100)} percent`}
              >
                {Array.from({ length: 14 }).map((_, index) => {
                  const threshold = (index + 1) / 14
                  const lit = micLevel >= threshold * 0.72
                  const height = 8 + Math.sin((index / 13) * Math.PI) * 24
                  return (
                    <span
                      key={index}
                      className={`w-1.5 rounded-full transition-colors ${
                        lit ? 'bg-emerald-200' : 'bg-white/15'
                      }`}
                      style={{
                        height: `${height + micLevel * 20}px`,
                        opacity: lit ? 0.95 : 0.35,
                      }}
                    />
                  )
                })}
              </div>
            </div>
            <div ref={audioRootRef} className="sr-only" aria-hidden="true" />
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h,80px)+0.75rem)] z-30 flex justify-center px-4 sm:hidden">
        <button
          type="button"
          aria-label={
            voiceActive
              ? 'Stop LILY voice session'
              : 'Approve microphone and start LILY'
          }
          onClick={() =>
            voiceActive ? stopLilyVoice() : void startLilyVoice()
          }
          disabled={!voiceActive && !voiceReadiness.canStart}
          className={`min-h-12 rounded-full px-6 text-sm font-semibold shadow-2xl ${
            voiceActive
              ? 'border border-rose-300/40 bg-rose-300/90 text-slate-950'
              : voiceReadiness.canStart
                ? 'bg-emerald-300 text-slate-950'
                : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-400'
          }`}
        >
          {voiceActive ? 'Stop' : 'Start'}
        </button>
      </div>

      <style>{`
        .lily-starfield {
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.68) 1px, transparent 1.5px),
            radial-gradient(circle, rgba(34,211,238,0.45) 1px, transparent 1.7px);
          background-size: 72px 72px, 118px 118px;
          background-position: 0 0, 28px 44px;
          opacity: 0.35;
          animation: lily-drift 28s linear infinite;
        }

        .lily-orb {
          position: relative;
          width: min(64vw, 390px);
          aspect-ratio: 1;
          overflow: visible;
          isolation: isolate;
          background: transparent;
          perspective: 900px;
          transform-style: preserve-3d;
          filter:
            drop-shadow(0 0 calc(22px + (var(--lily-mic-level, 0) * 38px)) rgba(34,211,238,0.28))
            drop-shadow(0 0 calc(30px + (var(--lily-mic-level, 0) * 38px)) rgba(217,70,239,0.16));
          transform: scale(calc(0.98 + (var(--lily-mic-level, 0) * 0.06)));
          animation: lily-field-breathe 5.5s ease-in-out infinite;
        }

        .lily-orb::before {
          content: "";
          position: absolute;
          inset: 9%;
          border-radius: 50%;
          border: 1px solid rgba(186,230,253,0.08);
          opacity: calc(0.16 + (var(--lily-mic-level, 0) * 0.28));
          transform: scaleY(0.42) rotate(-10deg);
          animation: lily-orbit-sketch 18s linear infinite;
        }

        .lily-orb::after {
          content: "";
          position: absolute;
          inset: 22%;
          border-radius: 50%;
          border: 1px solid rgba(125,211,252,0.07);
          opacity: calc(0.1 + (var(--lily-mic-level, 0) * 0.24));
          transform: scaleY(0.34) rotate(64deg);
          animation: lily-orbit-sketch 23s linear reverse infinite;
        }

        .lily-dust-sphere,
        .lily-helix {
          position: absolute;
          inset: 0;
          left: 50%;
          top: 50%;
          transform-style: preserve-3d;
          pointer-events: none;
          will-change: transform, filter;
        }

        .lily-dust-sphere {
          width: 100%;
          height: 100%;
          left: 0;
          top: 0;
          opacity: 0.72;
          animation: lily-dust-drift calc(28s - (var(--lily-mic-level, 0) * 10s)) ease-in-out infinite;
        }

        .lily-helix {
          width: 1px;
          height: 1px;
          filter:
            drop-shadow(0 0 calc(7px + (var(--lily-mic-level, 0) * 18px)) rgba(103,232,249,0.78))
            drop-shadow(0 0 20px rgba(217,70,239,0.22));
          transform: rotateX(63deg) rotateZ(-10deg);
          animation: lily-helix-precess calc(18s - (var(--lily-mic-level, 0) * 7s)) ease-in-out infinite;
        }

        .lily-orb-particle,
        .lily-helix-particle {
          position: absolute;
          left: var(--x);
          top: var(--y);
          width: var(--size);
          height: var(--size);
          border-radius: 999px;
          opacity: calc((var(--opacity) * 0.78) + (var(--lily-mic-level, 0) * 0.38));
          background: hsl(var(--hue) 94% 78%);
          box-shadow:
            0 0 calc(5px + (var(--lily-mic-level, 0) * 14px)) hsl(var(--hue) 94% 70% / 0.72),
            0 0 1px rgba(255,255,255,0.96);
          pointer-events: none;
          will-change: transform, opacity, filter;
          animation: lily-particle-twinkle 2.8s ease-in-out infinite;
          animation-delay: var(--delay);
        }

        .lily-orb-particle {
          transform: translate(-50%, -50%) scale(calc(0.62 + (var(--lily-mic-level, 0) * 0.78)));
        }

        .lily-helix-particle {
          left: 0;
          top: 0;
          z-index: 2;
          opacity: calc(var(--opacity) + (var(--lily-mic-level, 0) * 0.42));
          transform:
            translate3d(var(--x), var(--y), var(--z))
            scale(calc((0.76 + ((var(--depth) + 1) * 0.28)) + (var(--lily-mic-level, 0) * 0.55)));
          animation:
            lily-particle-twinkle 2.8s ease-in-out infinite,
            lily-helix-float 6.4s ease-in-out infinite;
          animation-delay: var(--delay), calc(var(--delay) * 1.7);
        }

        .lily-orb-particle:nth-child(11n),
        .lily-helix-particle:nth-child(8n) {
          background: rgba(255,255,255,0.9);
        }

        .lily-orb-particle:nth-child(13n),
        .lily-helix-particle:nth-child(13n) {
          background: rgba(253,230,138,0.9);
        }

        .lily-orb-particle:nth-child(17n),
        .lily-helix-particle:nth-child(17n) {
          background: rgba(244,114,182,0.88);
        }

        .lily-orb-particle:nth-child(19n),
        .lily-helix-particle:nth-child(19n) {
          background: rgba(110,231,183,0.88);
        }

        .lily-orb-particle:nth-child(23n),
        .lily-helix-particle:nth-child(23n) {
          background: rgba(125,211,252,0.92);
        }

        .lily-orb[data-state="idle"] .lily-helix,
        .lily-orb[data-state="idle"] .lily-dust-sphere {
          opacity: 0.76;
        }

        .lily-orb[data-state="armed"] .lily-helix {
          filter:
            drop-shadow(0 0 14px rgba(110,231,183,0.58))
            drop-shadow(0 0 24px rgba(103,232,249,0.22));
          animation-duration: calc(9s - (var(--lily-mic-level, 0) * 4s));
        }

        .lily-orb[data-state="listening"] {
          filter:
            drop-shadow(0 0 calc(34px + (var(--lily-mic-level, 0) * 56px)) rgba(110,231,183,0.48))
            drop-shadow(0 0 24px rgba(103,232,249,0.2));
        }

        .lily-orb[data-state="listening"] .lily-helix {
          filter:
            drop-shadow(0 0 18px rgba(110,231,183,0.78))
            drop-shadow(0 0 28px rgba(103,232,249,0.32));
          animation-duration: calc(10s - (var(--lily-mic-level, 0) * 4s));
          mix-blend-mode: screen;
        }

        .lily-orb[data-state="thinking"] {
          filter:
            drop-shadow(0 0 44px rgba(244,114,182,0.42))
            drop-shadow(0 0 24px rgba(103,232,249,0.18));
          animation-duration: 1.8s;
        }

        .lily-orb[data-state="thinking"] .lily-helix {
          filter:
            drop-shadow(0 0 18px rgba(244,114,182,0.82))
            drop-shadow(0 0 28px rgba(103,232,249,0.38));
          animation-duration: 5.2s;
        }

        .lily-orb[data-state="speaking"],
        .lily-orb[data-state="connected"] {
          filter:
            drop-shadow(0 0 calc(38px + (var(--lily-mic-level, 0) * 62px)) rgba(34,211,238,0.5))
            drop-shadow(0 0 30px rgba(217,70,239,0.26));
        }

        .lily-orb[data-state="speaking"] .lily-helix {
          filter:
            drop-shadow(0 0 18px rgba(103,232,249,0.85))
            drop-shadow(0 0 28px rgba(217,70,239,0.36));
          animation-duration: calc(9s - (var(--lily-mic-level, 0) * 4s));
          mix-blend-mode: screen;
        }

        .lily-orb[data-state="listening"] .lily-dust-sphere,
        .lily-orb[data-state="speaking"] .lily-dust-sphere {
          animation-duration: calc(18s - (var(--lily-mic-level, 0) * 8s));
          mix-blend-mode: screen;
        }

        .lily-orb[data-state="listening"] .lily-helix-particle {
          transform:
            translate3d(calc(var(--x) * 0.82), var(--y), calc(var(--z) * 1.2))
            scale(calc((0.96 + ((var(--depth) + 1) * 0.32)) + (var(--lily-mic-level, 0) * 0.75)));
          animation-duration: 1.25s;
        }

        .lily-orb[data-state="speaking"] .lily-helix-particle {
          transform:
            translate3d(calc(var(--x) * 1.16), calc(var(--y) + (var(--depth) * -10px)), calc(var(--z) * 1.34))
            scale(calc((1.04 + ((var(--depth) + 1) * 0.34)) + (var(--lily-mic-level, 0) * 0.92)));
          animation-duration: 0.95s;
        }

        @keyframes lily-field-breathe {
          0%, 100% {
            filter: saturate(calc(1.05 + (var(--lily-mic-level, 0) * 0.55))) brightness(1);
          }
          50% {
            filter: saturate(calc(1.35 + (var(--lily-mic-level, 0) * 0.8))) brightness(calc(1.03 + (var(--lily-mic-level, 0) * 0.18)));
          }
        }

        @keyframes lily-orbit-sketch {
          0% { transform: scaleY(0.36) rotate(0deg); }
          50% { transform: scaleY(0.5) rotate(180deg); }
          100% { transform: scaleY(0.36) rotate(360deg); }
        }

        @keyframes lily-dust-drift {
          0%, 100% {
            transform: rotate3d(0.4, 1, 0.2, 0deg) scale(1);
          }
          50% {
            transform: rotate3d(0.4, 1, 0.2, 22deg) scale(calc(1.01 + (var(--lily-mic-level, 0) * 0.04)));
          }
        }

        @keyframes lily-helix-precess {
          0%, 100% {
            transform: rotateX(63deg) rotateY(-18deg) rotateZ(-10deg);
          }
          50% {
            transform: rotateX(70deg) rotateY(18deg) rotateZ(10deg);
          }
        }

        @keyframes lily-helix-float {
          0%, 100% {
            margin-top: 0;
            filter: blur(0);
          }
          50% {
            margin-top: calc((var(--depth) + 1) * -1.8px);
            filter: blur(calc((1 - ((var(--depth) + 1) / 2)) * 0.7px));
          }
        }

        @keyframes lily-particle-twinkle {
          0%, 100% { filter: brightness(0.86); }
          45% { filter: brightness(calc(1.25 + (var(--lily-mic-level, 0) * 0.75))); }
        }

        @keyframes lily-drift {
          to { background-position: 72px 72px, 146px 162px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lily-starfield,
          .lily-orb,
          .lily-dust-sphere,
          .lily-helix,
          .lily-orb-particle,
          .lily-helix-particle {
            animation: none;
          }
        }
      `}</style>
    </main>
  )
}

export const Route = createFileRoute('/lily')({
  component: LilyPage,
})
