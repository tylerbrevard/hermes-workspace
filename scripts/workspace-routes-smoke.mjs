#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const baseUrl = args[0] || 'http://127.0.0.1:3002/workspace'
const repoRoot = process.cwd()
const envPath = path.join(repoRoot, '.env')
const routesPath = path.join(
  repoRoot,
  'config',
  'workspace-visible-routes.json',
)
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8')).filter(
  (route) => !route.mobileOnly,
)
const EXPECTED_TEXT_TIMEOUT_MS = 15_000
const BROWSER_CLEANUP_TIMEOUT_MS = 5_000

function readEnv() {
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

async function withCleanupTimeout(label, action) {
  let timeout
  try {
    await Promise.race([
      action(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          BROWSER_CLEANUP_TIMEOUT_MS,
        )
      }),
    ])
  } catch (error) {
    console.warn(
      `warn ${label}: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

const env = readEnv()
const browser = await chromium.launch({
  headless: true,
  executablePath: fs.existsSync(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  )
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined,
})
const context = await browser.newContext({
  viewport: { width: 1360, height: 900 },
})

if (env.HERMES_PASSWORD) {
  const auth = await context.request.post(`${baseUrl}/api/auth`, {
    data: { password: env.HERMES_PASSWORD },
    headers: { 'content-type': 'application/json' },
  })
  if (!auth.ok()) {
    throw new Error(`auth failed with HTTP ${auth.status()}`)
  }
}

let failed = 0
for (const { route, smokeText: expectedText } of routes) {
  const page = await context.newPage()
  const errors = []
  const consoleErrors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location()
      consoleErrors.push(
        `console: ${message.text()}${location.url ? ` (${location.url})` : ''}`,
      )
    }
  })

  try {
    await page.goto(`${baseUrl}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.waitForFunction(
      (expected) => document.body.innerText.includes(expected),
      expectedText,
      { timeout: EXPECTED_TEXT_TIMEOUT_MS },
    )
    const text = await page.locator('body').innerText({ timeout: 10_000 })
    if (!text.includes(expectedText)) {
      throw new Error(`missing expected text "${expectedText}"`)
    }
    if (/not found|404/i.test(text)) {
      throw new Error('rendered not-found state')
    }
    if (errors.length) {
      throw new Error(errors.join('; '))
    }
    console.log(
      consoleErrors.length
        ? `ok ${route} (${consoleErrors.length} console warning(s))`
        : `ok ${route}`,
    )
  } catch (error) {
    failed += 1
    console.error(
      `fail ${route}: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    await page.close()
  }
}

await withCleanupTimeout('context.close', () => context.close())
await withCleanupTimeout('browser.close', () => browser.close())
if (failed > 0) {
  throw new Error(`${failed} route smoke check(s) failed`)
}

console.log(`ok ${routes.length} workspace routes`)
process.exit(0)
