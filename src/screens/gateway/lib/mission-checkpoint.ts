// All mission state persisted to localStorage — local-first, no external DB

import { readJsonStorage, writeJsonStorage } from '@/lib/typed-storage'

export type MissionCheckpoint = {
  id: string
  label: string
  name?: string
  goal?: string
  processType: 'sequential' | 'hierarchical' | 'parallel'
  team: Array<{
    id: string
    name: string
    modelId: string
    roleDescription: string
    goal: string
    backstory: string
  }>
  tasks: Array<{
    id: string
    title: string
    status: string
    assignedTo?: string
  }>
  agentSessionMap: Record<string, string>
  agentSessions?: Record<string, string>
  agentSessionModelMap?: Record<string, string>
  status: 'running' | 'paused' | 'completed' | 'aborted'
  startedAt: number
  updatedAt: number
  completedAt?: number
  budgetLimit?: string
  report?: string
}

const CURRENT_KEY = 'clawsuite:mission-checkpoint'
const HISTORY_KEY = 'clawsuite:mission-history'
const MAX_HISTORY = 20

function isMissionCheckpoint(value: unknown): value is MissionCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<MissionCheckpoint>
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    (item.processType === 'sequential' ||
      item.processType === 'hierarchical' ||
      item.processType === 'parallel') &&
    Array.isArray(item.team) &&
    Array.isArray(item.tasks) &&
    Boolean(item.agentSessionMap) &&
    typeof item.agentSessionMap === 'object' &&
    !Array.isArray(item.agentSessionMap) &&
    (item.status === 'running' ||
      item.status === 'paused' ||
      item.status === 'completed' ||
      item.status === 'aborted') &&
    typeof item.startedAt === 'number' &&
    typeof item.updatedAt === 'number'
  )
}

function isMissionCheckpointArray(
  value: unknown,
): value is Array<MissionCheckpoint> {
  return Array.isArray(value) && value.every(isMissionCheckpoint)
}

function getMissionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function saveMissionCheckpoint(cp: MissionCheckpoint): void {
  const storage = getMissionStorage()
  if (!storage) return
  writeJsonStorage(CURRENT_KEY, { ...cp, updatedAt: Date.now() }, storage)
}

export function loadMissionCheckpoint(): MissionCheckpoint | null {
  const storage = getMissionStorage()
  if (!storage) return null
  return readJsonStorage(
    CURRENT_KEY,
    null,
    (value): value is MissionCheckpoint | null =>
      value === null || isMissionCheckpoint(value),
    storage,
  ).value
}

export function clearMissionCheckpoint(): void {
  const storage = getMissionStorage()
  if (!storage) return
  storage.removeItem(CURRENT_KEY)
}

export function archiveMissionToHistory(cp: MissionCheckpoint): void {
  const storage = getMissionStorage()
  if (!storage) return
  const history = readJsonStorage(
    HISTORY_KEY,
    [],
    isMissionCheckpointArray,
    storage,
  ).value
  history.unshift({ ...cp, completedAt: Date.now() })
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY)
  writeJsonStorage(HISTORY_KEY, history, storage)
}

export function loadMissionHistory(): Array<MissionCheckpoint> {
  const storage = getMissionStorage()
  if (!storage) return []
  return readJsonStorage(HISTORY_KEY, [], isMissionCheckpointArray, storage)
    .value
}
