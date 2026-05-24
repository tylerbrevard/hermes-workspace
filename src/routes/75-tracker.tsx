import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { withBasePath } from '@/lib/base-path'

export const Route = createFileRoute('/75-tracker')({
  ssr: false,
  component: SeventyFiveTrackerRoute,
})

function SeventyFiveTrackerRoute() {
  usePageTitle('75 Hard/Soft')

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--theme-bg)]">
      <iframe
        title="75 Hard and 75 Soft Tracker"
        src={withBasePath('/75-day-tracker/index.html')}
        className="h-full w-full flex-1 border-0 bg-[#f6f4ef]"
      />
    </main>
  )
}

