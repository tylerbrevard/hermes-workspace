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

export const WORKSPACE_ROUTE_REGISTRY: Array<WorkspaceRouteRegistryEntry> = [
  {
    route: '/dashboard',
    label: 'Dashboard',
    owner: 'daily',
    runtimeDependencies: ['dashboard overview API', 'gateway status'],
    smokeText: 'Hermes Workspace',
    mobileSmokeText: 'Phone Cockpit',
    escalationPath: 'Refresh gateway, then inspect dashboard overview source.',
  },
  {
    route: '/phone',
    label: 'Phone Cockpit',
    owner: 'daily',
    runtimeDependencies: ['phone cockpit API', 'tasks', 'meetings'],
    smokeText: 'Phone Cockpit',
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
    smokeText: 'Start LILY',
    escalationPath:
      'Check voice diagnostics, worker status, and token issuance.',
  },
  {
    route: '/chat/main',
    label: 'Chat',
    owner: 'daily',
    runtimeDependencies: ['sessions API', 'gateway streaming', 'model config'],
    smokeText: 'SESSIONS',
    mobileSmokeText: 'Begin a session',
    escalationPath:
      'Check auth, session history, gateway streaming, and model provider.',
  },
  {
    route: '/playground',
    label: 'HermesWorld',
    owner: 'systems',
    runtimeDependencies: ['3D assets', 'playground state', 'browser WebGL'],
    smokeText: 'OPEN FULL',
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
    route: '/wegovy',
    label: 'Wegovy Shots',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: 'Wegovy Shots',
    escalationPath: 'Check local storage recovery and weekly shot state.',
  },
  {
    route: '/zyn-tracker',
    label: 'Zyn Tracker',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: 'Zyn Tracker',
    escalationPath: 'Check local storage recovery and daily pouch entries.',
  },
  {
    route: '/food-log',
    label: 'Food Log',
    owner: 'daily',
    runtimeDependencies: ['local typed storage'],
    smokeText: 'Food Log',
    escalationPath: 'Check local storage recovery and meal entries.',
  },
  {
    route: '/conductor',
    label: 'Conductor',
    owner: 'agent-ops',
    runtimeDependencies: ['conductor spawn API', 'gateway', 'mission storage'],
    smokeText: 'Launch a mission',
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
    smokeText: 'MEMORY FILES',
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
  return WORKSPACE_ROUTE_REGISTRY.find((entry) => entry.route === route) ?? null
}

export function getWorkspaceRouteRegistryByOwner(owner: WorkspaceRouteOwner) {
  return WORKSPACE_ROUTE_REGISTRY.filter((entry) => entry.owner === owner)
}
