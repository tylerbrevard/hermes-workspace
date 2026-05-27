import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { McpServerCard } from './components/mcp-server-card'
import { McpServerDialog } from './components/mcp-server-dialog'
import { InstallConfirmationDialog } from './components/install-confirmation-dialog'
import { useMcpCapabilityMode } from './hooks/use-mcp-capability-mode'
import { useMcpServers } from './hooks/use-mcp-servers'
import { useMcpHub } from './hooks/use-mcp-hub'
import { SourcesManagerDialog } from './components/sources-manager-dialog'
import type { HubMcpEntry } from './hooks/use-mcp-hub'
import type { McpClientInput, McpServer } from '@/types/mcp'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { withBasePath } from '@/lib/base-path'

type Tab = 'installed' | 'marketplace'
type McpFocus = 'all' | 'failed' | 'stale' | 'auth'

const TOOLBAR_FIELD =
  'h-9 w-full min-w-0 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none transition-colors focus:border-primary sm:min-w-[220px]'

function formatRefreshTime(updatedAt: number): string {
  if (!updatedAt) return 'not loaded yet'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(updatedAt)
}

function daysSince(value?: string): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000))
}

function isStaleServer(server: McpServer): boolean {
  const age = daysSince(server.lastTestedAt)
  return !server.lastTestedAt || (age != null && age > 7)
}

export function getMcpConfigPaths(mode: string) {
  const expected = '/Users/tylerlyon/.hermes/config.yaml'
  const detected =
    mode === 'fallback'
      ? '/Users/tylerlyon/.hermes/config.yaml'
      : 'Hermes Agent /api/mcp runtime'
  return { expected, detected }
}

export function getMcpSecurityIndicators(server: McpServer): Array<string> {
  const indicators: Array<string> = []
  if (server.transportType === 'http') indicators.push('remote tools')
  if (
    server.command ||
    server.args.some((arg) => /file|fs|path|dir/i.test(arg))
  ) {
    indicators.push('file access')
  }
  if (server.authType !== 'none' || server.hasBearerToken) {
    indicators.push('credentialed')
  }
  if (indicators.length === 0) indicators.push('local low-risk')
  return indicators
}

export function getMcpOwnership(server: McpServer): string {
  const name = server.name.toLowerCase()
  if (name.includes('github')) return 'GitHub workflows and code review jobs'
  if (name.includes('outlook') || name.includes('email')) return 'mailbox jobs'
  if (name.includes('browser') || name.includes('chrome'))
    return 'browser QA jobs'
  if (name.includes('memory') || name.includes('agentdb')) return 'memory jobs'
  return 'Hermes and Codex agent jobs'
}

export function buildMcpDiagnosticsExport(servers: Array<McpServer>): string {
  return JSON.stringify(
    servers.map((server) => ({
      name: server.name,
      status: server.status,
      enabled: server.enabled,
      transportType: server.transportType,
      tools: server.discoveredToolsCount,
      lastTestedAt: server.lastTestedAt ?? null,
      lastError: server.lastError ?? null,
      security: getMcpSecurityIndicators(server),
      owner: getMcpOwnership(server),
    })),
    null,
    2,
  )
}

export function getMcpEmptyStateCopy(mode: string) {
  if (mode === 'fallback') {
    return 'Backend support is in config fallback mode. Add only known local servers, test each connection, and do not paste secrets into marketplace templates.'
  }
  return 'Add a server, test the connection, then discover tools before routing agent work to it. Do not install unverified remote tools without reviewing the command and permissions.'
}

export function sortMcpServersForAttention(servers: Array<McpServer>) {
  return [...servers].sort((left, right) => {
    const score = (server: McpServer) => {
      if (server.status === 'failed') return 0
      if (server.lastError) return 1
      if (isStaleServer(server)) return 2
      if (!server.enabled) return 3
      if (server.status === 'connected') return 5
      return 4
    }
    const scoreDiff = score(left) - score(right)
    if (scoreDiff !== 0) return scoreDiff
    return left.name.localeCompare(right.name)
  })
}

export function getMcpPrimaryAction(server: McpServer): string {
  if (server.status === 'failed') return 'Test and inspect logs'
  if (server.lastError) return 'Open failed diagnostic'
  if (server.authType !== 'none' || server.hasBearerToken) return 'Verify auth'
  if (isStaleServer(server)) return 'Retest server'
  if (!server.enabled) return 'Enable when needed'
  return 'Review tools'
}

export function getMcpCapabilityMatrixRows(servers: Array<McpServer>) {
  return sortMcpServersForAttention(servers).map((server) => ({
    id: server.id,
    name: server.name,
    tools: server.discoveredToolsCount,
    resources: server.transportType === 'http' ? 'remote' : 'local',
    prompts: server.discoveredTools.some((tool) =>
      /prompt|template|chat/i.test(`${tool.name} ${tool.description ?? ''}`),
    )
      ? 'yes'
      : 'unknown',
    auth:
      server.authType === 'none' && !server.hasBearerToken
        ? 'none'
        : server.authType,
    risk: getMcpSecurityIndicators(server).join(', '),
    action: getMcpPrimaryAction(server),
  }))
}

export function getMcpSkillRoute(server: McpServer): string {
  const text = `${server.name} ${server.discoveredTools
    .map((tool) => `${tool.name} ${tool.description ?? ''}`)
    .join(' ')}`.toLowerCase()
  if (text.includes('github')) return '/skills?search=github'
  if (text.includes('browser') || text.includes('chrome'))
    return '/skills?search=browser'
  if (text.includes('memory') || text.includes('agentdb'))
    return '/skills?search=memory'
  if (text.includes('email') || text.includes('outlook'))
    return '/skills?search=outlook'
  return '/skills?search=mcp'
}

export function McpScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('installed')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<McpServer | McpClientInput | null>(
    null,
  )
  const [installEntry, setInstallEntry] = useState<HubMcpEntry | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [focus, setFocus] = useState<McpFocus>('all')

  const { mode: capabilityMode } = useMcpCapabilityMode()
  const configPaths = getMcpConfigPaths(capabilityMode)
  // Marketplace tab uses useMcpHub instead; coerce to 'installed' so the
  // server-list query stays valid but its results aren't rendered there.
  const serverListTab = tab === 'marketplace' ? 'installed' : tab
  const query = useMcpServers({ tab: serverListTab, category, search })
  const servers = query.data?.servers ?? []
  const attentionServers = useMemo(
    () => sortMcpServersForAttention(servers),
    [servers],
  )
  const visibleServers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const focused = attentionServers.filter((server) => {
      if (focus === 'failed')
        return server.status === 'failed' || Boolean(server.lastError)
      if (focus === 'stale') return isStaleServer(server)
      if (focus === 'auth')
        return server.authType !== 'none' || server.hasBearerToken
      return true
    })
    if (!normalized) return focused
    return focused.filter((server) => {
      const toolText = server.discoveredTools
        .map((tool) => `${tool.name} ${tool.description ?? ''}`)
        .join(' ')
        .toLowerCase()
      return (
        server.name.toLowerCase().includes(normalized) ||
        toolText.includes(normalized)
      )
    })
  }, [attentionServers, focus, search])
  const lastErrorServer =
    servers.find((server) => server.lastError) ??
    servers.find((server) => server.status === 'failed') ??
    null
  const staleServers = useMemo(
    () => servers.filter((server) => isStaleServer(server)),
    [servers],
  )
  const categories = query.data?.categories ?? ['All']
  const serverCounts = useMemo(
    () =>
      servers.reduce(
        (counts, server) => {
          counts.total += 1
          if (server.enabled) counts.enabled += 1
          if (server.status === 'connected') counts.connected += 1
          if (server.status === 'failed') counts.failed += 1
          if (server.source === 'preset') counts.presets += 1
          return counts
        },
        { total: 0, enabled: 0, connected: 0, failed: 0, presets: 0 },
      ),
    [servers],
  )

  const hubQuery = useMcpHub(tab === 'marketplace' ? search : '')

  function handleTabChange(next: string | number | null) {
    if (next === 'installed' || next === 'marketplace') {
      setTab(next)
      setSearch('')
    }
  }

  const totalLabel =
    tab === 'marketplace'
      ? `${(hubQuery.data?.total ?? 0).toLocaleString()} results`
      : `${servers.length.toLocaleString()} servers`

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                Hermes Workspace · MCP
              </p>
              <h1 className="text-2xl font-medium text-ink text-balance sm:text-3xl">
                MCP Servers
              </h1>
              <p className="text-sm text-primary-500 text-pretty sm:text-base">
                Discover, install, and manage Model Context Protocol servers
                exposed to Hermes Agent.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              Add Server
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {[
              ['Total', serverCounts.total],
              ['Enabled', serverCounts.enabled],
              ['Connected', serverCounts.connected],
              ['Failed', serverCounts.failed],
              ['Presets', serverCounts.presets],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-primary-200 bg-primary-100/60 px-3 py-2"
              >
                <span className="text-primary-500">{label}</span>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-primary-500">
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Source: Hermes Agent MCP endpoints
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Last refreshed: {formatRefreshTime(query.dataUpdatedAt)}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Health:{' '}
              {query.isError
                ? 'server list unavailable'
                : serverCounts.failed > 0
                  ? `${serverCounts.failed} failing`
                  : 'no failures reported'}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Stale catalogs: {staleServers.length}
            </span>
            <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1">
              Config: {configPaths.detected}
            </span>
          </div>
          <details className="mt-3 rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2 text-xs text-primary-600">
            <summary className="cursor-pointer font-semibold text-primary-700">
              Model Context Protocol help
            </summary>
            <p className="mt-1 text-pretty">
              MCP servers expose external tools to agents. Test connection,
              inspect tools, review security scope, and only then route Hermes
              or Codex jobs to the server.
            </p>
          </details>
          {capabilityMode === 'fallback' ? (
            <div
              role="status"
              className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              ⚠ Local fallback mode — using config.yaml. Test, Discover, and
              Logs require the new hermes-agent /api/mcp endpoints.
            </div>
          ) : null}
          <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
            <div className="rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-500">
                Server health
              </span>
              <span className="mt-1 block text-lg font-semibold text-ink">
                {serverCounts.failed > 0
                  ? `${serverCounts.failed} failing`
                  : staleServers.length > 0
                    ? `${staleServers.length} stale checks`
                    : `${serverCounts.connected} connected`}
              </span>
              <span className="mt-0.5 block truncate text-primary-500">
                {serverCounts.enabled} enabled of {serverCounts.total}
              </span>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2 md:col-span-2">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-500">
                Last tool error
              </span>
              {lastErrorServer ? (
                <>
                  <span className="mt-1 block font-semibold text-ink">
                    {lastErrorServer.name}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-primary-500">
                    {lastErrorServer.lastError ||
                      `${lastErrorServer.status} on last check`}
                  </span>
                </>
              ) : (
                <>
                  <span className="mt-1 block font-semibold text-ink">
                    No tool errors reported
                  </span>
                  <span className="mt-0.5 block text-primary-500">
                    Run Test on stale servers before relying on them.
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs sm:grid-cols-4">
            {[
              { key: 'all' as const, label: 'All', value: serverCounts.total },
              {
                key: 'failed' as const,
                label: 'Recently failed',
                value:
                  serverCounts.failed +
                  servers.filter((server) => server.lastError).length,
              },
              {
                key: 'stale' as const,
                label: 'Stale',
                value: staleServers.length,
              },
              {
                key: 'auth' as const,
                label: 'Auth',
                value: servers.filter(
                  (server) =>
                    server.authType !== 'none' || server.hasBearerToken,
                ).length,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFocus(item.key)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  focus === item.key
                    ? 'border-primary-900 bg-primary-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                    : 'border-primary-200 bg-primary-100/50 text-primary-600 hover:bg-primary-100'
                }`}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-wide">
                  {item.label}
                </span>
                <span className="mt-1 block text-xl font-semibold">
                  {item.value}
                </span>
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-2 md:hidden">
          {visibleServers.slice(0, 3).map((server) => (
            <article
              key={`mobile-${server.id}`}
              className="rounded-xl border border-primary-200 bg-primary-50/85 px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-ink">{server.name}</div>
                  <div className="mt-1 text-xs text-primary-500">
                    {server.status} · {server.discoveredToolsCount} tools
                  </div>
                </div>
                <a
                  href={withBasePath(getMcpSkillRoute(server))}
                  className="rounded-lg border border-primary-200 bg-primary-100/60 px-2 py-1 text-xs text-primary-700"
                >
                  Skills
                </a>
              </div>
              <div className="mt-2 line-clamp-2 text-xs text-primary-500">
                {server.lastError || getMcpPrimaryAction(server)}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-500">
                Capability Matrix
              </h2>
              <p className="text-xs text-primary-500">
                Tools, resources, prompts, auth, risk, and skill handoff per
                server.
              </p>
            </div>
          </div>
          <div className="mt-3 overflow-auto rounded-xl border border-primary-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-primary-100 text-xs uppercase tracking-[0.12em] text-primary-500">
                <tr>
                  <th className="px-3 py-2">Server</th>
                  <th className="px-3 py-2">Tools</th>
                  <th className="px-3 py-2">Resources</th>
                  <th className="px-3 py-2">Prompts</th>
                  <th className="px-3 py-2">Auth</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Skills</th>
                </tr>
              </thead>
              <tbody>
                {getMcpCapabilityMatrixRows(visibleServers)
                  .slice(0, 12)
                  .map((row) => {
                    const serverForRow = visibleServers.find(
                      (server) => server.id === row.id,
                    )
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-primary-200 text-primary-700"
                      >
                        <td className="px-3 py-2 font-medium text-ink">
                          {row.name}
                        </td>
                        <td className="px-3 py-2">{row.tools}</td>
                        <td className="px-3 py-2">{row.resources}</td>
                        <td className="px-3 py-2">{row.prompts}</td>
                        <td className="px-3 py-2">{row.auth}</td>
                        <td className="px-3 py-2">{row.risk}</td>
                        <td className="px-3 py-2">{row.action}</td>
                        <td className="px-3 py-2">
                          {serverForRow ? (
                            <a
                              href={withBasePath(
                                getMcpSkillRoute(serverForRow),
                              )}
                              className="underline-offset-2 hover:underline"
                            >
                              Open
                            </a>
                          ) : (
                            'n/a'
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-wrap items-center gap-2">
              <TabsList
                className="rounded-xl border border-primary-200 bg-primary-100/60 p-1"
                variant="default"
              >
                <TabsTab value="installed" className="min-w-[110px]">
                  Installed
                </TabsTab>
                <TabsTab value="marketplace" className="min-w-[120px]">
                  Marketplace
                </TabsTab>
              </TabsList>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  tab === 'marketplace'
                    ? 'Search MCP catalog…'
                    : 'Search servers and tools'
                }
                className={`${TOOLBAR_FIELD} flex-1`}
              />

              {tab === 'installed' ? (
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-9 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <TabsPanel value="installed" className="pt-3">
              <ServerList
                query={query}
                servers={visibleServers}
                capabilityMode={capabilityMode}
                onEdit={(s) => {
                  setEditing(s)
                  setDialogOpen(true)
                }}
              />
            </TabsPanel>
            <TabsPanel value="marketplace" className="pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {hubQuery.data?.source ? (
                  <div className="text-xs text-primary-500">
                    Source: {hubQuery.data.source}
                  </div>
                ) : (
                  <div />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSourcesOpen(true)}
                >
                  Sources
                </Button>
              </div>

              {hubQuery.data?.warnings && hubQuery.data.warnings.length > 0 ? (
                hubQuery.data.results.length > 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠ One or more sources unavailable; showing local results.
                    <span className="ml-1 text-[11px] text-primary-500">
                      ({hubQuery.data.warnings[0]})
                    </span>
                  </p>
                ) : (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    {hubQuery.data.warnings[0]}
                  </div>
                )
              ) : null}

              {hubQuery.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {hubQuery.error instanceof Error
                    ? hubQuery.error.message
                    : 'Failed to load marketplace.'}
                </div>
              ) : null}

              <MarketplaceGrid
                entries={(hubQuery.data?.results ?? []).filter(
                  (e) => !e.installed,
                )}
                loading={hubQuery.isPending}
                onInstall={setInstallEntry}
              />

              {hubQuery.hasNextPage ? (
                <div className="flex items-center justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={hubQuery.isFetchingNextPage}
                    onClick={() => hubQuery.fetchNextPage()}
                  >
                    {hubQuery.isFetchingNextPage
                      ? 'Loading…'
                      : `Load more (${(hubQuery.data?.results.length ?? 0).toLocaleString()} of ${(hubQuery.data?.total ?? 0).toLocaleString()})`}
                  </Button>
                </div>
              ) : null}
            </TabsPanel>
          </Tabs>
        </section>

        <footer className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2.5 text-sm text-primary-500 tabular-nums">
          <span>{totalLabel}</span>
          <span className="text-xs">
            mode: {capabilityMode === 'fallback' ? 'config fallback' : 'native'}
          </span>
        </footer>
      </div>

      <McpServerDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
      />

      <InstallConfirmationDialog
        entry={installEntry}
        onClose={() => setInstallEntry(null)}
        onInstalled={() => {
          queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] })
          queryClient.invalidateQueries({ queryKey: ['mcp', 'hub-search'] })
        }}
      />

      <SourcesManagerDialog
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
    </div>
  )
}

interface ServerListProps {
  query: ReturnType<typeof useMcpServers>
  servers: Array<McpServer>
  capabilityMode: string
  onEdit: (server: McpServer) => void
}

function ServerList({
  query,
  servers,
  capabilityMode,
  onEdit,
}: ServerListProps) {
  if (query.isLoading) {
    return (
      <EmptyCard
        title="Loading servers…"
        description="Fetching MCP servers from Hermes Agent."
      />
    )
  }
  if (query.isError) {
    return (
      <EmptyCard
        title="Failed to load servers"
        description={query.error.message}
        tone="danger"
      />
    )
  }
  if (servers.length === 0) {
    return (
      <EmptyCard
        title="No MCP servers configured"
        description={getMcpEmptyStateCopy(capabilityMode)}
      />
    )
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary-200 bg-primary-100/50 px-3 py-2 text-xs text-primary-600">
        Log snippets for failed MCP startup are shown on each card when
        available. Ownership lanes map servers to the agent/job that depends on
        them.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {servers.map((server) => (
          <McpServerCard key={server.id} server={server} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

interface EmptyCardProps {
  title: string
  description?: string
  tone?: 'neutral' | 'danger'
}

function EmptyCard({ title, description, tone = 'neutral' }: EmptyCardProps) {
  const toneClasses =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
      : 'border-primary-200 bg-primary-50/80 text-primary-500'
  return (
    <div
      className={`rounded-xl border border-dashed px-4 py-10 text-center ${toneClasses}`}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-primary-500">{description}</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MarketplaceGrid — Phase 3.0 Marketplace tab
// ---------------------------------------------------------------------------

const TRUST_PILL: Record<string, { label: string; className: string }> = {
  official: {
    label: 'Official',
    className:
      'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
  },
  community: {
    label: 'Community',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  unverified: {
    label: 'Unverified',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
  },
}

const SOURCE_LABEL: Record<string, string> = {
  'mcp-get': 'mcp.run',
  local: 'Local',
}

interface MarketplaceGridProps {
  entries: Array<HubMcpEntry>
  loading: boolean
  onInstall: (entry: HubMcpEntry) => void
}

function MarketplaceGrid({
  entries,
  loading,
  onInstall,
}: MarketplaceGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-primary-200 bg-primary-50/70 p-4 min-h-[160px]"
          >
            <div className="mb-3 h-4 w-2/5 rounded-md bg-primary-100" />
            <div className="mb-2 h-3 w-3/4 rounded-md bg-primary-100" />
            <div className="h-3 w-1/2 rounded-md bg-primary-100" />
            <div className="mt-4 h-8 w-1/3 rounded-md bg-primary-100" />
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyCard
        title="No results"
        description="Try a different search term. The registry may be unavailable — local presets are used as fallback."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {entries.map((entry) => {
          const trust = TRUST_PILL[entry.trust] ?? TRUST_PILL.unverified
          const sourceLabel = SOURCE_LABEL[entry.source] ?? entry.source

          return (
            <motion.article
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-2 rounded-xl border border-primary-200 bg-primary-50/85 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-base font-medium text-ink text-balance line-clamp-1">
                      {entry.name}
                    </h3>
                    {entry.installed ? (
                      <span
                        className="shrink-0 rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                        aria-label="Installed"
                      >
                        Installed
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-primary-500 text-pretty">
                    {entry.description || 'No description.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${trust.className}`}
                >
                  {trust.label}
                </span>
                <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-[11px] font-medium text-primary-500">
                  {sourceLabel}
                </span>
                {entry.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-[11px] text-primary-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-end gap-2 pt-2">
                {entry.installed ? (
                  <span className="text-xs text-primary-500">
                    Already installed
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onInstall(entry)}
                  >
                    Review install
                  </Button>
                )}
              </div>
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
