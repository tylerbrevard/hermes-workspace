export type WorkspaceRouteOwner =
  | 'daily'
  | 'agent-ops'
  | 'knowledge'
  | 'systems'
  | 'settings'

export type WorkspaceRouteRegistryEntry = {
  route: string
  label: string
  owner: WorkspaceRouteOwner
  runtimeDependencies: Array<string>
  smokeText: string
  mobileSmokeText?: string
  escalationPath: string
}

export type WorkspaceRouteSmokeFixture = {
  route: string
  label: string
  smokeText: string
  mobileSmokeText?: string
}

export type WorkspaceRouteDiagnosticContext = {
  registry: WorkspaceRouteRegistryEntry | null
  smokeAssertions: {
    desktopText: string | null
    mobileText: string | null
  }
  routeFixtures: Array<WorkspaceRouteSmokeFixture>
  liveSourceDrilldowns: Array<{
    label: string
    target: string
  }>
}

const WORKSPACE_ROUTE_SMOKE_FIXTURES: Record<
  string,
  Array<WorkspaceRouteSmokeFixture>
> = {
  '/jobs': [
    {
      route: '/jobs?smokeFixture=failed',
      label: 'Failed job state',
      smokeText: 'Smoke fixture failure',
      mobileSmokeText: 'Smoke fixture failure',
    },
  ],
  '/tasks': [
    {
      route: '/tasks?create=task',
      label: 'Create task modal',
      smokeText: 'Tasks',
      mobileSmokeText: 'Tasks',
    },
  ],
  '/75-tracker': [
    {
      route: '/75-tracker?mode=hard&quick=1',
      label: 'Hard-mode quick view',
      smokeText: '1 gallon',
      mobileSmokeText: '1 gallon',
    },
  ],
  '/operations': [
    {
      route: '/operations?create=agent',
      label: 'Create agent modal',
      smokeText: 'Agent',
      mobileSmokeText: 'Agent',
    },
  ],
}

function getLiveSourceTarget(dependency: string) {
  const normalized = dependency.toLowerCase()
  if (normalized.includes('api')) return '/workspace/files?path=src/server'
  if (normalized.includes('gateway')) return '/workspace/operations'
  if (normalized.includes('config')) return '/workspace/files?path=config'
  if (normalized.includes('storage') || normalized.includes('store'))
    return '/workspace/settings'
  if (normalized.includes('graph') || normalized.includes('teams'))
    return '/workspace/presence'
  if (normalized.includes('connectwise')) return '/workspace/it-ops'
  if (normalized.includes('skills')) return '/workspace/skills'
  if (normalized.includes('memory')) return '/workspace/memory'
  if (normalized.includes('profiles')) return '/workspace/profiles'
  return '/workspace/files'
}

export const WORKSPACE_ROUTE_REGISTRY: Array<WorkspaceRouteRegistryEntry> = [
  {
    route: '/dashboard',
    label: 'Dashboard',
    owner: 'daily',
    runtimeDependencies: ['dashboard overview API', 'gateway status'],
    smokeText: 'Hermes Workspace',
    mobileSmokeText: 'Quick Actions',
    escalationPath: 'Refresh gateway, then inspect dashboard overview source.',
  },
  {
    route: '/phone',
    label: 'Phone',
    owner: 'daily',
    runtimeDependencies: ['phone cockpit API', 'tasks', 'meetings'],
    smokeText: 'Phone',
    escalationPath: 'Check phone summary API and local capture queue.',
  },
  {
    route: '/lily',
    label: 'LILY',
    owner: 'daily',
    runtimeDependencies: [
      'LiveKit token API',
      'LILY voice worker',
      'Hermes chat API',
    ],
    smokeText: 'LILY',
    escalationPath:
      'Check voice diagnostics, worker status, and token issuance.',
  },
  {
    route: '/chat/main',
    label: 'Chat',
    owner: 'daily',
    runtimeDependencies: ['sessions API', 'gateway streaming', 'model config'],
    smokeText: 'CHAT COCKPIT',
    mobileSmokeText: 'Mobile',
    escalationPath:
      'Check auth, session history, gateway streaming, and model provider.',
  },
  {
    route: '/playground',
    label: 'HermesWorld',
    owner: 'systems',
    runtimeDependencies: ['3D assets', 'playground state', 'browser WebGL'],
    smokeText: 'FULL',
    escalationPath:
      'Check asset loading, WebGL support, and playground runtime logs.',
  },
  {
    route: '/files',
    label: 'Files',
    owner: 'knowledge',
    runtimeDependencies: ['files API', 'workspace root', 'preview API'],
    smokeText: 'Files',
    escalationPath: 'Check workspace root permissions and file preview API.',
  },
  {
    route: '/terminal',
    label: 'Terminal',
    owner: 'systems',
    runtimeDependencies: ['terminal stream API', 'PTY sessions'],
    smokeText: 'Terminal',
    escalationPath:
      'Check terminal session registry, stream transport, and shell availability.',
  },
  {
    route: '/jobs',
    label: 'Jobs',
    owner: 'agent-ops',
    runtimeDependencies: ['automation/job APIs', 'scheduler state'],
    smokeText: 'Jobs',
    escalationPath:
      'Check job API, schedules, last run state, and automation logs.',
  },
  {
    route: '/tasks',
    label: 'Tasks',
    owner: 'daily',
    runtimeDependencies: ['tasks API', 'task store'],
    smokeText: 'Tasks',
    escalationPath: 'Check task store, API mutations, and source handoffs.',
  },
  {
    route: '/75-tracker',
    label: '75 Hard/Soft',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: '75 Hard/Soft',
    escalationPath: 'Check local storage recovery and daily habit state.',
  },
  {
    route: '/pto-tracker',
    label: 'PTO Tracker',
    owner: 'daily',
    runtimeDependencies: ['PTO report artifacts', 'direct-report roster'],
    smokeText: 'PTO Tracker',
    mobileSmokeText: 'People coverage',
    escalationPath:
      'Regenerate the PTO tracker report bundle and check report artifact serving.',
  },
  {
    route: '/chief-of-staff-mailbox',
    label: 'Chief of Staff Mailbox',
    owner: 'daily',
    runtimeDependencies: ['mailbox digest artifacts'],
    smokeText: 'Mailbox CoS',
    mobileSmokeText: 'Chief of Staff Mailbox',
    escalationPath: 'Check mailbox digest generation and report freshness.',
  },
  {
    route: '/apple-health',
    label: 'Apple Health',
    owner: 'daily',
    runtimeDependencies: ['Hermes health SQLite DB', 'Health Auto Export sync'],
    smokeText: 'Health',
    mobileSmokeText: 'Health',
    escalationPath:
      'Check health bridge status, Health Auto Export freshness, and .health.db daily_summary rows.',
  },
  {
    route: '/wegovy',
    label: 'Wegovy Shots',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: 'Wegovy',
    escalationPath: 'Check local storage recovery and weekly shot state.',
  },
  {
    route: '/zyn-tracker',
    label: 'Zyn Tracker',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: 'Zyn',
    escalationPath: 'Check local storage recovery and daily pouch entries.',
  },
  {
    route: '/food-log',
    label: 'Food Log',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: 'Food',
    escalationPath: 'Check local storage recovery and meal entries.',
  },
  {
    route: '/conductor',
    label: 'Conductor',
    owner: 'agent-ops',
    runtimeDependencies: ['conductor spawn API', 'gateway', 'mission storage'],
    smokeText: 'Plan, assign, verify.',
    escalationPath:
      'Check mission draft, spawn API, gateway stream, and approvals.',
  },
  {
    route: '/operations',
    label: 'Operations',
    owner: 'agent-ops',
    runtimeDependencies: ['profiles API', 'agent metadata', 'jobs'],
    smokeText: 'Operations',
    escalationPath:
      'Check profiles, agent metadata storage, and operations hooks.',
  },
  {
    route: '/ops-intelligence',
    label: 'Ops Intelligence',
    owner: 'agent-ops',
    runtimeDependencies: [
      'ops intelligence API',
      'update status',
      'production checks',
    ],
    smokeText: 'Ops Intelligence',
    escalationPath:
      'Check production checks, source freshness, and report generation.',
  },
  {
    route: '/swarm',
    label: 'Swarm',
    owner: 'agent-ops',
    runtimeDependencies: ['swarm runtime API', 'crew status', 'mission store'],
    smokeText: 'Swarm',
    escalationPath:
      'Check swarm runtime, crew status, worker heartbeat, and mission state.',
  },
  {
    route: '/memory',
    label: 'Memory',
    owner: 'knowledge',
    runtimeDependencies: ['memory API', 'knowledge browser'],
    smokeText: 'Memory',
    escalationPath: 'Check memory feature gate, API reads, and source paths.',
  },
  {
    route: '/skills',
    label: 'Skills',
    owner: 'knowledge',
    runtimeDependencies: ['skills API', 'skills hub search'],
    smokeText: 'Skills Browser',
    escalationPath: 'Check skill roots, hub search, and install/toggle APIs.',
  },
  {
    route: '/mcp',
    label: 'MCP Servers',
    owner: 'knowledge',
    runtimeDependencies: ['MCP API', 'hub sources', 'presets'],
    smokeText: 'MCP Servers',
    escalationPath:
      'Check server config, auth placeholders, logs, and hub sources.',
  },
  {
    route: '/profiles',
    label: 'Profiles',
    owner: 'knowledge',
    runtimeDependencies: ['profiles API', 'profile config files'],
    smokeText: 'Profiles',
    escalationPath: 'Check active/default profiles and profile mutation APIs.',
  },
  {
    route: '/meetings',
    label: 'Meetings',
    owner: 'daily',
    runtimeDependencies: ['meetings API', 'calendar source'],
    smokeText: 'Meetings',
    escalationPath: 'Check meeting API, calendar sync, and action posting.',
  },
  {
    route: '/presence',
    label: 'Presence',
    owner: 'agent-ops',
    runtimeDependencies: ['presence API', 'Teams/Graph sync'],
    smokeText: 'Presence',
    escalationPath:
      'Check Teams auth, presence source freshness, and manual sync.',
  },
  {
    route: '/it-ops',
    label: 'IT Ops / ConnectWise',
    owner: 'agent-ops',
    runtimeDependencies: ['IT ops API', 'ConnectWise data'],
    smokeText: 'ConnectWise',
    escalationPath:
      'Check ConnectWise sync, ticket source, and native approval state.',
  },
  {
    route: '/barry',
    label: 'Barry',
    owner: 'daily',
    runtimeDependencies: ['Barry ops API', 'meeting data'],
    smokeText: 'Barry',
    escalationPath: 'Check Barry API, meeting source, and action endpoint.',
  },
  {
    route: '/settings',
    label: 'Settings',
    owner: 'settings',
    runtimeDependencies: [
      'settings store',
      'Hermes config APIs',
      'provider config',
    ],
    smokeText: 'Settings',
    escalationPath:
      'Check settings store, provider validation, and config write APIs.',
  },
]

export function findWorkspaceRouteRegistryEntry(route: string) {
  const normalizedRoute = route.replace(/^\/workspace(?=\/|$)/, '') || '/'
  return (
    WORKSPACE_ROUTE_REGISTRY.find((entry) => entry.route === normalizedRoute) ??
    null
  )
}

export function getWorkspaceRouteRegistryByOwner(owner: WorkspaceRouteOwner) {
  return WORKSPACE_ROUTE_REGISTRY.filter((entry) => entry.owner === owner)
}

export function getWorkspaceRouteSmokeFixtures(route: string) {
  const routePath =
    (route.split('?')[0] || route).replace(/^\/workspace(?=\/|$)/, '') || '/'
  return WORKSPACE_ROUTE_SMOKE_FIXTURES[routePath] ?? []
}

export function buildWorkspaceRouteDiagnosticContext(
  route: string,
): WorkspaceRouteDiagnosticContext {
  const routePath =
    (route.split('?')[0] || route).replace(/^\/workspace(?=\/|$)/, '') || '/'
  const registry = findWorkspaceRouteRegistryEntry(routePath)
  return {
    registry,
    smokeAssertions: {
      desktopText: registry?.smokeText ?? null,
      mobileText: registry?.mobileSmokeText ?? registry?.smokeText ?? null,
    },
    routeFixtures: getWorkspaceRouteSmokeFixtures(routePath),
    liveSourceDrilldowns: (registry?.runtimeDependencies ?? []).map(
      (dependency) => ({
        label: dependency,
        target: getLiveSourceTarget(dependency),
      }),
    ),
  }
}
