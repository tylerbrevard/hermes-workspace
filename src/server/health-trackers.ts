import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || join(HOME, '.hermes', 'workspace')
const HEALTH_TRACKERS_FILE =
  process.env.HERMES_HEALTH_TRACKERS_FILE ||
  join(HERMES_WORKSPACE, 'runtime', 'db', 'workspace', 'health-trackers.json')

export type HealthTrackersState = {
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

export type HealthTrackersPatch = Partial<{
  wegovy: Partial<HealthTrackersState['wegovy']>
  zyn: Partial<HealthTrackersState['zyn']>
  food: Partial<HealthTrackersState['food']>
}>

export class HealthTrackersConflictError extends Error {
  current: HealthTrackersState

  constructor(current: HealthTrackersState) {
    super('Health tracker state changed on another client')
    this.name = 'HealthTrackersConflictError'
    this.current = current
  }
}

const DEFAULT_STATE: HealthTrackersState = {
  wegovy: {
    shots: [],
    supply: 4,
    refill: new Date().toISOString().slice(0, 10),
    reminder: '08:00',
  },
  zyn: {
    entries: [],
    limit: 8,
    avoided: [],
  },
  food: {
    entries: [],
    favorites: [],
    calorieTarget: 2200,
    proteinTarget: 150,
  },
  updatedAt: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown, fallback: Array<string>) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : fallback
}

function unknownArray(value: unknown, fallback: Array<unknown>) {
  return Array.isArray(value) ? value : fallback
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function normalizeState(value: unknown): HealthTrackersState {
  const root = isRecord(value) ? value : {}
  const wegovy = isRecord(root.wegovy) ? root.wegovy : {}
  const zyn = isRecord(root.zyn) ? root.zyn : {}
  const food = isRecord(root.food) ? root.food : {}

  return {
    wegovy: {
      shots: unknownArray(wegovy.shots, DEFAULT_STATE.wegovy.shots),
      supply: numberValue(wegovy.supply, DEFAULT_STATE.wegovy.supply),
      refill: stringValue(wegovy.refill, DEFAULT_STATE.wegovy.refill),
      reminder: stringValue(wegovy.reminder, DEFAULT_STATE.wegovy.reminder),
    },
    zyn: {
      entries: unknownArray(zyn.entries, DEFAULT_STATE.zyn.entries),
      limit: numberValue(zyn.limit, DEFAULT_STATE.zyn.limit),
      avoided: stringArray(zyn.avoided, DEFAULT_STATE.zyn.avoided),
    },
    food: {
      entries: unknownArray(food.entries, DEFAULT_STATE.food.entries),
      favorites: stringArray(food.favorites, DEFAULT_STATE.food.favorites),
      calorieTarget: numberValue(
        food.calorieTarget,
        DEFAULT_STATE.food.calorieTarget,
      ),
      proteinTarget: numberValue(
        food.proteinTarget,
        DEFAULT_STATE.food.proteinTarget,
      ),
    },
    updatedAt: typeof root.updatedAt === 'string' ? root.updatedAt : null,
  }
}

export function readHealthTrackersState(): HealthTrackersState {
  if (!existsSync(HEALTH_TRACKERS_FILE)) return DEFAULT_STATE
  try {
    return normalizeState(
      JSON.parse(readFileSync(HEALTH_TRACKERS_FILE, 'utf8')),
    )
  } catch {
    return DEFAULT_STATE
  }
}

export function writeHealthTrackersPatch(
  patch: HealthTrackersPatch,
  expectedUpdatedAt?: string | null,
): HealthTrackersState {
  const current = readHealthTrackersState()
  if (
    expectedUpdatedAt !== undefined &&
    current.updatedAt !== expectedUpdatedAt
  ) {
    throw new HealthTrackersConflictError(current)
  }
  const now = new Date().toISOString()
  const next: HealthTrackersState = {
    ...current,
    wegovy: { ...current.wegovy, ...(patch.wegovy || {}) },
    zyn: { ...current.zyn, ...(patch.zyn || {}) },
    food: { ...current.food, ...(patch.food || {}) },
    updatedAt:
      now === current.updatedAt
        ? new Date(Date.parse(now) + 1).toISOString()
        : now,
  }
  mkdirSync(dirname(HEALTH_TRACKERS_FILE), { recursive: true })
  writeFileSync(HEALTH_TRACKERS_FILE, JSON.stringify(next, null, 2), 'utf8')
  return next
}
