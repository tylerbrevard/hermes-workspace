import { describe, expect, it } from 'vitest'

import { formatTaskAssigneeLabel } from './task-card'
import { TASKS_BOARD_HELP_TEXT, serializeTasksCsv } from './tasks-screen'
import type { ClaudeTask } from '@/lib/tasks-api'

describe('tasks UX copy', () => {
  it('exposes helper copy that explains drag and assignment behavior', () => {
    expect(TASKS_BOARD_HELP_TEXT).toBe(
      'Workspace Tasks is a lightweight task board. Drag cards to change status. Use Dashboard Kanban for native multi-board controls.',
    )
  })

  it('formats assignee labels explicitly for assigned and unassigned tasks', () => {
    expect(formatTaskAssigneeLabel('jarvis', { jarvis: 'Jarvis' })).toBe(
      'Assignee: Jarvis',
    )
    expect(formatTaskAssigneeLabel(null, {})).toBe('Assignee: Unassigned')
  })

  it('serializes visible tasks as escaped CSV for exports', () => {
    const task: ClaudeTask = {
      id: 'task-1',
      title: 'Fix "quoted" card',
      description: '',
      column: 'review',
      priority: 'high',
      assignee: 'swarm6',
      tags: ['ux', 'smoke'],
      due_date: '2026-05-21',
      position: 1,
      created_by: 'user',
      created_at: '2026-05-21T12:00:00Z',
      updated_at: '2026-05-21T12:30:00Z',
    }

    const csv = serializeTasksCsv([task])

    expect(csv).toContain('"Fix ""quoted"" card"')
    expect(csv).toContain('"swarm6"')
    expect(csv).toContain('"ux; smoke"')
    expect(csv.split('\n')).toHaveLength(2)
  })
})
