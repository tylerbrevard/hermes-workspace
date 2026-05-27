import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalFile = process.env.HERMES_HEALTH_TRACKERS_FILE

afterEach(() => {
  if (originalFile === undefined) delete process.env.HERMES_HEALTH_TRACKERS_FILE
  else process.env.HERMES_HEALTH_TRACKERS_FILE = originalFile
  vi.resetModules()
})

describe('health tracker server store', () => {
  it('persists partial tracker patches without dropping other sections', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'health-trackers-'))
    process.env.HERMES_HEALTH_TRACKERS_FILE = join(dir, 'state.json')
    vi.resetModules()

    const store = await import('./health-trackers')

    const first = store.writeHealthTrackersPatch({
      zyn: {
        entries: [
          {
            id: 'z1',
            date: '2026-05-26',
            time: '09:00 AM',
            count: 1,
            strengthMg: 6,
            trigger: 'Focus',
            note: '',
          },
        ],
      },
    })
    expect(first.zyn.entries).toHaveLength(1)
    expect(first.food.calorieTarget).toBe(2200)

    const second = store.writeHealthTrackersPatch({
      food: {
        calorieTarget: 2100,
      },
    })
    expect(second.zyn.entries).toHaveLength(1)
    expect(second.food.calorieTarget).toBe(2100)

    const raw = JSON.parse(
      readFileSync(process.env.HERMES_HEALTH_TRACKERS_FILE, 'utf8'),
    )
    expect(raw.updatedAt).toEqual(expect.any(String))
  })

  it('rejects stale writes when an expected update token is supplied', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'health-trackers-'))
    process.env.HERMES_HEALTH_TRACKERS_FILE = join(dir, 'state.json')
    vi.resetModules()

    const store = await import('./health-trackers')

    const first = store.writeHealthTrackersPatch({
      zyn: { limit: 7 },
    })
    const second = store.writeHealthTrackersPatch(
      {
        zyn: { limit: 6 },
      },
      first.updatedAt,
    )

    expect(() =>
      store.writeHealthTrackersPatch({ zyn: { limit: 5 } }, first.updatedAt),
    ).toThrow(store.HealthTrackersConflictError)
    expect(second.zyn.limit).toBe(6)
  })
})
