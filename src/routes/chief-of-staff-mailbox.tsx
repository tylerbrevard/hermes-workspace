import { createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Mail01Icon } from '@hugeicons/core-free-icons'
import { useMemo } from 'react'
import type { ToolsStatusRailItem } from '@/components/tools-action-dock'
import { withBasePath } from '@/lib/base-path'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'
import {
  ToolsActionDock,
  ToolsStatusRail,
} from '@/components/tools-action-dock'

export const Route = createFileRoute('/chief-of-staff-mailbox')({
  component: ChiefOfStaffMailboxRoute,
})

function ChiefOfStaffMailboxRoute() {
  usePageTitle('Chief of Staff Mailbox')
  const reportUrl = useMemo(
    () => withBasePath('/reports/chief-of-staff-mailbox/latest.html'),
    [],
  )
  const taskUrl = withBasePath(
    '/tasks?create=task&source=chief-of-staff-mailbox',
  )
  const actionTiles: Array<ToolsStatusRailItem> = [
    {
      id: 'reply',
      label: 'Reply queue',
      value: 'Reply',
      tone: 'warning',
      progress: 70,
    },
    {
      id: 'delegate',
      label: 'Delegation',
      value: 'Assign',
      progress: 55,
    },
    {
      id: 'cleanup',
      label: 'Cleanup',
      value: 'Dry-run',
      tone: 'good',
      progress: 80,
    },
    {
      id: 'evidence',
      label: 'Evidence',
      value: 'Digest',
      progress: 100,
    },
  ]
  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 pb-[calc(var(--tabbar-h,0px)+24px)] sm:px-5 lg:px-6">
        <section className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-accent)]">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    size={22}
                    strokeWidth={1.8}
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                    Mailbox CoS
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                    Chief of Staff Mailbox
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--theme-muted)]">
                    Reply risk, delegation, cleanup, and evidence.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {['Reply', 'Me', 'Them', 'FYI'].map(
                  (item, index) => (
                    <span
                      key={item}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium',
                        index === 0
                          ? 'border-amber-300/40 bg-amber-400/10 text-amber-600'
                          : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-muted)]',
                      )}
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="border-t border-[var(--theme-border)] bg-[var(--theme-bg)] p-4 lg:border-l lg:border-t-0">
              <ToolsStatusRail
                label="Mailbox status"
                className="xl:grid-cols-1"
                items={[
                  {
                    id: 'needs-tyler',
                    label: 'Needs Tyler',
                    value: 'Review',
                    tone: 'warning',
                    progress: 70,
                  },
                  {
                    id: 'waiting',
                    label: 'Waiting',
                    value: 'Track',
                    progress: 45,
                  },
                  {
                    id: 'digest',
                    label: 'Digest',
                    value: 'Ready',
                    tone: 'good',
                    progress: 100,
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
            <ToolsStatusRail label="Mailbox triage" items={actionTiles} />
          </div>

          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
              Action dock
            </p>
            <ToolsActionDock
              className="mt-3 lg:grid-cols-2"
              label="Mailbox quick actions"
              items={[
                {
                  id: 'digest',
                  label: 'Digest',
                  icon: 'mail',
                  tone: 'primary',
                  href: reportUrl,
                  meta: 'Latest',
                },
                {
                  id: 'task',
                  label: 'Task',
                  icon: 'task',
                  href: taskUrl,
                  meta: 'Commitment',
                },
                {
                  id: 'source',
                  label: 'Source',
                  icon: 'file',
                  href: withBasePath(
                    '/files?path=runtime/reports/chief-of-staff-mailbox',
                  ),
                  meta: 'Artifacts',
                },
                {
                  id: 'auth',
                  label: 'Graph',
                  icon: 'shield',
                  href: withBasePath('/settings'),
                  meta: 'Repair',
                  tone: 'good',
                },
              ]}
            />
          </div>
        </section>

        <section className="min-h-[720px] overflow-hidden rounded-lg border border-[var(--theme-border)] bg-white shadow-sm">
          <iframe
            title="Chief of Staff Mailbox"
            src={reportUrl}
            className="h-[720px] min-h-0 w-full border-0 bg-white"
          />
        </section>
      </div>
    </main>
  )
}
