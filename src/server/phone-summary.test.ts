import { describe, expect, it } from 'vitest'
import { buildPhoneWidgetSummary } from './phone-summary'
import type { PhoneCockpitSnapshot } from './phone-cockpit'

describe('buildPhoneWidgetSummary', () => {
  it('keeps the phone snapshot compact for widgets and lock-screen use', () => {
    const summary = buildPhoneWidgetSummary({
      checkedAt: '2026-05-26T12:00:00.000Z',
      sources: {
        presence: { ok: true, checkedAt: 'now', label: 'Presence' },
        calendar: { ok: true, checkedAt: 'now', label: 'Calendar' },
        meetingPrep: { ok: true, checkedAt: 'now', label: 'Meeting prep' },
        mail: { ok: false, checkedAt: 'now', label: 'Mail' },
        tasks: { ok: true, checkedAt: 'now', label: 'Tasks' },
        devices: { ok: true, checkedAt: 'now', label: 'Devices' },
      },
      attention: [
        {
          id: 'a1',
          kind: 'task',
          severity: 'warning',
          title: 'Approve the CAB change',
          source: 'tasks',
          observedAt: 'now',
          actionLabel: 'Review',
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
          id: 'm1',
          title: 'Ops review',
          date: '2026-05-26T14:00:00.000Z',
          minutesUntil: 42,
          joinUrl: 'https://example.com',
          actionCount: 0,
        },
        stats: null,
      },
      meetingPrep: {
        meetingId: null,
        openActionItems: [],
        previousMeetings: [],
      },
      inbox: { unread: 3, focused: [] },
      tasks: {
        total: 4,
        urgent: 2,
        overdue: 1,
        today: 1,
        items: [],
      },
      devices: {
        m5: [],
        office: { status: 'online', online: true },
      },
      shortcuts: {
        enabled: true,
        endpoint: '/api/phone-cockpit/shortcuts',
        allowedActions: ['note'],
        auth: 'bearer-token',
      },
      capture: {
        notePath: '/tmp/note.md',
        storesAudioTranscripts: false,
      },
    } as PhoneCockpitSnapshot)

    expect(summary.headline).toBe('Approve the CAB change')
    expect(summary.counters).toMatchObject({
      unread: 3,
      urgent: 2,
      overdue: 1,
      attention: 1,
    })
    expect(summary.nextMeeting?.joinAvailable).toBe(true)
    expect(summary.degradedSources).toEqual(['Mail'])
  })
})
