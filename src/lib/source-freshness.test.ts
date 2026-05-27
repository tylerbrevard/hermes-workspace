import { describe, expect, it } from 'vitest'
import {
  formatWorkspaceFreshness,
  freshnessTimestampMs,
  isWorkspaceSourceStale,
} from './source-freshness'

describe('source freshness', () => {
  const now = Date.parse('2026-05-27T15:00:00.000Z')

  it('formats relative freshness consistently for workspace pages', () => {
    expect(
      formatWorkspaceFreshness('2026-05-27T14:59:45.000Z', { nowMs: now }),
    ).toBe('just now')
    expect(
      formatWorkspaceFreshness('2026-05-27T14:52:00.000Z', { nowMs: now }),
    ).toBe('8m ago')
    expect(
      formatWorkspaceFreshness('2026-05-27T12:00:00.000Z', { nowMs: now }),
    ).toBe('3h ago')
    expect(
      formatWorkspaceFreshness('2026-05-24T15:00:00.000Z', { nowMs: now }),
    ).toBe('3d ago')
  })

  it('supports page-specific empty and invalid labels', () => {
    expect(
      formatWorkspaceFreshness(null, {
        emptyLabel: 'Not synced',
        nowMs: now,
      }),
    ).toBe('Not synced')
    expect(
      formatWorkspaceFreshness('not-a-date', {
        invalidLabel: 'Sync unknown',
        nowMs: now,
      }),
    ).toBe('Sync unknown')
  })

  it('detects stale source timestamps from strings and numbers', () => {
    expect(
      isWorkspaceSourceStale('2026-05-27T14:59:00.000Z', 120_000, now),
    ).toBe(false)
    expect(
      isWorkspaceSourceStale('2026-05-27T14:55:00.000Z', 120_000, now),
    ).toBe(true)
    expect(isWorkspaceSourceStale(now - 30_000, 120_000, now)).toBe(false)
    expect(isWorkspaceSourceStale(null, 120_000, now)).toBe(true)
  })

  it('normalizes invalid timestamps to null', () => {
    expect(freshnessTimestampMs('2026-05-27T15:00:00.000Z')).toBe(now)
    expect(freshnessTimestampMs('bad')).toBeNull()
    expect(freshnessTimestampMs(undefined)).toBeNull()
  })
})
