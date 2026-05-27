import { describe, expect, it, vi } from 'vitest'
import {
  isBooleanRecord,
  isStringArray,
  readJsonStorage,
  writeJsonStorage,
} from './typed-storage'

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key)
    }),
  }
}

describe('typed storage helpers', () => {
  it('reads valid JSON and validates shape', () => {
    const storage = memoryStorage({ habits: JSON.stringify({ water: true }) })

    expect(
      readJsonStorage('habits', {}, isBooleanRecord, storage).value,
    ).toEqual({ water: true })
  })

  it('recovers invalid JSON by removing the bad entry', () => {
    const storage = memoryStorage({ history: '{bad json' })

    expect(readJsonStorage('history', [], isStringArray, storage)).toEqual({
      value: [],
      recovered: true,
    })
    expect(storage.removeItem).toHaveBeenCalledWith('history')
  })

  it('recovers valid JSON with the wrong shape', () => {
    const storage = memoryStorage({ habits: JSON.stringify(['water']) })

    expect(readJsonStorage('habits', {}, isBooleanRecord, storage)).toEqual({
      value: {},
      recovered: true,
    })
  })

  it('writes JSON and reports success', () => {
    const storage = memoryStorage()

    expect(writeJsonStorage('history', ['checked water'], storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      'history',
      JSON.stringify(['checked water']),
    )
  })
})
