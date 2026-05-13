import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || join(HOME, '.hermes', 'workspace')
const ONE_ON_ONES_DB =
  process.env.HERMES_ONE_ON_ONES_DB ||
  process.env.OPENCLAW_ONE_ON_ONES_DB ||
  join(HERMES_WORKSPACE, '.one-on-ones.json')
const WINS_CACHE_FILE = join(HERMES_WORKSPACE, '.wins-cache.json')
const WINS_TEAM_MEMBERS_FILE = join(HERMES_WORKSPACE, '.wins-team-members.json')
const SETTINGS_FILE = join(HERMES_WORKSPACE, '.clawos-settings.json')
const NOTION_KEY_FILE = join(HOME, '.config', 'notion', 'api_key')
const WINS_DATA_SOURCE_ID = '3223a60b-cbfa-8126-9dc8-000bbecb3a60'
const WINS_CACHE_TTL_MS = 5 * 60 * 1000

type BarryMeetingStatus = 'upcoming' | 'completed' | 'archived'

type BarryMeeting = {
  id: string
  date: string
  status: BarryMeetingStatus
  agenda: Array<{ text: string; discussed: boolean }>
  winsDiscussed: string[]
  actionItems: Array<{ text: string; owner: string; done: boolean }>
  notes: string
}

type BarryWin = {
  id: string
  win: string
  category: string
  priority?: string
  date: string
  costSavings?: number | null
  impactNote?: string
  shareWithBarry?: boolean
  status?: string
  teamMembers?: string[]
}

type WinsCache = {
  wins: BarryWin[]
  lastFetched: number
}

function sqlString(value: unknown) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}

function execSql(sql: string) {
  mkdirSync(dirname(ONE_ON_ONES_DB), { recursive: true })
  return execFileSync('sqlite3', [ONE_ON_ONES_DB, sql], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
}

function ensureBarrySchema() {
  execSql(`
    CREATE TABLE IF NOT EXISTS barry_meetings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      agenda_json TEXT NOT NULL,
      wins_json TEXT NOT NULL,
      actions_json TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

function parseJsonArray<T>(value: unknown): T[] {
  if (typeof value !== 'string' || value.length === 0) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function rowToMeeting(row: Record<string, unknown>): BarryMeeting {
  return {
    id: String(row.id || ''),
    date: String(row.date || ''),
    status: (
      row.status === 'completed' || row.status === 'archived'
        ? row.status
        : 'upcoming'
    ) as BarryMeetingStatus,
    agenda: parseJsonArray(row.agenda_json),
    winsDiscussed: parseJsonArray(row.wins_json),
    actionItems: parseJsonArray(row.actions_json),
    notes: String(row.notes || ''),
  }
}

export function listBarryMeetings(): BarryMeeting[] {
  ensureBarrySchema()
  const output = execSql(
    "SELECT json_group_array(json_object('id', id, 'date', date, 'status', status, 'agenda_json', agenda_json, 'wins_json', wins_json, 'actions_json', actions_json, 'notes', notes)) FROM (SELECT * FROM barry_meetings ORDER BY date DESC);",
  ).trim()
  if (!output || output === '[]' || output === '[null]') return []
  try {
    const rows = JSON.parse(output)
    return Array.isArray(rows) ? rows.map(rowToMeeting) : []
  } catch {
    return []
  }
}

function normalizeMeeting(input: Partial<BarryMeeting> & { id?: string }): BarryMeeting {
  if (!input.id?.trim()) {
    throw new Error('Missing meeting id')
  }
  return {
    id: input.id,
    date: input.date || new Date().toISOString(),
    status:
      input.status === 'completed' || input.status === 'archived'
        ? input.status
        : 'upcoming',
    agenda: Array.isArray(input.agenda) ? input.agenda : [],
    winsDiscussed: Array.isArray(input.winsDiscussed) ? input.winsDiscussed : [],
    actionItems: Array.isArray(input.actionItems) ? input.actionItems : [],
    notes: input.notes || '',
  }
}

export function createBarryMeeting(input: Partial<BarryMeeting> & { id?: string }) {
  ensureBarrySchema()
  const meeting = normalizeMeeting(input)
  const now = new Date().toISOString()
  execSql(`
    INSERT INTO barry_meetings
      (id, date, status, agenda_json, wins_json, actions_json, notes, created_at, updated_at)
    VALUES
      (${sqlString(meeting.id)}, ${sqlString(meeting.date)}, ${sqlString(meeting.status)},
       ${sqlString(JSON.stringify(meeting.agenda))}, ${sqlString(JSON.stringify(meeting.winsDiscussed))},
       ${sqlString(JSON.stringify(meeting.actionItems))}, ${sqlString(meeting.notes)},
       ${sqlString(now)}, ${sqlString(now)});
  `)
}

export function updateBarryMeeting(input: Partial<BarryMeeting> & { id?: string }) {
  ensureBarrySchema()
  if (!input.id?.trim()) throw new Error('Missing meeting id')
  const existing = listBarryMeetings().find((meeting) => meeting.id === input.id)
  if (!existing) {
    const error = new Error('Meeting not found') as Error & { status?: number }
    error.status = 404
    throw error
  }

  const merged = normalizeMeeting({ ...existing, ...input, id: input.id })
  execSql(`
    UPDATE barry_meetings
    SET date = ${sqlString(merged.date)},
        status = ${sqlString(merged.status)},
        agenda_json = ${sqlString(JSON.stringify(merged.agenda))},
        wins_json = ${sqlString(JSON.stringify(merged.winsDiscussed))},
        actions_json = ${sqlString(JSON.stringify(merged.actionItems))},
        notes = ${sqlString(merged.notes)},
        updated_at = ${sqlString(new Date().toISOString())}
    WHERE id = ${sqlString(input.id)};
  `)
}

export function deleteBarryMeeting(id: string) {
  ensureBarrySchema()
  if (!id.trim()) throw new Error('Missing meeting id')
  execSql(`DELETE FROM barry_meetings WHERE id = ${sqlString(id)};`)
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJsonFile(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8')
}

function readCurrentUser() {
  const settings = readJsonFile<{ profile?: { name?: string } }>(SETTINGS_FILE, {})
  const profileName = settings.profile?.name?.trim()
  return profileName && profileName.length > 0
    ? profileName.split(/\s+/)[0]
    : 'Tyler'
}

function plainText(richText: unknown): string {
  return Array.isArray(richText)
    ? richText.map((entry) => String(entry?.plain_text || '')).join('')
    : ''
}

function parseNotionWin(page: Record<string, any>): BarryWin {
  const props = page.properties || {}
  return {
    id: String(page.id || ''),
    win: props.Win?.title ? plainText(props.Win.title) : '',
    category: props.Category?.select?.name || 'Personal Win',
    priority: props.Priority?.select?.name || 'Medium',
    date: props.Date?.date?.start || String(page.created_time || '').slice(0, 10),
    costSavings: props['Cost Savings']?.number ?? null,
    impactNote: props['Impact Note']?.rich_text
      ? plainText(props['Impact Note'].rich_text)
      : '',
    shareWithBarry: Boolean(props['Share with Barry']?.checkbox),
    status: props.Status?.select?.name || 'Active',
  }
}

function readWinsCache(): WinsCache | null {
  const cache = readJsonFile<WinsCache | null>(WINS_CACHE_FILE, null)
  return cache && Array.isArray(cache.wins) ? cache : null
}

function mergeTeamMembers(wins: BarryWin[]): BarryWin[] {
  const index = readJsonFile<Record<string, string[]>>(WINS_TEAM_MEMBERS_FILE, {})
  return wins.map((win) =>
    Array.isArray(index[win.id]) && index[win.id].length > 0
      ? { ...win, teamMembers: index[win.id] }
      : win,
  )
}

async function fetchWinsFromNotion(): Promise<BarryWin[]> {
  const key = readFileSync(NOTION_KEY_FILE, 'utf8').trim()
  const allWins: BarryWin[] = []
  let startCursor: string | undefined

  do {
    const response = await fetch(
      `https://api.notion.com/v1/data_sources/${WINS_DATA_SOURCE_ID}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2025-09-03',
        },
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ property: 'Date', direction: 'descending' }],
          ...(startCursor ? { start_cursor: startCursor } : {}),
        }),
      },
    )

    const payload = (await response.json().catch(() => ({}))) as {
      results?: Array<Record<string, any>>
      has_more?: boolean
      next_cursor?: string
      message?: string
    }
    if (!response.ok) {
      throw new Error(payload.message || `Notion wins fetch failed (${response.status})`)
    }

    allWins.push(...(payload.results || []).map(parseNotionWin))
    startCursor = payload.has_more ? payload.next_cursor || undefined : undefined
  } while (startCursor)

  writeJsonFile(WINS_CACHE_FILE, { wins: allWins, lastFetched: Date.now() })
  return allWins
}

export async function listBarryWins(): Promise<BarryWin[]> {
  const cache = readWinsCache()
  let wins = cache?.wins || []

  if (!cache || Date.now() - cache.lastFetched > WINS_CACHE_TTL_MS) {
    try {
      wins = await fetchWinsFromNotion()
    } catch {
      wins = cache?.wins || []
    }
  }

  return mergeTeamMembers(wins).filter(
    (win) => win.shareWithBarry && win.status === 'Active',
  )
}

export async function getBarryData() {
  const [meetings, wins] = await Promise.all([
    Promise.resolve(listBarryMeetings()),
    listBarryWins(),
  ])

  return {
    meetings,
    wins,
    currentUser: readCurrentUser(),
    refreshedAt: new Date().toISOString(),
  }
}
