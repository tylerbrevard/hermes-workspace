#!/usr/bin/env node
import fs from 'node:fs'
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
const BROWSER_CLEANUP_TIMEOUT_MS = 5_000
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
  const macChrome =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return fs.existsSync(macChrome) ? macChrome : undefined
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

const results = []
let failed = 0

for (const {
  route,
  smokeText,
  visualText,
  screenshotName: name,
} of visibleRoutes) {
  const expectedText = visualText || smokeText
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
    await page.goto(`${baseUrl}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
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
      { timeout: 8_000 },
    )
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
      screenshot: screenshotPath,
      ok: true,
      expectedText,
      layout,
      consoleErrors,
    })
    console.log(`ok ${route} ${screenshotPath}`)
  } catch (error) {
    failed += 1
    const message = error instanceof Error ? error.message : String(error)
    results.push({ route, screenshot: screenshotPath, ok: false, message })
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
