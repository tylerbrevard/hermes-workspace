import { describe, expect, it } from 'vitest'
import {
  buildLilyDiagnostics,
  buildLilySessionSummary,
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
      label: 'Safari speech recognition available',
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
      label: 'Chrome speech recognition ready',
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
      label: 'Speech recognition missing',
    })
  })

  it('builds sectioned diagnostics for browser, worker, network, and config', () => {
    expect(
      buildLilyDiagnostics({
        micPermission: 'granted',
        browserVoiceLabel: 'Chrome speech recognition ready',
        liveKitConnected: true,
        tokenStatus: 'Token valid until 5:00 PM',
        workerStatus: 'online',
        status: 'Ready',
      }),
    ).toContain('[network] livekit=connected; token=Token valid until 5:00 PM')
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
    ).toBe('Start worker')
  })

  it('classifies voice readiness and setup blockers', () => {
    expect(
      getLilyVoiceReadiness({
        configured: true,
        micPermission: 'granted',
        browserSupported: true,
        workerStatus: 'online',
        tokenStatus: 'LiveKit token active',
        liveKitConnected: true,
      }),
    ).toMatchObject({ state: 'ready', canStart: true })

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
      blocker: 'Microphone permission is blocked',
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
    ).toEqual(['needs action', 'degraded', 'blocked', 'degraded'])
  })

  it('normalizes permission and LiveKit errors for actionable copy', () => {
    expect(
      getMicrophonePermissionGuidance({
        micPermission: 'denied',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
      }),
    ).toContain('Chrome')
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
