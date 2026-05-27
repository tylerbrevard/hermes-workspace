import { describe, expect, it } from 'vitest'
import {
  buildBarryFollowUpTask,
  buildBarryMeetingBrief,
  getBarryLastInteraction,
  getBarryNextAction,
  getBarryPrepSummary,
} from './barry-screen'

describe('BarryScreen helpers', () => {
  it('builds a real task payload from an open Barry action item', () => {
    const task = buildBarryFollowUpTask(
      {
        id: 'barry-123',
        date: '2026-05-26T14:00:00.000Z',
        status: 'upcoming',
        agenda: [],
        winsDiscussed: [],
        actionItems: [],
        notes: 'Need to close the loop before next 1-on-1.',
      },
      { text: 'Send Barry the Q2 follow-up', owner: 'Tyler', done: false },
      'Tyler',
    )

    expect(task).toMatchObject({
      title: '[Barry] Send Barry the Q2 follow-up',
      column: 'todo',
      priority: 'medium',
      assignee: 'Tyler',
      created_by: 'barry',
    })
    expect(task.tags).toContain('barry')
    expect(task.tags).toContain('follow-up')
    expect(task.tags).toContain('barry-meeting:barry-123')
    expect(task.description).toContain('Meeting id: barry-123')
  })

  it('summarizes empty next-meeting state', () => {
    expect(getBarryPrepSummary(null)).toMatchObject({
      completeness: 0,
      openActions: 0,
      hasNextMeeting: false,
      nextDate: 'not scheduled',
    })
    expect(buildBarryMeetingBrief(null)).toContain('No next 1-on-1 scheduled')
  })

  it('builds a next-meeting brief with prep completeness and decisions section', () => {
    const meeting = {
      id: 'barry-124',
      date: '2026-05-26T14:00:00.000Z',
      status: 'upcoming' as const,
      agenda: [{ text: 'Review blockers', discussed: false }],
      winsDiscussed: ['Won project'],
      actionItems: [{ text: 'Follow up', owner: 'Tyler', done: false }],
      notes: '## Notes',
    }

    expect(getBarryPrepSummary(meeting).completeness).toBe(100)
    expect(buildBarryMeetingBrief(meeting)).toContain('## Decisions')
  })

  it('selects the next Barry action and latest completed interaction', () => {
    const upcoming = {
      id: 'barry-125',
      date: '2026-05-29T14:00:00.000Z',
      status: 'upcoming' as const,
      agenda: [{ text: 'Review priorities', discussed: false }],
      winsDiscussed: [],
      actionItems: [],
      notes: '',
    }
    const ready = {
      ...upcoming,
      winsDiscussed: ['win-1'],
      actionItems: [{ text: 'Follow up', owner: 'Tyler', done: false }],
      notes: 'Ready notes',
    }

    expect(getBarryNextAction(null)).toBe('Schedule Barry 1-on-1')
    expect(getBarryNextAction(upcoming)).toBe('Prep next 1-on-1')
    expect(getBarryNextAction(ready)).toBe('Create follow-up tasks')
    expect(
      getBarryLastInteraction([
        upcoming,
        {
          ...upcoming,
          id: 'old',
          status: 'completed',
          date: '2026-05-01T12:00:00.000Z',
        },
        {
          ...upcoming,
          id: 'new',
          status: 'archived',
          date: '2026-05-10T12:00:00.000Z',
        },
      ]),
    ).toContain('May 10')
  })
})
