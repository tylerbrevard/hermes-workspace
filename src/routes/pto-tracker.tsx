import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { withBasePath } from '@/lib/base-path'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  ToolsActionDock,
  ToolsStatusRail,
} from '@/components/tools-action-dock'

export const Route = createFileRoute('/pto-tracker')({
  component: PtoTrackerRoute,
})

function PtoTrackerRoute() {
  usePageTitle('PTO Tracker')
  const reportUrl = useMemo(
    () => withBasePath('/reports/pto-tracker/latest.html'),
    [],
  )
  return (
    <main className="flex h-full min-h-0 flex-col bg-primary-50 text-primary-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="shrink-0 border-b border-primary-200 bg-white/90 px-4 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-neutral-400">
              People coverage
            </div>
            <div className="mt-2">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  PTO Tracker
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-primary-600 dark:text-neutral-400">
                  Direct-report PTO, coverage, and pattern review.
                </p>
              </div>
            </div>
            <ToolsStatusRail
              className="mt-4"
              label="PTO status"
              items={[
                {
                  id: 'report',
                  label: 'Report',
                  value: 'latest',
                  tone: 'good',
                  progress: 100,
                },
                {
                  id: 'policy',
                  label: 'Policy',
                  value: 'linked',
                  progress: 80,
                },
                {
                  id: 'watchlist',
                  label: 'Watchlist',
                  value: 'CSV',
                  tone: 'warning',
                  progress: 65,
                },
                {
                  id: 'export',
                  label: 'Export',
                  value: 'PDF',
                  progress: 75,
                },
              ]}
            />
            <ToolsActionDock
              className="mt-4"
              label="PTO quick actions"
              items={[
                {
                  id: 'open-report',
                  label: 'Report',
                  icon: 'file',
                  tone: 'primary',
                  href: reportUrl,
                  meta: 'Latest HTML',
                },
                {
                  id: 'follow-up',
                  label: 'Task',
                  icon: 'task',
                  href: withBasePath('/tasks?create=task&source=pto-tracker'),
                  meta: 'Follow-up',
                },
                {
                  id: 'patterns',
                  label: 'Patterns',
                  icon: 'search',
                  href: withBasePath(
                    '/reports/pto-tracker/pattern_watchlist.csv',
                  ),
                  meta: 'Evidence',
                  tone: 'warning',
                },
                {
                  id: 'archive',
                  label: 'Archive',
                  icon: 'download',
                  href: withBasePath('/reports/pto-tracker/latest.pdf'),
                  meta: 'PDF',
                },
              ]}
            />
          </section>
        </div>
      </header>
      <iframe
        title="PTO Tracker"
        src={reportUrl}
        className="h-full min-h-0 w-full flex-1 border-0 bg-white"
      />
    </main>
  )
}
