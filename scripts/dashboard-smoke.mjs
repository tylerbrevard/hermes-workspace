#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Dashboard Smoke Test — validates API endpoints return expected shapes.
 * Usage: node scripts/dashboard-smoke.mjs [baseUrl]
 * Default: http://127.0.0.1:3002/workspace
 */

const inputBase = process.argv[2] || 'http://127.0.0.1:3002/workspace'
const parsedBase = new URL(inputBase)
const BASE = parsedBase.origin
const env = readEnv()
const authHeaders = await buildAuthHeaders()
let passed = 0
let failed = 0

function readEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\n/)
      .filter(
        (line) => line && !line.trim().startsWith('#') && line.includes('='),
      )
      .map((line) => {
        const index = line.indexOf('=')
        const value = line.slice(index + 1).replace(/^['"]|['"]$/g, '')
        return [line.slice(0, index), value]
      }),
  )
}

function readWorkspaceSessionToken() {
  const sessionPath = path.join(
    env.HERMES_HOME || env.CLAUDE_HOME || path.join(os.homedir(), '.hermes'),
    'workspace-sessions.json',
  )
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionPath, 'utf8'))
    return (
      Object.entries(parsed.tokens || {})
        .filter(
          ([, expiry]) => typeof expiry === 'number' && expiry > Date.now(),
        )
        .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
    )
  } catch {
    return null
  }
}

async function buildAuthHeaders() {
  const existingToken = readWorkspaceSessionToken()
  if (existingToken) {
    return { cookie: `claude-auth=${existingToken}` }
  }

  if (!env.HERMES_PASSWORD) return {}

  const auth = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: env.HERMES_PASSWORD }),
  })
  if (auth.status === 400) return {}
  if (!auth.ok) {
    throw new Error(`auth failed with HTTP ${auth.status}`)
  }

  const cookie = auth.headers.get('set-cookie')?.split(';')[0]
  return cookie ? { cookie } : {}
}

async function check(name, url, validate) {
  try {
    const res = await fetch(url, { headers: authHeaders })
    if (!res.ok) {
      console.error(`❌ ${name}: HTTP ${res.status}`)
      failed++
      return
    }
    const data = await res.json()
    const result = validate(data)
    if (result === true) {
      console.log(`✅ ${name}`)
      passed++
    } else {
      console.error(`❌ ${name}: ${result}`)
      failed++
    }
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`)
    failed++
  }
}

// 1. Ping
await check('GET /api/ping', `${BASE}/api/ping`, (d) => {
  if (d.ok !== true) return 'missing ok:true'
  return true
})

// 2. Sessions
await check('GET /api/sessions', `${BASE}/api/sessions`, (d) => {
  // May be bare array or {sessions: [...]}
  const sessions = Array.isArray(d) ? d : d?.sessions
  if (!Array.isArray(sessions)) return 'expected sessions array'
  return true
})

// 3. Session Status
await check('GET /api/session-status', `${BASE}/api/session-status`, (d) => {
  if (!d.payload) return 'missing payload'
  if (!Array.isArray(d.payload.sessions)) return 'missing payload.sessions'
  if (typeof d.payload.status !== 'string') return 'missing payload.status'
  if (typeof d.payload.totalTokens !== 'number')
    return 'missing payload.totalTokens'
  return true
})

// 4. Provider usage
await check('GET /api/provider-usage', `${BASE}/api/provider-usage`, (d) => {
  if (!d.ok && !d.usage && !d.providers) return 'unexpected shape'
  return true
})

// 5. Connection status
await check(
  'GET /api/connection-status',
  `${BASE}/api/connection-status`,
  (d) => {
    if (typeof d !== 'object' || d === null) return 'expected object'
    return true
  },
)

// 6. Models
await check('GET /api/models', `${BASE}/api/models`, (d) => {
  if (!Array.isArray(d) && !d.models) return 'expected array or {models:[]}'
  return true
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
