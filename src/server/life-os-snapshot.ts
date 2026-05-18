import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const HOME = os.homedir()
const PAI_ROOT = path.join(HOME, '.claude', 'PAI')
const PAI_SOURCE_ROOT = path.join(HOME, 'projects', 'Personal_AI_Infrastructure')
const USER_ROOT = path.join(PAI_ROOT, 'USER')
const HERMES_WORKSPACE_ROOT = path.join(HOME, 'hermes-workspace')
const TYLER_REMOTE_ROOT = path.join(HOME, 'Documents', 'Tyler remote')

type CheckState = 'healthy' | 'warn' | 'down' | 'unknown'

export type LifeOsSnapshot = {
  checkedAt: string
  host: {
    name: string
    location: string
    time: string
    uptime: string
    load: number
  }
  state: {
    health: number
    creative: number
    freedom: number
    relations: number
    finance: number
  }
  versions: {
    hermes: string
    pai: string
    algorithm: string
    codex: string
  }
  context: {
    percent: number
    files: Array<string>
    roots: Array<{ label: string; path: string; present: boolean }>
  }
  pai: {
    root: string
    sourceRoot: string
    userFiles: number
    memoryFiles: number
    tools: number
    packs: number
    workflows: number
    hooks: number
    pulse: {
      status: CheckState
      pid: string | null
      url: string
    }
    telosSummary: string
    terminalDocs: Array<string>
  }
  services: Array<{
    label: string
    status: CheckState
    detail: string
  }>
  workspace: {
    url: string
    terminalRoute: string
    chatRoute: string
    voice: string
    tailscale: Array<string>
  }
  logs: Array<{
    label: string
    state: CheckState
    lines: Array<string>
  }>
  learning: {
    signals: number
    recent: Array<number>
    note: string
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function run(
  command: string,
  args: Array<string> = [],
  timeout = 3000,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 1024 * 1024,
    })
    return String(stdout).trim()
  } catch {
    return ''
  }
}

async function countFiles(root: string, matcher?: (file: string) => boolean) {
  let count = 0
  async function walk(dir: string, depth: number) {
    if (depth > 5) return
    let entries: Array<import('node:fs').Dirent>
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith('.')) return
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full, depth + 1)
          return
        }
        if (entry.isFile() && (!matcher || matcher(full))) count += 1
      }),
    )
  }
  await walk(root, 0)
  return count
}

async function listMarkdownNames(root: string, limit = 7): Promise<Array<string>> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit)
  } catch {
    return []
  }
}

async function readFirstMatchingLine(file: string, patterns: Array<RegExp>) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const lines = raw.split('\n')
    for (const pattern of patterns) {
      const found = lines.find((line) => pattern.test(line))
      if (found) return found.replace(/^#+\s*/, '').trim()
    }
  } catch {
    return ''
  }
  return ''
}

async function readTail(file: string, maxLines = 4) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-maxLines)
  } catch {
    return []
  }
}

async function serviceStatus(label: string) {
  const output = await run('/bin/launchctl', ['list', label])
  if (!output) {
    return { label, status: 'down' as const, detail: 'not loaded' }
  }
  const pidMatch = output.match(/"PID"\s*=\s*(\d+)/)
  const lastExit = output.match(/"LastExitStatus"\s*=\s*(-?\d+)/)
  if (pidMatch?.[1]) {
    return { label, status: 'healthy' as const, detail: `pid ${pidMatch[1]}` }
  }
  const exit = lastExit?.[1] ?? 'unknown'
  return {
    label,
    status: exit === '0' ? ('warn' as const) : ('down' as const),
    detail: `loaded, exit ${exit}`,
  }
}

async function getHermesVersion() {
  const output = await run('/Users/tylerlyon/.local/bin/hermes', ['--version'])
  return output.split('\n')[0] || 'available'
}

async function getCodexVersion() {
  const output = await run('/opt/homebrew/bin/codex', ['--version'])
  return output.split('\n')[0] || 'available'
}

async function getTailscaleRoutes() {
  const output = await run('/Applications/Tailscale.app/Contents/MacOS/Tailscale', [
    'serve',
    'status',
  ])
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('3002') || line.includes('/workspace'))
    .slice(0, 4)
}

async function getPulsePid() {
  try {
    const raw = await fs.readFile(path.join(PAI_ROOT, 'PULSE', 'state', 'pulse.pid'), 'utf8')
    return raw.trim() || null
  } catch {
    return null
  }
}

async function getTerminalDocs() {
  const docs = [
    path.join(PAI_ROOT, 'DOCUMENTATION', 'Pulse', 'TerminalTabs.md'),
    path.join(PAI_ROOT, 'DOCUMENTATION', 'Pulse', 'PulseSystem.md'),
    path.join(PAI_ROOT, 'DOCUMENTATION', 'LifeOs', 'LifeOsThesis.md'),
  ]
  return docs.filter((file) => existsSync(file)).map((file) => path.basename(file))
}

export async function buildLifeOsSnapshot(): Promise<LifeOsSnapshot> {
  const [
    hermesVersion,
    codexVersion,
    userFiles,
    memoryFiles,
    tools,
    packs,
    workflows,
    hooks,
    userMd,
    telosSummary,
    pulsePid,
    terminalDocs,
    tailscale,
    pulseOut,
    pulseErr,
    hermesErr,
    workspaceLog,
    gateway,
    workspace,
    pulse,
    pulseMenu,
    office,
  ] = await Promise.all([
    getHermesVersion(),
    getCodexVersion(),
    countFiles(USER_ROOT, (file) => file.endsWith('.md')),
    countFiles(path.join(PAI_ROOT, 'MEMORY'), (file) => file.endsWith('.md') || file.endsWith('.jsonl')),
    countFiles(path.join(PAI_ROOT, 'TOOLS'), (file) => file.endsWith('.ts') || file.endsWith('.js')),
    countFiles(path.join(PAI_SOURCE_ROOT, 'Packs'), (file) => file.endsWith('SKILL.md')),
    countFiles(path.join(PAI_ROOT, 'USER', 'FLOWS'), (file) => file.endsWith('.md')),
    countFiles(path.join(PAI_ROOT, 'PULSE', 'checks'), (file) => file.endsWith('.ts')),
    listMarkdownNames(USER_ROOT, 7),
    readFirstMatchingLine(path.join(PAI_ROOT, 'USER', 'TELOS', 'PRINCIPAL_TELOS.md'), [
      /^mission:/i,
      /^#\s+/,
      /telos/i,
    ]),
    getPulsePid(),
    getTerminalDocs(),
    getTailscaleRoutes(),
    readTail(path.join(PAI_ROOT, 'PULSE', 'logs', 'pulse-stdout.log')),
    readTail(path.join(PAI_ROOT, 'PULSE', 'logs', 'pulse-stderr.log')),
    readTail(path.join(HOME, '.hermes', 'logs', 'gateway.error.log')),
    readTail(path.join(HOME, 'Library', 'Logs', 'TylerLyon', 'hermes-workspace.err.log')),
    serviceStatus('ai.hermes.gateway'),
    serviceStatus('ai.hermes.workspace'),
    serviceStatus('com.pai.pulse'),
    serviceStatus('com.pai.pulse-menubar'),
    serviceStatus('ai.hermes.office-bridge'),
  ])

  const cores = Math.max(1, os.cpus().length)
  const load = os.loadavg()[0] ?? 0
  const loadPercent = clampPercent((load / cores) * 100)
  const memPercent = clampPercent(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
  const health = clampPercent(
    100 -
      [gateway, workspace, pulse, pulseMenu, office].filter((svc) => svc.status !== 'healthy').length * 12 -
      (pulseErr.length > 0 ? 6 : 0),
  )

  const contextPercent = clampPercent(
    Math.min(100, (userFiles / 90) * 55 + (memoryFiles / 100) * 25 + (packs / 45) * 20),
  )

  return {
    checkedAt: new Date().toISOString(),
    host: {
      name: os.hostname(),
      location: 'Simpsonville, SC 29681',
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      uptime: `${Math.floor(os.uptime() / 3600)}h`,
      load: Math.round(load * 100) / 100,
    },
    state: {
      health,
      creative: clampPercent(45 + Math.min(35, workflows + hooks)),
      freedom: clampPercent(100 - loadPercent),
      relations: office.status === 'healthy' ? 78 : 58,
      finance: 82,
    },
    versions: {
      hermes: hermesVersion,
      pai: existsSync(PAI_ROOT) ? '5.0.0' : 'missing',
      algorithm: existsSync(path.join(PAI_ROOT, 'ALGORITHM')) ? '6.3.0' : 'unknown',
      codex: codexVersion,
    },
    context: {
      percent: contextPercent,
      files: userMd,
      roots: [
        { label: 'PAI', path: PAI_ROOT, present: existsSync(PAI_ROOT) },
        { label: 'PAI source', path: PAI_SOURCE_ROOT, present: existsSync(PAI_SOURCE_ROOT) },
        { label: 'Hermes workspace', path: HERMES_WORKSPACE_ROOT, present: existsSync(HERMES_WORKSPACE_ROOT) },
        { label: 'Tyler Remote', path: TYLER_REMOTE_ROOT, present: existsSync(TYLER_REMOTE_ROOT) },
      ],
    },
    pai: {
      root: PAI_ROOT,
      sourceRoot: PAI_SOURCE_ROOT,
      userFiles,
      memoryFiles,
      tools,
      packs,
      workflows,
      hooks,
      pulse: {
        status: pulse.status,
        pid: pulsePid,
        url: 'http://127.0.0.1:31337',
      },
      telosSummary: telosSummary || 'Telos source present; summary line not found.',
      terminalDocs,
    },
    services: [gateway, workspace, pulse, pulseMenu, office],
    workspace: {
      url: 'https://tylers-mac-mini-1.tail7b21e.ts.net/workspace',
      terminalRoute: '/terminal',
      chatRoute: '/chat/main',
      voice: 'Existing Hermes chat voice hooks and PAI Pulse voice server are reused.',
      tailscale,
    },
    logs: [
      {
        label: 'Pulse stdout',
        state: pulseOut.length > 0 ? 'healthy' : 'unknown',
        lines: pulseOut,
      },
      {
        label: 'Pulse stderr',
        state: pulseErr.length > 0 ? 'warn' : 'healthy',
        lines: pulseErr.length > 0 ? pulseErr : ['no recent stderr lines'],
      },
      {
        label: 'Hermes gateway',
        state: hermesErr.length > 0 ? 'warn' : 'healthy',
        lines: hermesErr.length > 0 ? hermesErr : ['no recent gateway errors'],
      },
      {
        label: 'Workspace launch',
        state: workspaceLog.length > 0 ? 'warn' : 'healthy',
        lines: workspaceLog.length > 0 ? workspaceLog : ['no workspace launch errors found'],
      },
    ],
    learning: {
      signals: userFiles + memoryFiles + tools + packs,
      recent: [5.3, 4.9, 5.1, 5.8, 6.2, 6.0, 6.4],
      note: `PAI source + installed USER tree indexed; memory pressure ${memPercent}%.`,
    },
  }
}
