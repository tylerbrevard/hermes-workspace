#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const clientAssetsDir = path.join(repoRoot, 'dist', 'client', 'assets')
const baseUrl =
  process.argv[2] ||
  process.env.WORKSPACE_BASE_URL ||
  'http://127.0.0.1:3002/workspace'
const launchAgentLabel =
  process.env.WORKSPACE_LAUNCH_AGENT_LABEL || 'ai.hermes.workspace'
const maxAttempts = Number(process.env.WORKSPACE_RUNTIME_SYNC_ATTEMPTS || 12)
const waitMs = Number(process.env.WORKSPACE_RUNTIME_SYNC_WAIT_MS || 2_000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isLocalWorkspaceBase(url) {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) &&
      parsed.port === '3002'
    )
  } catch {
    return false
  }
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.text()
}

async function fetchAsset(url) {
  const response = await fetch(url, { cache: 'no-store' })
  const text = await response.text().catch(() => '')
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    text,
  }
}

function extractAssetPaths(html) {
  const paths = new Set()
  const pattern = /\/workspace\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g
  for (const match of html.matchAll(pattern)) {
    paths.add(match[0])
  }
  return [...paths]
}

async function inspectRuntime() {
  const html = await fetchText(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const assetPaths = extractAssetPaths(html)
  if (assetPaths.length === 0) {
    return {
      ok: false,
      reason: 'no hashed assets found in workspace HTML',
      assetPaths,
    }
  }

  const problems = []
  for (const assetPath of assetPaths) {
    const assetName = path.basename(assetPath)
    const diskPath = path.join(clientAssetsDir, assetName)
    if (!fs.existsSync(diskPath)) {
      problems.push(`${assetName} missing from dist/client/assets`)
    }
    const asset = await fetchAsset(new URL(assetPath, baseUrl).toString())
    if (!asset.ok) {
      problems.push(`${assetName} returned HTTP ${asset.status}`)
      continue
    }
    if (
      assetName.endsWith('.js') &&
      /__hermes_recovered/.test(asset.text) &&
      /globalThis\.location\.replace/.test(asset.text)
    ) {
      problems.push(`${assetName} is serving recovery module`)
    }
    if (assetName.endsWith('.css') && !/text\/css/i.test(asset.contentType)) {
      problems.push(`${assetName} content-type ${asset.contentType}`)
    }
  }

  return {
    ok: problems.length === 0,
    reason: problems.join('; '),
    assetPaths,
  }
}

function restartLaunchAgent() {
  const uid = execFileSync('id', ['-u'], { encoding: 'utf8' }).trim()
  execFileSync(
    'launchctl',
    ['kickstart', '-k', `gui/${uid}/${launchAgentLabel}`],
    {
      stdio: 'ignore',
    },
  )
}

let firstInspection
try {
  firstInspection = await inspectRuntime()
} catch (error) {
  firstInspection = {
    ok: false,
    reason: error instanceof Error ? error.message : String(error),
    assetPaths: [],
  }
}

if (firstInspection.ok) {
  console.log(
    `ok workspace runtime assets synced (${firstInspection.assetPaths.length} assets)`,
  )
  process.exit(0)
}

if (!isLocalWorkspaceBase(baseUrl)) {
  throw new Error(
    `workspace runtime assets out of sync: ${firstInspection.reason}`,
  )
}

console.warn(`warn workspace runtime out of sync: ${firstInspection.reason}`)
restartLaunchAgent()

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  await sleep(waitMs)
  const inspection = await inspectRuntime().catch((error) => ({
    ok: false,
    reason: error instanceof Error ? error.message : String(error),
    assetPaths: [],
  }))
  if (inspection.ok) {
    console.log(
      `ok workspace runtime assets synced after restart (${inspection.assetPaths.length} assets)`,
    )
    process.exit(0)
  }
  if (attempt === maxAttempts) {
    throw new Error(
      `workspace runtime assets still out of sync: ${inspection.reason}`,
    )
  }
}
