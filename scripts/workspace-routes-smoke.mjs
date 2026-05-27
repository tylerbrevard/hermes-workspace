#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const mobile = rawArgs.includes('--mobile')
const args = rawArgs.filter((arg) => arg !== '--mobile')
const baseUrl = args[0] || 'http://127.0.0.1:3002/workspace'
const repoRoot = process.cwd()
const envPath = path.join(repoRoot, '.env')
const routesPath = path.join(
  repoRoot,
  'config',
  'workspace-visible-routes.json',
)
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'))
  .flatMap((routeConfig) => [
    routeConfig,
    ...(routeConfig.routeSmokeFixtures ?? []).map((fixtureConfig) => ({
      ...routeConfig,
      ...fixtureConfig,
      mobileOnly: routeConfig.mobileOnly,
      screenshotName:
        fixtureConfig.screenshotName ?? routeConfig.screenshotName,
    })),
  ])
  .filter((route) => mobile || !route.mobileOnly)
const NAVIGATION_TIMEOUT_MS = 30_000
const EXPECTED_TEXT_TIMEOUT_MS = 15_000
const BROWSER_CLEANUP_TIMEOUT_MS = 30_000
const ROUTE_ATTEMPTS = 2
const AUTH_ATTEMPTS = 5
const AUTH_RETRY_WAIT_MS = 15_000

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function installWorkspaceSession() {
  const token = readWorkspaceSessionToken()
  if (!token) return false

  const url = new URL(baseUrl)
  await context.addCookies([
    {
      name: 'claude-auth',
      value: token,
      domain: url.hostname,
      path: url.pathname.replace(/\/$/, '') || '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Strict',
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  ])
  return true
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

async function workspaceShellReachable() {
  const response = await context.request
    .get(baseUrl, { timeout: NAVIGATION_TIMEOUT_MS })
    .catch(() => null)
  if (!response?.ok()) return false
  const html = await response.text().catch(() => '')
  return html.includes('Hermes Workspace')
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
  viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  serviceWorkers: 'block',
})

const hasWorkspaceSession = await installWorkspaceSession()
if (!hasWorkspaceSession && env.HERMES_PASSWORD) {
  let auth
  for (let attempt = 1; attempt <= AUTH_ATTEMPTS; attempt += 1) {
    auth = await context.request.post(`${baseUrl}/api/auth`, {
      data: { password: env.HERMES_PASSWORD },
      headers: { 'content-type': 'application/json' },
    })
    if (auth.status() !== 429 || attempt === AUTH_ATTEMPTS) break
    console.warn(
      `warn auth returned HTTP 429; retrying in ${AUTH_RETRY_WAIT_MS / 1000}s`,
    )
    await sleep(AUTH_RETRY_WAIT_MS)
  }
  if (!auth.ok()) {
    if (auth.status() === 400) {
      if (await workspaceShellReachable()) {
        console.warn(
          'warn auth not required; continuing because workspace shell is reachable',
        )
      } else {
        throw new Error(`auth failed with HTTP ${auth.status()}`)
      }
    } else {
      throw new Error(`auth failed with HTTP ${auth.status()}`)
    }
  }
}

let failed = 0
for (const routeConfig of routes) {
  const { route } = routeConfig
  const expectedText =
    mobile && routeConfig.mobileSmokeText
      ? routeConfig.mobileSmokeText
      : routeConfig.smokeText

  let lastError
  try {
    for (let attempt = 1; attempt <= ROUTE_ATTEMPTS; attempt += 1) {
      const page = await context.newPage()
      const errors = []
      const consoleErrors = []
      page.on('pageerror', (error) =>
        errors.push(`pageerror: ${error.message}`),
      )
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
          timeout: NAVIGATION_TIMEOUT_MS,
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
        if (mobile) {
          const overflow = await page.evaluate(() =>
            Math.max(
              0,
              Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
              ) - window.innerWidth,
            ),
          )
          if (overflow > 2) {
            throw new Error(`document horizontal overflow: ${overflow}px`)
          }
        }
        console.log(
          consoleErrors.length
            ? `ok ${route} (${consoleErrors.length} console warning(s))`
            : `ok ${route}`,
        )
        lastError = null
        break
      } catch (error) {
        lastError = error
        if (attempt < ROUTE_ATTEMPTS) {
          console.warn(
            `warn ${route}: retrying after ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      } finally {
        await page.close()
      }
    }
    if (lastError) {
      throw lastError
    }
  } catch (error) {
    failed += 1
    console.error(
      `fail ${route}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

await withCleanupTimeout('context.close', () => context.close())
await withCleanupTimeout('browser.close', () => browser.close())
if (failed > 0) {
  throw new Error(`${failed} route smoke check(s) failed`)
}

console.log(`ok ${routes.length} ${mobile ? 'mobile ' : ''}workspace routes`)
process.exit(0)
