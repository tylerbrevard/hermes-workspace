import { describe, expect, it } from 'vitest'
import {
  extractWakeCommand,
  getLiveKitTokenRefreshDelay,
  getSpeechTimeoutMs,
  isFatalSpeechRecognitionError,
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
})
