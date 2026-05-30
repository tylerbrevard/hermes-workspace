import { describe, expect, it } from 'vitest'
import {
  buildClientUpdate,
  buildConnectWiseActionQueue,
  buildExecutiveDashboardStats,
  buildInternalTicketBrief,
  buildItOpsBriefing,
  buildItOpsDiagnosticsExport,
  getConnectWiseTicketUrl,
  getItOpsSourceState,
  getNativePsaGuidance,
  getTicketApprovalBoundary,
  getTicketSlaLabel,
} from './it-ops-screen'

describe('ItOpsScreen helpers', () => {
  it('prioritizes SLA, approval, owner, priority, and stale ticket actions', () => {
    const now = Date.now()
    const tickets = [
      {
        id: 100,
        summary: 'Old standard request',
        board: 'Service Desk',
        status: 'New',
        priority: 'Normal',
        owner: 'Tyler',
        company: 'Acme',
        dateEntered: new Date(now - 96 * 3_600_000).toISOString(),
        requiredDate: null,
      },
      {
        id: 101,
        summary: 'CAB approval required',
        board: 'Change',
        status: 'Waiting Approval',
        priority: 'Normal',
        owner: 'Tyler',
        company: 'Acme',
        dateEntered: new Date(now - 2 * 3_600_000).toISOString(),
        requiredDate: null,
      },
      {
        id: 102,
        summary: 'Critical outage',
        board: 'Service Desk',
        status: 'In Progress',
        priority: 'Critical',
        owner: 'Sam',
        company: 'Acme',
        dateEntered: new Date(now - 1 * 3_600_000).toISOString(),
        requiredDate: null,
      },
      {
        id: 103,
        summary: 'No owner',
        board: 'Service Desk',
        status: 'New',
        priority: 'Normal',
        owner: 'Unassigned',
        company: 'Acme',
        dateEntered: new Date(now - 1 * 3_600_000).toISOString(),
        requiredDate: null,
      },
      {
        id: 104,
        summary: 'Due soon',
        board: 'Service Desk',
        status: 'In Progress',
        priority: 'Normal',
        owner: 'Sam',
        company: 'Acme',
        dateEntered: new Date(now - 1 * 3_600_000).toISOString(),
        requiredDate: new Date(now + 2 * 3_600_000).toISOString(),
      },
    ]

    const actions = buildConnectWiseActionQueue(tickets)

    expect(actions.map((action) => action.kind)).toEqual([
      'sla-risk',
      'approval',
      'unassigned',
      'priority',
      'stale',
    ])
    expect(actions[0]?.ticket.id).toBe(104)
  })

  it('classifies zero-ticket, auth-required, stale-source, and healthy states', () => {
    expect(getItOpsSourceState(null, 'ConnectWise unauthorized')).toBe(
      'auth-required',
    )
    expect(
      getItOpsSourceState({ analytics: { recentTickets: [] } } as any),
    ).toBe('zero-ticket')
    expect(
      getItOpsSourceState({
        analytics: { recentTickets: [{ id: 1 }], errors: ['stale'] },
      } as any),
    ).toBe('stale-source')
    expect(
      getItOpsSourceState({
        analytics: { recentTickets: [{ id: 1 }], errors: [] },
      } as any),
    ).toBe('healthy')
  })

  it('exports source timestamps and native PSA guidance', () => {
    const briefing = buildItOpsBriefing({
      analytics: {
        fetchedAt: '2026-05-26T12:00:00.000Z',
        ticketStats: {
          open: 3,
          closedToday: 1,
          avgResolutionHours: 2,
          slaCompliancePct: 99,
        },
        recentTickets: [],
      },
      overview: { generatedAt: '2026-05-26T11:00:00.000Z' },
    } as any)

    expect(briefing).toContain('ConnectWise source')
    expect(getNativePsaGuidance()).toContain('native ConnectWise')
  })

  it('builds native ticket links, SLA labels, and approval boundaries', () => {
    const now = Date.parse('2026-05-27T12:00:00.000Z')
    const ticket = {
      id: 200,
      summary: 'CAB approval required',
      board: 'Change',
      status: 'Waiting Approval',
      priority: 'High',
      owner: 'Tyler',
      company: 'Acme',
      dateEntered: '2026-05-27T10:00:00.000Z',
      requiredDate: '2026-05-27T14:00:00.000Z',
      ticketUrl: 'https://cw.example/ticket/200',
    }

    expect(getConnectWiseTicketUrl(ticket)).toBe(
      'https://cw.example/ticket/200',
    )
    expect(getTicketSlaLabel(ticket, now)).toBe('Due 2h')
    expect(getTicketApprovalBoundary(ticket)).toBe(
      'Native ConnectWise approval',
    )
  })

  it('builds copy templates and diagnostics without exposing secrets', () => {
    const ticket = {
      id: 201,
      summary: 'Printer down',
      board: 'Service Desk',
      status: 'New',
      priority: 'Normal',
      owner: 'Unassigned',
      company: 'Acme',
      dateEntered: '2026-05-27T10:00:00.000Z',
      requiredDate: null,
    }
    const diagnostics = buildItOpsDiagnosticsExport({
      analytics: {
        fetchedAt: '2026-05-27T12:00:00.000Z',
        ticketStats: {
          open: 1,
          closedToday: 0,
          avgResolutionHours: 0,
          slaCompliancePct: 100,
        },
        recentTickets: [ticket],
        errors: ['ConnectWise not configured'],
      },
      overview: { generatedAt: '2026-05-27T11:00:00.000Z' },
    } as any)

    expect(buildClientUpdate(ticket)).toContain('Client update')
    expect(buildInternalTicketBrief(ticket)).toContain('Boundary:')
    expect(diagnostics).toContain('nativePsaBoundary')
    expect(diagnostics).not.toContain('privateKey')
  })

  it('builds executive dashboard stats with Tyler and direct-report load', () => {
    const stats = buildExecutiveDashboardStats({
      analytics: {
        ticketStats: {
          open: 12,
          closedToday: 4,
          avgResolutionHours: 7,
          slaCompliancePct: 96,
        },
        queueBreakdown: [
          { queue: 'Service Desk', count: 8 },
          { queue: 'Projects', count: 4 },
        ],
        recentTickets: [
          {
            id: 301,
            summary: 'CAB approval required',
            board: 'Change',
            status: 'Waiting Approval',
            priority: 'Normal',
            owner: 'Tyler',
            company: 'Acme',
            dateEntered: '2026-05-27T10:00:00.000Z',
            requiredDate: null,
          },
          {
            id: 302,
            summary: 'Printer outage',
            board: 'Service Desk',
            status: 'New',
            priority: 'High',
            owner: 'Unassigned',
            company: 'Acme',
            dateEntered: '2026-05-27T10:00:00.000Z',
            requiredDate: null,
          },
        ],
      },
      overview: {
        totalMeetings: 3,
        actionItems: [
          {
            id: 'a1',
            meetingId: 'm1',
            meetingDate: '2026-05-27',
            assignee: 'Tyler',
            task: 'Approve change',
            isTyler: true,
          },
          {
            id: 'a2',
            meetingId: 'm1',
            meetingDate: '2026-05-27',
            assignee: 'Adam Acevedo',
            task: 'Close stale ticket',
            isDirectReport: true,
          },
        ],
        recurringIssues: [{ label: 'Backlog', count: 2, dates: [] }],
      },
    } as any)

    expect(stats.posture).toBe('Watch')
    expect(stats.topBoard).toBe('Service Desk')
    expect(stats.tylerActionCount).toBe(1)
    expect(stats.directReportActionCount).toBe(1)
    expect(stats.tylerTouchedTicketCount).toBe(1)
    expect(stats.unassignedCount).toBe(1)
  })
})
