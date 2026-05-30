import { describe, expect, it } from 'vitest'
import {
  buildAppleHealthReview,
  buildAppleHealthTiles,
  buildTrend,
} from './apple-health-insights'
import type { AppleHealthDailySummary } from './apple-health-insights'

function day(
  offset: number,
  patch: Partial<AppleHealthDailySummary>,
): AppleHealthDailySummary {
  return {
    date: `2026-05-${String(27 - offset).padStart(2, '0')}`,
    steps: 7000,
    activeEnergyKcal: 450,
    restingHeartRate: 60,
    avgHeartRate: 78,
    maxHeartRate: 120,
    hrvAvg: 45,
    spo2Avg: 97,
    sleepDurationMinutes: 420,
    sleepEfficiency: null,
    workoutCount: 0,
    workoutMinutes: 0,
    exerciseMinutes: 20,
    vo2Max: null,
    timeInDaylight: 15,
    mindfulnessMinutes: 0,
    ...patch,
  }
}

describe('apple health insights', () => {
  it('detects a meaningful trend between recent and previous windows', () => {
    const trend = buildTrend([10, 11, 12, 11, 10, 12, 11, 20, 20, 20, 19, 21, 20, 20])
    expect(trend.direction).toBe('down')
    expect(trend.recentAverage).toBeLessThan(trend.previousAverage!)
  })

  it('builds tiles with sparkline series for dashboard cards', () => {
    const days = Array.from({ length: 14 }, (_, index) =>
      day(index, { steps: index < 7 ? 9000 : 5000 }),
    )
    const tiles = buildAppleHealthTiles(days)
    const steps = tiles.find((tile) => tile.id === 'steps')
    const sleep = tiles.find((tile) => tile.id === 'sleep')
    expect(steps?.value).toBe('9,000')
    expect(steps?.tone).toBe('good')
    expect(steps?.series).toHaveLength(14)
    expect(sleep?.detail).toContain('0.0 h')
  })

  it('gives specific non-generic recovery advice from trend evidence', () => {
    const days = Array.from({ length: 14 }, (_, index) =>
      day(index, {
        hrvAvg: index < 7 ? 25 : 50,
        restingHeartRate: index < 7 ? 72 : 58,
        steps: index < 7 ? 8000 : 7600,
      }),
    )
    const review = buildAppleHealthReview({
      days,
      sourceAgeDays: 0,
      totalMetrics: 200,
    })
    expect(review.status).toBe('watch')
    expect(review.advice.join(' ')).toContain('Recovery pressured')
    expect(review.caveats.join(' ')).toContain('not medical advice')
  })

  it('does not pretend when the health database is empty', () => {
    const review = buildAppleHealthReview({
      days: [],
      sourceAgeDays: null,
      totalMetrics: 0,
    })
    expect(review.status).toBe('empty')
    expect(review.advice[0]).toContain('Health Bridge sync')
  })
})
