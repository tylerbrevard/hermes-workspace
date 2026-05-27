import { apiPath } from './base-path'

export type HealthTrackersClientState = {
  wegovy: {
    shots: Array<unknown>
    supply: number
    refill: string
    reminder: string
  }
  zyn: {
    entries: Array<unknown>
    limit: number
    avoided: Array<string>
  }
  food: {
    entries: Array<unknown>
    favorites: Array<string>
    calorieTarget: number
    proteinTarget: number
  }
  updatedAt: string | null
}

export type HealthTrackersClientPatch = Partial<{
  wegovy: Partial<HealthTrackersClientState['wegovy']>
  zyn: Partial<HealthTrackersClientState['zyn']>
  food: Partial<HealthTrackersClientState['food']>
}>

export class HealthTrackersClientConflictError extends Error {
  current: HealthTrackersClientState

  constructor(current: HealthTrackersClientState) {
    super('Health tracker state changed on another client')
    this.name = 'HealthTrackersClientConflictError'
    this.current = current
  }
}

export async function fetchHealthTrackersState() {
  const response = await fetch(apiPath('/api/health-trackers'), {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Health trackers HTTP ${response.status}`)
  return (await response.json()) as HealthTrackersClientState
}

export async function patchHealthTrackersState(
  patch: HealthTrackersClientPatch,
  expectedUpdatedAt?: string | null,
) {
  const response = await fetch(apiPath('/api/health-trackers'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      expectedUpdatedAt === undefined ? patch : { ...patch, expectedUpdatedAt },
    ),
  })
  if (response.status === 409) {
    const body = (await response.json()) as {
      current?: HealthTrackersClientState
    }
    if (body.current) throw new HealthTrackersClientConflictError(body.current)
  }
  if (!response.ok) throw new Error(`Health trackers HTTP ${response.status}`)
  return (await response.json()) as HealthTrackersClientState
}
