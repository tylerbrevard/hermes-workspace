export type StorageParseResult<T> = {
  value: T
  recovered: boolean
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function readJsonStorage<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
  storage?: StorageLike,
): StorageParseResult<T> {
  const target = getStorage(storage)
  if (!target) return { value: fallback, recovered: false }

  try {
    const raw = target.getItem(key)
    if (!raw) return { value: fallback, recovered: false }
    const parsed = JSON.parse(raw)
    if (validate(parsed)) return { value: parsed, recovered: false }
    target.removeItem(key)
    return { value: fallback, recovered: true }
  } catch {
    try {
      target.removeItem(key)
    } catch {
      // Best effort cleanup only.
    }
    return { value: fallback, recovered: true }
  }
}

export function writeJsonStorage<T>(
  key: string,
  value: T,
  storage?: StorageLike,
): boolean {
  const target = getStorage(storage)
  if (!target) return false

  try {
    target.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function isBooleanRecord(
  value: unknown,
): value is Record<string, boolean> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every(
      (entry) => typeof entry === 'boolean',
    )
  )
}

export function isStringArray(value: unknown): value is Array<string> {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}
