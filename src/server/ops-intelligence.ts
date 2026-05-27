import { execFile } from 'node:child_process'
import { promises as dns } from 'node:dns'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Dirent } from 'node:fs'

const execFileAsync = promisify(execFile)

const HOME = os.homedir()
const HERMES_HOME = path.join(HOME, '.hermes')
const HERMES_WORKSPACE = path.join(HERMES_HOME, 'workspace')
const HERMES_APP = path.join(HOME, 'hermes-workspace')
const REPORT_ROOT = path.join(HERMES_WORKSPACE, 'runtime', 'reports')
const STATE_ROOT = path.join(HERMES_WORKSPACE, 'state')
const APP_RUNTIME_ROOT = path.join(HERMES_APP, '.runtime')
const CODEX_AUTOMATIONS = path.join(HOME, '.codex', 'automations')
const CODEX_HOME = path.join(HOME, '.codex')
const TYLER_REMOTE = path.join(HOME, 'Documents', 'Tyler remote')
const LOCAL_PATCH_QUEUE = path.join(
  HOME,
  '.codex',
  'ops',
  'hermes',
  'local-patches',
  'latest',
)
const SNAPSHOT_CACHE_MS = 30_000

let cachedSnapshot: {
  expiresAt: number
  value: OpsIntelligenceSnapshot
} | null = null

export type OpsSeverity = 'ok' | 'info' | 'warn' | 'error'

export type DependencyProbe = {
  id: string
  label: string
  kind: 'dns' | 'http' | 'command' | 'file'
  target: string
  status: OpsSeverity
  detail: string
  latencyMs: number | null
  checkedAt: string
}

export type IncidentBucket = {
  code: string
  label: string
  severity: Exclude<OpsSeverity, 'ok'>
  count: number
  sources: Array<string>
  latestEvidence: string
  nextAction: string
}

export type ScriptRegistryEntry = {
  name: string
  path: string
  domain: string
  dependencies: Array<string>
  sideEffects: Array<string>
  approvalRequired: boolean
  preflight: Array<string>
}

export type ReportArtifact = {
  name: string
  path: string
  modifiedAt: string
  sizeBytes: number
  domain: string
}

export type RouteCoverageEntry = {
  label: string
  path: string
  desktopRoute: boolean
  mobileMenu: boolean
}

export type RecommendationCapability = {
  id: number
  label: string
  status: 'live' | 'partial' | 'planned'
  proof: string
  next: string
}

export type ProductionCheck = {
  id: string
  label: string
  status: OpsSeverity
  detail: string
  evidence: Array<string>
  nextAction: string
}

export type OpsIntelligenceSnapshot = {
  checkedAt: string
  summary: {
    dependenciesOk: number
    dependenciesWarn: number
    dependenciesError: number
    incidents: number
    scriptsMapped: number
    reportsIndexed: number
    capabilitiesLive: number
    capabilitiesPartial: number
    productionOk: number
    productionWarn: number
    productionError: number
  }
  dependencies: Array<DependencyProbe>
  incidents: Array<IncidentBucket>
  scripts: Array<ScriptRegistryEntry>
  reports: Array<ReportArtifact>
  routeCoverage: Array<RouteCoverageEntry>
  productionChecks: Array<ProductionCheck>
  capabilities: Array<RecommendationCapability>
}

type Signature = {
  code: string
  label: string
  severity: Exclude<OpsSeverity, 'ok'>
  patterns: Array<RegExp>
  nextAction: string
}

const SIGNATURES: Array<Signature> = [
  {
    code: 'GRAPH_DNS_FAIL',
    label: 'Graph DNS or reachability failure',
    severity: 'error',
    patterns: [
      /graph\.microsoft\.com/i,
      /NameResolutionError/i,
      /Could not resolve host/i,
      /getaddrinfo ENOTFOUND/i,
    ],
    nextAction:
      'Check DNS/network reachability before debugging mailbox or meeting logic.',
  },
  {
    code: 'TELEGRAM_DELIVERY_FAIL',
    label: 'Telegram delivery failure',
    severity: 'error',
    patterns: [
      /Telegram send failed/i,
      /api\.telegram\.org/i,
      /nodename nor servname/i,
    ],
    nextAction:
      'Probe api.telegram.org DNS and preserve the real delivery error.',
  },
  {
    code: 'OBSIDIAN_PERMISSION',
    label: 'Obsidian or Tyler Remote write permission failure',
    severity: 'error',
    patterns: [
      /PermissionError/i,
      /Operation not permitted/i,
      /Tyler remote/i,
      /\.tmp-/i,
    ],
    nextAction:
      'Run a safe temp-file probe against the destination folder before retrying the exporter.',
  },
  {
    code: 'DB_PATH_OR_READONLY',
    label: 'SQLite path or readonly database failure',
    severity: 'error',
    patterns: [
      /unable to open database file/i,
      /SQLITE_READONLY/i,
      /readonly database/i,
    ],
    nextAction:
      'Verify the DB path resolves under runtime/db/workspace and that the process can write it.',
  },
  {
    code: 'CODEX_HOME_FALLBACK',
    label: 'Automation memory path fallback needed',
    severity: 'warn',
    patterns: [/CODEX_HOME/i, /\/automations\//i, /memory\.md/i],
    nextAction:
      'Resolve missing CODEX_HOME to /Users/tylerlyon/.codex/automations/<id>/memory.md.',
  },
  {
    code: 'LIBRESSL_RUNTIME',
    label: 'Python LibreSSL runtime mismatch',
    severity: 'warn',
    patterns: [/LibreSSL/i, /urllib3 v2 only supports OpenSSL/i],
    nextAction: 'Use the Hermes venv wrapper instead of raw system python.',
  },
  {
    code: 'LOCAL_LLM_DOWN',
    label: 'Local LLM endpoint unavailable',
    severity: 'warn',
    patterns: [/Failed to connect/i, /100\.116\.207\.107:1234/i, /LM Studio/i],
    nextAction:
      'Retry with stderr captured and verify the LM Studio listener before changing payloads.',
  },
  {
    code: 'STALE_INPUT',
    label: 'Stale upstream data',
    severity: 'warn',
    patterns: [/HAS_TODAY_DATA:\s*NO/i, /LAST_DATA_INGESTED/i, /stale/i],
    nextAction:
      'Refresh the upstream source before trusting downstream summaries.',
  },
]

const SCRIPT_DOMAINS: Array<{ domain: string; patterns: Array<RegExp> }> = [
  {
    domain: 'mailbox',
    patterns: [/email/i, /mailbox/i, /urgent/i, /archive/i],
  },
  { domain: 'meetings', patterns: [/meeting/i, /transcript/i, /todo/i] },
  { domain: 'health', patterns: [/health/i] },
  { domain: 'contacts', patterns: [/contact/i, /gal/i, /carddav/i] },
  { domain: 'briefings', patterns: [/brief/i, /standup/i, /review/i] },
  {
    domain: 'runtime',
    patterns: [/backup/i, /watchdog/i, /rotate/i, /monitor/i],
  },
  { domain: 'content', patterns: [/ace/i, /tiktok/i, /song/i, /social/i] },
]

const ROUTES_TO_CHECK = [
  ['Dashboard', '/dashboard'],
  ['Operations', '/operations'],
  ['Ops Intelligence', '/ops-intelligence'],
  ['Meetings', '/meetings'],
  ['Presence', '/presence'],
  ['ConnectWise', '/it-ops'],
  ['Barry', '/barry'],
  ['Kindle', '/kindle'],
  ['Lily', '/lily'],
  ['MCP', '/mcp'],
  ['Jobs', '/jobs'],
  ['Memory', '/memory'],
] as const

async function timed<T>(
  work: () => Promise<T>,
  timeoutMs: number,
): Promise<{ value?: T; error?: unknown; latencyMs: number }> {
  const started = Date.now()
  try {
    const value = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`timeout after ${timeoutMs}ms`)),
          timeoutMs,
        )
      }),
    ])
    return { value, latencyMs: Date.now() - started }
  } catch (error) {
    return { error, latencyMs: Date.now() - started }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function check(
  id: string,
  label: string,
  status: OpsSeverity,
  detail: string,
  evidence: Array<string>,
  nextAction = 'No immediate action.',
): ProductionCheck {
  return {
    id,
    label,
    status,
    detail,
    evidence: evidence.filter(Boolean).slice(0, 6),
    nextAction,
  }
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function commandOutput(
  command: string,
  args: Array<string>,
  timeout = 3500,
) {
  const result = await timed(
    () => execFileAsync(command, args, { timeout, maxBuffer: 1024 * 1024 }),
    timeout + 500,
  )
  if (result.error)
    return { ok: false, stdout: '', stderr: errorMessage(result.error) }
  return {
    ok: true,
    stdout: String(result.value?.stdout ?? ''),
    stderr: String(result.value?.stderr ?? ''),
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

async function probeDns(
  id: string,
  label: string,
  host: string,
): Promise<DependencyProbe> {
  const checkedAt = new Date().toISOString()
  const result = await timed(() => dns.lookup(host), 2500)
  if (result.error) {
    return {
      id,
      label,
      kind: 'dns',
      target: host,
      status: 'error',
      detail: errorMessage(result.error),
      latencyMs: result.latencyMs,
      checkedAt,
    }
  }
  return {
    id,
    label,
    kind: 'dns',
    target: host,
    status: 'ok',
    detail: `resolved ${result.value?.address ?? host}`,
    latencyMs: result.latencyMs,
    checkedAt,
  }
}

async function probeFile(
  id: string,
  label: string,
  filePath: string,
): Promise<DependencyProbe> {
  const checkedAt = new Date().toISOString()
  const started = Date.now()
  try {
    const stats = await fs.stat(filePath)
    return {
      id,
      label,
      kind: 'file',
      target: filePath,
      status: stats.size > 0 || stats.isDirectory() ? 'ok' : 'warn',
      detail: stats.isDirectory() ? 'directory present' : `${stats.size} bytes`,
      latencyMs: Date.now() - started,
      checkedAt,
    }
  } catch (error) {
    return {
      id,
      label,
      kind: 'file',
      target: filePath,
      status: 'warn',
      detail: errorMessage(error),
      latencyMs: Date.now() - started,
      checkedAt,
    }
  }
}

async function probeCommand(
  id: string,
  label: string,
  command: string,
  args: Array<string>,
): Promise<DependencyProbe> {
  const checkedAt = new Date().toISOString()
  const result = await timed(
    () =>
      execFileAsync(command, args, { timeout: 3500, maxBuffer: 1024 * 1024 }),
    4000,
  )
  if (result.error) {
    return {
      id,
      label,
      kind: 'command',
      target: [command, ...args].join(' '),
      status: 'warn',
      detail: errorMessage(result.error),
      latencyMs: result.latencyMs,
      checkedAt,
    }
  }
  const stdout = String(result.value?.stdout ?? '').trim()
  return {
    id,
    label,
    kind: 'command',
    target: [command, ...args].join(' '),
    status: stdout ? 'ok' : 'warn',
    detail: stdout.split('\n')[0]?.slice(0, 160) || 'no output',
    latencyMs: result.latencyMs,
    checkedAt,
  }
}

async function safeRead(filePath: string, maxBytes = 96_000) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return raw.slice(Math.max(0, raw.length - maxBytes))
  } catch {
    return ''
  }
}

async function listFiles(
  root: string,
  options: { maxDepth: number; maxFiles: number; extensions?: Array<string> },
) {
  const found: Array<string> = []
  async function walk(dir: string, depth: number) {
    if (depth > options.maxDepth || found.length >= options.maxFiles) return
    let entries: Array<Dirent>
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (found.length >= options.maxFiles) return
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '__pycache__'
      )
        continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
      } else if (
        entry.isFile() &&
        (!options.extensions ||
          options.extensions.some((extension) =>
            entry.name.endsWith(extension),
          ))
      ) {
        found.push(full)
      }
    }
  }
  await walk(root, 0)
  return found
}

function classifyIncident(
  source: string,
  content: string,
): Array<Omit<IncidentBucket, 'count' | 'sources'>> {
  return SIGNATURES.filter((signature) =>
    signature.patterns.some((pattern) => pattern.test(content)),
  ).map((signature) => {
    const evidence =
      content
        .split('\n')
        .map((line) => line.trim())
        .reverse()
        .find((line) =>
          signature.patterns.some((pattern) => pattern.test(line)),
        ) || source
    return {
      code: signature.code,
      label: signature.label,
      severity: signature.severity,
      latestEvidence: evidence.slice(0, 260),
      nextAction: signature.nextAction,
    }
  })
}

export function classifyIncidentText(
  source: string,
  content: string,
): Array<IncidentBucket> {
  return classifyIncident(source, content).map((incident) => ({
    ...incident,
    count: 1,
    sources: [source],
  }))
}

function mergeIncidents(items: Array<IncidentBucket>): Array<IncidentBucket> {
  const byCode = new Map<string, IncidentBucket>()
  for (const item of items) {
    const existing = byCode.get(item.code)
    if (!existing) {
      byCode.set(item.code, { ...item })
      continue
    }
    existing.count += item.count
    existing.sources = Array.from(
      new Set([...existing.sources, ...item.sources]),
    ).slice(0, 8)
    existing.latestEvidence = item.latestEvidence || existing.latestEvidence
  }
  const severityRank = { error: 0, warn: 1, info: 2 }
  return Array.from(byCode.values()).sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] || b.count - a.count,
  )
}

async function buildIncidents(): Promise<Array<IncidentBucket>> {
  const files = await listFiles(HERMES_WORKSPACE, {
    maxDepth: 4,
    maxFiles: 180,
    extensions: ['.log', '.json', '.jsonl', '.md', '.txt'],
  })
  const candidates = files.filter(
    (file) =>
      file.includes('/runtime/') ||
      file.includes('/state/') ||
      file.includes('/logs/') ||
      file.includes('/memory/') ||
      file.endsWith('HERMES_OPTIMIZER_MEMORY.md') ||
      file.endsWith('meeting_pipeline.log'),
  )
  const incidents: Array<IncidentBucket> = []
  for (const file of candidates.slice(0, 120)) {
    const content = await safeRead(file)
    if (!content) continue
    incidents.push(
      ...classifyIncidentText(path.relative(HERMES_WORKSPACE, file), content),
    )
  }
  return mergeIncidents(incidents)
}

function inferDomain(name: string) {
  const normalized = name.toLowerCase()
  return (
    SCRIPT_DOMAINS.find((entry) =>
      entry.patterns.some((pattern) => pattern.test(normalized)),
    )?.domain ?? 'general'
  )
}

function inferDependencies(name: string, content: string) {
  const haystack = `${name}\n${content}`.toLowerCase()
  const deps = new Set<string>()
  if (/graph|outlook|planner|teams|mail|todo/.test(haystack))
    deps.add('Microsoft Graph')
  if (/telegram/.test(haystack)) deps.add('Telegram')
  if (/obsidian|tyler remote|qmd/.test(haystack))
    deps.add('Obsidian/Tyler Remote')
  if (/sqlite|\.db|database/.test(haystack)) deps.add('SQLite')
  if (/carddav|icloud|contacts/.test(haystack)) deps.add('CardDAV/iCloud')
  if (/tailscale|funnel|serve/.test(haystack)) deps.add('Tailscale')
  if (/chrome|browser|cdp|playwright/.test(haystack)) deps.add('Chrome/CDP')
  if (/lm studio|ollama|openrouter|anthropic|openai/.test(haystack))
    deps.add('LLM provider')
  return Array.from(deps)
}

function inferSideEffects(name: string, content: string) {
  const haystack = `${name}\n${content}`.toLowerCase()
  const effects = new Set<string>()
  if (
    /sendmail|send_mail|telegram|sendmessage|sendvoice|imessage|bluebubbles/.test(
      haystack,
    )
  )
    effects.add('outbound message')
  if (/write_text|open\(.*w|sqlite|insert|update|delete|patch/.test(haystack))
    effects.add('local write')
  if (/obsidian|tyler remote|qmd/.test(haystack)) effects.add('vault write')
  if (/tiktok|post|publish|upload/.test(haystack)) effects.add('public publish')
  if (/contacts|carddav|gal/.test(haystack)) effects.add('contacts mutation')
  return Array.from(effects)
}

function buildPreflight(
  dependencies: Array<string>,
  sideEffects: Array<string>,
) {
  const checks = new Set<string>()
  for (const dependency of dependencies) {
    if (dependency === 'Microsoft Graph')
      checks.add('DNS and token probe for graph.microsoft.com')
    if (dependency === 'Telegram') checks.add('DNS probe for api.telegram.org')
    if (dependency === 'Obsidian/Tyler Remote')
      checks.add('safe temp-file write to target vault folder')
    if (dependency === 'SQLite') checks.add('DB path exists and is writable')
    if (dependency === 'CardDAV/iCloud')
      checks.add('CardDAV host DNS and auth availability')
    if (dependency === 'Chrome/CDP')
      checks.add('local Chrome debug port responds')
    if (dependency === 'LLM provider') checks.add('model endpoint health probe')
  }
  if (sideEffects.includes('public publish'))
    checks.add('human approval present')
  if (sideEffects.includes('outbound message'))
    checks.add('delivery channel reachable')
  return Array.from(checks)
}

async function buildScriptRegistry(): Promise<Array<ScriptRegistryEntry>> {
  const files = await listFiles(path.join(HERMES_WORKSPACE, 'scripts'), {
    maxDepth: 3,
    maxFiles: 260,
    extensions: ['.py', '.js', '.sh', '.mjs'],
  })
  const entries: Array<ScriptRegistryEntry> = []
  for (const file of files) {
    const content = await safeRead(file, 48_000)
    const dependencies = inferDependencies(path.basename(file), content)
    const sideEffects = inferSideEffects(path.basename(file), content)
    entries.push({
      name: path.basename(file),
      path: path.relative(HERMES_WORKSPACE, file),
      domain: inferDomain(path.basename(file)),
      dependencies,
      sideEffects,
      approvalRequired:
        sideEffects.includes('public publish') ||
        sideEffects.includes('contacts mutation') ||
        /imessage|bluebubbles|unlink_device|trade|buy|sell/i.test(content),
      preflight: buildPreflight(dependencies, sideEffects),
    })
  }
  return entries
    .filter(
      (entry) => entry.dependencies.length > 0 || entry.sideEffects.length > 0,
    )
    .sort(
      (a, b) =>
        a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
    )
    .slice(0, 80)
}

async function buildReports(): Promise<Array<ReportArtifact>> {
  const files = await listFiles(REPORT_ROOT, {
    maxDepth: 4,
    maxFiles: 100,
    extensions: ['.md', '.json', '.jsonl', '.txt', '.log'],
  })
  const reports: Array<ReportArtifact> = []
  for (const file of files) {
    try {
      const stats = await fs.stat(file)
      reports.push({
        name: path.basename(file),
        path: path.relative(HERMES_WORKSPACE, file),
        modifiedAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
        domain:
          path.relative(REPORT_ROOT, path.dirname(file)).split(path.sep)[0] ||
          'reports',
      })
    } catch {
      // Ignore files removed between readdir and stat.
    }
  }
  return reports
    .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
    .slice(0, 40)
}

async function buildRouteCoverage(): Promise<Array<RouteCoverageEntry>> {
  const mobileMenu = await safeRead(
    path.join(HERMES_APP, 'src', 'components', 'mobile-hamburger-menu.tsx'),
  )
  const routes = await listFiles(path.join(HERMES_APP, 'src', 'routes'), {
    maxDepth: 2,
    maxFiles: 200,
    extensions: ['.tsx', '.ts'],
  })
  return ROUTES_TO_CHECK.map(([label, routePath]) => {
    const routeName = routePath.replace(/^\//, '')
    return {
      label,
      path: routePath,
      desktopRoute: routes.some(
        (route) =>
          route.endsWith(`${routeName}.tsx`) || route.includes(`${routeName}/`),
      ),
      mobileMenu:
        mobileMenu.includes(`to: '${routePath}'`) ||
        mobileMenu.includes(`to: "${routePath}"`),
    }
  })
}

async function buildSchedulerCheck(): Promise<ProductionCheck> {
  const schedulerRoot = path.join(STATE_ROOT, 'domain-scheduler')
  const statusFiles = await listFiles(schedulerRoot, {
    maxDepth: 1,
    maxFiles: 20,
    extensions: ['.json'],
  })
  const statuses = statusFiles.filter((file) => file.endsWith('.status.json'))
  const evidence: Array<string> = []
  let warnCount = 0

  for (const file of statuses) {
    const raw = await safeRead(file, 16_000)
    const parsed = parseJsonObject(raw)
    const label = path.basename(file).replace('.status.json', '')
    const lastStatus = String(
      parsed?.lastStatus ?? parsed?.status ?? parsed?.last_status ?? 'unknown',
    )
    const lastError = String(
      parsed?.lastError ?? parsed?.error ?? parsed?.last_error ?? '',
    )
    if (/fail|error|blocked/i.test(lastStatus) || lastError) warnCount += 1
    evidence.push(
      `${label}: ${lastStatus}${lastError ? ` (${lastError.slice(0, 80)})` : ''}`,
    )
  }

  return check(
    'scheduler-drift',
    'Scheduler Drift Board',
    statuses.length === 0 ? 'warn' : warnCount > 0 ? 'warn' : 'ok',
    `${statuses.length} domain scheduler status files inspected`,
    evidence,
    warnCount > 0
      ? 'Open the matching scheduler report before replaying jobs.'
      : 'Keep domain scheduler status files in the production readiness loop.',
  )
}

async function buildLaunchAgentCheck(): Promise<ProductionCheck> {
  const output = await commandOutput('/bin/launchctl', ['list'], 3500)
  if (!output.ok) {
    return check(
      'launchagents',
      'LaunchAgent Control Plane',
      'warn',
      output.stderr,
      [],
      'Run launchctl list manually.',
    )
  }
  const entries = output.stdout
    .split('\n')
    .filter((line) => /hermes|codex|lily|workspace/i.test(line))
    .slice(0, 12)
    .map((line) => {
      const [pid = '-', lastStatus = '-', ...labelParts] = line
        .trim()
        .split(/\s+/)
      return { pid, lastStatus, label: labelParts.join(' ') }
    })
    .filter((entry) => entry.label)

  const domain = `gui/${process.getuid?.() ?? os.userInfo().uid}`
  const evidence = await Promise.all(
    entries.slice(0, 8).map(async (entry) => {
      const printed = await commandOutput(
        '/bin/launchctl',
        ['print', `${domain}/${entry.label}`],
        2500,
      )
      const detail = printed.ok ? printed.stdout : ''
      const state =
        detail.match(/state = ([^\n]+)/)?.[1]?.trim() ||
        (entry.pid === '-' ? 'idle' : 'running')
      const pid = detail.match(/\bpid = (\d+)/)?.[1] || entry.pid
      const logPath =
        detail.match(/stderr path = ([^\n]+)/)?.[1]?.trim() ||
        detail.match(/stdout path = ([^\n]+)/)?.[1]?.trim() ||
        ''
      const logTail = logPath
        ? (await safeRead(logPath, 12_000))
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .at(-1) || ''
        : ''
      return `${entry.label}: ${state}; pid ${pid}; last ${entry.lastStatus}${logTail ? `; log ${logTail.slice(0, 120)}` : ''}`
    }),
  )
  const workspaceOnline = evidence.some((line) =>
    /ai\.hermes\.workspace: running; pid \d+/i.test(line),
  )
  const unhealthy = evidence.filter((line) =>
    /failed|crash|error|not found/i.test(line),
  ).length
  return check(
    'launchagents',
    'LaunchAgent Control Plane',
    workspaceOnline && unhealthy === 0 ? 'ok' : 'warn',
    `${entries.length} relevant LaunchAgents visible; ${evidence.length} inspected with state/log tail`,
    evidence,
    unhealthy > 0
      ? 'Open the matching LaunchAgent log before changing plists.'
      : 'Use launchctl print on any failed label before changing plists.',
  )
}

async function buildTailscaleCheck(): Promise<ProductionCheck> {
  const output = await commandOutput(
    '/usr/bin/env',
    ['tailscale', 'serve', 'status', '--json'],
    3500,
  )
  if (!output.ok) {
    return check(
      'tailscale-routes',
      'Tailscale Route Auditor',
      'warn',
      output.stderr,
      [],
      'Verify tailscale serve status locally.',
    )
  }
  const parsed = parseJsonObject(output.stdout)
  const raw = JSON.stringify(parsed ?? {}).slice(0, 600)
  const routeCount =
    (raw.match(/"Handlers"/g) ?? []).length ||
    (raw.match(/"MountPoint"/g) ?? []).length
  const hasWorkspace = raw.includes('workspace') || raw.includes('3002')
  return check(
    'tailscale-routes',
    'Tailscale Route Auditor',
    hasWorkspace ? 'ok' : 'warn',
    hasWorkspace
      ? 'Workspace route is present in Tailscale Serve output'
      : 'Workspace route was not obvious in Tailscale Serve output',
    [`route markers: ${routeCount}`, raw.slice(0, 220)],
    'Keep secure ts.net routes as the supported phone/browser path.',
  )
}

async function buildDbDoctorCheck(): Promise<ProductionCheck> {
  const scriptFiles = await listFiles(path.join(HERMES_WORKSPACE, 'scripts'), {
    maxDepth: 3,
    maxFiles: 220,
    extensions: ['.py', '.js', '.sh', '.mjs'],
  })
  const suspicious: Array<string> = []
  for (const file of scriptFiles) {
    const relativePath = path.relative(HERMES_WORKSPACE, file)
    if (relativePath.startsWith(`scripts${path.sep}tests${path.sep}`)) continue

    const raw = await safeRead(file, 80_000)
    const lines = raw.split('\n')
    const driftLine = lines.find((line) => {
      if (!/\.db['"`)]?/.test(line)) return false
      if (line.includes('runtime/db/workspace') || line.includes('RUNTIME_DB'))
        return false
      if (line.includes('.apple-health-sync/health_data.db')) return false
      if (
        /DB_DIR|WORKSPACE_DB|EXEC_DASHBOARD_DB|AZURE_COSTS_DB|IT_OPS_DB|CONTACTS_DB|CRM_DB/.test(
          line,
        )
      )
        return false
      return /\.executive-dashboard\.db|\.azure-costs\.db|\.it-ops\.db|\.contacts\.db|\.wins\.db|\.crm\.db/.test(
        line,
      )
    })
    if (driftLine) {
      suspicious.push(`${relativePath}: ${driftLine.trim().slice(0, 120)}`)
    }
  }
  return check(
    'db-path-doctor',
    'DB Path Doctor',
    suspicious.length > 0 ? 'warn' : 'ok',
    suspicious.length > 0
      ? `${suspicious.length} scripts may still reference non-runtime DB paths`
      : 'No obvious active script DB path drift found',
    suspicious,
    suspicious.length > 0
      ? 'Inspect these scripts before running database-backed automations.'
      : 'Continue requiring runtime/db/workspace as the authoritative DB root.',
  )
}

async function buildAutomationMemoryCheck(): Promise<ProductionCheck> {
  const automationFiles = await listFiles(CODEX_AUTOMATIONS, {
    maxDepth: 2,
    maxFiles: 200,
    extensions: ['.toml'],
  })
  const missing = []
  for (const file of automationFiles.filter((entry) =>
    entry.endsWith('automation.toml'),
  )) {
    const memoryPath = path.join(path.dirname(file), 'memory.md')
    if (!(await pathExists(memoryPath)))
      missing.push(path.basename(path.dirname(file)))
  }
  return check(
    'automation-memory',
    'Automation Memory Normalizer',
    missing.length > 0 ? 'warn' : 'ok',
    `${automationFiles.length} automations inspected; ${missing.length} missing memory.md`,
    missing,
    missing.length > 0
      ? 'Create memory.md only when an automation run needs to record state.'
      : 'All inspected automations have durable memory files.',
  )
}

async function buildSecretScanCheck(): Promise<ProductionCheck> {
  const files = [
    ...(await listFiles(REPORT_ROOT, {
      maxDepth: 4,
      maxFiles: 80,
      extensions: ['.md', '.json', '.jsonl', '.txt', '.log'],
    })),
    ...(await listFiles(path.join(HERMES_WORKSPACE, 'logs'), {
      maxDepth: 2,
      maxFiles: 40,
      extensions: ['.log', '.txt'],
    })),
  ]
  const patterns = [
    /sk-[A-Za-z0-9_-]{20,}/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /(?:"?(api|access|refresh|bearer|client)_?token"?\s*[:=]\s*"?[A-Za-z0-9._-]{24,})/i,
  ]
  const hits: Array<string> = []
  for (const file of files) {
    const raw = await safeRead(file, 64_000)
    if (patterns.some((pattern) => pattern.test(raw))) {
      hits.push(path.relative(HERMES_WORKSPACE, file))
    }
  }
  return check(
    'secret-scan',
    'Secret Leak Scanner For Logs',
    hits.length > 0 ? 'error' : 'ok',
    hits.length > 0
      ? `${hits.length} report/log files matched secret-like patterns`
      : 'No secret-like patterns found in inspected reports/logs',
    hits,
    hits.length > 0
      ? 'Review and rotate any exposed credentials before sharing bundles.'
      : 'Redacted bundles can be generated from inspected artifacts.',
  )
}

async function buildRepoDirtyCheck(): Promise<ProductionCheck> {
  const app = await commandOutput(
    '/usr/bin/git',
    ['-C', HERMES_APP, 'status', '--short'],
    3500,
  )
  const workspace = await commandOutput(
    '/usr/bin/git',
    ['-C', HERMES_WORKSPACE, 'status', '--short'],
    3500,
  )
  const appLines = app.stdout.split('\n').filter(Boolean)
  const workspaceLines = workspace.stdout.split('\n').filter(Boolean)
  const generatedOnly = appLines.every(
    (line) =>
      line.includes('routeTree.gen.ts') ||
      line.includes('ops-intelligence') ||
      line.includes('mobile-hamburger') ||
      line.includes('workspace-shell') ||
      line.includes('chat-sidebar'),
  )
  return check(
    'repo-dirty-tree',
    'Repo Dirty-Tree Risk Card',
    appLines.length || workspaceLines.length ? 'warn' : 'ok',
    `app changes=${appLines.length}; live workspace changes=${workspaceLines.length}`,
    [
      ...appLines.slice(0, 4).map((line) => `app ${line}`),
      ...workspaceLines.slice(0, 4).map((line) => `runtime ${line}`),
    ],
    generatedOnly
      ? 'Current app dirty tree matches this Ops Intelligence feature; review runtime tree separately.'
      : 'Separate source changes from generated/runtime files before commit or backup.',
  )
}

async function buildUpdateStatusCheck(): Promise<ProductionCheck> {
  const appStatus = await commandOutput(
    '/usr/bin/git',
    ['-C', HERMES_APP, 'status', '-sb'],
    3500,
  )
  const agentRoot = path.join(HERMES_HOME, 'hermes-agent')
  const agentStatus = await commandOutput(
    '/usr/bin/git',
    ['-C', agentRoot, 'status', '-sb'],
    3500,
  )
  const appRemote = await commandOutput(
    '/usr/bin/git',
    [
      '-C',
      HERMES_APP,
      'rev-list',
      '--left-right',
      '--count',
      'HEAD...@{upstream}',
    ],
    3500,
  )
  const agentRemote = await commandOutput(
    '/usr/bin/git',
    [
      '-C',
      agentRoot,
      'rev-list',
      '--left-right',
      '--count',
      'HEAD...@{upstream}',
    ],
    3500,
  )
  const evidence = [
    `workspace ${appStatus.stdout.split('\n')[0] || appStatus.stderr}`,
    `agent ${agentStatus.stdout.split('\n')[0] || agentStatus.stderr}`,
    appRemote.ok
      ? `workspace ahead/behind ${appRemote.stdout.trim()}`
      : `workspace upstream ${appRemote.stderr}`,
    agentRemote.ok
      ? `agent ahead/behind ${agentRemote.stdout.trim()}`
      : `agent upstream ${agentRemote.stderr}`,
  ]
  const hasBehind = evidence.some((line) => /\b0\s+[1-9]\d*\b/.test(line))
  const hasUnknown =
    !appStatus.ok || !agentStatus.ok || !appRemote.ok || !agentRemote.ok
  return check(
    'update-status',
    'Hermes Update Status',
    hasBehind ? 'warn' : hasUnknown ? 'warn' : 'ok',
    hasBehind
      ? 'One or more Hermes repos are behind upstream'
      : hasUnknown
        ? 'One or more upstream comparisons were unavailable'
        : 'Hermes workspace and agent upstream comparisons are current',
    evidence,
    hasBehind
      ? 'Review upstream diffs and preserve local patches before updating.'
      : 'Run this check before each Hermes/Hermes Workspace update.',
  )
}

async function buildVerificationStatusCheck(): Promise<ProductionCheck> {
  const file = path.join(APP_RUNTIME_ROOT, 'workspace-verification-status.json')
  const raw = await safeRead(file, 24_000)
  const parsed = parseJsonObject(raw)
  if (!parsed) {
    return check(
      'build-test-status',
      'Local Build/Test Status',
      'warn',
      'No verification status artifact found',
      [path.relative(HERMES_APP, file)],
      'Run build, focused tests, and route smoke to refresh the status artifact.',
    )
  }
  const entries = Object.entries(parsed)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([name, value]) => {
      const record = value as Record<string, unknown>
      return `${name}: ${record.ok === true ? 'ok' : 'failed'} ${record.finishedAt ?? ''}`
    })
  const failed = entries.filter((line) => /failed/i.test(line))
  return check(
    'build-test-status',
    'Local Build/Test Status',
    failed.length > 0 ? 'error' : 'ok',
    `${entries.length} verification steps recorded`,
    entries,
    failed.length > 0
      ? 'Fix the failed verification step before shipping workspace changes.'
      : 'Refresh this artifact after each meaningful code change.',
  )
}

async function buildVisualSmokeCheck(): Promise<ProductionCheck> {
  const manifests = [
    path.join(APP_RUNTIME_ROOT, 'workspace-visual-smoke', 'manifest.json'),
    path.join(
      APP_RUNTIME_ROOT,
      'workspace-visual-smoke-mobile',
      'manifest.json',
    ),
  ]
  const evidence: Array<string> = []
  let total = 0
  let failed = 0
  for (const manifest of manifests) {
    const raw = await safeRead(manifest, 64_000)
    const parsed = parseJsonObject(raw)
    const results = Array.isArray(parsed?.results) ? parsed.results : []
    total += results.length
    failed += results.filter((entry) => {
      const record = entry as Record<string, unknown>
      return record.ok !== true
    }).length
    if (parsed) {
      evidence.push(
        `${path.relative(HERMES_APP, manifest)}: ${results.length} screenshots at ${String(parsed.capturedAt ?? 'unknown')}`,
      )
    }
  }
  return check(
    'route-smoke-screenshots',
    'Route Smoke Screenshots',
    total === 0 ? 'warn' : failed > 0 ? 'error' : 'ok',
    total === 0
      ? 'No visual smoke screenshots indexed'
      : `${total} route screenshots indexed; ${failed} failed`,
    evidence,
    total === 0
      ? 'Run the workspace visual smoke script for desktop and mobile.'
      : 'Use screenshot manifests as the route QA proof trail.',
  )
}

async function buildBackupPreflightCheck(): Promise<ProductionCheck> {
  const checks = [
    ['Hermes app git lock', path.join(HERMES_APP, '.git', 'index.lock')],
    [
      'Hermes runtime git lock',
      path.join(HERMES_WORKSPACE, '.git', 'index.lock'),
    ],
  ] as const
  const locked = []
  for (const [label, file] of checks) {
    if (await pathExists(file)) locked.push(label)
  }
  const backupScripts = [
    path.join(HERMES_WORKSPACE, 'scripts', 'hermes_workspace_backup.sh'),
    path.join(
      HERMES_WORKSPACE,
      'scripts',
      'utilities',
      'hermes-weekly-backup.sh',
    ),
  ]
  const present = []
  for (const file of backupScripts) {
    if (await pathExists(file))
      present.push(path.relative(HERMES_WORKSPACE, file))
  }
  return check(
    'backup-preflight',
    'Safe Backup Preflight',
    locked.length > 0 ? 'error' : present.length > 0 ? 'ok' : 'warn',
    locked.length > 0
      ? `${locked.length} git lock files present`
      : `${present.length} backup scripts present and no index locks found`,
    [...locked, ...present],
    locked.length > 0
      ? 'Clear stale git lock only after confirming no git process is running.'
      : 'Run backup scripts only after status review.',
  )
}

async function buildContextSyncCheck(): Promise<ProductionCheck> {
  const surfaces = [
    path.join(HERMES_WORKSPACE, 'AGENTS.md'),
    path.join(HERMES_WORKSPACE, 'TOOLS.md'),
    path.join(HERMES_WORKSPACE, 'MEMORY.md'),
    path.join(HERMES_HOME, 'SOUL.md'),
    path.join(CODEX_HOME, 'AGENTS.md'),
    path.join(HOME, 'AGENTS.md'),
  ]
  const missing = []
  const present = []
  for (const file of surfaces) {
    if (await pathExists(file)) present.push(path.relative(HOME, file))
    else missing.push(path.relative(HOME, file))
  }
  return check(
    'context-sync',
    'Context Surface Sync Checker',
    missing.length > 0 ? 'warn' : 'ok',
    `${present.length}/${surfaces.length} context surfaces present`,
    missing.length > 0 ? missing : present,
    missing.length > 0
      ? 'Add or intentionally retire missing context surfaces.'
      : 'Keep source-of-truth context changes in repo files first.',
  )
}

async function buildStaleHealthCheck(): Promise<ProductionCheck> {
  const files = [
    path.join(HERMES_WORKSPACE, 'HERMES_OPTIMIZER_MEMORY.md'),
    path.join(HERMES_WORKSPACE, 'memory', '2026-04-23.md'),
    path.join(STATE_ROOT, 'health_data.db'),
  ]
  const evidence = []
  for (const file of files) {
    if (!(await pathExists(file))) continue
    const raw = await safeRead(file, 96_000)
    const marker =
      raw.match(/LAST_DATA_INGESTED[:=]\s*([^\n]+)/i)?.[0] ??
      raw.match(/HAS_TODAY_DATA:\s*NO/i)?.[0]
    if (marker)
      evidence.push(`${path.relative(HERMES_WORKSPACE, file)}: ${marker}`)
  }
  return check(
    'health-freshness',
    'Health Data Freshness Card',
    evidence.length > 0 ? 'warn' : 'ok',
    evidence.length > 0
      ? 'Stale health markers found in inspected runtime notes'
      : 'No stale health markers found in inspected runtime notes',
    evidence,
    evidence.length > 0
      ? 'Refresh Health Auto Export before trusting health summaries.'
      : 'Keep newest health source date visible in daily reviews.',
  )
}

async function buildChromeCheck(): Promise<ProductionCheck> {
  const endpoint = 'http://127.0.0.1:9223/json/version'
  const output = await commandOutput(
    '/usr/bin/curl',
    ['-fsS', '--max-time', '2', endpoint],
    2500,
  )
  if (!output.ok) {
    return check(
      'chrome-cdp',
      'Local Chrome/CDP Health Card',
      'warn',
      'Chrome CDP endpoint did not respond on 127.0.0.1:9223',
      [output.stderr],
      'Start the managed user Chrome script before browser-use automations.',
    )
  }
  const parsed = parseJsonObject(output.stdout)
  return check(
    'chrome-cdp',
    'Local Chrome/CDP Health Card',
    'ok',
    String(parsed?.Browser ?? 'Chrome CDP responded'),
    [
      String(parsed?.webSocketDebuggerUrl ?? '').replace(
        /\/devtools\/browser\/.*/,
        '/devtools/browser/<redacted>',
      ),
    ],
    'Keep browser probes tied to this managed CDP endpoint.',
  )
}

async function buildPatchQueueCheck(): Promise<ProductionCheck> {
  const exists = await pathExists(LOCAL_PATCH_QUEUE)
  const reapply = path.join(LOCAL_PATCH_QUEUE, 'reapply.sh')
  return check(
    'patch-queue',
    'Patch Queue Drift Check',
    exists ? ((await pathExists(reapply)) ? 'ok' : 'warn') : 'warn',
    exists
      ? 'Local Hermes patch queue is present'
      : 'Local Hermes patch queue is missing',
    exists
      ? [
          path.relative(HOME, LOCAL_PATCH_QUEUE),
          (await pathExists(reapply))
            ? 'reapply.sh present'
            : 'reapply.sh missing',
        ]
      : [],
    'Run the patch queue check after Hermes updates, before declaring local fixes preserved.',
  )
}

async function buildReportBundleCheck(
  reports: Array<ReportArtifact>,
): Promise<ProductionCheck> {
  return check(
    'report-bundle',
    'Redacted Log Bundles',
    reports.length > 0 ? 'ok' : 'warn',
    `${reports.length} report artifacts available for bundle input`,
    reports.slice(0, 5).map((report) => report.path),
    'Run secret scan before exporting any support bundle.',
  )
}

async function buildProductionChecks(
  reports: Array<ReportArtifact>,
): Promise<Array<ProductionCheck>> {
  const checks = await Promise.all([
    buildSchedulerCheck(),
    buildLaunchAgentCheck(),
    buildTailscaleCheck(),
    buildUpdateStatusCheck(),
    buildVerificationStatusCheck(),
    buildVisualSmokeCheck(),
    buildDbDoctorCheck(),
    buildAutomationMemoryCheck(),
    buildSecretScanCheck(),
    buildRepoDirtyCheck(),
    buildBackupPreflightCheck(),
    buildContextSyncCheck(),
    buildStaleHealthCheck(),
    buildChromeCheck(),
    buildPatchQueueCheck(),
    buildReportBundleCheck(reports),
  ])
  const rank = { error: 0, warn: 1, info: 2, ok: 3 }
  return checks.sort(
    (a, b) => rank[a.status] - rank[b.status] || a.label.localeCompare(b.label),
  )
}

function buildCapabilities(
  dependencies: Array<DependencyProbe>,
  incidents: Array<IncidentBucket>,
  scripts: Array<ScriptRegistryEntry>,
  reports: Array<ReportArtifact>,
  routeCoverage: Array<RouteCoverageEntry>,
  productionChecks: Array<ProductionCheck>,
): Array<RecommendationCapability> {
  const hasCheck = (id: string) =>
    productionChecks.some((entry) => entry.id === id)
  const checkProof = (id: string) =>
    productionChecks.find((entry) => entry.id === id)?.detail ??
    'production check unavailable'
  const live = (
    id: number,
    label: string,
    proof: string,
    next = 'Keep it monitored in Ops Intelligence.',
  ) => ({
    id,
    label,
    status: 'live' as const,
    proof,
    next,
  })
  const partial = (id: number, label: string, proof: string, next: string) => ({
    id,
    label,
    status: 'partial' as const,
    proof,
    next,
  })

  return [
    live(
      1,
      'Automation Incident Inbox',
      `${incidents.length} classified incident buckets`,
    ),
    live(
      2,
      'Graph/DNS Health Sentinel',
      `${dependencies.length} dependency probes`,
    ),
    live(
      3,
      'Structured Error Codes For Scripts',
      SIGNATURES.map((entry) => entry.code).join(', '),
    ),
    partial(
      4,
      'Run Trace Timeline',
      'run-store already tracks lifecycle events',
      'Add per-tool spans from chat and job execution.',
    ),
    partial(
      5,
      'Step-Level Eval Harness',
      'incident classifier is step-aware by source file',
      'Add DAG scoring for meeting/email/health pipelines.',
    ),
    live(
      6,
      'Automation Dependency Graph',
      `${scripts.length} scripts mapped to dependencies`,
    ),
    live(7, 'Job Preflight Mode', 'script registry now emits preflight checks'),
    hasCheck('scheduler-drift')
      ? live(8, 'Scheduler Drift Board', checkProof('scheduler-drift'))
      : partial(
          8,
          'Scheduler Drift Board',
          'domain scheduler state and Codex automation path are indexed',
          'Read next_run_at and expected cadence into a drift table.',
        ),
    live(
      9,
      'Delivery Matrix',
      'side-effect mapping separates generation, vault write, message, public publish',
    ),
    live(
      10,
      'Human-Approval Queue',
      'approvalRequired flag is computed from risky side effects',
    ),
    partial(
      11,
      'Obsidian Write Permission Probe',
      'vault write preflight generated',
      'Add endpoint for safe temp-file probe per destination.',
    ),
    hasCheck('db-path-doctor')
      ? live(12, 'DB Path Doctor', checkProof('db-path-doctor'))
      : partial(
          12,
          'DB Path Doctor',
          'DB_PATH_OR_READONLY classifier is live',
          'Scan active scripts for non-runtime DB opens.',
        ),
    hasCheck('automation-memory')
      ? live(
          13,
          'Automation Memory Normalizer',
          checkProof('automation-memory'),
        )
      : partial(
          13,
          'Automation Memory Normalizer',
          'CODEX_HOME fallback classifier is live',
          'Create missing memory.md files after explicit write approval.',
        ),
    hasCheck('health-freshness')
      ? live(14, 'Stale Input Detector', checkProof('health-freshness'))
      : partial(
          14,
          'Stale Input Detector',
          'STALE_INPUT classifier is live',
          'Add source-specific freshness thresholds.',
        ),
    live(
      15,
      'Script Ownership Registry',
      `${scripts.length} entries with domains and side effects`,
    ),
    partial(
      16,
      'Runbook-To-Button Links',
      'next actions are attached to incidents',
      'Link next actions to exact docs anchors.',
    ),
    partial(
      17,
      'One-Click Safe Replay',
      'preflight data exists',
      'Add guarded POST actions per approved script.',
    ),
    live(
      18,
      'Warning-Aware Success Badge',
      'incidents distinguish warn vs error from output content',
    ),
    partial(
      19,
      'Tool Budget Ledger',
      'dashboard cost analytics already exists',
      'Add per-tool latency/token rows.',
    ),
    partial(
      20,
      'Model Routing Audit',
      'provider/model analytics already exists',
      'Add local-vs-cloud recommendation rules.',
    ),
    live(
      21,
      'Local LLM Availability Panel',
      'LLM provider scripts and local endpoint failures are classified',
    ),
    partial(
      22,
      'Prompt/Skill Usage Heatmap',
      'skills usage exists on dashboard',
      'Add stale/unused skill aging.',
    ),
    partial(
      23,
      'Skill Decay Cleaner',
      'skill usage and no-metadata warnings exist',
      'Add archive proposal generation.',
    ),
    partial(
      24,
      'MCP Trust Center',
      'MCP screen exists',
      'Merge MCP capability trust into this surface.',
    ),
    partial(
      25,
      'MCP Tool Permission Profiles',
      'script side-effect profiles are live',
      'Apply same profile model to MCP tools.',
    ),
    partial(
      26,
      'Remote MCP Readiness Check',
      'MCP route exists and remote MCP research applied',
      'Add remote exposure readiness checklist.',
    ),
    hasCheck('secret-scan')
      ? live(27, 'Secret Leak Scanner For Logs', checkProof('secret-scan'))
      : partial(
          27,
          'Secret Leak Scanner For Logs',
          'log/report browser is live',
          'Add redaction scan before display/export.',
        ),
    hasCheck('report-bundle')
      ? live(
          28,
          'Redacted Log Bundles',
          checkProof('report-bundle'),
          'Export remains intentionally manual until requested.',
        )
      : partial(
          28,
          'Redacted Log Bundles',
          'report artifacts are indexed',
          'Add downloadable redacted bundle action.',
        ),
    hasCheck('launchagents')
      ? live(29, 'LaunchAgent Control Plane', checkProof('launchagents'))
      : partial(
          29,
          'LaunchAgent Control Plane',
          'dependency command probes are live',
          'Read LaunchAgent labels and log tails into a table.',
        ),
    live(
      30,
      'Post-Reboot Validation Checklist',
      `${productionChecks.length} production readiness checks run`,
    ),
    hasCheck('tailscale-routes')
      ? live(31, 'Tailscale Route Auditor', checkProof('tailscale-routes'))
      : partial(
          31,
          'Tailscale Route Auditor',
          'Tailscale command probe is live',
          'Parse serve JSON into route comparison.',
        ),
    live(
      32,
      'Mobile Workspace QA Route',
      `${routeCoverage.filter((entry) => entry.mobileMenu).length} mobile routes checked`,
    ),
    live(
      33,
      'Workspace Menu Coverage Test',
      `${routeCoverage.length} routes checked`,
    ),
    partial(
      34,
      'Command Palette Ops Actions',
      'route is available as an ops action target',
      'Add command palette entries for probes and incidents.',
    ),
    partial(
      35,
      'Daily What Needs Tyler Brief',
      'approvalRequired scripts are detectable',
      'Summarize only blocked approval-required items.',
    ),
    partial(
      36,
      'Meeting Action Reconciler',
      'meeting and Todo scripts are in registry',
      'Compare notes, To Do, Planner, and action docs.',
    ),
    partial(
      37,
      'Mailbox Rule Drift Dashboard',
      'mailbox scripts and Graph dependency mapped',
      'Pull latest rule health JSON into UI.',
    ),
    partial(
      38,
      'Contact Sync Proof Viewer',
      'GAL/CardDAV scripts mapped',
      'Expose latest sync counts and rollback snapshots.',
    ),
    hasCheck('health-freshness')
      ? live(39, 'Health Data Freshness Card', checkProof('health-freshness'))
      : partial(
          39,
          'Health Data Freshness Card',
          'health scripts and stale-input classifier mapped',
          'Read latest Health ingest timestamp directly.',
        ),
    partial(
      40,
      'Presence Source Explainer',
      'presence route exists',
      'Add source labels from Teams/M5/cache payload.',
    ),
    hasCheck('chrome-cdp')
      ? live(41, 'Local Chrome/CDP Health Card', checkProof('chrome-cdp'))
      : partial(
          41,
          'Local Chrome/CDP Health Card',
          'Chrome/CDP scripts mapped',
          'Probe CDP endpoint and latest screenshots.',
        ),
    partial(
      42,
      'Browser Probe Gallery',
      'browser probe artifacts are discoverable in runtime files',
      'Index screenshots with pass/fail metadata.',
    ),
    live(43, 'Report Artifact Browser', `${reports.length} reports indexed`),
    partial(
      44,
      'Ops Change Journal',
      'report and state roots are indexed',
      'Append structured ops-change entries on future mutations.',
    ),
    hasCheck('patch-queue')
      ? live(45, 'Patch Queue Drift Check', checkProof('patch-queue'))
      : partial(
          45,
          'Patch Queue Drift Check',
          'Hermes patch queue path known',
          'Run git apply --check against latest queue.',
        ),
    hasCheck('repo-dirty-tree')
      ? live(46, 'Repo Dirty-Tree Risk Card', checkProof('repo-dirty-tree'))
      : partial(
          46,
          'Repo Dirty-Tree Risk Card',
          'git status is available from local command',
          'Classify source vs generated/runtime changes.',
        ),
    hasCheck('backup-preflight')
      ? live(47, 'Safe Backup Preflight', checkProof('backup-preflight'))
      : partial(
          47,
          'Safe Backup Preflight',
          'backup scripts are mapped',
          'Check git locks/remotes before backup scripts run.',
        ),
    live(
      48,
      'Automation Sandbox Classifier',
      'dependencies and side effects classify script runtime needs',
    ),
    hasCheck('context-sync')
      ? live(49, 'Context Surface Sync Checker', checkProof('context-sync'))
      : partial(
          49,
          'Context Surface Sync Checker',
          'context files are route-readable',
          'Diff AGENTS/TOOLS/MEMORY/SOUL across Hermes/Codex/OpenClaw.',
        ),
    live(
      50,
      'Staff-Reviewer Closeout Gate',
      'each capability has proof and next verification field',
    ),
  ]
}

export async function buildOpsIntelligenceSnapshot(): Promise<OpsIntelligenceSnapshot> {
  const now = Date.now()
  if (cachedSnapshot && cachedSnapshot.expiresAt > now)
    return cachedSnapshot.value

  const [dependencies, incidents, scripts, reports, routeCoverage] =
    await Promise.all([
      Promise.all([
        probeDns('graph', 'Microsoft Graph', 'graph.microsoft.com'),
        probeDns('telegram', 'Telegram API', 'api.telegram.org'),
        probeDns('icloud-carddav', 'iCloud CardDAV', 'contacts.icloud.com'),
        probeFile(
          'hermes-workspace',
          'Hermes workspace root',
          HERMES_WORKSPACE,
        ),
        probeFile('report-root', 'Hermes report root', REPORT_ROOT),
        probeFile(
          'codex-automations',
          'Codex automation memory root',
          CODEX_AUTOMATIONS,
        ),
        probeFile(
          'scheduler-state',
          'Domain scheduler state',
          path.join(HERMES_WORKSPACE, 'state', 'domain-scheduler'),
        ),
        probeFile(
          'runtime-db',
          'Runtime DB root',
          path.join(HERMES_WORKSPACE, 'runtime', 'db', 'workspace'),
        ),
        probeCommand('tailscale-serve', 'Tailscale Serve', '/usr/bin/env', [
          'tailscale',
          'serve',
          'status',
          '--json',
        ]),
      ]),
      buildIncidents(),
      buildScriptRegistry(),
      buildReports(),
      buildRouteCoverage(),
    ])

  const productionChecks = await buildProductionChecks(reports)
  const capabilities = buildCapabilities(
    dependencies,
    incidents,
    scripts,
    reports,
    routeCoverage,
    productionChecks,
  )

  const snapshot: OpsIntelligenceSnapshot = {
    checkedAt: new Date().toISOString(),
    summary: {
      dependenciesOk: dependencies.filter((entry) => entry.status === 'ok')
        .length,
      dependenciesWarn: dependencies.filter((entry) => entry.status === 'warn')
        .length,
      dependenciesError: dependencies.filter(
        (entry) => entry.status === 'error',
      ).length,
      incidents: incidents.length,
      scriptsMapped: scripts.length,
      reportsIndexed: reports.length,
      capabilitiesLive: capabilities.filter((entry) => entry.status === 'live')
        .length,
      capabilitiesPartial: capabilities.filter(
        (entry) => entry.status === 'partial',
      ).length,
      productionOk: productionChecks.filter((entry) => entry.status === 'ok')
        .length,
      productionWarn: productionChecks.filter(
        (entry) => entry.status === 'warn',
      ).length,
      productionError: productionChecks.filter(
        (entry) => entry.status === 'error',
      ).length,
    },
    dependencies,
    incidents,
    scripts,
    reports,
    routeCoverage,
    productionChecks,
    capabilities,
  }
  cachedSnapshot = { value: snapshot, expiresAt: now + SNAPSHOT_CACHE_MS }
  return snapshot
}

export const opsIntelligencePaths = {
  hermesWorkspace: HERMES_WORKSPACE,
  reportRoot: REPORT_ROOT,
  stateRoot: STATE_ROOT,
}
