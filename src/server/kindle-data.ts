import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getItOpsData } from './it-ops-data'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || join(HOME, '.hermes', 'workspace')
const HERMES_DB_DIR = join(HERMES_WORKSPACE, 'runtime', 'db', 'workspace')
const MEETINGS_DB =
  process.env.HERMES_MEETINGS_DB ||
  join(HERMES_DB_DIR, '.meetings.db')
const AZURE_COSTS_DB = join(HERMES_WORKSPACE, '.azure-costs.db')
const PLANNER_CACHE = join(HERMES_WORKSPACE, '.planner-cache.json')
const PRESENCE_STATE = join(HERMES_WORKSPACE, '.presence_state.json')
const WINS_CACHE = join(HERMES_WORKSPACE, '.wins-cache.json')
const HERMES_CRON_DIR = join(HOME, '.hermes', 'hermes-agent', 'cron')
const CONNECTWISE_CONFIG_CANDIDATES = [
  process.env.HERMES_CONNECTWISE_CONFIG,
  process.env.OPENCLAW_CONNECTWISE_CONFIG,
  join(HOME, '.config', 'hermes', 'tokens', 'connectwise_config.json'),
  join(HOME, '.config', 'openclaw', 'tokens', 'connectwise_config.json'),
].filter(Boolean) as string[]
const CLAWOS_INTERNAL_ORIGIN = (
  process.env.CLAWOS_INTERNAL_ORIGIN?.trim() || 'http://127.0.0.1:3000'
).replace(/\/+$/, '')

type ConnectWiseConfig = {
  baseUrl: string
  companyId: string
  publicKey: string
  privateKey: string
  clientId: string
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

function queryDb<T>(dbPath: string, sql: string): T[] {
  if (!existsSync(dbPath)) return []
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  }).trim()
  return output ? (JSON.parse(output) as T[]) : []
}

async function fetchClawosJson<T>(pathName: string): Promise<T> {
  const response = await fetch(`${CLAWOS_INTERNAL_ORIGIN}${pathName}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    throw new Error(`ClawOS API ${pathName} returned ${response.status}`)
  }
  return (await response.json()) as T
}

function todayBounds() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function getTodayMeetings() {
  const { start, end } = todayBounds()
  const rows = queryDb<{ id: string; title: string; date: string }>(
    MEETINGS_DB,
    `SELECT id, title, date FROM meetings WHERE date >= '${start}' AND date <= '${end}' ORDER BY date ASC;`,
  )
  const now = Date.now()
  return rows.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    subject: meeting.title,
    date: meeting.date,
    start: meeting.date,
    isPast: new Date(meeting.date).getTime() < now,
  }))
}

function getPlannerSummary() {
  const cache = readJsonFile<{ tasks?: any[]; plans?: any[]; groups?: any[] }>(
    PLANNER_CACHE,
    {},
  )
  const tasks = Array.isArray(cache.tasks) ? cache.tasks : []
  const now = Date.now()
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const isOpen = (task: any) => (task?.percentComplete ?? 0) < 100
  const dueDate = (task: any) => task?.dueDateTime || task?.dueDate || null
  return {
    available: existsSync(PLANNER_CACHE),
    taskCount: tasks.length,
    overdueCount: tasks.filter((task) => {
      const due = dueDate(task)
      return isOpen(task) && due && new Date(due).getTime() < now
    }).length,
    dueThisWeekCount: tasks.filter((task) => {
      const due = dueDate(task)
      if (!isOpen(task) || !due) return false
      const time = new Date(due).getTime()
      return time >= now && time <= weekEnd.getTime()
    }).length,
    completedCount: tasks.filter((task) => (task?.percentComplete ?? 0) >= 100).length,
    groupsCount: Array.isArray(cache.groups) ? cache.groups.length : 0,
    plansCount: Array.isArray(cache.plans) ? cache.plans.length : 0,
  }
}

function getPresenceSummary() {
  const state = readJsonFile<any>(PRESENCE_STATE, {})
  const tyler = state.tyler || {}
  const availability = tyler.status || (state.tyler_is_home ? 'home' : 'away')
  return {
    availability: String(availability || 'Unknown'),
    activity: tyler.reason || tyler.location || '',
    stale: tyler.lastUpdate
      ? Date.now() - new Date(tyler.lastUpdate).getTime() > 15 * 60 * 1000
      : true,
  }
}

function getCostSummary() {
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const todayRow = queryDb<{ total: number }>(
    AZURE_COSTS_DB,
    `SELECT COALESCE(SUM(cost_usd), 0) as total FROM azure_costs WHERE date = '${today}';`,
  )[0]
  const monthRow = queryDb<{ total: number }>(
    AZURE_COSTS_DB,
    `SELECT COALESCE(SUM(cost_usd), 0) as total FROM azure_costs WHERE substr(date, 1, 7) = '${month}';`,
  )[0]
  return {
    today: typeof todayRow?.total === 'number' ? todayRow.total : null,
    month: typeof monthRow?.total === 'number' ? monthRow.total : null,
  }
}

function getWinsThisWeek() {
  const cache = readJsonFile<{ wins?: Array<{ date?: string; created_at?: string }> }>(
    WINS_CACHE,
    {},
  )
  const wins = Array.isArray(cache.wins) ? cache.wins : []
  const weekAgo = Date.now() - 7 * 86_400_000
  return wins.filter((win) => {
    const value = win.created_at || win.date
    return value ? new Date(value).getTime() >= weekAgo : false
  }).length
}

function getCronHealth() {
  const rows = queryDb<{
    name: string
    enabled: number
    status: string | null
    last_status: string | null
    consecutive_errors: number | null
  }>(join(HERMES_CRON_DIR, 'cron.sqlite'), 'SELECT name, enabled, status, last_status, consecutive_errors FROM jobs;')
  const enabled = rows.filter((job) => Boolean(job.enabled))
  const failed = enabled.filter((job) => {
    const status = `${job.status || ''} ${job.last_status || ''}`.toLowerCase()
    return status.includes('fail') || status.includes('error') || (job.consecutive_errors || 0) > 0
  })
  return {
    total: rows.length,
    running: enabled.length,
    failed: failed.length,
    failedNames: failed.map((job) => job.name),
  }
}

function getHealthSummary(cronHealth: ReturnType<typeof getCronHealth>, presence: ReturnType<typeof getPresenceSummary>) {
  const issues: string[] = []
  if (cronHealth.failed > 0) issues.push(`${cronHealth.failed} cron job(s) failing`)
  if (presence.stale) issues.push('Presence state is stale')
  const percent = Math.max(0, 100 - issues.length * 15)
  return {
    overall: issues.length ? 'warning' : 'healthy',
    percent,
    issues,
    memoryUsage: null,
    gatewayOnline: true,
  }
}

function readConnectWiseConfig(): ConnectWiseConfig | null {
  for (const configPath of CONNECTWISE_CONFIG_CANDIDATES) {
    if (!existsSync(configPath)) continue
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as ConnectWiseConfig
      if (config.baseUrl && config.companyId && config.publicKey && config.privateKey && config.clientId) {
        return config
      }
    } catch {
      // Try next path.
    }
  }
  return null
}

function authHeader(config: ConnectWiseConfig) {
  return `Basic ${Buffer.from(`${config.companyId}+${config.publicKey}:${config.privateKey}`).toString('base64')}`
}

async function fetchConnectWiseTickets() {
  const config = readConnectWiseConfig()
  if (!config) return { recent: [], byPriority: [], error: 'ConnectWise not configured' }
  try {
    const response = await fetch(
      `${config.baseUrl}/service/tickets?conditions=status/name!="Closed"&pageSize=50&fields=id,summary,status,priority,assignedTo,owner,dateEntered,board,requiredDate`,
      {
        headers: {
          Authorization: authHeader(config),
          clientId: config.clientId,
          Accept: 'application/json',
        },
      },
    )
    if (!response.ok) {
      return { recent: [], byPriority: [], error: `ConnectWise API ${response.status}` }
    }
    const tickets = (await response.json()) as any[]
    const byPriorityMap: Record<string, number> = {}
    for (const ticket of tickets) {
      const priority = ticket.priority?.name || 'Unlabeled'
      byPriorityMap[priority] = (byPriorityMap[priority] || 0) + 1
    }
    return {
      recent: tickets.slice(0, 8).map((ticket) => ({
        id: ticket.id,
        summary: ticket.summary || '(no summary)',
        status: ticket.status?.name,
        priority: ticket.priority?.name,
        assignedTo: ticket.owner?.name || ticket.assignedTo?.name,
      })),
      byPriority: Object.entries(byPriorityMap)
        .sort((left, right) => right[1] - left[1])
        .map(([priority, count]) => ({ priority, count })),
      error: null,
    }
  } catch (error) {
    return {
      recent: [],
      byPriority: [],
      error: error instanceof Error ? error.message : 'ConnectWise fetch failed',
    }
  }
}

export async function getKindleData() {
  const [itOps, cwTickets, dashboardData, executiveData] = await Promise.all([
    getItOpsData(),
    fetchConnectWiseTickets(),
    fetchClawosJson<any>('/api/dashboard-data?nocache=1').catch(() => null),
    fetchClawosJson<any>('/api/executive-it').catch(() => null),
  ])
  const meetings = Array.isArray(dashboardData?.meetings?.todayList)
    ? dashboardData.meetings.todayList
    : getTodayMeetings()
  const planner = executiveData?.microsoft365?.planner || getPlannerSummary()
  const presence = dashboardData?.teamsPresence || getPresenceSummary()
  const cronHealth = dashboardData?.cronHealth || getCronHealth()
  const healthSummary =
    dashboardData?.healthSummary || getHealthSummary(cronHealth, presence)
  const nextMeeting =
    executiveData?.microsoft365?.meetings?.nextMeeting ||
    meetings
      .filter((meeting) => !meeting.isPast)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null
  const connectwiseSummary = executiveData?.connectwise?.summary
  const connectwiseTickets = executiveData?.connectwise?.tickets
  const connectwiseDashboard = dashboardData?.connectwise

  return {
    dashboard: {
      connectwise: {
        openTicketCount:
          connectwiseDashboard?.openTicketCount ??
          connectwiseSummary?.openTickets ??
          itOps.analytics.ticketStats.open,
        available:
          connectwiseDashboard?.available ?? itOps.analytics.errors.length === 0,
        configured:
          connectwiseDashboard?.configured ??
          !itOps.analytics.errors.some((error) =>
            error.toLowerCase().includes('not configured'),
          ),
        detail: connectwiseDashboard?.detail ?? itOps.analytics.errors[0] ?? null,
      },
      cronHealth,
      healthSummary,
      teamsPresence: presence,
      aiCost: dashboardData?.aiCost || getCostSummary(),
      meetings: {
        todayCount: dashboardData?.meetings?.todayCount ?? meetings.length,
        todayList: meetings,
      },
      wins: {
        thisWeek: dashboardData?.wins?.thisWeek ?? getWinsThisWeek(),
      },
      openclaw: {
        hasUpdate: dashboardData?.openclaw?.hasUpdate ?? false,
        latestName: dashboardData?.openclaw?.latestName ?? null,
      },
    },
    executive: {
      connectwise: {
        available:
          executiveData?.connectwise?.available ?? itOps.analytics.errors.length === 0,
        summary: {
          openTickets: connectwiseSummary?.openTickets ?? itOps.analytics.ticketStats.open,
          slaAtRisk: Math.max(
            0,
            connectwiseSummary?.slaAtRisk ??
              Math.round(
                itOps.analytics.ticketStats.open *
                  (1 - itOps.analytics.ticketStats.slaCompliancePct / 100),
              ),
          ),
          boardCount: connectwiseSummary?.boardCount ?? itOps.analytics.queueBreakdown.length,
          techCount: connectwiseSummary?.techCount ?? itOps.analytics.teamPerformance.length,
          slaCompliance:
            connectwiseSummary?.slaCompliance ??
            itOps.analytics.ticketStats.slaCompliancePct,
          avgResolutionTime:
            connectwiseSummary?.avgResolutionTime ??
            itOps.analytics.ticketStats.avgResolutionHours,
        },
        tickets: {
          byPriority: connectwiseTickets?.byPriority || cwTickets.byPriority,
          byTech: connectwiseTickets?.byTech || itOps.analytics.teamPerformance.map((member) => ({
            tech: member.name,
            count: member.ticketsAssigned,
          })),
          recent: connectwiseTickets?.recent || cwTickets.recent,
        },
        fetchedAt: executiveData?.connectwise?.fetchedAt || itOps.analytics.fetchedAt,
        error:
          executiveData?.connectwise?.error ||
          cwTickets.error ||
          itOps.analytics.errors[0] ||
          null,
      },
      microsoft365: {
        planner,
        meetings: {
          available:
            executiveData?.microsoft365?.meetings?.available ??
            dashboardData?.meetings?.available ??
            existsSync(MEETINGS_DB),
          todayCount:
            executiveData?.microsoft365?.meetings?.todayCount ??
            dashboardData?.meetings?.todayCount ??
            meetings.length,
          nextMeeting,
          meetings:
            executiveData?.microsoft365?.meetings?.meetings || meetings.slice(0, 8),
        },
      },
      fetchedAt: executiveData?.fetchedAt || new Date().toISOString(),
    },
    refreshedAt: new Date().toISOString(),
  }
}
