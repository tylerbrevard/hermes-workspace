import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || join(HOME, '.hermes', 'workspace')
const HERMES_DB_DIR = join(HERMES_WORKSPACE, 'runtime', 'db', 'workspace')
const GRAPH_WRAPPER = join(HERMES_WORKSPACE, 'scripts', 'run_hermes_venv_python.sh')
const GRAPH_BRIDGE = join(HERMES_WORKSPACE, 'scripts', 'graph_bridge.py')
const TYLER_GUID = 'b906d90e-689b-464e-8904-aed5180b463a'
const PRESENCE_STATE = join(HERMES_WORKSPACE, '.presence_state.json')
const M5_DB = process.env.HERMES_M5_DISPLAY_DB || join(HERMES_DB_DIR, '.m5-display.db')
const IOT_CONFIG = join(HERMES_WORKSPACE, '.iot-config.json')
const M5_WORDS = join(HERMES_WORKSPACE, '.m5_words.json')
const MEETINGS_DB =
  process.env.HERMES_MEETINGS_DB ||
  join(HERMES_DB_DIR, '.meetings.db')
const LEGACY_PRESENCE_ORIGIN = (
  process.env.HERMES_LEGACY_PRESENCE_ORIGIN?.trim() ||
  process.env.CLAWOS_INTERNAL_ORIGIN?.trim() ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '')

type TeamsPresence = {
  availability?: string
  activity?: string
  displayName?: string
  color?: string
  inferred?: boolean
  stale?: boolean
  authRequired?: boolean
  fallback?: boolean
  timestamp?: string
  error?: string
  source?: string
}

type WordPool = {
  id: string
  name: string
  words: string[]
  active: boolean
}

type IotConfigEntry = [string, Record<string, unknown>]

const PRESENCE_COLORS: Record<string, string> = {
  Available: 'green',
  Busy: 'red',
  DoNotDisturb: 'red',
  BeRightBack: 'yellow',
  Away: 'yellow',
  Offline: 'gray',
  PresenceUnknown: 'gray',
  InAMeeting: 'red',
  Presenting: 'red',
  OutOfOffice: 'gray',
}

const DISPLAY_NAMES: Record<string, string> = {
  Available: 'Available',
  Busy: 'Busy',
  DoNotDisturb: 'Do Not Disturb',
  BeRightBack: 'Be Right Back',
  Away: 'Away',
  Offline: 'Offline',
  PresenceUnknown: 'Unknown',
  InAMeeting: 'In a Meeting',
  Presenting: 'Presenting',
  OutOfOffice: 'Out of Office',
  OffWork: 'Off Work',
  UrgentInterruptionsOnly: 'Do Not Disturb',
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

function queryDb<T>(dbPath: string, sql: string): T[] {
  if (!existsSync(dbPath)) return []
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  }).trim()
  return output ? (JSON.parse(output) as T[]) : []
}

function execSql(dbPath: string, sql: string) {
  mkdirSync(dirname(dbPath), { recursive: true })
  execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' })
}

async function fetchLegacyPresenceJson<T>(pathName: string): Promise<T> {
  if (!LEGACY_PRESENCE_ORIGIN) {
    throw new Error('legacy presence origin disabled')
  }
  const response = await fetch(`${LEGACY_PRESENCE_ORIGIN}${pathName}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    throw new Error(`legacy presence API ${pathName} returned ${response.status}`)
  }
  return (await response.json()) as T
}

function sqlString(value: unknown) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}

function normalizePresence(value?: string) {
  const normalized = (value || '').toLowerCase().replace(/[^a-z]/g, '')
  if (normalized.includes('donotdisturb') || normalized.includes('urgentinterruptionsonly')) {
    return 'donotdisturb'
  }
  if (normalized.includes('busy') || normalized.includes('inameeting')) return 'busy'
  if (normalized.includes('berightback') || normalized.includes('brb')) return 'berightback'
  if (normalized.includes('away')) return 'away'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('offline') || normalized.includes('unknown')) return 'offline'
  return normalized || 'unknown'
}

function normalizeLegacyTeamsStatus(status?: string): string {
  switch (status) {
    case 'Available':
      return 'available'
    case 'Busy':
    case 'InACall':
    case 'InAMeeting':
    case 'InAConferenceCall':
    case 'Presenting':
      return 'busy'
    case 'DoNotDisturb':
    case 'UrgentInterruptionsOnly':
      return 'dnd'
    case 'BeRightBack':
      return 'brb'
    case 'Away':
      return 'away'
    default:
      return 'unknown'
  }
}

function teamsStatusPayload(status: string, activity = '') {
  return {
    status,
    activity,
    availability: status,
    teamsStatus: normalizeLegacyTeamsStatus(status),
    label: status,
    word: status,
    currentWord: status,
  }
}

function inferPresenceFromLocal(): TeamsPresence | null {
  const state = readJsonFile<any>(PRESENCE_STATE, {})
  const tyler = state.tyler || {}
  const raw = String(tyler.location || tyler.status || (state.tyler_is_home ? 'home' : '')).toLowerCase()
  if (!raw) return null
  if (raw === 'home') {
    return {
      availability: 'Available',
      activity: 'Available',
      color: PRESENCE_COLORS.Available,
      inferred: true,
      timestamp: tyler.lastUpdate || state.tyler_last_home || new Date().toISOString(),
    }
  }
  if (raw === 'away' || raw === 'office' || raw === 'traveling') {
    return {
      availability: 'Away',
      activity: 'Away',
      color: PRESENCE_COLORS.Away,
      inferred: true,
      timestamp: tyler.lastUpdate || state.tyler_last_away || new Date().toISOString(),
    }
  }
  if (raw === 'sleeping') {
    return {
      availability: 'DoNotDisturb',
      activity: 'OffWork',
      color: PRESENCE_COLORS.DoNotDisturb,
      inferred: true,
      timestamp: tyler.lastUpdate || new Date().toISOString(),
    }
  }
  return null
}

function graphJson<T>(method: string, endpoint: string, body?: unknown): T {
  const args = [GRAPH_BRIDGE, 'json', method, endpoint]
  if (body !== undefined) args.push(JSON.stringify(body))
  const output = execFileSync(GRAPH_WRAPPER, args, {
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 8 * 1024 * 1024,
  }).trim()
  return output ? (JSON.parse(output) as T) : (null as T)
}

export async function getTeamsPresence(): Promise<TeamsPresence> {
  try {
    const presence = await fetchLegacyPresenceJson<TeamsPresence>('/api/teams-presence')
    const availability = presence.availability || 'PresenceUnknown'
    return {
      ...presence,
      availability,
      activity: presence.activity || availability,
      displayName:
        presence.displayName || DISPLAY_NAMES[availability] || availability,
      color: presence.color || PRESENCE_COLORS[availability] || 'gray',
      timestamp: presence.timestamp || new Date().toISOString(),
      source: presence.source || 'clawos',
    }
  } catch {
    // Fall back to the direct Graph bridge for standalone Workspace operation.
  }

  try {
    const presence = graphJson<{ availability?: string; activity?: string }>(
      'GET',
      `/users/${TYLER_GUID}/presence`,
    )
    const availability = presence.availability || 'PresenceUnknown'
    if (availability === 'PresenceUnknown' || availability === 'Offline') {
      const inferred = inferPresenceFromLocal()
      if (inferred) return { ...inferred, fallback: availability === 'Offline' }
    }
    return {
      availability,
      activity: presence.activity || availability,
      displayName: DISPLAY_NAMES[availability] || availability,
      color: PRESENCE_COLORS[availability] || 'gray',
      timestamp: new Date().toISOString(),
      source: 'graph',
    }
  } catch (error) {
    const inferred = inferPresenceFromLocal()
    const message = error instanceof Error ? error.message : String(error)
    if (inferred) return { ...inferred, fallback: true, error: message }
    return { availability: 'PresenceUnknown', activity: 'PresenceUnknown', color: 'gray', error: message, authRequired: message.includes('401') }
  }
}

function ensureM5Schema() {
  execSql(
    M5_DB,
    `
    CREATE TABLE IF NOT EXISTS m5_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'M5Stack',
      ip_address TEXT,
      firmware_version TEXT,
      status TEXT DEFAULT 'offline',
      last_seen TEXT,
      brightness INTEGER DEFAULT 128,
      fetch_interval INTEGER DEFAULT 30,
      current_word TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    `,
  )
  execSql(
    M5_DB,
    `
    CREATE TABLE IF NOT EXISTS m5_display_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL UNIQUE,
      display_mode TEXT DEFAULT 'teams',
      custom_message TEXT,
      rotation_enabled INTEGER DEFAULT 0,
      rotation_interval_seconds INTEGER DEFAULT 30,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    `,
  )
}

function readIotConfigs(): IotConfigEntry[] {
  const entries = readJsonFile<IotConfigEntry[]>(IOT_CONFIG, [])
  return Array.isArray(entries)
    ? entries.filter(
        (entry): entry is IotConfigEntry =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          entry[1] !== null &&
          typeof entry[1] === 'object',
      )
    : []
}

function writeIotConfigs(configs: IotConfigEntry[]) {
  writeJsonFile(IOT_CONFIG, configs)
}

function configLabels(deviceId: string) {
  const entries = readIotConfigs()
  const config = entries.find(([id]) => id === deviceId)?.[1] || {}
  const labels: Record<string, string> = {}
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith('label') && typeof value === 'string') {
      labels[key.replace(/^label/, '').toLowerCase()] = value
    }
  }
  return {
    labels,
    tunnelUrl: typeof config.tunnelUrl === 'string' ? config.tunnelUrl : undefined,
    updatedAt: typeof config.updatedAt === 'number' ? config.updatedAt : undefined,
  }
}

function deriveCurrentLabel(config: Record<string, unknown>, fallback = 'Unknown'): string {
  const candidate =
    config.currentWord ||
    config.word ||
    config.label ||
    config.labelAvailable ||
    config.labelBusy ||
    config.labelDND ||
    config.labelBRB ||
    config.labelAway ||
    config.labelOffline ||
    config.labelUnknown
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback
}

function getDeviceRow(deviceId: string) {
  return queryDb<any>(
    M5_DB,
    `SELECT * FROM m5_devices WHERE device_id = ${sqlString(deviceId)} LIMIT 1;`,
  )[0] || null
}

function getDisplayConfig(deviceId: string) {
  return queryDb<any>(
    M5_DB,
    `SELECT * FROM m5_display_config WHERE device_id = ${sqlString(deviceId)} LIMIT 1;`,
  )[0] || null
}

function upsertM5Device(input: {
  deviceId: string
  status?: string
  currentWord?: string
  fetchInterval?: number
}) {
  ensureM5Schema()
  const now = new Date().toISOString()
  const existing = getDeviceRow(input.deviceId)
  const fetchInterval =
    typeof input.fetchInterval === 'number'
      ? Math.round(input.fetchInterval)
      : existing?.fetch_interval || 30
  execSql(
    M5_DB,
    `INSERT INTO m5_devices (device_id, name, status, last_seen, current_word, fetch_interval)
     VALUES (${sqlString(input.deviceId)}, ${sqlString(input.deviceId)}, ${sqlString(input.status || 'online')}, ${sqlString(now)}, ${sqlString(input.currentWord || '')}, ${fetchInterval})
     ON CONFLICT(device_id) DO UPDATE SET
       name = excluded.name,
       status = excluded.status,
       last_seen = excluded.last_seen,
       current_word = COALESCE(NULLIF(excluded.current_word, ''), m5_devices.current_word),
       fetch_interval = excluded.fetch_interval;`,
  )
}

export async function getLegacyTeamsPresence() {
  const presence = await getTeamsPresence()
  return {
    ...presence,
    displayName: presence.displayName || DISPLAY_NAMES[presence.availability || ''] || presence.availability || 'Unknown',
    color: presence.color || PRESENCE_COLORS[presence.availability || ''] || 'gray',
  }
}

export function getLegacyIotDevices() {
  ensureM5Schema()
  return {
    devices: queryDb<any>(M5_DB, 'SELECT * FROM m5_devices ORDER BY name;'),
  }
}

export function recordLegacyIotTelemetry(body: Record<string, unknown>) {
  const deviceId =
    typeof body.device === 'string'
      ? body.device
      : typeof body.device_id === 'string'
        ? body.device_id
        : typeof body.deviceId === 'string'
          ? body.deviceId
          : ''
  if (!deviceId) throw new Error('device or device_id is required')
  upsertM5Device({
    deviceId,
    status: typeof body.status === 'string' ? body.status : 'online',
    currentWord:
      typeof body.word === 'string'
        ? body.word
        : typeof body.currentWord === 'string'
          ? body.currentWord
          : undefined,
  })
  return {
    ok: true,
    device: deviceId,
    received: {
      temp: body.temp,
      rssi: body.rssi,
      uptime: body.uptime,
      battery: body.battery,
      buttons: body.buttons,
    },
    timestamp: new Date().toISOString(),
  }
}

export function getLegacyIotConfig(searchParams: URLSearchParams) {
  ensureM5Schema()
  const configs = readIotConfigs()
  let deviceId =
    searchParams.get('device') ||
    searchParams.get('deviceId') ||
    searchParams.get('device_id') ||
    configs[0]?.[0] ||
    queryDb<{ device_id: string }>(
      M5_DB,
      'SELECT device_id FROM m5_devices ORDER BY last_seen DESC LIMIT 1;',
    )[0]?.device_id ||
    'peppy-waffle'

  const config = configs.find(([id]) => id === deviceId)?.[1] || {}
  const device = getDeviceRow(deviceId)
  const displayConfig = getDisplayConfig(deviceId)
  const statusLabel =
    typeof device?.current_word === 'string' && device.current_word.trim()
      ? device.current_word
      : deriveCurrentLabel(config)
  const availability =
    typeof device?.status === 'string' && device.status.trim() ? device.status : 'Unknown'
  const fetchInterval =
    typeof config.fetchInterval === 'number'
      ? config.fetchInterval
      : typeof config.sensorInterval === 'number'
        ? config.sensorInterval
        : device?.fetch_interval || 30
  const mergedConfig = {
    ...config,
    deviceId,
    serverUrl: 'https://tylers-mac-mini-1.tail7b21e.ts.net',
    displayMode: displayConfig?.display_mode || 'teams',
    fetchInterval,
    label: statusLabel,
    word: statusLabel,
    currentWord: statusLabel,
    status: normalizeLegacyTeamsStatus(device?.status),
    teamsStatus: normalizeLegacyTeamsStatus(device?.status),
    availability,
    version:
      typeof config.version === 'number'
        ? config.version
        : typeof displayConfig?.id === 'number'
          ? 1
          : undefined,
  }

  upsertM5Device({
    deviceId,
    status: availability,
    currentWord: statusLabel,
    fetchInterval,
  })

  return {
    device: deviceId,
    ...mergedConfig,
    config: mergedConfig,
    timestamp: new Date().toISOString(),
  }
}

export function updateLegacyIotConfig(body: Record<string, unknown>) {
  const deviceId =
    typeof body.device === 'string'
      ? body.device
      : typeof body.device_id === 'string'
        ? body.device_id
        : ''
  if (!deviceId) throw new Error('device or device_id is required')

  const { device: _device, device_id: _deviceId, ...configUpdates } = body
  const configs = readIotConfigs()
  const index = configs.findIndex(([id]) => id === deviceId)
  const current = index >= 0 ? configs[index][1] : {}
  const nextConfig = {
    ...current,
    ...configUpdates,
    updatedAt: Date.now(),
    version: (typeof current.version === 'number' ? current.version : 0) + 1,
  }
  if (index >= 0) {
    configs[index] = [deviceId, nextConfig]
  } else {
    configs.push([deviceId, nextConfig])
  }
  writeIotConfigs(configs)

  const currentLabel = deriveCurrentLabel(nextConfig)
  const availability =
    typeof nextConfig.availability === 'string' ? nextConfig.availability : currentLabel
  const fetchInterval =
    typeof nextConfig.fetchInterval === 'number'
      ? nextConfig.fetchInterval
      : typeof nextConfig.sensorInterval === 'number'
        ? nextConfig.sensorInterval
        : 30
  upsertM5Device({
    deviceId,
    status: availability,
    currentWord: currentLabel,
    fetchInterval,
  })
  execSql(
    M5_DB,
    `INSERT INTO m5_display_config (device_id, display_mode, updated_at)
     VALUES (${sqlString(deviceId)}, 'teams', ${sqlString(new Date().toISOString())})
     ON CONFLICT(device_id) DO UPDATE SET display_mode = 'teams', updated_at = excluded.updated_at;`,
  )

  return {
    ok: true,
    device: deviceId,
    config: {
      ...nextConfig,
      deviceId,
      serverUrl: 'https://tylers-mac-mini-1.tail7b21e.ts.net',
      displayMode: 'teams',
      label: currentLabel,
      word: currentLabel,
      currentWord: currentLabel,
      status: normalizeLegacyTeamsStatus(availability),
      teamsStatus: normalizeLegacyTeamsStatus(availability),
      availability,
    },
    timestamp: new Date().toISOString(),
  }
}

export function getM5Devices() {
  ensureM5Schema()
  const rows = queryDb<any>(
    M5_DB,
    'SELECT * FROM m5_devices ORDER BY name;',
  )
  return rows.map((row) => {
    const lastSeen = row.last_seen ? new Date(row.last_seen) : new Date(0)
    const minutesAgo = Math.max(0, Math.round((Date.now() - lastSeen.getTime()) / 60_000))
    const extra = configLabels(row.device_id || row.id)
    return {
      id: row.device_id || String(row.id),
      name: row.name || row.device_id || 'Unknown',
      type: 'M5Stack',
      status: row.status || 'unknown',
      teamsStatus: row.status || 'unknown',
      currentWord: row.current_word || '',
      wordMode: 'teams',
      lastUpdate: row.last_seen || new Date().toISOString(),
      lastSeenMinutesAgo: minutesAgo,
      sensors: undefined,
      config: {
        brightness: row.brightness ?? 128,
        fetchInterval: row.fetch_interval ?? 30,
        labels: Object.keys(extra.labels).length ? extra.labels : undefined,
        tunnelUrl: extra.tunnelUrl,
      },
    }
  })
}

export function updateDeviceConfig(deviceId: string, brightness?: number, fetchInterval?: number) {
  ensureM5Schema()
  const sets: string[] = []
  if (typeof brightness === 'number') sets.push(`brightness = ${Math.round(brightness)}`)
  if (typeof fetchInterval === 'number') sets.push(`fetch_interval = ${Math.round(fetchInterval)}`)
  if (!sets.length) return
  execSql(M5_DB, `UPDATE m5_devices SET ${sets.join(', ')} WHERE device_id = ${sqlString(deviceId)};`)
}

export function updateDeviceLabel(deviceId: string, status: string, word: string) {
  ensureM5Schema()
  execSql(
    M5_DB,
    `UPDATE m5_devices SET status = ${sqlString(status)}, current_word = ${sqlString(word)} WHERE device_id = ${sqlString(deviceId)};`,
  )
}

export function getWordPools(): WordPool[] {
  const defaults: WordPool[] = [
    { id: 'default', name: 'Default', words: ['HELLO', 'WORLD', 'CODING', 'MAGIC'], active: true },
  ]
  const pools = readJsonFile<WordPool[]>(M5_WORDS, defaults)
  if (!existsSync(M5_WORDS)) writeJsonFile(M5_WORDS, pools)
  return Array.isArray(pools) ? pools : defaults
}

function saveWordPools(pools: WordPool[]) {
  writeJsonFile(M5_WORDS, pools)
}

export function activatePool(poolId: string) {
  const pools = getWordPools().map((pool) => ({ ...pool, active: pool.id === poolId }))
  saveWordPools(pools)
  return { success: true }
}

export function rotateWords() {
  const active = getWordPools().find((pool) => pool.active)
  if (!active || active.words.length === 0) return { word: 'HELLO' }
  return { word: active.words[Math.floor(Math.random() * active.words.length)] }
}

export async function getTeamsPreview() {
  const presence = await getTeamsPresence()
  return teamsStatusPayload(presence.availability || 'Unknown', presence.activity || '')
}

function getActiveMeetingTitle() {
  const now = Date.now()
  const rows = queryDb<{ title: string; date: string }>(
    MEETINGS_DB,
    `SELECT title, date FROM meetings WHERE date >= '${new Date(now - 60 * 60_000).toISOString()}' AND date <= '${new Date(now + 60 * 60_000).toISOString()}' ORDER BY date ASC;`,
  )
  const active = rows.find((meeting) => {
    const start = new Date(meeting.date).getTime()
    return start <= now && start + 60 * 60_000 >= now
  })
  return active?.title || null
}

function buildSyncDiagnostics(presence: TeamsPresence, devices: ReturnType<typeof getM5Devices>) {
  const freshestDevice = [...devices].sort(
    (left, right) =>
      (left.lastSeenMinutesAgo ?? Number.POSITIVE_INFINITY) -
      (right.lastSeenMinutesAgo ?? Number.POSITIVE_INFINITY),
  )[0]
  const teamsAvailability = presence.availability || 'Unknown'
  const normalizedTeams = normalizePresence(teamsAvailability)
  const deviceStatus = freshestDevice?.teamsStatus || freshestDevice?.status || ''
  const normalizedDeviceStatus = normalizePresence(deviceStatus)
  const deviceWord = freshestDevice?.currentWord || ''
  const lastSeenMinutesAgo = freshestDevice?.lastSeenMinutesAgo
  const expectedLabel =
    freshestDevice?.config?.labels?.[normalizedTeams] ||
    freshestDevice?.config?.labels?.[teamsAvailability] ||
    null
  const presenceSource = presence.error
    ? 'error'
    : presence.authRequired
      ? 'auth-required'
      : presence.stale
        ? 'stale'
        : presence.source || (presence.inferred || presence.fallback ? 'inferred' : 'graph')

  let driftReason = 'in_sync'
  let inSync = true
  if (presence.error) {
    inSync = false
    driftReason = 'teams_unavailable'
  } else if ((lastSeenMinutesAgo ?? Number.POSITIVE_INFINITY) > 5) {
    inSync = false
    driftReason = 'device_stale'
  } else if (normalizedDeviceStatus !== normalizedTeams) {
    inSync = false
    driftReason = 'status_mismatch'
  } else if (expectedLabel && deviceWord && expectedLabel !== deviceWord) {
    inSync = false
    driftReason = 'label_mismatch'
  }

  return {
    teamsAvailability,
    teamsActivity: presence.activity || '',
    presenceSource,
    teamsError: presence.error || null,
    deviceName: freshestDevice?.name || null,
    deviceStatus,
    deviceWord,
    deviceFreshness: lastSeenMinutesAgo ?? null,
    expectedLabel,
    inSync,
    driftReason,
  }
}

export async function getPresenceData() {
  const presence = await getTeamsPresence()
  const devices = getM5Devices()
  const pools = getWordPools()
  return {
    presence,
    preview: teamsStatusPayload(
      presence.availability || 'Unknown',
      presence.activity || '',
    ),
    devices,
    pools,
    syncDiagnostics: buildSyncDiagnostics(presence, devices),
    activeMeetingTitle: getActiveMeetingTitle(),
    refreshedAt: new Date().toISOString(),
  }
}
