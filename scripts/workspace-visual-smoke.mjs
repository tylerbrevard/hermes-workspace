#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const mobile = rawArgs.includes('--mobile')
const args = rawArgs.filter((arg) => arg !== '--mobile')
const baseUrl =
  args[0] || process.env.WORKSPACE_BASE_URL || 'http://127.0.0.1:3002/workspace'
const repoRoot = process.cwd()
const envPath = path.join(repoRoot, '.env')
const routesPath = path.join(
  repoRoot,
  'config',
  'workspace-visible-routes.json',
)
const outputDir =
  process.env.WORKSPACE_VISUAL_SMOKE_DIR ||
  path.join(
    repoRoot,
    '.runtime',
    mobile ? 'workspace-visual-smoke-mobile' : 'workspace-visual-smoke',
  )
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'))
const BROWSER_CLEANUP_TIMEOUT_MS = 30_000
const ROUTE_GOTO_TIMEOUT_MS = Number(
  process.env.WORKSPACE_VISUAL_GOTO_TIMEOUT_MS || 45_000,
)
const EXPECTED_TEXT_TIMEOUT_MS = Number(
  process.env.WORKSPACE_VISUAL_EXPECTED_TIMEOUT_MS || 30_000,
)
const visibleRoutes = routes.filter((route) => mobile || !route.mobileOnly)

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

function chromeExecutablePath() {
  if (process.env.WORKSPACE_VISUAL_CHROME_EXECUTABLE) {
    return process.env.WORKSPACE_VISUAL_CHROME_EXECUTABLE
  }
  if (fs.existsSync(chromium.executablePath())) return undefined
  const macChrome =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return fs.existsSync(macChrome) ? macChrome : undefined
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientNavigationError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return /ERR_CONNECTION_REFUSED|ERR_ABORTED|frame was detached|Target page, context or browser has been closed/i.test(
    message,
  )
}

async function gotoRoute(page, url) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: ROUTE_GOTO_TIMEOUT_MS,
      })
      if (page.url().includes('__hermes_recovered=')) {
        await sleep(2_000)
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: ROUTE_GOTO_TIMEOUT_MS,
        })
      }
      return
    } catch (error) {
      lastError = error
      if (!isTransientNavigationError(error) || attempt === 3) break
      await sleep(2_000 * attempt)
    }
  }
  throw lastError
}

fs.mkdirSync(outputDir, { recursive: true })

const env = readEnv()
const browser = await chromium.launch({
  headless: true,
  executablePath: chromeExecutablePath(),
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
  const auth = await context.request.post(`${baseUrl}/api/auth`, {
    data: { password: env.HERMES_PASSWORD },
    headers: { 'content-type': 'application/json' },
  })
  if (!auth.ok()) {
    throw new Error(`auth failed with HTTP ${auth.status()}`)
  }
}

const results = []
let failed = 0

for (const {
  route,
  mobileSmokeText,
  mobileVisibleSelector,
  smokeText,
  visibleSelector,
  visualText,
  screenshotName: name,
} of visibleRoutes) {
  const expectedText =
    mobile && mobileSmokeText ? mobileSmokeText : visualText || smokeText
  const expectedVisibleSelector =
    mobile && mobileVisibleSelector ? mobileVisibleSelector : visibleSelector
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

  const screenshotPath = path.join(outputDir, `${name}.png`)
  try {
    await gotoRoute(page, `${baseUrl}${route}`)
    await page
      .waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => {})
    await page
      .waitForFunction(
        () => !/^\s*Loading\.\.\.\s*$/i.test(document.body.innerText),
        { timeout: 10_000 },
      )
      .catch(() => {})
    await page.waitForFunction(
      (expected) => document.body.innerText.includes(expected),
      expectedText,
      { timeout: EXPECTED_TEXT_TIMEOUT_MS },
    )
    if (expectedVisibleSelector) {
      await page
        .locator(expectedVisibleSelector)
        .first()
        .waitFor({ state: 'visible', timeout: EXPECTED_TEXT_TIMEOUT_MS })
    }
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const bodyText = await page.locator('body').innerText({ timeout: 10_000 })
    const image = fs.statSync(screenshotPath)
    const layout = await page.evaluate(() => {
      const root = document.documentElement
      const body = document.body
      const viewportWidth = window.innerWidth
      const scrollWidth = Math.max(root.scrollWidth, body.scrollWidth)
      return {
        viewportWidth,
        scrollWidth,
        horizontalOverflowPx: Math.max(0, scrollWidth - viewportWidth),
      }
    })

    if (image.size < 10_000) {
      throw new Error(`screenshot too small: ${image.size} bytes`)
    }
    if (!bodyText.includes(expectedText)) {
      throw new Error(`missing expected text "${expectedText}"`)
    }
    if (/^(\s*)?(404|not found|route not found)\b/i.test(bodyText)) {
      throw new Error('rendered not-found state')
    }
    if (mobile && layout.horizontalOverflowPx > 2) {
      throw new Error(
        `document horizontal overflow: ${layout.horizontalOverflowPx}px`,
      )
    }
    if (errors.length) {
      throw new Error(errors.join('; '))
    }

    results.push({
      route,
      label: name,
      screenshotName: name,
      screenshot: screenshotPath,
      ok: true,
      expectedText,
      expectedVisibleSelector,
      layout,
      consoleErrors,
    })
    console.log(`ok ${route} ${screenshotPath}`)
  } catch (error) {
    failed += 1
    const message = error instanceof Error ? error.message : String(error)
    await page
      .screenshot({ path: screenshotPath, fullPage: true })
      .catch(() => {})
    results.push({
      route,
      label: name,
      screenshotName: name,
      screenshot: screenshotPath,
      ok: false,
      expectedText,
      expectedVisibleSelector,
      message,
    })
    console.error(`fail ${route}: ${message}`)
  } finally {
    await page.close()
  }
}

await withCleanupTimeout('context.close', () => context.close())
await withCleanupTimeout('browser.close', () => browser.close())

const manifestPath = path.join(outputDir, 'manifest.json')
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      baseUrl,
      viewport: mobile ? 'mobile' : 'desktop',
      screenshotLabels: results.map((result) => ({
        route: result.route,
        label: result.label,
        screenshotName: result.screenshotName,
        screenshot: result.screenshot,
      })),
      results,
    },
    null,
    2,
  ),
)

if (failed > 0) {
  throw new Error(`${failed} visual smoke check(s) failed`)
}

console.log(
  `ok ${visibleRoutes.length} ${mobile ? 'mobile ' : ''}visual smoke screenshots -> ${outputDir}`,
)
process.exit(0)
