import { apiPath } from './base-path'
import type {
  AppleHealthDailySummary,
  AppleHealthReview,
  AppleHealthTile,
} from './apple-health-insights'

export type AppleHealthDashboardPayload = {
  source: {
    available: boolean
    latestDate: string | null
    latestUpdate: string | null
    recentDays: number
    sourceAgeDays: number | null
    status: string
  }
  healthDb: {
    path: string
    available: boolean
    totalMetrics: number
    totalDays: number
    lastIngested: string | null
  }
  days: Array<AppleHealthDailySummary>
  tiles: Array<AppleHealthTile>
  review: AppleHealthReview
  recentWorkouts: Array<{
    type: string
    startDate: string
    durationSeconds: number | null
    activeEnergyKcal: number | null
    distanceMeters: number | null
    avgHeartRate: number | null
    maxHeartRate: number | null
  }>
}

export async function fetchAppleHealthDashboard() {
  const response = await fetch(apiPath('/api/apple-health'), {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Apple Health HTTP ${response.status}`)
  return (await response.json()) as AppleHealthDashboardPayload
}
