import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { apiPath, withBasePath } from '@/lib/base-path'

type LilyConfig = {
  ok: boolean
  configured: boolean
  serverUrl: string
  agentName: string
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

type LilyConversationPreset = {
  id: string
  label: string
  prompt: string
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
    label: 'Daily brief',
    prompt:
      'Give me a daily brief: meetings, urgent tasks, waiting replies, and the one thing I should do next.',
  },
  {
    id: 'meeting-prep',
    label: 'Meeting prep',
    prompt:
      'Prep me for the next meeting. Include context, likely decisions, open action items, and risks.',
  },
  {
    id: 'task-triage',
    label: 'Task triage',
    prompt:
      'Triage my tasks into do now, delegate, schedule, and ignore. Call out anything waiting on me.',
  },
  {
    id: 'system-check',
    label: 'System check',
    prompt:
      'Check Hermes workspace health, voice loop readiness, source freshness, and what changed recently.',
  },
]

export function buildLilyDiagnostics(input: {
  micPermission: string
  browserVoiceLabel: string
  liveKitConnected: boolean
  tokenStatus: string
  workerStatus?: string
  status: string
  error?: string
}) {
  return [
    'LILY diagnostics',
    `[browser] mic=${input.micPermission}; speech=${input.browserVoiceLabel}`,
    `[worker] status=${input.workerStatus || 'checking'}`,
    `[network] livekit=${input.liveKitConnected ? 'connected' : 'not connected'}; token=${input.tokenStatus}`,
    `[config] status=${input.status}; error=${input.error || 'none'}`,
  ].join('\n')
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
    return 'Start worker'
  }
  if (/unavailable|refreshing|no livekit token/i.test(input.tokenStatus)) {
    return 'Refresh token'
  }
  if (!input.liveKitConnected) return 'Use typed fallback'
  return 'Voice loop ready'
}

export function getLilyVoiceReadiness(input: {
  configured: boolean
  micPermission: string
  browserSupported: boolean
  workerStatus?: string
  tokenStatus: string
  liveKitConnected: boolean
}) {
  if (input.liveKitConnected) {
    return {
      state: 'ready' as const,
      label: 'Voice ready',
      blocker: 'none',
      canStart: true,
    }
  }
  if (input.micPermission === 'denied') {
    return {
      state: 'unavailable' as const,
      label: 'Voice unavailable',
      blocker: 'Microphone permission is blocked',
      canStart: false,
    }
  }
  if (input.workerStatus && input.workerStatus !== 'online') {
    return {
      state: 'degraded' as const,
      label: 'Voice degraded',
      blocker: `Voice worker is ${input.workerStatus}`,
      canStart: false,
    }
  }
  if (!input.configured && !input.browserSupported) {
    return {
      state: 'unavailable' as const,
      label: 'Voice unavailable',
      blocker: 'LiveKit is not configured and browser speech is unavailable',
      canStart: false,
    }
  }
  if (
    !input.configured ||
    /no livekit token|unavailable/i.test(input.tokenStatus)
  ) {
    return {
      state: 'degraded' as const,
      label: 'Typed fallback active',
      blocker: input.configured
        ? 'LiveKit token is not active yet'
        : 'LiveKit keys are missing',
      canStart: input.browserSupported,
    }
  }
  if (!input.browserSupported) {
    return {
      state: 'degraded' as const,
      label: 'Voice transport only',
      blocker: 'Browser Listen is unavailable',
      canStart: input.configured,
    }
  }
  return {
    state: 'ready' as const,
    label: 'Voice ready',
    blocker: 'none',
    canStart: true,
  }
}

export function getLilySetupChecklist(input: {
  configured: boolean
  micPermission: string
  browserSupported: boolean
  workerStatus?: string
  liveKitConnected: boolean
}) {
  return [
    {
      id: 'microphone',
      label: 'Microphone permission',
      status:
        input.micPermission === 'granted'
          ? 'ready'
          : input.micPermission === 'denied'
            ? 'blocked'
            : 'needs action',
      action:
        input.micPermission === 'denied'
          ? 'Allow microphone in browser site settings, then retry.'
          : 'Approve microphone when prompted.',
    },
    {
      id: 'browser',
      label: 'Browser speech',
      status: input.browserSupported ? 'ready' : 'degraded',
      action: input.browserSupported
        ? 'Browser Listen is available.'
        : 'Use Chrome for wake-word listening, or continue with typed fallback.',
    },
    {
      id: 'worker',
      label: 'LILY voice worker',
      status:
        !input.workerStatus || input.workerStatus === 'online'
          ? 'ready'
          : 'blocked',
      action:
        !input.workerStatus || input.workerStatus === 'online'
          ? 'Worker is reachable.'
          : 'Start the worker before relying on full voice mode.',
    },
    {
      id: 'transport',
      label: 'LiveKit transport',
      status: input.liveKitConnected
        ? 'ready'
        : input.configured
          ? 'needs action'
          : 'degraded',
      action: input.configured
        ? 'Start LILY to issue a fresh token.'
        : 'Configure LiveKit keys in Settings.',
    },
  ]
}

export function getMicrophonePermissionGuidance(input: {
  micPermission: string
  userAgent: string
}) {
  if (input.micPermission !== 'denied') {
    return 'Approve the microphone prompt when it appears. If no prompt appears, open browser site settings for this Workspace URL.'
  }
  if (/chrome|crios|chromium/i.test(input.userAgent)) {
    return 'Chrome: click the site settings icon in the address bar, set Microphone to Allow, then retry LILY.'
  }
  if (/safari/i.test(input.userAgent)) {
    return 'Safari: open Settings for This Website, allow Microphone, then retry LILY.'
  }
  return 'Open this browser site settings, allow Microphone for Hermes Workspace, then retry LILY.'
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

function buildHelixDust(count: number): Array<DustParticle & { z: number }> {
  return Array.from({ length: count }, (_, index) => {
    const turn = (index / (count - 1)) * Math.PI * 5.6
    const strand = index % 2 === 0 ? 0 : Math.PI
    const depth = Math.cos(turn + strand)
    const radius = 19 + Math.sin(index * 0.57) * 2.2
    return {
      id: `helix-${index}`,
      x: 50 + Math.sin(turn + strand) * radius,
      y: 14 + (index / (count - 1)) * 72,
      z: depth,
      size: 1.35 + (depth + 1) * 0.55 + (index % 3) * 0.12,
      opacity: 0.38 + (depth + 1) * 0.24,
      hue: index % 2 === 0 ? 188 : 292,
      delay: -index * 0.045,
    }
  })
}

const ORB_DUST = buildOrbDust(150)
const HELIX_DUST = buildHelixDust(118)

const STARTER_MESSAGES: Array<LilyMessage> = [
  {
    role: 'assistant',
    content: 'I am here. Type or start voice and we can talk back and forth.',
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

function formatCheckedAt(value?: string): string {
  if (!value) return 'not checked'
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return 'not checked'
  const diff = Date.now() - time
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
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
      label: 'Chrome speech recognition ready',
      detail:
        'Browser Listen can stream interim transcripts after mic approval.',
    }
  }
  if (hasSpeechRecognition && isSafari) {
    return {
      supported: true,
      label: 'Safari speech recognition available',
      detail:
        'Safari may stop recognition more aggressively; use typed chat if it drops.',
    }
  }
  return {
    supported: hasSpeechRecognition,
    label: hasSpeechRecognition
      ? 'Speech recognition ready'
      : 'Speech recognition missing',
    detail: hasSpeechRecognition
      ? 'Browser Listen is available.'
      : 'Use Chrome for Browser Listen, or use typed chat and LiveKit transport.',
  }
}

function getBrowserVoiceSupport() {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      label: 'Browser listen unavailable',
      detail: 'Speech recognition is only available in the browser.',
    }
  }
  return getBrowserVoiceSupportForUserAgent({
    userAgent: navigator.userAgent,
    hasSpeechRecognition: Boolean(getSpeechRecognition()),
  })
}

function LilyPage() {
  const [config, setConfig] = useState<LilyConfig | null>(null)
  const [messages, setMessages] = useState<Array<LilyMessage>>(STARTER_MESSAGES)
  const [status, setStatus] = useState('Initializing')
  const [typedFallback, setTypedFallback] = useState('')
  const [voiceTestStage, setVoiceTestStage] = useState('Not tested')
  const [lastHeardAt, setLastHeardAt] = useState<string | null>(null)
  const [lastSpokeAt, setLastSpokeAt] = useState<string | null>(null)
  const [retentionMode, setRetentionMode] = useState<
    'session' | 'workspace-memory'
  >('session')
  const [timeline, setTimeline] = useState<Array<LilyTimelineEvent>>([])
  const [voiceMode, setVoiceMode] = useState<
    'idle' | 'armed' | 'listening' | 'thinking' | 'speaking' | 'connected'
  >('idle')
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false)
  const [heardWakeWord, setHeardWakeWord] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [liveKitConnected, setLiveKitConnected] = useState(false)
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
  const currentLiveKitRoomNameRef = useRef<string | null>(null)
  const reconnectingLiveKitRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAnimationRef = useRef<number | null>(null)
  const speechAnimationRef = useRef<number | null>(null)
  const wakeWindowTimeoutRef = useRef<number | null>(null)
  const handsFreeRef = useRef(false)
  const heardWakeWordRef = useRef(false)
  const isSendingRef = useRef(false)
  const restartingRef = useRef(false)
  const speechRecognitionFatalErrorRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const speak = useSpeechSynthesis()
  const browserVoice = useMemo(getBrowserVoiceSupport, [])
  const voiceWorker = config?.voiceWorker
  const visualLevel = Math.max(micLevel, speechLevel)
  const voiceActive = handsFreeEnabled || liveKitConnected
  const awaitingReply =
    isSending && messages[messages.length - 1]?.role === 'user'
  const failureCta = getLilyFailureCta({
    micPermission,
    browserSupported: browserVoice.supported,
    liveKitConnected,
    workerStatus: voiceWorker?.status,
    tokenStatus,
  })
  const voiceReadiness = getLilyVoiceReadiness({
    configured: Boolean(config?.configured),
    micPermission,
    browserSupported: browserVoice.supported,
    workerStatus: voiceWorker?.status,
    tokenStatus,
    liveKitConnected,
  })
  const setupChecklist = getLilySetupChecklist({
    configured: Boolean(config?.configured),
    micPermission,
    browserSupported: browserVoice.supported,
    workerStatus: voiceWorker?.status,
    liveKitConnected,
  })
  const primaryBlocker =
    setupChecklist.find((item) => item.status === 'blocked') ||
    setupChecklist.find((item) => item.status === 'needs action') ||
    setupChecklist.find((item) => item.status === 'degraded')

  function addTimeline(event: Omit<LilyTimelineEvent, 'id' | 'createdAt'>) {
    const next: LilyTimelineEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    }
    setTimeline((current) => [next, ...current].slice(0, 8))
  }

  useEffect(() => {
    handsFreeRef.current = handsFreeEnabled
  }, [handsFreeEnabled])

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
    let cancelled = false
    async function loadConfig(options?: { quiet?: boolean }) {
      try {
        const response = await fetch(apiPath('/lily/config'))
        const payload = (await response.json()) as LilyConfig
        if (cancelled) return
        setConfig(payload)
        if (!options?.quiet) {
          setStatus(payload.configured ? 'Ready' : 'LiveKit keys needed')
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
        setVoiceMode('armed')
        setStatus('Listening for "LILY"')
      }
    }, 8_000)
  }

  function stopHandsFreeAfterSpeechError(speechError: string) {
    handsFreeRef.current = false
    clearWakeWindow()
    setHandsFreeEnabled(false)
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
        setStatus('Listening for "LILY"')
        setVoiceMode('armed')
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
        setStatus('Listening for "LILY"')
        setVoiceMode('armed')
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
      label: 'Last heard',
      detail: clean,
    })
    setLiveTranscript(clean)
    const wake = extractWakeCommand(clean)
    if (wake.heardWakeWord) {
      clearWakeWindow()
      heardWakeWordRef.current = true
      setHeardWakeWord(true)
      if (wake.command) {
        void sendMessage(wake.command, { resumeHandsFree: true })
        return
      }
      setStatus('I heard LILY. Ask me.')
      setVoiceMode('listening')
      armWakeWindow()
      return
    }
    if (heardWakeWordRef.current) {
      clearWakeWindow()
      void sendMessage(clean, { resumeHandsFree: true })
    }
  }

  async function startHandsFreeListening(options?: { resume?: boolean }) {
    if (!options?.resume) {
      if (!(await ensureMicrophonePermission())) return
      void requestWakeLock()
    }
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setError(
        'Microphone is enabled, but this browser does not provide speech recognition. Use Chrome for wake-word mode, or use the message box with speaker replies.',
      )
      setHandsFreeEnabled(false)
      setVoiceMode(liveKitConnected ? 'connected' : 'idle')
      setStatus('Microphone ready; browser listen unavailable')
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
      setVoiceMode(heardWakeWordRef.current ? 'listening' : 'armed')
      setStatus(heardWakeWordRef.current ? 'Listening' : 'Listening for "LILY"')
    }
    recognition.onerror = (event: any) => {
      const speechError = event?.error ? String(event.error) : ''
      if (handsFreeRef.current && speechError === 'no-speech') {
        return
      }
      if (isFatalSpeechRecognitionError(speechError)) {
        speechRecognitionFatalErrorRef.current = true
        stopHandsFreeAfterSpeechError(speechError)
      } else {
        setVoiceMode(
          handsFreeRef.current
            ? 'armed'
            : liveKitConnected
              ? 'connected'
              : 'idle',
        )
        setStatus(
          handsFreeRef.current
            ? 'Listening for "LILY"'
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
        if (event.results[index].isFinal) {
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
    setHandsFreeEnabled(false)
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
    setVoiceMode(handsFreeEnabled ? 'armed' : 'idle')
    setStatus(handsFreeEnabled ? 'Listening for "LILY"' : 'Ready')
  }

  async function startLilyVoice() {
    const micReady = await ensureMicrophonePermission()
    if (!micReady) return
    if (config?.configured) {
      const connected = await connectLiveKit()
      if (connected) {
        setStatus('LiveKit connected. Speak naturally.')
        setVoiceMode('connected')
        return
      }
    }
    await startHandsFreeListening({ resume: true })
  }

  function stopLilyVoice() {
    stopHandsFree()
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
      liveKitConnected ? 'connected' : handsFreeEnabled ? 'armed' : 'idle',
    )
    setStatus(
      liveKitConnected
        ? 'LiveKit connected'
        : handsFreeEnabled
          ? 'Listening for "LILY"'
          : 'Ready',
    )
  }

  async function testVoiceLoop() {
    setError('')
    setVoiceTestStage('browser: checking microphone permission')
    const micReady = await ensureMicrophonePermission()
    if (!micReady) {
      setVoiceTestStage('failed at browser mic permission')
      return
    }
    setVoiceTestStage('worker: checking voice worker')
    if (voiceWorker?.status && voiceWorker.status !== 'online') {
      setVoiceTestStage(`failed at worker online: ${voiceWorker.status}`)
      return
    }
    setVoiceTestStage('transport: refreshing LiveKit token')
    if (config?.configured) {
      const connected = await connectLiveKit({ reconnect: liveKitConnected })
      if (!connected) {
        setVoiceTestStage('failed at LiveKit transport/token refresh')
        return
      }
    }
    setVoiceTestStage('speaker: testing output')
    await testSpeaker()
    setVoiceTestStage('passed: browser, worker, LiveKit, and speaker checked')
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

        <section className="relative flex min-h-[calc(100vh-1px)] items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-h-[min(700px,calc(100vh-32px))] w-full max-w-3xl flex-col items-center justify-center p-3 text-center sm:p-5">
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
                        '--x': `${particle.x}%`,
                        '--y': `${particle.y}%`,
                        '--z': particle.z,
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
              <div
                className={`mt-3 rounded-full border px-4 py-1 text-xs font-semibold ${
                  voiceReadiness.state === 'ready'
                    ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100'
                    : voiceReadiness.state === 'degraded'
                      ? 'border-amber-300/40 bg-amber-300/10 text-amber-100'
                      : 'border-rose-300/40 bg-rose-300/10 text-rose-100'
                }`}
              >
                {voiceReadiness.label}
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
                className={`mt-4 min-h-12 rounded-full px-6 text-sm font-semibold transition sm:min-w-52 ${
                  voiceActive
                    ? 'border border-rose-300/40 bg-rose-300/10 text-rose-100 hover:bg-rose-300/20'
                    : voiceReadiness.canStart
                      ? 'border border-emerald-200/60 bg-emerald-300 text-slate-950 shadow-[0_0_42px_rgba(110,231,183,0.28)] hover:bg-emerald-200'
                      : 'cursor-not-allowed border border-white/10 bg-white/10 text-slate-400'
                }`}
              >
                {voiceActive ? 'Stop LILY' : 'Start LILY'}
              </button>
              {!voiceActive && !voiceReadiness.canStart ? (
                <div className="mt-2 text-xs text-amber-100">
                  {voiceReadiness.blocker}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-200">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1">
                  {status}
                </span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1">
                  Mic {micPermission}
                </span>
                <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1">
                  Agent {voiceWorker?.status || 'checking'}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Last spoke:{' '}
                  {lastSpokeAt ? formatCheckedAt(lastSpokeAt) : 'none'}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Last heard:{' '}
                  {lastHeardAt ? formatCheckedAt(lastHeardAt) : 'none'}
                </span>
              </div>

              <section className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-left">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                      Voice setup
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Current blocker: {primaryBlocker?.action || 'none'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href={withBasePath('/settings?section=providers')}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-200"
                    >
                      Model settings
                    </a>
                    <a
                      href={withBasePath('/settings?section=voice')}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-200"
                    >
                      Voice settings
                    </a>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {setupChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-3 py-2 ${
                        item.status === 'ready'
                          ? 'border-emerald-300/20 bg-emerald-300/10'
                          : item.status === 'blocked'
                            ? 'border-rose-300/30 bg-rose-400/10'
                            : 'border-amber-300/30 bg-amber-300/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-100">
                          {item.label}
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">
                        {item.action}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {liveTranscript ? (
                <div className="mt-4 max-w-xl rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-50">
                  {liveTranscript}
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 max-w-xl rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                  <div className="mt-2 text-xs text-rose-100/80">
                    {getMicrophonePermissionGuidance({
                      micPermission,
                      userAgent:
                        typeof navigator === 'undefined'
                          ? ''
                          : navigator.userAgent,
                    })}
                  </div>
                </div>
              ) : null}

              <section
                className="mt-4 flex w-full flex-1 flex-col rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-left shadow-2xl shadow-cyan-950/20"
                aria-label="LILY conversation"
              >
                <div
                  className="flex h-[24vh] min-h-40 flex-col gap-3 overflow-y-auto pr-1 sm:h-[28vh]"
                  aria-live="polite"
                >
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}-${message.content.slice(
                        0,
                        24,
                      )}`}
                      className={`flex ${
                        message.role === 'user'
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-emerald-300 text-slate-950'
                            : 'rounded-bl-md border border-white/10 bg-white/[0.08] text-slate-100'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {awaitingReply ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
                        LILY is thinking...
                      </div>
                    </div>
                  ) : null}
                  <div ref={transcriptEndRef} />
                </div>

                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void sendTypedFallback()
                  }}
                >
                  <input
                    value={typedFallback}
                    onChange={(event) => setTypedFallback(event.target.value)}
                    placeholder="Message LILY..."
                    className="min-h-12 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-200/70"
                    aria-label="Message LILY"
                  />
                  <button
                    type="submit"
                    disabled={!typedFallback.trim() || isSending}
                    className="min-h-12 rounded-full bg-emerald-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Send
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {liveKitConnected
                      ? 'Voice transport connected'
                      : browserVoice.supported
                        ? 'Browser voice ready'
                        : 'Typed chat active'}
                  </span>
                  <span>
                    {retentionMode === 'workspace-memory'
                      ? 'Workspace memory on'
                      : 'Session memory'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copySessionSummary()}
                    className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-200"
                  >
                    Copy summary
                  </button>
                </div>
              </section>

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

      <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 sm:hidden">
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
          {voiceActive ? 'Stop LILY' : 'Start LILY'}
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
          width: min(48vw, 270px);
          aspect-ratio: 1;
          border-radius: 999px;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 48%, rgba(226,245,255,0.18), rgba(34,211,238,0.08) 28%, rgba(124,58,237,0.05) 54%, transparent 72%),
            radial-gradient(circle at 50% 50%, transparent 58%, rgba(186,230,253,0.14) 59%, transparent 65%);
          box-shadow:
            0 0 calc(58px + (var(--lily-mic-level, 0) * 80px)) rgba(34,211,238,0.38),
            inset 0 0 54px rgba(125,211,252,0.12),
            inset 0 0 110px rgba(168,85,247,0.08);
          transform: scale(calc(0.985 + (var(--lily-mic-level, 0) * 0.07)));
          animation: lily-orb-breathe 5.5s ease-in-out infinite;
        }

        .lily-orb::before {
          content: "";
          position: absolute;
          inset: 8%;
          border-radius: inherit;
          border: 1px solid rgba(186,230,253,0.14);
          box-shadow:
            inset 0 0 28px rgba(103,232,249,0.18),
            0 0 20px rgba(34,211,238,0.12);
          opacity: calc(0.42 + (var(--lily-mic-level, 0) * 0.42));
          transform: scaleY(0.96) rotateX(62deg);
          animation: lily-shell-precess 12s linear infinite;
        }

        .lily-orb::after {
          content: "";
          position: absolute;
          inset: 18%;
          border-radius: inherit;
          background: radial-gradient(circle, rgba(255,255,255,0.2), transparent 58%);
          filter: blur(18px);
          opacity: calc(0.22 + (var(--lily-mic-level, 0) * 0.45));
          transform: scale(calc(0.82 + (var(--lily-mic-level, 0) * 0.22)));
        }

        .lily-dust-sphere,
        .lily-helix {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          pointer-events: none;
          will-change: transform, filter;
        }

        .lily-dust-sphere {
          animation: lily-dust-sphere-spin calc(34s - (var(--lily-mic-level, 0) * 14s)) linear infinite;
        }

        .lily-helix {
          inset: 9%;
          filter:
            drop-shadow(0 0 calc(8px + (var(--lily-mic-level, 0) * 16px)) rgba(103,232,249,0.72))
            drop-shadow(0 0 22px rgba(217,70,239,0.28));
          animation: lily-helix-rotate calc(13s - (var(--lily-mic-level, 0) * 6s)) linear infinite;
        }

        .lily-orb-particle,
        .lily-helix-particle {
          position: absolute;
          left: var(--x);
          top: var(--y);
          width: var(--size);
          height: var(--size);
          border-radius: 999px;
          opacity: calc(var(--opacity) + (var(--lily-mic-level, 0) * 0.34));
          background: hsl(var(--hue) 94% 78%);
          box-shadow:
            0 0 calc(4px + (var(--lily-mic-level, 0) * 12px)) hsl(var(--hue) 94% 70% / 0.72),
            0 0 1px rgba(255,255,255,0.96);
          pointer-events: none;
          will-change: transform, opacity, filter;
          animation: lily-particle-twinkle 2.8s ease-in-out infinite;
          animation-delay: var(--delay);
        }

        .lily-orb-particle {
          transform: translate(-50%, -50%) scale(calc(0.82 + (var(--lily-mic-level, 0) * 0.7)));
        }

        .lily-helix-particle {
          z-index: 2;
          opacity: calc(var(--opacity) + (var(--lily-mic-level, 0) * 0.42));
          transform:
            translate(-50%, -50%)
            translateZ(calc(var(--z) * 42px))
            scale(calc((1 + var(--z) * 0.16) + (var(--lily-mic-level, 0) * 0.58)));
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
          box-shadow:
            0 0 calc(82px + (var(--lily-mic-level, 0) * 80px)) rgba(52,211,153,0.45),
            inset 0 0 66px rgba(110,231,183,0.16);
        }

        .lily-orb[data-state="listening"] .lily-helix {
          filter:
            drop-shadow(0 0 18px rgba(110,231,183,0.78))
            drop-shadow(0 0 28px rgba(103,232,249,0.32));
          animation-duration: calc(7s - (var(--lily-mic-level, 0) * 3.5s));
          mix-blend-mode: screen;
        }

        .lily-orb[data-state="thinking"] {
          box-shadow:
            0 0 104px rgba(244,114,182,0.42),
            inset 0 0 70px rgba(244,114,182,0.12);
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
          box-shadow:
            0 0 calc(96px + (var(--lily-mic-level, 0) * 92px)) rgba(34,211,238,0.52),
            inset 0 0 78px rgba(255,255,255,0.14);
        }

        .lily-orb[data-state="speaking"] .lily-helix {
          filter:
            drop-shadow(0 0 18px rgba(103,232,249,0.85))
            drop-shadow(0 0 28px rgba(217,70,239,0.36));
          animation-duration: calc(7s - (var(--lily-mic-level, 0) * 3.5s));
          mix-blend-mode: screen;
        }

        .lily-orb[data-state="listening"] .lily-dust-sphere,
        .lily-orb[data-state="speaking"] .lily-dust-sphere {
          animation-duration: calc(18s - (var(--lily-mic-level, 0) * 8s));
          mix-blend-mode: screen;
        }

        .lily-orb[data-state="listening"] .lily-helix-particle,
        .lily-orb[data-state="speaking"] .lily-helix-particle {
          transform:
            translate(-50%, -50%)
            translateZ(calc(var(--z) * 52px))
            scale(calc((1.04 + var(--z) * 0.2) + (var(--lily-mic-level, 0) * 0.76)));
          animation-duration: 1.35s;
        }

        @keyframes lily-orb-breathe {
          0%, 100% {
            filter: saturate(calc(1.05 + (var(--lily-mic-level, 0) * 0.55))) brightness(1);
          }
          50% {
            filter: saturate(calc(1.35 + (var(--lily-mic-level, 0) * 0.8))) brightness(calc(1.03 + (var(--lily-mic-level, 0) * 0.18)));
          }
        }

        @keyframes lily-shell-precess {
          0% { transform: scaleY(0.96) rotateX(62deg) rotateZ(0deg); }
          100% { transform: scaleY(0.96) rotateX(62deg) rotateZ(360deg); }
        }

        @keyframes lily-dust-sphere-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(calc(1.01 + (var(--lily-mic-level, 0) * 0.04))); }
          100% { transform: rotate(360deg) scale(1); }
        }

        @keyframes lily-helix-rotate {
          0% { transform: perspective(680px) rotateX(12deg) rotateY(0deg) rotateZ(-8deg); }
          100% { transform: perspective(680px) rotateX(12deg) rotateY(360deg) rotateZ(-8deg); }
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
