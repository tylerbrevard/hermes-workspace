import { describe, expect, it } from 'vitest'

import { formatTaskAssigneeLabel } from './task-card'
import {
  TASKS_BOARD_HELP_TEXT,
  getInitialTasksSearchState,
  getOwnerWorkload,
  getTaskColumnEmptyState,
  getTaskDiagnostics,
  getTaskDueLane,
  getTaskDueRisk,
  getTaskFocusSections,
  getTaskFollowUpTarget,
  getTaskProvenance,
  getTaskSource,
  getTaskSourceGroups,
  getTodayPromiseTask,
  isDelegatedTask,
  isDueToday,
  isWaitingTask,
  readTasksViewPreferences,
  serializeTasksCsv,
  writeTasksViewPreferences,
} from './tasks-screen'
import type { ClaudeTask } from '@/lib/tasks-api'

describe('tasks UX copy', () => {
  it('exposes concise helper copy for the board scope', () => {
    expect(TASKS_BOARD_HELP_TEXT).toBe(
      'Active work, blockers, follow-ups, and review handoffs in one board.',
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

  it('classifies today, waiting, and delegated task filters', () => {
    const today = new Date().toISOString().slice(0, 10)

    expect(isDueToday({ due_date: today, column: 'todo' })).toBe(true)
    expect(isDueToday({ due_date: today, column: 'done' })).toBe(false)
    expect(
      isWaitingTask({
        title: 'Waiting on approval',
        description: '',
        tags: [],
        column: 'todo',
      }),
    ).toBe(true)
    expect(
      isWaitingTask({
        title: 'Ship dashboard card',
        description: '',
        tags: ['workspace-flow'],
        column: 'todo',
      }),
    ).toBe(false)
    expect(isDelegatedTask({ assignee: 'swarm6', column: 'review' })).toBe(true)
    expect(isDelegatedTask({ assignee: null, column: 'review' })).toBe(false)
  })

  it('builds blocked-by-me and waiting-on-others focus sections', () => {
    const tasks: Array<ClaudeTask> = [
      {
        id: 'blocked-1',
        title: 'Needs Tyler approval',
        description: '',
        column: 'blocked',
        priority: 'high',
        assignee: 'tyler',
        tags: [],
        due_date: null,
        position: 1,
        created_by: 'user',
        created_at: '2026-05-26T12:00:00Z',
        updated_at: '2026-05-26T12:00:00Z',
      },
      {
        id: 'waiting-1',
        title: 'Waiting on customer',
        description: '',
        column: 'todo',
        priority: 'medium',
        assignee: null,
        tags: [],
        due_date: null,
        position: 2,
        created_by: 'user',
        created_at: '2026-05-26T12:00:00Z',
        updated_at: '2026-05-26T12:00:00Z',
      },
      {
        id: 'done-waiting',
        title: 'Waiting but complete',
        description: '',
        column: 'done',
        priority: 'low',
        assignee: null,
        tags: [],
        due_date: null,
        position: 3,
        created_by: 'user',
        created_at: '2026-05-26T12:00:00Z',
        updated_at: '2026-05-26T12:00:00Z',
      },
    ]

    const sections = getTaskFocusSections(tasks)

    expect(sections).toHaveLength(2)
    expect(sections[0]?.id).toBe('blocked-by-me')
    expect(sections[0]?.tasks.map((task) => task.id)).toEqual(['blocked-1'])
    expect(sections[1]?.id).toBe('waiting-on-others')
    expect(sections[1]?.tasks.map((task) => task.id)).toEqual(['waiting-1'])
  })

  it('derives task board entry state from route search', () => {
    expect(
      getInitialTasksSearchState({
        assignee: 'swarm6',
        filter: 'waiting',
        create: 'task',
        column: 'review',
      }),
    ).toEqual({
      assignee: 'swarm6',
      filter: 'waiting',
      createTask: true,
      column: 'review',
    })

    expect(getInitialTasksSearchState({})).toEqual({
      assignee: null,
      filter: 'all',
      createTask: false,
      column: 'backlog',
    })
  })

  it('persists typed view preferences and recovers invalid entries', () => {
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value)
      },
      removeItem: (key: string) => {
        entries.delete(key)
      },
    }

    expect(
      writeTasksViewPreferences(
        { showDone: true, searchText: 'approval', savedFilter: 'blocked' },
        storage,
      ),
    ).toBe(true)
    expect(readTasksViewPreferences(storage)).toEqual({
      showDone: true,
      searchText: 'approval',
      savedFilter: 'blocked',
    })

    entries.set(
      'hermes-tasks-view-preferences-v1',
      JSON.stringify({ showDone: 'yes', searchText: 42, savedFilter: 'bad' }),
    )
    expect(readTasksViewPreferences(storage)).toEqual({
      showDone: false,
      searchText: '',
      savedFilter: 'all',
    })
    expect(entries.has('hermes-tasks-view-preferences-v1')).toBe(false)
  })

  it('uses column-specific empty states before falling back to filters', () => {
    expect(getTaskColumnEmptyState('blocked', false)).toEqual({
      title: 'No blockers',
      description: 'Anything waiting on you will appear here.',
    })
    expect(getTaskColumnEmptyState('review', false).title).toBe(
      'No review handoffs',
    )
    expect(getTaskColumnEmptyState('todo', true)).toEqual({
      title: 'No matching tasks',
      description: 'Clear search or change filters to widen this lane.',
    })
  })

  it('builds due lanes, provenance, workload, follow-up, and diagnostics metadata', () => {
    const today = new Date().toISOString().slice(0, 10)
    const task: ClaudeTask = {
      id: 'task-chat',
      title: 'Waiting on Alex for chat follow-up',
      description: 'Created from chat session and linked to files',
      column: 'todo',
      priority: 'high',
      assignee: 'alex',
      tags: ['chat'],
      due_date: today,
      position: 1,
      created_by: 'agent',
      created_at: '2026-05-26T12:00:00Z',
      updated_at: '2026-05-26T12:00:00Z',
      session_id: 'session-1',
    }

    expect(getTaskDueLane(task)).toBe('today')
    expect(getTaskProvenance(task)).toBe('created from chat')
    expect(getTaskFollowUpTarget(task)).toBe('Alex for chat follow-up')
    expect(getTaskDiagnostics(task)).toContain('linked session session-1')
    expect(getOwnerWorkload([task])).toEqual([
      { owner: 'alex', count: 1, blocked: 1 },
    ])
  })

  it('groups tasks by source and selects a today promise', () => {
    const today = new Date().toISOString().slice(0, 10)
    const tasks: Array<ClaudeTask> = [
      {
        id: 'phone-1',
        title: 'Phone capture: call Alex',
        description: 'Follow up with Alex',
        column: 'todo',
        priority: 'medium',
        assignee: null,
        tags: ['phone'],
        due_date: null,
        position: 1,
        created_by: 'user',
        created_at: '2026-05-26T12:00:00Z',
        updated_at: '2026-05-26T12:00:00Z',
      },
      {
        id: 'meeting-1',
        title: 'Meeting transcript follow-up',
        description: '',
        column: 'todo',
        priority: 'high',
        assignee: 'tyler',
        tags: ['meeting'],
        due_date: today,
        position: 2,
        created_by: 'agent',
        created_at: '2026-05-26T12:00:00Z',
        updated_at: '2026-05-26T12:00:00Z',
      },
    ]

    expect(getTaskSource(tasks[0])).toBe('phone capture')
    expect(getTaskSourceGroups(tasks)).toEqual([
      { source: 'phone capture', count: 1, blocked: 1 },
      { source: 'meetings', count: 1, blocked: 1 },
    ])
    expect(getTodayPromiseTask(tasks)?.id).toBe('meeting-1')
    expect(getTaskDueRisk(tasks[1])).toEqual({
      label: 'Due today',
      severity: 'warning',
    })
  })
})
