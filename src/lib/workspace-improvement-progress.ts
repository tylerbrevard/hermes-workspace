import { WORKSPACE_IMPROVEMENT_PAGES } from './workspace-improvements'
import type { WorkspaceImprovementPage } from './workspace-improvements'

export const WORKSPACE_IMPROVEMENT_STORAGE_KEY =
  'hermes:workspace-improvements:completed:v1'

export const WORKSPACE_IMPROVEMENT_OPEN_EVENT =
  'hermes:open-workspace-improvements'

export type CompletedMap = Record<string, boolean>

export type ImprovementCategory =
  | 'Mobile'
  | 'Reliability'
  | 'Automation'
  | 'Navigation'
  | 'Data'
  | 'Experience'

export type ImprovementStatus = 'all' | 'open' | 'done'

export type ImprovementScope = 'current' | 'all'

export type IndexedImprovement = {
  page: WorkspaceImprovementPage
  index: number
  item: string
  key: string
  category: ImprovementCategory
  completed: boolean
}

export type FilteredImprovementPage = {
  page: WorkspaceImprovementPage
  items: Array<IndexedImprovement>
}

export const IMPROVEMENT_CATEGORIES: Array<ImprovementCategory> = [
  'Experience',
  'Mobile',
  'Reliability',
  'Automation',
  'Navigation',
  'Data',
]

const CATEGORY_KEYWORDS: Array<{
  category: ImprovementCategory
  words: Array<string>
}> = [
  {
    category: 'Mobile',
    words: ['mobile', 'touch', 'swipe', 'one-hand', 'joystick'],
  },
  {
    category: 'Reliability',
    words: [
      'health',
      'diagnostic',
      'fallback',
      'warning',
      'failure',
      'stale',
      'safe',
      'conflict',
      'latency',
      'reconnect',
      'sla',
    ],
  },
  {
    category: 'Automation',
    words: ['automation', 'job', 'cron', 'retry', 'rerun', 'schedule'],
  },
  {
    category: 'Navigation',
    words: [
      'search',
      'filter',
      'launcher',
      'palette',
      'breadcrumbs',
      'portal',
      'shortcut',
      'switcher',
    ],
  },
  {
    category: 'Data',
    words: [
      'export',
      'import',
      'timeline',
      'history',
      'chart',
      'sparkline',
      'artifact',
      'source',
      'freshness',
      'log',
      'score',
    ],
  },
]

export function improvementItemKey(pageId: string, index: number) {
  return `${pageId}:${index}`
}

export function inferImprovementCategory(item: string): ImprovementCategory {
  const normalized = item.toLowerCase()
  const match = CATEGORY_KEYWORDS.find((entry) =>
    entry.words.some((word) => normalized.includes(word)),
  )
  return match?.category ?? 'Experience'
}

export function indexWorkspaceImprovements(
  completed: CompletedMap,
): Array<IndexedImprovement> {
  return WORKSPACE_IMPROVEMENT_PAGES.flatMap((page) =>
    page.recommendations.map((item, index) => {
      const key = improvementItemKey(page.id, index)
      return {
        page,
        index,
        item,
        key,
        category: inferImprovementCategory(item),
        completed: Boolean(completed[key]),
      }
    }),
  )
}

export function getImprovementStats(completed: CompletedMap, pageId?: string) {
  const items = indexWorkspaceImprovements(completed).filter(
    (item) => !pageId || item.page.id === pageId,
  )
  const done = items.filter((item) => item.completed).length
  const total = items.length
  return {
    done,
    open: total - done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

export function filterWorkspaceImprovements({
  completed,
  page,
  scope,
  query,
  status,
  category,
}: {
  completed: CompletedMap
  page: WorkspaceImprovementPage | null
  scope: ImprovementScope
  query: string
  status: ImprovementStatus
  category: ImprovementCategory | 'all'
}): Array<FilteredImprovementPage> {
  const normalizedQuery = query.trim().toLowerCase()
  const activePages =
    scope === 'current' && page ? [page] : WORKSPACE_IMPROVEMENT_PAGES

  return activePages
    .map((candidate) => {
      const items = candidate.recommendations
        .map((item, index) => {
          const key = improvementItemKey(candidate.id, index)
          const indexed: IndexedImprovement = {
            page: candidate,
            index,
            item,
            key,
            category: inferImprovementCategory(item),
            completed: Boolean(completed[key]),
          }
          return indexed
        })
        .filter((item) => {
          if (status === 'open' && item.completed) return false
          if (status === 'done' && !item.completed) return false
          if (category !== 'all' && item.category !== category) return false
          if (!normalizedQuery) return true
          return `${candidate.label} ${candidate.route} ${item.item} ${item.category}`
            .toLowerCase()
            .includes(normalizedQuery)
        })

      return { page: candidate, items }
    })
    .filter((candidate) => candidate.items.length > 0)
}

export function serializeImprovementPlan(
  completed: CompletedMap,
  format: 'json' | 'markdown',
) {
  const pages = WORKSPACE_IMPROVEMENT_PAGES.map((page) => ({
    page: page.label,
    route: page.route,
    recommendations: page.recommendations.map((item, index) => ({
      item,
      category: inferImprovementCategory(item),
      completed: Boolean(completed[improvementItemKey(page.id, index)]),
    })),
  }))

  if (format === 'json') return JSON.stringify(pages, null, 2)

  return pages
    .map((page) => {
      const lines = page.recommendations.map(
        (item, index) =>
          `${index + 1}. [${item.completed ? 'x' : ' '}] ${item.item} (${item.category})`,
      )
      return `## ${page.page} (${page.route})\n${lines.join('\n')}`
    })
    .join('\n\n')
}
