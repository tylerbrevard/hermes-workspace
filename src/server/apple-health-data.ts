import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { AppleHealthDailySummary } from '@/lib/apple-health-insights'
import {
  buildAppleHealthReview,
  buildAppleHealthTiles,
} from '@/lib/apple-health-insights'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || path.join(HOME, '.hermes', 'workspace')
const HEALTH_DB =
  process.env.HERMES_HEALTH_DB ||
  path.join(HERMES_WORKSPACE, 'runtime', 'db', 'workspace', '.health.db')
const APPLE_HEALTH_SYNC_DB =
  process.env.APPLE_HEALTH_SYNC_DB ||
  path.join(HOME, '.apple-health-sync', 'health_data.db')

type DailySummaryRow = {
  date: string
  steps: number | null
  active_energy_kcal: number | null
  resting_heart_rate: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  hrv_avg: number | null
  spo2_avg: number | null
  sleep_duration_minutes: number | null
  sleep_efficiency: number | null
  workout_count: number | null
  workout_minutes: number | null
  exercise_minutes: number | null
  vo2_max: number | null
  time_in_daylight: number | null
  mindfulness_minutes: number | null
  updated_at: string | null
}

type SourceRow = {
  latestDate: string | null
  latestUpdate: string | null
  recentDays: number
}

type CountRow = {
  totalMetrics: number
  totalDays: number
  lastIngested: string | null
}

type WorkoutRow = {
  workout_type: string
  start_date: string
  duration_seconds: number | null
  active_energy_kcal: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
}

function queryDb<T>(dbPath: string, sql: string): Array<T> {
  if (!existsSync(dbPath)) return []
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
  }).trim()
  if (!output) return []
  return JSON.parse(output) as Array<T>
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mapDailyRow(row: DailySummaryRow): AppleHealthDailySummary {
  return {
    date: row.date,
    steps: numberOrNull(row.steps),
    activeEnergyKcal: numberOrNull(row.active_energy_kcal),
    restingHeartRate: numberOrNull(row.resting_heart_rate),
    avgHeartRate: numberOrNull(row.avg_heart_rate),
    maxHeartRate: numberOrNull(row.max_heart_rate),
    hrvAvg: numberOrNull(row.hrv_avg),
    spo2Avg: numberOrNull(row.spo2_avg),
    sleepDurationMinutes: numberOrNull(row.sleep_duration_minutes),
    sleepEfficiency: numberOrNull(row.sleep_efficiency),
    workoutCount: numberOrNull(row.workout_count),
    workoutMinutes: numberOrNull(row.workout_minutes),
    exerciseMinutes: numberOrNull(row.exercise_minutes),
    vo2Max: numberOrNull(row.vo2_max),
    timeInDaylight: numberOrNull(row.time_in_daylight),
    mindfulnessMinutes: numberOrNull(row.mindfulness_minutes),
  }
}

function daysBetween(date: string | null) {
  if (!date) return null
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  const now = new Date()
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
  )
  return Math.floor((todayUtc - parsed.getTime()) / 86_400_000)
}

function loadSourceStatus() {
  const source = queryDb<SourceRow>(
    APPLE_HEALTH_SYNC_DB,
    `
      SELECT
        MAX(date) AS latestDate,
        (SELECT updated_at FROM health_data ORDER BY date DESC, updated_at DESC LIMIT 1) AS latestUpdate,
        COUNT(*) AS recentDays
      FROM health_data
      WHERE date >= date('now', '-14 days')
    `,
  )[0] || { latestDate: null, latestUpdate: null, recentDays: 0 }
  const sourceAgeDays = daysBetween(source.latestDate)
  return {
    available: existsSync(APPLE_HEALTH_SYNC_DB),
    latestDate: source.latestDate,
    latestUpdate: source.latestUpdate,
    recentDays: source.recentDays ?? 0,
    sourceAgeDays,
    status:
      sourceAgeDays == null
        ? 'missing'
        : sourceAgeDays > 1
          ? 'phone_export_stale'
          : 'fresh',
  }
}

export function getAppleHealthDashboard() {
  const days = queryDb<DailySummaryRow>(
    HEALTH_DB,
    `
      SELECT
        date, steps, active_energy_kcal, resting_heart_rate, avg_heart_rate,
        max_heart_rate, hrv_avg, spo2_avg, sleep_duration_minutes,
        sleep_efficiency, workout_count, workout_minutes, exercise_minutes,
        vo2_max, time_in_daylight, mindfulness_minutes, updated_at
      FROM daily_summary
      ORDER BY date DESC
      LIMIT 30
    `,
  ).map(mapDailyRow)

  const counts = queryDb<CountRow>(
    HEALTH_DB,
    `
      SELECT
        (SELECT COUNT(*) FROM health_metrics) AS totalMetrics,
        (SELECT COUNT(*) FROM daily_summary) AS totalDays,
        (SELECT MAX(ingested_at) FROM ingested_payloads) AS lastIngested
    `,
  )[0] || { totalMetrics: 0, totalDays: 0, lastIngested: null }

  const recentWorkouts = queryDb<WorkoutRow>(
    HEALTH_DB,
    `
      SELECT workout_type, start_date, duration_seconds, active_energy_kcal,
             distance_meters, avg_heart_rate, max_heart_rate
      FROM workouts
      ORDER BY start_date DESC
      LIMIT 8
    `,
  )

  const source = loadSourceStatus()
  return {
    source,
    healthDb: {
      path: HEALTH_DB,
      available: existsSync(HEALTH_DB),
      totalMetrics: counts.totalMetrics ?? 0,
      totalDays: counts.totalDays ?? 0,
      lastIngested: counts.lastIngested,
    },
    days,
    tiles: buildAppleHealthTiles(days),
    review: buildAppleHealthReview({
      days,
      sourceAgeDays: source.sourceAgeDays,
      totalMetrics: counts.totalMetrics ?? 0,
    }),
    recentWorkouts: recentWorkouts.map((workout) => ({
      type: workout.workout_type || 'Unknown',
      startDate: workout.start_date,
      durationSeconds: numberOrNull(workout.duration_seconds),
      activeEnergyKcal: numberOrNull(workout.active_energy_kcal),
      distanceMeters: numberOrNull(workout.distance_meters),
      avgHeartRate: numberOrNull(workout.avg_heart_rate),
      maxHeartRate: numberOrNull(workout.max_heart_rate),
    })),
  }
}
