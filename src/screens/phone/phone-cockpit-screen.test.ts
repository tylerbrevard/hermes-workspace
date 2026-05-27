import { describe, expect, it } from 'vitest'
import {
  buildPhoneAtAGlance,
  buildPhoneDailyLoopSignals,
  buildPhoneFreshnessNotice,
  buildPhoneModeReadouts,
  buildPhoneSignalRail,
  describeQueuedCapture,
  nextPhoneTab,
  quickLogPhoneFood,
  quickLogPhoneWegovy,
  quickLogPhoneZyn,
  removePhoneQuickLog,
  toggleCollapsedCardSet,
} from './lib/phone-cockpit-helpers'
import type { PhoneCockpitSnapshot } from '@/server/phone-cockpit'

describe('phone cockpit tabs', () => {
  it('moves through Today, Work, and Systems without wrapping past edges', () => {
    expect(nextPhoneTab('today', 'next')).toBe('work')
    expect(nextPhoneTab('work', 'next')).toBe('systems')
    expect(nextPhoneTab('systems', 'next')).toBe('systems')
    expect(nextPhoneTab('systems', 'previous')).toBe('work')
    expect(nextPhoneTab('work', 'previous')).toBe('today')
    expect(nextPhoneTab('today', 'previous')).toBe('today')
  })
})

describe('phone card collapse preferences', () => {
  it('toggles a card id in an immutable set', () => {
    const initial = new Set(['needs' as const])
    const withoutNeeds = toggleCollapsedCardSet(initial, 'needs')
    const withCapture = toggleCollapsedCardSet(withoutNeeds, 'capture')

    expect(initial.has('needs')).toBe(true)
    expect(withoutNeeds.has('needs')).toBe(false)
    expect(withCapture.has('capture')).toBe(true)
  })
})

describe('phone mode readouts', () => {
  it('summarizes commute, meeting, and desk state for glance use', () => {
    const snapshot: PhoneCockpitSnapshot = {
      checkedAt: '2026-05-26T14:00:00.000Z',
      sources: {
        presence: {
          ok: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          label: 'Presence',
        },
        calendar: {
          ok: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          label: 'Calendar',
        },
        meetingPrep: {
          ok: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          label: 'Meeting prep',
        },
        mail: {
          ok: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          label: 'Mail',
        },
        tasks: {
          ok: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          label: 'Tasks',
        },
        devices: {
          ok: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          label: 'Devices',
        },
      },
      attention: [
        {
          id: 'mail-1',
          kind: 'mail',
          severity: 'warning',
          title: 'Approval needed',
          source: 'mail',
          observedAt: '2026-05-26T14:00:00.000Z',
        },
      ],
      presence: {
        availability: 'Available',
        activity: 'Available',
        displayName: 'Tyler',
        color: 'green',
      },
      schedule: {
        meetings: [],
        nextMeeting: {
          id: 'meeting-1',
          title: 'CAB Review',
          date: '2026-05-26T14:20:00.000Z',
          minutesUntil: 20,
          joinUrl: 'https://example.com/meet',
        },
        stats: null,
      },
      meetingPrep: {
        meetingId: null,
        openActionItems: [],
        previousMeetings: [],
      },
      inbox: { unread: 4, focused: [] },
      tasks: { total: 3, urgent: 2, overdue: 0, today: 1, items: [] },
      devices: {
        m5: [],
        office: {
          status: 'online',
          online: true,
          checkedAt: '2026-05-26T14:00:00.000Z',
          displayMode: 'focus',
          deskMode: 'work',
          replyLength: 'short',
        },
      },
      shortcuts: {
        enabled: true,
        endpoint: '/workspace/api/phone-cockpit',
        allowedActions: ['note', 'task', 'draft'],
        auth: 'bearer-token',
      },
      capture: {
        notePath: '/tmp/Hermes Phone Capture.md',
        storesAudioTranscripts: false,
      },
    }

    const readouts = buildPhoneModeReadouts(snapshot)

    expect(readouts.commute.title).toContain('CAB Review')
    expect(readouts.commute.detail).toContain('4 unread mail')
    expect(readouts.meeting.active).toBe(true)
    expect(readouts.meeting.detail).toContain('Join link is ready')
    expect(readouts.desk.online).toBe(true)
    expect(readouts.desk.detail).toContain('display focus')

    const glance = buildPhoneAtAGlance(snapshot)
    expect(glance.map((item) => item.label)).toEqual([
      'Next event',
      'Urgent tasks',
      'Waiting',
      'Desk state',
      'Source health',
    ])
    expect(glance.find((item) => item.label === 'Waiting')?.value).toBe(
      '1 me / 0 others',
    )

    const rail = buildPhoneSignalRail(snapshot)
    expect(rail.map((item) => item.id)).toEqual([
      'meeting',
      'tasks',
      'mail',
      'desk',
      'sources',
    ])
    expect(rail.find((item) => item.id === 'meeting')?.tone).toBe('warn')
    expect(rail.find((item) => item.id === 'desk')?.value).toBe('online')
  })
})

describe('phone daily loop signals', () => {
  it('keeps subpage entry points available without browser storage', () => {
    const signals = buildPhoneDailyLoopSignals()

    expect(signals.map((item) => item.href).sort()).toEqual([
      '/75-tracker',
      '/food-log',
      '/pto-tracker',
      '/wegovy',
      '/zyn-tracker',
    ])
    expect(signals[0]?.id).toBe('food')
  })
})

describe('phone freshness notice', () => {
  it('stays quiet when current and speaks up when stale or degraded', () => {
    const now = Date.parse('2026-05-26T14:12:00.000Z')
    const originalNow = Date.now
    Date.now = () => now
    try {
      expect(
        buildPhoneFreshnessNotice('2026-05-26T14:08:00.000Z', 0),
      ).toBeNull()
      expect(buildPhoneFreshnessNotice('2026-05-26T13:58:00.000Z', 0)).toBe(
        '14m ago',
      )
      expect(buildPhoneFreshnessNotice('2026-05-26T14:08:00.000Z', 2)).toBe(
        '2 sources degraded',
      )
      expect(
        buildPhoneFreshnessNotice('2026-05-26T14:08:00.000Z', 0, {
          presence: {
            ok: true,
            checkedAt: '2026-05-26T13:58:00.000Z',
            label: 'Presence',
          },
          calendar: {
            ok: true,
            checkedAt: '2026-05-26T14:08:00.000Z',
            label: 'Calendar',
          },
          meetingPrep: {
            ok: true,
            checkedAt: '2026-05-26T14:08:00.000Z',
            label: 'Meeting prep',
          },
          mail: {
            ok: true,
            checkedAt: '2026-05-26T14:08:00.000Z',
            label: 'Mail',
          },
          tasks: {
            ok: true,
            checkedAt: '2026-05-26T14:08:00.000Z',
            label: 'Tasks',
          },
          devices: {
            ok: true,
            checkedAt: '2026-05-26T14:08:00.000Z',
            label: 'Devices',
          },
        }),
      ).toBe('Presence stale 14m')
    } finally {
      Date.now = originalNow
    }
  })
})

describe('phone quick logs', () => {
  it('writes compatible tracker entries and removes them for undo', () => {
    const store = new Map<string, string>()
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
        },
      },
    })

    try {
      const zyn = quickLogPhoneZyn(new Date('2026-05-26T14:12:00.000Z'), 6)
      expect(zyn.strengthMg).toBe(6)
      expect(
        JSON.parse(store.get('workspace.health.zyn.entries') ?? '[]')[0].count,
      ).toBe(1)

      const food = quickLogPhoneFood(
        'chicken rice bowl',
        { meal: 'Lunch', barcode: '123', photoName: 'front label' },
        new Date('2026-05-26T14:12:00.000Z'),
      )
      expect(food).toMatchObject({
        meal: 'Lunch',
        barcode: '123',
        photoName: 'front label',
        protein: 38,
      })

      store.set('workspace.health.wegovy.supply', '4')
      const wegovy = quickLogPhoneWegovy(new Date('2026-05-26T14:12:00.000Z'), {
        doseMg: 0.5,
        site: 'Left thigh',
      })
      expect(wegovy.entry).toMatchObject({
        doseMg: 0.5,
        site: 'Left thigh',
      })
      expect(store.get('workspace.health.wegovy.supply')).toBe('3')

      expect(removePhoneQuickLog('workspace.health.zyn.entries', zyn.id)).toBe(
        true,
      )
      expect(
        JSON.parse(store.get('workspace.health.zyn.entries') ?? '[]'),
      ).toEqual([])
      expect(
        removePhoneQuickLog(
          'workspace.health.wegovy.shots',
          wegovy.entry?.id ?? '',
          true,
        ),
      ).toBe(true)
      expect(store.get('workspace.health.wegovy.supply')).toBe('4')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
  })
})

describe('phone offline queue readouts', () => {
  it('reports queue age, retry count, and last error', () => {
    const status = describeQueuedCapture(
      {
        createdAt: '2026-05-26T14:00:00.000Z',
        retryCount: 2,
        lastTriedAt: '2026-05-26T14:05:00.000Z',
        error: 'Graph unavailable',
      },
      Date.parse('2026-05-26T14:12:00.000Z'),
    )

    expect(status).toEqual({
      age: '12m old',
      retries: '2 retries',
      lastTriedAt: '2026-05-26T14:05:00.000Z',
      lastError: 'Graph unavailable',
    })
  })
})
