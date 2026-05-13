import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { apiPath } from '@/lib/base-path'
import { Markdown } from '@/components/prompt-kit/markdown'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'

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

type HistoryPair = { q: string; a: string; source?: string; createdAt?: number }

type LilyContextPayload = {
  context?: LilyContext
  generatedAt?: string
  error?: string
}

type LilyParsePayload = {
  content?: string
  source?: string
  error?: string
}

type LilyTranscribePayload = {
  text?: string
  error?: string
}

const STORAGE_KEY = 'workspace-lily-history'
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SYSTEM_PROMPT =
  "You are Lily, Chief of Staff inside Workspace. Be concise, warm, polished, and direct. Sound like someone competent and present, not a generic chatbot. Tyler values speed, clarity, and useful judgment."

function shellClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

function cardClassName() {
  return 'rounded-2xl border border-primary-200 bg-primary-100/70 p-4 dark:border-neutral-800 dark:bg-neutral-900'
}

function loadHistory(): HistoryPair[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return []
    }
    if (!Array.isArray(parsed.history)) return []
    return parsed.history
      .filter(
        (entry): entry is HistoryPair =>
          entry &&
          typeof entry === 'object' &&
          typeof entry.q === 'string' &&
          typeof entry.a === 'string',
      )
      .map((entry) => ({
        q: entry.q,
        a: entry.a,
        source: typeof entry.source === 'string' ? entry.source : undefined,
        createdAt:
          typeof entry.createdAt === 'number' ? entry.createdAt : undefined,
      }))
  } catch {
    return []
  }
}

function saveHistory(history: HistoryPair[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        history: history.slice(-6),
      }),
    )
  } catch {
    // ignore
  }
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning. What should I look at first?'
  if (hour < 18) return 'What needs attention right now?'
  return 'What should we tighten up before tomorrow?'
}

function getSubline(context: LilyContext | null) {
  const hour = new Date().getHours()
  const hasMeetingContext = typeof context?.summary?.meetingsToday === 'number'
  if (hour < 12) {
    return hasMeetingContext
      ? "I've got context on today's meetings and your cron health."
      : "I've got live cron context and can pull today's schedule fast."
  }
  if (hour < 18) {
    return 'I can pull meetings, crons, tickets, or anything else that needs attention.'
  }
  return 'Wrap up the day or line up tomorrow.'
}

function formatRelativeMoment(timestamp: number | null) {
  if (!timestamp) return 'Not refreshed yet'
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return 'Updated just now'
  const mins = Math.round(diffMs / 60_000)
  if (mins < 60) return `Updated ${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Updated ${hrs}h ago`
  return `Updated ${Math.round(hrs / 24)}d ago`
}

function formatSourceLabel(source?: string) {
  if (!source) return 'Reply'
  if (source === 'hermes-gateway') return 'Hermes gateway'
  if (source === 'openai-direct') return 'OpenAI fallback'
  return source.replace(/[-_]/g, ' ')
}

function buildOperatorSnapshot(context: LilyContext | null) {
  if (!context?.summary) return 'Refreshing live context.'
  const summary = context.summary
  if (summary.transientIssue) return summary.transientIssue.summary
  if ((context.recentFailures || []).length > 0) {
    return `${context.recentFailures?.length} recent failure${context.recentFailures?.length === 1 ? '' : 's'} need review.`
  }
  if ((summary.meetingsToday || 0) > 0 && summary.nextMeeting) {
    return `${summary.meetingsToday} meeting${summary.meetingsToday === 1 ? '' : 's'} today. Next: ${summary.nextMeeting.title} at ${summary.nextMeeting.when}.`
  }
  if ((summary.nextJobs || []).length > 0) {
    return `${summary.healthyJobs} jobs healthy. Next up: ${summary.nextJobs?.[0]?.name} ${summary.nextJobs?.[0]?.when}.`
  }
  return 'No immediate operator issues detected.'
}

const SUGGESTED_PROMPTS = [
  'What needs attention right now?',
  "Summarize today's meetings and next job.",
  'What is the biggest operational risk right now?',
  'Give me a short end-of-day operator brief.',
]

export function LilyScreen() {
  const [context, setContext] = useState<LilyContext | null>(null)
  const [history, setHistory] = useState<HistoryPair[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contextLoadedAt, setContextLoadedAt] = useState<number | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [lastTranscript, setLastTranscript] = useState('')
  const requestAbortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  async function loadContext() {
    setRefreshing(true)
    try {
      const response = await fetch(apiPath('/api/ops/lily'))
      const payload = (await response.json()) as LilyContextPayload
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load Lily context')
      }
      startTransition(() => {
        setContext(payload.context || null)
        setContextLoadedAt(
          payload.generatedAt ? new Date(payload.generatedAt).getTime() : Date.now(),
        )
        setError(null)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Lily context')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setHistory(loadHistory())
    void loadContext()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadContext()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
    }
  }, [])

  const latestAnswer = useMemo(
    () => history.length > 0 ? history[history.length - 1] : null,
    [history],
  )
  const operatorSnapshot = useMemo(
    () => buildOperatorSnapshot(context),
    [context],
  )

  function cleanupAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setSpeaking(false)
  }

  async function playAudio(text: string) {
    const cleanText = text.trim()
    if (!cleanText) return
    cleanupAudio()
    if (!audioEnabled) return

    try {
      const response = await fetch(apiPath('/api/ops/lily-speak'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'nova' }),
      })
      if (!response.ok) {
        throw new Error(`Speech failed (${response.status})`)
      }
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioUrlRef.current = audioUrl
      audioRef.current = audio
      audio.onended = () => {
        cleanupAudio()
      }
      audio.onerror = () => {
        cleanupAudio()
        setError('Audio playback failed')
      }
      setSpeaking(true)
      await audio.play()
    } catch (err) {
      cleanupAudio()
      setError(err instanceof Error ? err.message : 'Speech failed')
    }
  }

  const voiceRecorder = useVoiceRecorder({
    maxDurationMs: 90_000,
    onRecorded: async (blob) => {
      setTranscribing(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('audio', new File([blob], 'workspace-lily.webm', { type: blob.type || 'audio/webm' }))
        const response = await fetch(apiPath('/api/ops/lily-transcribe'), {
          method: 'POST',
          body: formData,
        })
        const payload = (await response.json()) as LilyTranscribePayload
        if (!response.ok || !payload.text?.trim()) {
          throw new Error(payload.error || 'Transcription failed')
        }
        const transcript = payload.text.trim()
        setLastTranscript(transcript)
        setInput(transcript)
        await sendPrompt(transcript)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed')
      } finally {
        setTranscribing(false)
      }
    },
    onError: (message) => {
      setError(message)
    },
  })

  async function sendPrompt(prompt: string) {
    const question = prompt.trim()
    if (!question || loading) return

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const recentHistory = history.length
        ? '\n\nRecent conversation:\n' +
          history
            .map((pair) => `Tyler: ${pair.q}\nLily: ${pair.a}`)
            .join('\n\n')
        : ''
      const response = await fetch(apiPath('/api/ops/lily'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemPrompt: `${SYSTEM_PROMPT} Current Workspace context: ${JSON.stringify(
            context || {},
          )}.${recentHistory} Use markdown only when it helps.`,
          prompt: question,
        }),
      })
      const payload = (await response.json()) as LilyParsePayload
      if (!response.ok) {
        throw new Error(payload.error || `Lily request failed (${response.status})`)
      }
      const updated = [
        ...history,
        {
          q: question,
          a: payload.content || "Hmm, I didn't get a response back.",
          source: payload.source,
          createdAt: Date.now(),
        },
      ].slice(-6)
      startTransition(() => {
        setHistory(updated)
        saveHistory(updated)
        setInput('')
      })
      if (audioEnabled) {
        void playAudio(updated[updated.length - 1]?.a || '')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : 'Lily request failed')
    } finally {
      requestAbortRef.current = null
      setLoading(false)
    }
  }

  function clearHistory() {
    startTransition(() => {
      setHistory([])
      saveHistory([])
    })
  }

  function cancelRequest() {
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    setLoading(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 sm:px-2">
      <div className={shellClassName()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-900 text-lg font-semibold text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900">
              L
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
                Ops
              </div>
              <h1 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
                Lily
              </h1>
              <p className="text-sm text-primary-600 dark:text-neutral-400">
                {getGreeting()}
              </p>
              <p className="mt-1 text-sm text-primary-500 dark:text-neutral-500">
                {getSubline(context)}
              </p>
              <p className="mt-2 text-xs text-primary-500 dark:text-neutral-500">
                {formatRelativeMoment(contextLoadedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.length > 0 ? (
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
              >
                Clear history
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void loadContext()}
              disabled={refreshing}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {refreshing ? 'Refreshing…' : 'Refresh context'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Live Context
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Operator snapshot
              </div>
              <div className="mt-2 text-sm leading-6 text-primary-900 dark:text-neutral-100">
                {operatorSnapshot}
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Jobs
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {context?.summary?.healthyJobs ?? 0} healthy
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {context?.summary?.failingJobs ?? 0} failing · {context?.summary?.warningJobs ?? 0} warning
              </div>
            </div>
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Meetings
              </div>
              <div className="mt-2 text-2xl font-semibold text-primary-900 dark:text-neutral-100">
                {context?.summary?.meetingsToday ?? 0} today
              </div>
              <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                {context?.summary?.nextMeeting
                  ? `${context.summary.nextMeeting.title} · ${context.summary.nextMeeting.when}`
                  : 'No upcoming meeting'}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className={cardClassName()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                Next jobs
              </div>
              <div className="mt-3 grid gap-2">
                {(context?.summary?.nextJobs || []).length === 0 ? (
                  <div className="text-sm text-primary-500 dark:text-neutral-400">
                    No scheduled jobs found.
                  </div>
                ) : null}
                {(context?.summary?.nextJobs || []).map((job) => (
                  <div
                    key={`${job.name}-${job.when}`}
                    className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 text-sm text-primary-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    {job.name}
                    <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                      {job.when}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {context?.summary?.transientIssue ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {context.summary.transientIssue.summary}
              </div>
            ) : null}

            {(context?.recentFailures || []).length > 0 ? (
              <div className={cardClassName()}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                  Recent failures
                </div>
                <div className="mt-3 grid gap-2">
                  {(context?.recentFailures || []).slice(0, 4).map((failure) => (
                    <div
                      key={`${failure.name}-${failure.when}`}
                      className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                        {failure.name}
                      </div>
                      <div className="mt-1 text-xs text-primary-600 dark:text-neutral-400">
                        {failure.when}
                      </div>
                      <div className="mt-1 text-xs text-primary-700 dark:text-neutral-300">
                        {failure.error}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className={shellClassName()}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
            Ask Lily
          </h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendPrompt(prompt)}
                disabled={loading}
                className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 text-left text-sm text-primary-800 transition-colors hover:bg-primary-100 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void sendPrompt(input)
                }
              }}
              rows={4}
              placeholder="Ask Lily anything..."
              className="min-h-28 flex-1 rounded-2xl border border-primary-200 bg-white px-3 py-3 text-sm text-primary-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-primary-600 dark:text-neutral-400">
            {voiceRecorder.isSupported ? (
              <button
                type="button"
                onClick={() => {
                  if (voiceRecorder.isRecording) {
                    voiceRecorder.stop()
                  } else {
                    void voiceRecorder.start()
                  }
                }}
                disabled={loading || transcribing}
                className="rounded-full border border-primary-200 px-3 py-1.5 dark:border-neutral-800"
              >
                {voiceRecorder.isRecording
                  ? `Stop recording (${Math.max(
                      1,
                      Math.round(voiceRecorder.durationMs / 1000),
                    )}s)`
                  : 'Record voice prompt'}
              </button>
            ) : (
              <span className="rounded-full border border-primary-200 px-3 py-1.5 dark:border-neutral-800">
                Voice input not supported here
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setAudioEnabled((value) => {
                  const next = !value
                  if (!next) cleanupAudio()
                  return next
                })
              }}
              className="rounded-full border border-primary-200 px-3 py-1.5 dark:border-neutral-800"
            >
              {audioEnabled ? 'Mute reply audio' : 'Unmute reply audio'}
            </button>
            <button
              type="button"
              onClick={() => void playAudio(latestAnswer?.a || '')}
              disabled={!latestAnswer?.a || transcribing}
              className="rounded-full border border-primary-200 px-3 py-1.5 disabled:opacity-60 dark:border-neutral-800"
            >
              {speaking ? 'Replay latest reply' : 'Play latest reply'}
            </button>
            {transcribing ? (
              <span className="rounded-full border border-primary-200 px-3 py-1.5 dark:border-neutral-800">
                Transcribing voice note…
              </span>
            ) : null}
            {lastTranscript ? (
              <span className="rounded-full border border-primary-200 px-3 py-1.5 dark:border-neutral-800">
                Last transcript: {lastTranscript.slice(0, 64)}
                {lastTranscript.length > 64 ? '…' : ''}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex justify-end">
            <div className="flex gap-2">
              {loading ? (
                <button
                  type="button"
                  onClick={cancelRequest}
                  className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 text-sm text-primary-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                >
                  Stop
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void sendPrompt(input)}
                disabled={loading || transcribing || !input.trim()}
                className="rounded-xl bg-primary-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {loading ? 'Thinking…' : 'Send'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {latestAnswer ? (
              <div className={cardClassName()}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                  {formatSourceLabel(latestAnswer.source)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-primary-600 dark:text-neutral-400">
                  <span>{latestAnswer.q}</span>
                  {latestAnswer.createdAt ? (
                    <span className="rounded-full border border-primary-200 px-2 py-0.5 dark:border-neutral-800">
                      {formatRelativeMoment(latestAnswer.createdAt).replace('Updated ', '')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Markdown className="space-y-3">{latestAnswer.a}</Markdown>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-primary-200 bg-primary-50/80 px-4 py-6 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                No conversation yet. Use a suggested prompt or ask your own question.
              </div>
            )}

            {history.length > 1 ? (
              <div className={cardClassName()}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 dark:text-neutral-400">
                  Recent thread
                </div>
                <div className="mt-3 grid gap-3">
                  {history
                    .slice(0, -1)
                    .reverse()
                    .map((pair, index) => (
                      <div
                        key={`${pair.q}-${index}`}
                        className="rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-400">
                          Tyler
                        </div>
                        <div className="mt-1 text-sm text-primary-900 dark:text-neutral-100">
                          {pair.q}
                        </div>
                        <div className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-400">
                          {formatSourceLabel(pair.source)}
                        </div>
                        <div className="mt-2">
                          <Markdown className="space-y-3">{pair.a}</Markdown>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
