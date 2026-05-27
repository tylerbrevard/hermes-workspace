import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { withBasePath } from '@/lib/base-path'

export const Route = createFileRoute('/pto-tracker')({
  component: PtoTrackerRoute,
})

function PtoTrackerRoute() {
  const reportUrl = useMemo(
    () => withBasePath('/reports/pto-tracker/latest.html'),
    [],
  )

  return (
    <main className="flex h-full min-h-0 flex-col bg-background">
      <iframe
        title="PTO Tracker"
        src={reportUrl}
        className="h-full min-h-0 w-full flex-1 border-0 bg-white"
      />
    </main>
  )
}
