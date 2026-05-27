import { useRouterState } from '@tanstack/react-router'

const routeLabels: Array<[RegExp, string]> = [
  [/^\/dashboard/, 'Loading workspace health'],
  [/^\/lily/, 'Loading LILY voice controls'],
  [/^\/chat/, 'Loading chat session'],
  [/^\/playground/, 'Loading HermesWorld'],
  [/^\/jobs/, 'Loading automation jobs'],
  [/^\/tasks/, 'Loading tasks'],
  [/^\/75-tracker/, 'Loading 75 Hard/Soft tracker'],
  [/^\/wegovy/, 'Loading Wegovy shots'],
  [/^\/zyn-tracker/, 'Loading Zyn tracker'],
  [/^\/food-log/, 'Loading food log'],
  [/^\/conductor/, 'Loading conductor missions'],
  [/^\/meetings/, 'Loading meeting context'],
  [/^\/presence/, 'Loading presence state'],
  [/^\/it-ops/, 'Loading ConnectWise operations'],
  [/^\/barry/, 'Loading Barry context'],
  [/^\/memory/, 'Loading memory browser'],
  [/^\/skills/, 'Loading skills browser'],
  [/^\/mcp/, 'Loading MCP servers'],
  [/^\/profiles/, 'Loading profiles'],
  [/^\/settings/, 'Loading settings'],
  [/^\/operations/, 'Loading agent operations'],
  [/^\/swarm/, 'Loading swarm runtime'],
  [/^\/ops-intelligence/, 'Loading ops intelligence'],
  [/^\/files/, 'Loading files'],
  [/^\/terminal/, 'Opening terminal'],
]

function getRouteLabel(pathname: string) {
  return (
    routeLabels.find(([pattern]) => pattern.test(pathname))?.[1] ??
    'Loading workspace page'
  )
}

export function RouteLoadingSkeleton() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const label = getRouteLabel(pathname)

  return (
    <div
      className="h-full min-h-[360px] bg-[var(--theme-bg)] p-4 md:p-6"
      aria-busy="true"
      aria-label={label}
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="h-4 w-40 animate-pulse rounded bg-primary-200" />
            <div className="mt-3 h-8 w-72 max-w-[70vw] animate-pulse rounded bg-primary-200" />
          </div>
          <div className="hidden h-9 w-32 animate-pulse rounded bg-primary-200 sm:block" />
        </div>
        <p className="text-sm text-primary-500">{label}...</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-lg border border-primary-200 bg-primary-100" />
          <div className="h-28 animate-pulse rounded-lg border border-primary-200 bg-primary-100" />
          <div className="h-28 animate-pulse rounded-lg border border-primary-200 bg-primary-100" />
        </div>
        <div className="min-h-0 flex-1 animate-pulse rounded-lg border border-primary-200 bg-primary-100" />
      </div>
    </div>
  )
}
