import { describe, expect, it } from 'vitest'

import {
  getSeventyFiveHabitItems,
  getSeventyFiveHabitSummary,
  getSeventyFiveHeatmapDays,
  getSeventyFiveShareReport,
  getSeventyFiveStreakRisk,
  getSeventyFiveTrendLegend,
  getSeventyFiveWeeklyTrend,
} from './75-tracker'

describe('75 tracker route helpers', () => {
  it('changes water and workout rules between hard and soft modes', () => {
    const hard = getSeventyFiveHabitItems('hard')
    const soft = getSeventyFiveHabitItems('soft')

    expect(hard.find((habit) => habit.id === 'water')?.rule).toBe('1 gallon')
    expect(soft.find((habit) => habit.id === 'water')?.rule).toBe(
      'daily target',
    )
    expect(hard.find((habit) => habit.id === 'workout')?.rule).toBe(
      '2 sessions',
    )
    expect(soft.find((habit) => habit.id === 'workout')?.rule).toBe(
      'move today',
    )
  })

  it('summarizes completed, remaining, and percent from checked habits', () => {
    const habits = getSeventyFiveHabitItems('soft')

    expect(
      getSeventyFiveHabitSummary(habits, {
        water: true,
        workout: true,
        reading: true,
      }),
    ).toEqual({
      completed: 3,
      total: 6,
      remaining: 3,
      percent: 50,
    })
  })

  it('uses the selected custom habit template', () => {
    const habits = getSeventyFiveHabitItems('soft', 'Meditation')

    expect(habits.find((habit) => habit.id === 'custom')).toMatchObject({
      label: 'Meditation',
      rule: 'custom habit',
    })
  })

  it('adjusts required habits for modified travel days', () => {
    const habits = getSeventyFiveHabitItems('hard', 'Mobility', true)

    expect(habits.find((habit) => habit.id === 'water')?.rule).toBe(
      'travel target',
    )
    expect(habits.find((habit) => habit.id === 'workout')?.rule).toBe(
      'modified movement',
    )
  })

  it('builds heatmap days and marks today from the current challenge index', () => {
    const days = getSeventyFiveHeatmapDays(new Date(2026, 4, 26), {
      water: true,
      workout: true,
      reading: true,
      diet: true,
      photo: true,
      custom: true,
    })

    expect(days).toHaveLength(75)
    expect(days[25]).toEqual({ index: 26, complete: true, isToday: true })
    expect(days[74]).toEqual({ index: 75, complete: false, isToday: false })
  })

  it('creates a shareable accountability report', () => {
    const trend = getSeventyFiveWeeklyTrend(50)
    const report = getSeventyFiveShareReport({
      mode: 'soft',
      todayKey: '2026-05-26',
      summary: { completed: 3, total: 6, remaining: 3, percent: 50 },
      trend,
    })

    expect(trend.label).toBe('Recoverable')
    expect(report).toContain('75 soft tracker - 2026-05-26')
    expect(report).toContain('3/6 complete (50%).')
    expect(report).toContain('3 remaining.')
  })

  it('labels streak risk by remaining work and time of day', () => {
    expect(
      getSeventyFiveStreakRisk({ remaining: 0, percent: 100 }, 22),
    ).toEqual({ severity: 'success', message: 'Streak safe.' })
    expect(getSeventyFiveStreakRisk({ remaining: 3, percent: 40 }, 21)).toEqual(
      {
        severity: 'danger',
        message: 'Streak at risk: more than one item remains after 8 PM.',
      },
    )
    expect(getSeventyFiveStreakRisk({ remaining: 1, percent: 83 }, 18)).toEqual(
      {
        severity: 'warning',
        message: 'Streak watch: pick the smallest remaining item now.',
      },
    )
  })

  it('describes trend states without relying on color alone', () => {
    expect(getSeventyFiveTrendLegend()).toEqual([
      { label: 'On track', detail: '100% complete today.' },
      { label: 'Recoverable', detail: '50-99% complete; finish smallest next.' },
      { label: 'Needs push', detail: 'Below 50%; front-load required items.' },
    ])
  })
})
