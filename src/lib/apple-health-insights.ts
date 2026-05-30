export type AppleHealthTrendDirection = 'up' | 'down' | 'flat' | 'unknown'

export type AppleHealthTrend = {
  direction: AppleHealthTrendDirection
  delta: number | null
  deltaPercent: number | null
  recentAverage: number | null
  previousAverage: number | null
}

export type AppleHealthDailySummary = {
  date: string
  steps: number | null
  activeEnergyKcal: number | null
  restingHeartRate: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  hrvAvg: number | null
  spo2Avg: number | null
  sleepDurationMinutes: number | null
  sleepEfficiency: number | null
  workoutCount: number | null
  workoutMinutes: number | null
  exerciseMinutes: number | null
  vo2Max: number | null
  timeInDaylight: number | null
  mindfulnessMinutes: number | null
}

export type AppleHealthTile = {
  id: string
  label: string
  value: string
  detail: string
  unit: string
  tone: 'good' | 'watch' | 'neutral'
  trend: AppleHealthTrend
  series: Array<number | null>
}

export type AppleHealthReview = {
  status: 'ready' | 'watch' | 'stale' | 'empty'
  headline: string
  evidence: Array<string>
  advice: Array<string>
  caveats: Array<string>
}

type MetricConfig = {
  id: string
  label: string
  unit: string
  key: keyof AppleHealthDailySummary
  format: (value: number | null) => string
  formatDelta?: (value: number) => string
  higherIsBetter?: boolean
}

const TILE_METRICS: Array<MetricConfig> = [
  {
    id: 'steps',
    label: 'Steps',
    unit: '',
    key: 'steps',
    format: (value) => (value == null ? '—' : Math.round(value).toLocaleString()),
    higherIsBetter: true,
  },
  {
    id: 'sleep',
    label: 'Sleep',
    unit: 'h',
    key: 'sleepDurationMinutes',
    format: (value) => (value == null ? '—' : `${(value / 60).toFixed(1)}h`),
    formatDelta: (value) => `${value > 0 ? '+' : ''}${(value / 60).toFixed(1)} h`,
    higherIsBetter: true,
  },
  {
    id: 'hrv',
    label: 'HRV',
    unit: 'ms',
    key: 'hrvAvg',
    format: (value) => (value == null ? '—' : `${Math.round(value)} ms`),
    higherIsBetter: true,
  },
  {
    id: 'resting-heart-rate',
    label: 'Resting HR',
    unit: 'bpm',
    key: 'restingHeartRate',
    format: (value) => (value == null ? '—' : `${Math.round(value)} bpm`),
    higherIsBetter: false,
  },
  {
    id: 'active-energy',
    label: 'Active energy',
    unit: 'kcal',
    key: 'activeEnergyKcal',
    format: (value) => (value == null ? '—' : `${Math.round(value)} kcal`),
    higherIsBetter: true,
  },
  {
    id: 'exercise',
    label: 'Exercise',
    unit: 'min',
    key: 'exerciseMinutes',
    format: (value) => (value == null ? '—' : `${Math.round(value)} min`),
    higherIsBetter: true,
  },
]

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(finite)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function buildTrend(
  newestFirstSeries: Array<number | null | undefined>,
  windowSize = 7,
): AppleHealthTrend {
  const recentAverage = average(newestFirstSeries.slice(0, windowSize))
  const previousAverage = average(
    newestFirstSeries.slice(windowSize, windowSize * 2),
  )
  if (recentAverage == null || previousAverage == null) {
    return {
      direction: 'unknown',
      delta: null,
      deltaPercent: null,
      recentAverage,
      previousAverage,
    }
  }

  const delta = recentAverage - previousAverage
  const deltaPercent =
    previousAverage === 0 ? null : (delta / Math.abs(previousAverage)) * 100
  const threshold = Math.max(Math.abs(previousAverage) * 0.03, 0.5)
  const direction =
    Math.abs(delta) < threshold ? 'flat' : delta > 0 ? 'up' : 'down'
  return {
    direction,
    delta: Number(delta.toFixed(2)),
    deltaPercent: deltaPercent == null ? null : Number(deltaPercent.toFixed(1)),
    recentAverage: Number(recentAverage.toFixed(2)),
    previousAverage: Number(previousAverage.toFixed(2)),
  }
}

function trendDetail(
  trend: AppleHealthTrend,
  unit: string,
  formatDelta?: (value: number) => string,
) {
  if (trend.direction === 'unknown' || trend.delta == null) {
    return 'Needs more history'
  }
  const sign = trend.delta > 0 ? '+' : ''
  const pct =
    trend.deltaPercent == null ? '' : `, ${sign}${trend.deltaPercent}%`
  const delta = formatDelta
    ? formatDelta(trend.delta)
    : `${sign}${Math.round(trend.delta)}${unit ? ` ${unit}` : ''}`
  return `${delta}${pct} vs prior week`
}

function tileTone(config: MetricConfig, trend: AppleHealthTrend) {
  if (trend.direction === 'unknown' || trend.direction === 'flat') return 'neutral'
  const improving =
    config.higherIsBetter === false
      ? trend.direction === 'down'
      : trend.direction === 'up'
  return improving ? 'good' : 'watch'
}

export function buildAppleHealthTiles(
  days: Array<AppleHealthDailySummary>,
): Array<AppleHealthTile> {
  const latest = days[0]
  return TILE_METRICS.map((metric) => {
    const series = days.map((day) => {
      const value = day[metric.key]
      return finite(value) ? value : null
    })
    const trend = buildTrend(series)
    const latestValue = latest ? latest[metric.key] : null
    return {
      id: metric.id,
      label: metric.label,
      value: metric.format(finite(latestValue) ? latestValue : null),
      detail: trendDetail(trend, metric.unit, metric.formatDelta),
      unit: metric.unit,
      tone: tileTone(metric, trend),
      trend,
      series,
    }
  })
}

function formatSleep(minutes: number | null | undefined) {
  return finite(minutes) ? `${(minutes / 60).toFixed(1)}h` : 'no sleep data'
}

function formatNumber(value: number | null | undefined, suffix = '') {
  return finite(value) ? `${Math.round(value).toLocaleString()}${suffix}` : '—'
}

export function buildAppleHealthReview(input: {
  days: Array<AppleHealthDailySummary>
  sourceAgeDays: number | null
  totalMetrics: number
}): AppleHealthReview {
  const { days, sourceAgeDays, totalMetrics } = input
  if (!days.length || totalMetrics === 0) {
    return {
      status: 'empty',
      headline: 'No Health data yet.',
      evidence: ['No daily rows in the health DB.'],
      advice: ['Run Health Bridge sync, then re-check.'],
      caveats: ['No inference without data.'],
    }
  }

  const latest = days[0]
  const stepsTrend = buildTrend(days.map((day) => day.steps))
  const sleepTrend = buildTrend(days.map((day) => day.sleepDurationMinutes))
  const hrvTrend = buildTrend(days.map((day) => day.hrvAvg))
  const restingTrend = buildTrend(days.map((day) => day.restingHeartRate))
  const recentSleep = average(days.slice(0, 7).map((day) => day.sleepDurationMinutes))
  const recentSteps = average(days.slice(0, 7).map((day) => day.steps))
  const recentExercise = average(days.slice(0, 7).map((day) => day.exerciseMinutes))
  const activityDip =
    stepsTrend.direction === 'down' && recentSteps != null && recentSteps < 6000
  const exerciseLow = recentExercise != null && recentExercise < 15

  const evidence = [
    `Day ${latest.date}: ${formatNumber(latest.steps)} steps, ${formatSleep(latest.sleepDurationMinutes)} sleep, HRV ${formatNumber(latest.hrvAvg, ' ms')}, RHR ${formatNumber(latest.restingHeartRate, ' bpm')}.`,
    `7d avg: ${formatNumber(recentSteps)} steps, ${formatSleep(recentSleep)}, ${formatNumber(recentExercise, ' min')} exercise.`,
  ]

  const advice: Array<string> = []
  if (sourceAgeDays != null && sourceAgeDays > 1) {
    advice.push('Sync Health Auto Export before today decisions.')
  }
  if (sleepTrend.direction === 'down' || (recentSleep != null && recentSleep < 390)) {
    advice.push(
      'Protect sleep: hard stop tonight; keep intensity low.',
    )
  }
  if (
    hrvTrend.direction === 'down' &&
    restingTrend.direction === 'up' &&
    stepsTrend.direction !== 'down'
  ) {
    advice.push(
      'Recovery pressured. Keep movement easy today.',
    )
  }
  if (activityDip) {
    advice.push(
      'Add a 20-minute walk block; steps are drifting down.',
    )
  }
  if (exerciseLow) {
    advice.push(
      'Set a 10-minute exercise floor on the calendar.',
    )
  }
  if (!advice.length) {
    advice.push(
      'Keep baseline; no obvious recovery/activity issue.',
    )
  }

  const stale = sourceAgeDays != null && sourceAgeDays > 1
  const watch =
    stale ||
    sleepTrend.direction === 'down' ||
    (hrvTrend.direction === 'down' && restingTrend.direction === 'up') ||
    activityDip ||
    exerciseLow

  return {
    status: stale ? 'stale' : watch ? 'watch' : 'ready',
    headline: stale
      ? 'Health data stale. Sync first.'
      : watch
        ? 'Health signals need attention.'
        : 'Signals usable for planning.',
    evidence,
    advice: advice.slice(0, 4),
    caveats: [
      'Trend review, not medical advice.',
      'Watch/export gaps can distort sleep, HRV, and activity.',
    ],
  }
}
