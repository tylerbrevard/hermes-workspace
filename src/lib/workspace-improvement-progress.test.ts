import { describe, expect, it } from 'vitest'
import {
  filterWorkspaceImprovements,
  getImprovementStats,
  improvementItemKey,
  inferImprovementCategory,
  serializeImprovementPlan,
} from './workspace-improvement-progress'
import {
  countWorkspaceRecommendations,
  findWorkspaceImprovementPage,
} from './workspace-improvements'
import type { CompletedMap } from './workspace-improvement-progress'

describe('workspace improvement progress helpers', () => {
  it('summarizes total and page progress from persisted completion keys', () => {
    const completed: CompletedMap = {
      [improvementItemKey('dashboard', 0)]: true,
      [improvementItemKey('dashboard', 1)]: true,
      [improvementItemKey('tasks', 0)]: true,
    }

    const total = countWorkspaceRecommendations()

    expect(getImprovementStats(completed)).toMatchObject({
      done: 3,
      open: total - 3,
      total,
      percent: 1,
    })
    expect(getImprovementStats(completed, 'dashboard')).toMatchObject({
      done: 2,
      open: 18,
      total: 20,
      percent: 10,
    })
  })

  it('filters current page improvements by status, category, and query', () => {
    const page = findWorkspaceImprovementPage('/dashboard')
    expect(page?.id).toBe('dashboard')

    const completed: CompletedMap = {
      [improvementItemKey('dashboard', 6)]: true,
    }
    const result = filterWorkspaceImprovements({
      completed,
      page: page ?? null,
      scope: 'current',
      query: 'mobile',
      status: 'done',
      category: 'Mobile',
    })

    expect(result).toHaveLength(1)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0]).toMatchObject({
      item: 'Add a "today only" mobile digest that hides lower-priority analytics until expanded.',
      category: 'Mobile',
      completed: true,
    })
  })

  it('exports a markdown execution plan with completion state and categories', () => {
    const markdown = serializeImprovementPlan(
      { [improvementItemKey('75-tracker', 1)]: true },
      'markdown',
    )

    expect(markdown).toContain('## 75 Hard/Soft (/75-tracker)')
    expect(markdown).toContain('2. [x]')
    expect(markdown).toContain('(Mobile)')
  })

  it('derives stable categories from recommendation language', () => {
    expect(inferImprovementCategory('Mobile compact cards')).toBe('Mobile')
    expect(inferImprovementCategory('Retry failed job button')).toBe(
      'Automation',
    )
    expect(inferImprovementCategory('Custom KPI pinning')).toBe('Experience')
  })
})
