import { describe, expect, it } from 'vitest'
import {
  buildLilyCockpitTiles,
  buildLilyDiagnostics,
  buildLilySessionSummary,
  buildLilyVoiceLoopStages,
  extractWakeCommand,
  getBrowserVoiceSupportForUserAgent,
  getLilyFailureCta,
  getLilySetupChecklist,
  getLilyVoiceReadiness,
  getLiveKitTokenRefreshDelay,
  getMicrophonePermissionGuidance,
  getSpeechTimeoutMs,
  isFatalSpeechRecognitionError,
  normalizeLiveKitError,
} from './lily'

describe('LILY LiveKit voice helpers', () => {
  it('refreshes LiveKit tokens 90 seconds before expiry', () => {
    const now = Date.parse('2026-05-21T12:00:00.000Z')
    const expiresAt = '2026-05-21T12:20:00.000Z'

    expect(getLiveKitTokenRefreshDelay(expiresAt, now)).toBe(1_110_000)
  })

  it('requests immediate reconnect for expired tokens', () => {
    const now = Date.parse('2026-05-21T12:20:01.000Z')
    const expiresAt = '2026-05-21T12:20:00.000Z'

    expect(getLiveKitTokenRefreshDelay(expiresAt, now)).toBe(0)
  })

  it('ignores missing or malformed expiry values', () => {
    expect(getLiveKitTokenRefreshDelay()).toBeNull()
    expect(getLiveKitTokenRefreshDelay('not-a-date')).toBeNull()
  })

  it('extracts wake-word commands from natural speech', () => {
    expect(extractWakeCommand('Hey LILY, check the workspace.')).toEqual({
      heardWakeWord: true,
      command: 'check the workspace',
    })
    expect(extractWakeCommand('lilly')).toEqual({
      heardWakeWord: true,
      command: '',
    })
    expect(extractWakeCommand('check the workspace')).toEqual({
      heardWakeWord: false,
      command: '',
    })
  })

  it('distinguishes fatal browser speech recognition errors', () => {
    expect(isFatalSpeechRecognitionError('not-allowed')).toBe(true)
    expect(isFatalSpeechRecognitionError('audio-capture')).toBe(true)
    expect(isFatalSpeechRecognitionError('no-speech')).toBe(false)
    expect(isFatalSpeechRecognitionError('aborted')).toBe(false)
  })

  it('bounds speech synthesis timeout by utterance length', () => {
    expect(getSpeechTimeoutMs('hello')).toBe(4_000)
    expect(
      getSpeechTimeoutMs(Array.from({ length: 200 }, () => 'word').join(' ')),
    ).toBe(30_000)
  })

  it('labels mobile Safari speech support with the right permission caveat', () => {
    expect(
      getBrowserVoiceSupportForUserAgent({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        hasSpeechRecognition: true,
      }),
    ).toMatchObject({
      supported: true,
      label: 'Safari ready',
    })
  })

  it('labels mobile Chrome as ready when speech recognition exists', () => {
    expect(
      getBrowserVoiceSupportForUserAgent({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        hasSpeechRecognition: true,
      }),
    ).toMatchObject({
      supported: true,
      label: 'Chrome ready',
    })
  })

  it('keeps typed chat as the fallback when mobile speech support is missing', () => {
    expect(
      getBrowserVoiceSupportForUserAgent({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        hasSpeechRecognition: false,
      }),
    ).toMatchObject({
      supported: false,
      label: 'Speech missing',
    })
  })

  it('builds sectioned diagnostics for browser, worker, network, and config', () => {
    expect(
      buildLilyDiagnostics({
        micPermission: 'granted',
        browserVoiceLabel: 'Chrome ready',
        liveKitConnected: true,
        realtimeConnected: false,
        geminiConnected: false,
        tokenStatus: 'Token valid until 5:00 PM',
        workerStatus: 'online',
        voiceMode: 'connected',
        status: 'Ready',
      }),
    ).toContain(
      '[transport] livekit=connected; realtime=not connected; gemini=not connected; token=Token valid until 5:00 PM',
    )
  })

  it('separates browser loop, transport, and actual speaking stages', () => {
    const stages = buildLilyVoiceLoopStages({
      handsFreeEnabled: true,
      pushToTalkActive: false,
      browserVoiceLabel: 'Chrome ready',
      micPermission: 'granted',
      liveKitConnected: true,
      realtimeConnected: false,
      geminiConnected: false,
      workerStatus: 'online',
      tokenStatus: 'LiveKit token active',
      voiceMode: 'speaking',
      isSending: false,
      lastTestStage: 'passed: browser, worker, LiveKit, and speaker checked',
    })

    expect(stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'browser',
          value: 'Hands-free',
          tone: 'ready',
        }),
        expect.objectContaining({
          id: 'transport',
          value: 'LiveKit transport connected',
          tone: 'ready',
        }),
        expect.objectContaining({
          id: 'agent',
          value: 'Speaking now',
          tone: 'ready',
        }),
        expect.objectContaining({
          id: 'test',
          value: 'Passed',
          tone: 'ready',
        }),
      ]),
    )
  })

  it('reports exact degraded voice-loop blockers for smoke coverage', () => {
    expect(
      buildLilyVoiceLoopStages({
        handsFreeEnabled: false,
        pushToTalkActive: false,
        browserVoiceLabel: 'Speech missing',
        micPermission: 'denied',
        liveKitConnected: false,
        workerStatus: 'offline',
        tokenStatus: 'No LiveKit token',
        voiceMode: 'idle',
        isSending: false,
        lastTestStage: 'failed at worker online: offline',
      }).map((stage) => [stage.id, stage.value, stage.detail]),
    ).toEqual([
      ['browser', 'Manual', 'Mic blocked'],
      ['transport', 'Browser fallback only', 'No LiveKit token'],
      ['agent', 'Not speaking', 'idle'],
      ['test', 'Failed', 'failed at worker online: offline'],
    ])
  })

  it('chooses failure-specific CTAs for common voice-loop blockers', () => {
    expect(
      getLilyFailureCta({
        micPermission: 'denied',
        browserSupported: true,
        liveKitConnected: false,
        workerStatus: 'online',
        tokenStatus: 'No LiveKit token',
      }),
    ).toBe('Grant mic')
    expect(
      getLilyFailureCta({
        micPermission: 'granted',
        browserSupported: false,
        liveKitConnected: false,
        workerStatus: 'online',
        tokenStatus: 'No LiveKit token',
      }),
    ).toBe('Switch browser')
    expect(
      getLilyFailureCta({
        micPermission: 'granted',
        browserSupported: true,
        liveKitConnected: false,
        workerStatus: 'offline',
        tokenStatus: 'No LiveKit token',
      }),
    ).toBe('Use Chrome loop')
  })

  it('classifies voice readiness and setup blockers', () => {
    expect(
      getLilyVoiceReadiness({
        configured: true,
        geminiConfigured: true,
        realtimeConfigured: true,
        micPermission: 'granted',
        browserSupported: true,
        workerStatus: 'online',
        tokenStatus: 'LiveKit token active',
        liveKitConnected: false,
      }),
    ).toMatchObject({
      state: 'ready',
      label: 'Gemini',
      canStart: true,
    })

    expect(
      getLilyVoiceReadiness({
        configured: true,
        geminiConfigured: false,
        realtimeConfigured: true,
        micPermission: 'granted',
        browserSupported: true,
        workerStatus: 'offline',
        tokenStatus: 'No LiveKit token',
        liveKitConnected: false,
      }),
    ).toMatchObject({
      state: 'ready',
      label: 'Realtime',
      canStart: true,
    })

    expect(
      getLilyVoiceReadiness({
        configured: true,
        micPermission: 'denied',
        browserSupported: true,
        workerStatus: 'online',
        tokenStatus: 'No LiveKit token',
        liveKitConnected: false,
      }),
    ).toMatchObject({
      state: 'unavailable',
      blocker: 'Mic permission blocked',
      canStart: false,
    })

    expect(
      getLilySetupChecklist({
        configured: false,
        micPermission: 'prompt',
        browserSupported: false,
        workerStatus: 'offline',
        liveKitConnected: false,
      }).map((item) => item.status),
    ).toEqual(['needs action', 'degraded', 'blocked'])

    expect(
      getLilyVoiceReadiness({
        configured: true,
        micPermission: 'granted',
        browserSupported: true,
        workerStatus: 'offline',
        tokenStatus: 'No LiveKit token',
        liveKitConnected: false,
      }),
    ).toMatchObject({
      state: 'degraded',
      canStart: true,
    })
  })

  it('builds compact voice cockpit tiles for the app-like LILY shell', () => {
    const readiness = getLilyVoiceReadiness({
      configured: true,
      geminiConfigured: true,
      realtimeConfigured: false,
      micPermission: 'granted',
      browserSupported: true,
      workerStatus: 'online',
      tokenStatus: 'LiveKit token active',
      liveKitConnected: false,
    })

    expect(
      buildLilyCockpitTiles({
        readiness,
        micPermission: 'granted',
        browserVoiceLabel: 'Chrome ready',
        tokenStatus: 'LiveKit token active',
        workerStatus: 'online',
        wakeLockStatus: 'active',
        memoryEnabled: true,
        conversationMemoryEnabled: true,
        timelineCount: 2,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'readiness',
          label: 'Voice',
          value: 'Gemini',
          tone: 'ready',
        }),
        expect.objectContaining({
          id: 'transport',
          value: 'Worker',
          tone: 'ready',
        }),
        expect.objectContaining({
          id: 'memory',
          value: 'Full',
          detail: '2 recent events · wake active',
        }),
      ]),
    )
  })

  it('normalizes permission and LiveKit errors for actionable copy', () => {
    expect(
      getMicrophonePermissionGuidance({
        micPermission: 'denied',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
      }),
    ).toBe('Chrome site settings: Mic Allow, then retry.')
    expect(normalizeLiveKitError('token expired')).toBe(
      'LiveKit token expired or invalid',
    )
    expect(normalizeLiveKitError('websocket timeout')).toBe(
      'LiveKit network connection failed',
    )
  })

  it('builds a compact session summary handoff', () => {
    expect(
      buildLilySessionSummary(
        [
          { role: 'assistant', content: 'Ready' },
          { role: 'user', content: 'Prep my day' },
          { role: 'assistant', content: 'Start with meetings.' },
        ],
        [
          {
            id: 't1',
            kind: 'task',
            label: 'Task',
            detail: 'Follow up',
            createdAt: '2026-05-27T12:00:00.000Z',
          },
        ],
      ),
    ).toContain('Last user: Prep my day')
  })
})
