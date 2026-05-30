import { describe, expect, it } from 'vitest'
import {
  estimateFoodFromText,
  getFoodCoaching,
  getFoodDashboardTiles,
  getFoodSummary,
  getWegovyDashboardTiles,
  getWegovyDosePlan,
  getWegovySideEffectSummary,
  getWegovySiteSuggestion,
  getWegovySummary,
  getZynDailySummary,
  getZynDashboardTiles,
  getZynInsights,
} from './-personal-health-trackers'

describe('personal health tracker helpers', () => {
  it('calculates Wegovy next due date and dose summary', () => {
    const summary = getWegovySummary(
      [
        {
          id: '2',
          date: '2026-05-20',
          doseMg: 0.5,
          site: 'Abdomen right',
          weightLb: 198.2,
          waistIn: 39,
          appetiteBefore: 7,
          appetiteAfter: 3,
          sideEffects: 'none',
          notes: '',
        },
        {
          id: '1',
          date: '2026-05-13',
          doseMg: 0.25,
          site: 'Abdomen left',
          weightLb: 200,
          waistIn: 40,
          appetiteBefore: 8,
          appetiteAfter: 5,
          sideEffects: 'mild nausea',
          notes: '',
        },
      ],
      new Date('2026-05-25T12:00:00'),
    )

    expect(summary.nextDue).toBe('2026-05-27')
    expect(summary.daysUntilDue).toBe(2)
    expect(summary.currentDose).toBe(0.5)
    expect(summary.weightChange).toBe(-1.8)
    expect(summary.waistChange).toBe(-1)
    expect(summary.appetiteChange).toBe(-4)
    expect(getWegovyDosePlan(summary.currentDose).next).toBe(1)
  })

  it('suggests Wegovy site rotation and summarizes side effects', () => {
    const shots = [
      {
        id: '1',
        date: '2026-05-27',
        doseMg: 0.5,
        site: 'Abdomen left',
        weightLb: 199,
        sideEffects: 'nausea',
        notes: '',
        nausea: true,
      },
    ]

    expect(getWegovySiteSuggestion(shots)).toBe('Abdomen right')
    expect(getWegovySideEffectSummary(shots)).toMatchObject({
      nausea: 1,
      label: 'Low',
    })
  })

  it('builds Wegovy dashboard tiles with trend context', () => {
    const summary = getWegovySummary(
      [
        {
          id: '2',
          date: '2026-05-20',
          doseMg: 0.5,
          site: 'Abdomen right',
          weightLb: 198,
          sideEffects: 'none',
          notes: '',
        },
        {
          id: '1',
          date: '2026-05-13',
          doseMg: 0.25,
          site: 'Abdomen left',
          weightLb: 200,
          sideEffects: 'nausea',
          notes: '',
        },
      ],
      new Date('2026-05-27T12:00:00'),
    )
    const tiles = getWegovyDashboardTiles(
      summary,
      getWegovySideEffectSummary([]),
      1,
    )

    expect(tiles).toMatchObject([
      { label: 'Shot runway', value: 'Today' },
      { label: 'Effect load', value: 'Low' },
      { label: 'Weight delta', value: '-2 lb', tone: 'good' },
      { label: 'Pen supply', value: '1', tone: 'warn' },
    ])
    expect(tiles.every((tile) => tile.trend.length === 4)).toBe(true)
  })

  it('summarizes Zyn pouches and nicotine against a daily cap', () => {
    expect(
      getZynDailySummary(
        [
          {
            id: '1',
            date: '2026-05-27',
            time: '09:00 AM',
            count: 2,
            strengthMg: 3,
            trigger: 'Focus',
            note: '',
          },
          {
            id: '2',
            date: '2026-05-27',
            time: '01:00 PM',
            count: 3,
            strengthMg: 6,
            trigger: 'Stress',
            note: '',
          },
        ],
        '2026-05-27',
        6,
      ),
    ).toEqual({ count: 5, nicotineMg: 24, remaining: 1, overLimit: false })

    expect(
      getZynInsights(
        [
          {
            id: '1',
            date: '2026-05-27',
            time: '09:00 AM',
            count: 2,
            strengthMg: 3,
            trigger: 'Focus',
            note: '',
          },
        ],
        6,
      ),
    ).toMatchObject({
      weeklyAverage: 2,
      streak: 1,
      riskiestTrigger: 'Focus',
      reductionTarget: 5,
    })
  })

  it('builds Zyn dashboard tiles around pace and trigger risk', () => {
    const summary = getZynDailySummary(
      [
        {
          id: '1',
          date: '2026-05-27',
          time: '09:00 AM',
          count: 5,
          strengthMg: 6,
          trigger: 'Stress',
          note: '',
        },
      ],
      '2026-05-27',
      4,
    )
    const insights = getZynInsights(
      [
        {
          id: '1',
          date: '2026-05-27',
          time: '09:00 AM',
          count: 5,
          strengthMg: 6,
          trigger: 'Stress',
          note: '',
        },
      ],
      4,
    )

    expect(getZynDashboardTiles(summary, insights, 4)).toMatchObject([
      { label: 'Today pace', value: '5/4', tone: 'warn' },
      { label: 'Nicotine load', value: '30 mg', tone: 'warn' },
      { label: '7d average', value: '5/day', tone: 'warn' },
      { label: 'Risk trigger', value: 'Stress' },
    ])
  })

  it('estimates food macros from natural language and totals the day', () => {
    const estimate = estimateFoodFromText(
      'grilled chicken with rice, avocado, and broccoli',
    )

    expect(estimate.calories).toBeGreaterThan(600)
    expect(estimate.protein).toBe(38)
    expect(estimate.fiber).toBe(8)
    expect(estimate.confidence).toBeGreaterThanOrEqual(80)

    const summary = getFoodSummary(
      [
        {
          id: '1',
          date: '2026-05-27',
          meal: 'Lunch',
          description: 'chicken rice',
          calories: 620,
          protein: 38,
          carbs: 42,
          fat: 24,
          fiber: 6,
          waterOz: 16,
          confidence: 82,
        },
      ],
      '2026-05-27',
    )

    expect(summary).toEqual({
      calories: 620,
      protein: 38,
      carbs: 42,
      fat: 24,
      fiber: 6,
      waterOz: 16,
      count: 1,
    })
    expect(getFoodCoaching(summary).glpSuggestion).toContain('protein')
  })

  it('builds Food dashboard tiles with calorie, protein, and GLP-1 guardrails', () => {
    const summary = getFoodSummary(
      [
        {
          id: '1',
          date: '2026-05-27',
          meal: 'Lunch',
          description: 'salmon potato asparagus',
          calories: 700,
          protein: 48,
          carbs: 42,
          fat: 24,
          fiber: 10,
          waterOz: 24,
          confidence: 82,
        },
      ],
      '2026-05-27',
    )
    const coaching = getFoodCoaching(summary)

    expect(getFoodDashboardTiles(summary, coaching, 1800, 120)).toMatchObject([
      { label: 'Calorie runway', value: '1100' },
      { label: 'Protein score', value: '40%' },
      { label: 'Fiber + water', value: '10g / 24oz' },
      { label: 'Meal count', value: '1' },
    ])
  })
})
