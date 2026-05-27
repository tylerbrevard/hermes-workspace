import { describe, expect, it } from 'vitest'
import {
  buildMeetingActionTodoItems,
  buildMeetingBriefMarkdown,
  buildMeetingExtractionSummary,
  classifyTylerRole,
  formatMeetingTitle,
  getMeetingEmptyState,
  getMeetingOwnerChips,
  getMeetingSeverity,
  getMeetingTrendInterpretation,
  isMeetingPrepWindow,
  meetingMatchesReviewFilter,
  meetingMatchesSearch,
} from './lib/meeting-workflow'

const meeting = {
  id: 'm1',
  title: 'Ops Review',
  date: '2026-05-26T12:00:00.000Z',
  reviewed: false,
  content: 'Discussed action items.',
  hasTranscription: true,
  participants: ['Tyler', 'Ava'],
  actionItems: [
    { id: 'a1', text: 'Follow up', status: 'open', assignee: 'Tyler' },
  ],
  issues: [{ id: 'i1', title: 'Blocked', status: 'open' }],
  decisions: [{ id: 'd1', text: 'Ship it' }],
}

describe('MeetingsScreen helpers', () => {
  it('summarizes extraction confidence and review state', () => {
    expect(buildMeetingExtractionSummary(meeting)).toMatchObject({
      actionCount: 1,
      issueCount: 1,
      decisionCount: 1,
      confidence: 'high',
      reviewState: 'needs review',
    })
  })

  it('filters review, action, prep, and transcript states', () => {
    const now = new Date('2026-05-26T09:00:00.000Z')
    expect(meetingMatchesReviewFilter(meeting, 'needs-review')).toBe(true)
    expect(meetingMatchesReviewFilter(meeting, 'has-open-actions')).toBe(true)
    expect(meetingMatchesReviewFilter(meeting, 'today', now)).toBe(true)
    expect(meetingMatchesReviewFilter(meeting, 'this-week', now)).toBe(true)
    expect(
      meetingMatchesReviewFilter({ ...meeting, content: '' }, 'no-prep'),
    ).toBe(true)
    expect(
      meetingMatchesReviewFilter(
        { ...meeting, hasTranscription: false },
        'no-transcript',
      ),
    ).toBe(true)
    expect(
      meetingMatchesReviewFilter(
        { ...meeting, content: '', hasTranscription: false },
        'missing-notes',
      ),
    ).toBe(true)
    expect(meetingMatchesReviewFilter(meeting, 'needs-follow-up')).toBe(true)
  })

  it('builds briefs and empty-state guidance for auth-required branches', () => {
    expect(classifyTylerRole(meeting)).toBe('owner/direct participant')
    expect(buildMeetingBriefMarkdown(meeting)).toContain('# Ops Review')
    expect(
      buildMeetingBriefMarkdown(meeting, { redactParticipants: true }),
    ).toContain('Attendees: 2 attendee(s), redacted')
    expect(
      formatMeetingTitle(
        '[EXTERNAL]Canceled: Current/resolve(Next Steps) Placeholder',
      ),
    ).toBe('Canceled: Next Steps')
    expect(getMeetingEmptyState('Unauthorized Graph token')).toContain(
      'Calendar auth required',
    )
  })

  it('detects prep windows, severity, owner chips, and local search', () => {
    expect(
      isMeetingPrepWindow(
        { ...meeting, date: '2026-05-26T12:00:00.000Z' },
        24,
        new Date('2026-05-26T09:00:00.000Z'),
      ),
    ).toBe(true)
    expect(getMeetingSeverity(meeting)).toBe('attention')
    expect(
      getMeetingSeverity({
        ...meeting,
        reviewed: true,
        actionItems: [{ id: 'a1', text: 'Done', status: 'completed' }],
        issues: [
          {
            id: 'i1',
            title: 'Outage',
            status: 'open',
            priority: 'critical',
          },
        ],
      }),
    ).toBe('blocked')
    expect(getMeetingOwnerChips(meeting)).toContain('Owner: Tyler')
    expect(meetingMatchesSearch(meeting, 'ava follow')).toBe(true)
  })

  it('builds deduped To Do handoff items and trend guidance', () => {
    expect(
      buildMeetingActionTodoItems(meeting, [
        {
          id: 'a1',
          text: 'Follow up',
          assignee: 'Tyler',
          meetingTitle: 'Ops Review',
        },
      ]),
    ).toHaveLength(1)
    expect(
      getMeetingTrendInterpretation([
        {
          date: '2026-05-26',
          dayLabel: 'Tue',
          meetingCount: 6,
          totalHours: 6,
          intensity: 3,
        },
        {
          date: '2026-05-27',
          dayLabel: 'Wed',
          meetingCount: 7,
          totalHours: 7,
          intensity: 4,
        },
        {
          date: '2026-05-28',
          dayLabel: 'Thu',
          meetingCount: 5,
          totalHours: 5,
          intensity: 3,
        },
      ]),
    ).toContain('3 heavy meeting days')
  })
})
