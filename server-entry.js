import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import server from './dist/server/server.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(__dirname, 'dist', 'client')
const PTO_TRACKER_REPORT_DIR =
  process.env.PTO_TRACKER_REPORT_DIR ||
  join(homedir(), '.hermes', 'workspace', 'runtime', 'reports', 'pto-tracker')
const HERMES_WORKSPACE_DIR =
  process.env.HERMES_WORKSPACE || join(homedir(), '.hermes', 'workspace')
const M5_DISPLAY_DB =
  process.env.HERMES_M5_DISPLAY_DB ||
  join(HERMES_WORKSPACE_DIR, 'runtime', 'db', 'workspace', '.m5-display.db')
const M5_FIRMWARE_DIR = join(HERMES_WORKSPACE_DIR, 'firmware')
const M5_WEATHER_CACHE = join(
  HERMES_WORKSPACE_DIR,
  'runtime',
  'm5-weather-29607.json',
)
const basePath = (() => {
  const raw = (process.env.VITE_APP_BASE_PATH || '').trim()
  if (!raw || raw === '/') return '/'
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading
})()

const port = parseInt(process.env.PORT || '3000', 10)
const CLAWOS_PROXY_PREFIX =
  basePath === '/' ? '/legacy-clawos' : `${basePath}/legacy-clawos`
const CLAWOS_PROXY_ORIGIN = (process.env.CLAWOS_PROXY_ORIGIN || '').replace(
  /\/$/,
  '',
)
const SESSION_STORE_FILE = join(
  process.env.HERMES_HOME ??
    process.env.CLAUDE_HOME ??
    join(homedir(), '.hermes'),
  'workspace-sessions.json',
)
// Default HOST to localhost-only. Operators who want the workspace reachable
// on a LAN / Tailscale / public surface must opt in explicitly with
// HOST=0.0.0.0 *and* set CLAUDE_PASSWORD (enforced below). See #122.
const host = process.env.HOST || '127.0.0.1'

function isNonLoopbackHost(h) {
  if (!h) return false
  const norm = h.trim().toLowerCase()
  if (norm === '127.0.0.1' || norm === '::1' || norm === 'localhost') {
    return false
  }
  return true
}

if (isNonLoopbackHost(host)) {
  // Honor HERMES_PASSWORD (current name) with CLAUDE_PASSWORD as a back-compat
  // fallback for deployments configured pre-rename.
  const password = (
    process.env.HERMES_PASSWORD ||
    process.env.CLAUDE_PASSWORD ||
    ''
  ).trim()
  if (!password) {
    console.error(
      '\n[workspace] refusing to start.\n' +
        `  HOST is set to "${host}" (non-loopback), but HERMES_PASSWORD is unset.\n` +
        '  This would expose a high-privilege control plane (terminals, files, agents)\n' +
        '  to anyone who can reach the port. Either:\n' +
        '    • set HOST=127.0.0.1 for local-only access, or\n' +
        '    • set HERMES_PASSWORD=<strong-secret> to enable workspace auth, or\n' +
        '    • set HERMES_ALLOW_INSECURE_REMOTE=1 to bypass this check (not recommended).\n' +
        '  See #122 for context.\n',
    )
    const allowInsecure = (
      process.env.HERMES_ALLOW_INSECURE_REMOTE ||
      process.env.CLAUDE_ALLOW_INSECURE_REMOTE ||
      ''
    )
      .trim()
      .toLowerCase()
    if (
      allowInsecure !== '1' &&
      allowInsecure !== 'true' &&
      allowInsecure !== 'yes'
    ) {
      process.exit(1)
    }
    console.warn(
      '[workspace] HERMES_ALLOW_INSECURE_REMOTE is set — starting anyway.',
    )
  }

  // Warn when serving over plain HTTP with a password: NODE_ENV=production
  // sets the Secure flag on session cookies, which browsers silently drop
  // over http://.  Operators must set COOKIE_SECURE=0 for plain-HTTP LAN
  // deployments.  See #149.
  const cookieSecureOverride = (process.env.COOKIE_SECURE || '')
    .trim()
    .toLowerCase()
  const cookieSecureExplicit =
    cookieSecureOverride === '0' ||
    cookieSecureOverride === 'false' ||
    cookieSecureOverride === 'no'
  if (!cookieSecureExplicit && process.env.NODE_ENV === 'production') {
    console.warn(
      '\n[workspace] warning: plain-HTTP LAN deployment detected.\n' +
        '  NODE_ENV=production enables the Secure flag on session cookies.\n' +
        '  Browsers silently drop Secure cookies over http://, so login will fail.\n' +
        '  Add COOKIE_SECURE=0 to your .env to fix this.  See #149.\n',
    )
  }
}

const MIME_TYPES = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
}

function isWorkspaceAuthEnabled() {
  return Boolean(
    (process.env.HERMES_PASSWORD || process.env.CLAUDE_PASSWORD || '').trim(),
  )
}

function getSessionTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())
  for (const cookie of cookies) {
    if (cookie.startsWith('claude-auth=')) {
      return cookie.slice('claude-auth='.length)
    }
  }
  return null
}

function hasValidWorkspaceSession(req) {
  if (!isWorkspaceAuthEnabled()) return true
  const token = getSessionTokenFromCookie(req.headers.cookie || null)
  if (!token || !existsSync(SESSION_STORE_FILE)) return false
  try {
    const raw = readFileSync(SESSION_STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const expiry = parsed?.tokens?.[token]
    return typeof expiry === 'number' && expiry > Date.now()
  } catch {
    return false
  }
}

function buildClawosRewriteScript(proxyPrefix) {
  return `<script>
(() => {
  const prefix = ${JSON.stringify(proxyPrefix)};
  const rootAttrSelectors = 'img[src^="/"],source[src^="/"],video[src^="/"],audio[src^="/"],script[src^="/"],iframe[src^="/"],link[href^="/"],a[href^="/"],form[action^="/"],[style*="url(/"],[style*="url(\\"/"],[style*="url(\\'/"]';
  const rewrite = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith(prefix + '/')) {
      return value;
    }
    return prefix + value;
  };
  const rewriteNode = (node) => {
    if (!(node instanceof Element)) return;
    if (node.hasAttribute('src')) node.setAttribute('src', rewrite(node.getAttribute('src')));
    if (node.hasAttribute('href')) node.setAttribute('href', rewrite(node.getAttribute('href')));
    if (node.hasAttribute('action')) node.setAttribute('action', rewrite(node.getAttribute('action')));
    const style = node.getAttribute('style');
    if (style && style.includes('url(')) {
      node.setAttribute('style', style.replace(/url\\((['"]?)\\/(?!\\/)/g, 'url($1' + prefix + '/'));
    }
  };
  document.querySelectorAll(rootAttrSelectors).forEach(rewriteNode);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        rewriteNode(mutation.target);
      }
      mutation.addedNodes?.forEach?.((node) => {
        if (!(node instanceof Element)) return;
        rewriteNode(node);
        node.querySelectorAll?.(rootAttrSelectors).forEach(rewriteNode);
      });
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['src', 'href', 'action', 'style'],
    childList: true,
    subtree: true,
  });
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') return originalFetch(rewrite(input), init);
    if (input instanceof Request) return originalFetch(new Request(rewrite(input.url), input), init);
    if (input instanceof URL) return originalFetch(rewrite(input.toString()), init);
    return originalFetch(input, init);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, typeof url === 'string' ? rewrite(url) : url, ...rest);
  };
  if (window.EventSource) {
    const NativeEventSource = window.EventSource;
    window.EventSource = function(url, config) {
      return new NativeEventSource(typeof url === 'string' ? rewrite(url) : url, config);
    };
    window.EventSource.prototype = NativeEventSource.prototype;
  }
  const wrapHistory = (name) => {
    const original = window.history[name].bind(window.history);
    window.history[name] = (state, unused, url) => {
      const nextUrl = typeof url === 'string' ? rewrite(url) : url;
      return original(state, unused, nextUrl);
    };
  };
  wrapHistory('pushState');
  wrapHistory('replaceState');
})();
</script>`
}

function rewriteClawosHtml(html, proxyPrefix) {
  let rewritten = html
  const attrNames = ['href', 'src', 'action', 'content']
  for (const attr of attrNames) {
    const pattern = new RegExp(`${attr}="/(?!/)`, 'g')
    rewritten = rewritten.replace(pattern, `${attr}="${proxyPrefix}/`)
  }
  rewritten = rewritten.replace(
    /url\((['"]?)\/(?!\/)/g,
    `url($1${proxyPrefix}/`,
  )
  const injection = buildClawosRewriteScript(proxyPrefix)
  if (rewritten.includes('</head>')) {
    return rewritten.replace('</head>', `${injection}</head>`)
  }
  return `${injection}${rewritten}`
}

async function writeFetchResponse(res, response) {
  const headers = new Headers(response.headers)
  const contentType = headers.get('content-type') || ''
  if (contentType.includes('text/html')) {
    // Mobile Safari/PWA shells are prone to holding stale SSR HTML that points
    // at old hashed chunks. Always force the shell back to the live server;
    // hashed assets themselves remain immutable below.
    headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    )
  }
  res.writeHead(response.status, Object.fromEntries(headers.entries()))

  if (response.body) {
    const reader = response.body.getReader()
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
      res.end()
    }
    await pump()
    return
  }

  const text = await response.text()
  res.end(text)
}

async function maybeProxyClawos(req, res, incomingUrl) {
  const incomingPathname = decodeURIComponent(incomingUrl.pathname)
  if (
    !incomingPathname.startsWith(CLAWOS_PROXY_PREFIX) ||
    incomingPathname.includes('..')
  ) {
    return false
  }

  if (!hasValidWorkspaceSession(req)) {
    const redirectTarget = `${basePath}/login?redirect=${encodeURIComponent(
      incomingPathname + incomingUrl.search,
    )}`
    res.writeHead(302, { Location: redirectTarget })
    res.end()
    return true
  }

  if (!CLAWOS_PROXY_ORIGIN) {
    res.writeHead(410, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: 'legacy_clawos_proxy_disabled',
        message: 'Set CLAWOS_PROXY_ORIGIN to enable the legacy ClawOS proxy.',
      }),
    )
    return true
  }

  const targetPath = incomingPathname.slice(CLAWOS_PROXY_PREFIX.length) || '/'
  const targetUrl = new URL(
    `${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}${incomingUrl.search}`,
    CLAWOS_PROXY_ORIGIN,
  )
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue
    if (
      key.toLowerCase() === 'host' ||
      key.toLowerCase() === 'content-length'
    ) {
      continue
    }
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  let body = null
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    duplex: 'half',
    redirect: 'manual',
  })

  const contentType = response.headers.get('content-type') || ''
  const proxiedHeaders = new Headers(response.headers)
  proxiedHeaders.delete('x-frame-options')
  proxiedHeaders.delete('content-security-policy')
  proxiedHeaders.delete('content-length')

  if (contentType.includes('text/html')) {
    const html = await response.text()
    const rewritten = rewriteClawosHtml(html, CLAWOS_PROXY_PREFIX)
    proxiedHeaders.set('content-type', contentType)
    proxiedHeaders.set('content-length', Buffer.byteLength(rewritten, 'utf8'))
    res.writeHead(response.status, Object.fromEntries(proxiedHeaders.entries()))
    res.end(rewritten)
    return true
  }

  res.writeHead(response.status, Object.fromEntries(proxiedHeaders.entries()))
  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
    return true
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  res.end(buffer)
  return true
}

async function maybeServePtoTrackerReport(req, res, incomingUrl) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false

  const reportPrefix =
    basePath === '/' ? '/reports/pto-tracker' : `${basePath}/reports/pto-tracker`
  const incomingPathname = decodeURIComponent(incomingUrl.pathname)
  if (
    !incomingPathname.startsWith(reportPrefix) ||
    incomingPathname.includes('..')
  ) {
    return false
  }

  if (!hasValidWorkspaceSession(req)) {
    const redirectTarget = `${basePath}/login?redirect=${encodeURIComponent(
      incomingPathname + incomingUrl.search,
    )}`
    res.writeHead(302, { Location: redirectTarget })
    res.end()
    return true
  }

  const relativePath =
    incomingPathname.slice(reportPrefix.length).replace(/^\/+/, '') ||
    'latest.html'
  const reportRoot = resolve(PTO_TRACKER_REPORT_DIR)
  const filePath = resolve(reportRoot, relativePath)
  if (filePath !== reportRoot && !filePath.startsWith(`${reportRoot}/`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return true
  }

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return true
    }

    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const data = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    if (req.method === 'HEAD') {
      res.end()
      return true
    }
    res.end(data)
    return true
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return true
  }
}

function sqliteJson(sql) {
  if (!existsSync(M5_DISPLAY_DB)) return []
  const output = execFileSync('sqlite3', ['-json', M5_DISPLAY_DB, sql], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  }).trim()
  return output ? JSON.parse(output) : []
}

function execSql(sql) {
  execFileSync('sqlite3', [M5_DISPLAY_DB, sql], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
}

function sqlString(value) {
  return `'${String(value || '').replaceAll("'", "''")}'`
}

async function maybeServeM5Ota(req, res, incomingUrl) {
  const incomingPathname = decodeURIComponent(incomingUrl.pathname)
  const routePath = basePath === '/' ? '/api/iot/m5-ota' : `${basePath}/api/iot/m5-ota`
  if (incomingPathname !== routePath) return false
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return true
  }

  try {
    const firmware = sqliteJson(
      'select version, filename, file_size, description, uploaded_at from m5_firmware order by uploaded_at desc',
    )
    const download = incomingUrl.searchParams.get('download')
    const version = incomingUrl.searchParams.get('version')

    if (download === 'true' && version) {
      const selected = firmware.find((item) => item.version === version)
      if (!selected) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Firmware version not found' }))
        return true
      }
      const filePath = join(M5_FIRMWARE_DIR, selected.filename)
      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Firmware file not found on disk' }))
        return true
      }
      const data = readFileSync(filePath)
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${selected.filename}"`,
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
      })
      if (req.method === 'HEAD') {
        res.end()
        return true
      }
      res.end(data)
      return true
    }

    const deviceId = incomingUrl.searchParams.get('deviceId') || ''
    const reportedVersion =
      incomingUrl.searchParams.get('currentVersion') ||
      incomingUrl.searchParams.get('firmware') ||
      ''
    if (deviceId && reportedVersion) {
      execSql(
        `update m5_devices set firmware_version = ${sqlString(reportedVersion)} where device_id = ${sqlString(deviceId)};`,
      )
    }
    const device = deviceId
      ? sqliteJson(
          `select firmware_version from m5_devices where device_id = ${sqlString(deviceId)} limit 1`,
        )[0] || null
      : null
    const latest = firmware[0] || null
    const currentVersion = device?.firmware_version || null
    const body = {
      latest: latest
        ? {
            version: latest.version,
            file_size: latest.file_size,
            uploaded_at: latest.uploaded_at,
          }
        : null,
      available: Boolean(latest && currentVersion && latest.version !== currentVersion),
      currentVersion,
      allVersions: firmware.map((item) => ({
        version: item.version,
        file_size: item.file_size,
        description: item.description,
        uploaded_at: item.uploaded_at,
      })),
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(body))
    return true
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process OTA request',
      }),
    )
    return true
  }
}

function readJsonFile(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonFile(path, value) {
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8')
}

function readFreshWeatherCache(maxAgeMs) {
  const cached = readJsonFile(M5_WEATHER_CACHE, null)
  if (!cached?.updatedAt) return null
  const age = Date.now() - Date.parse(cached.updatedAt)
  if (!Number.isFinite(age) || age > maxAgeMs) return null
  return cached
}

function roundedNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : null
}

async function getM5WeatherWidget() {
  const fresh = readFreshWeatherCache(10 * 60 * 1000)
  if (fresh) return fresh

  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=34.80&longitude=-82.31&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York',
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
    )
    if (!response.ok) throw new Error(`weather returned ${response.status}`)
    const payload = await response.json()
    const weather = {
      zip: '29607',
      label: 'Feels',
      temperatureF: roundedNumber(payload.current?.temperature_2m),
      feelsLikeF: roundedNumber(payload.current?.apparent_temperature),
      weatherCode: roundedNumber(payload.current?.weather_code),
      observedAt:
        typeof payload.current?.time === 'string' ? payload.current.time : null,
      updatedAt: new Date().toISOString(),
      source: 'open-meteo',
    }
    writeJsonFile(M5_WEATHER_CACHE, weather)
    return weather
  } catch {
    const cached = readJsonFile(M5_WEATHER_CACHE, null)
    if (cached) return { ...cached, stale: true }
    return {
      zip: '29607',
      label: 'Feels',
      temperatureF: null,
      feelsLikeF: null,
      weatherCode: null,
      observedAt: null,
      updatedAt: new Date().toISOString(),
      source: 'unavailable',
      stale: true,
    }
  }
}

async function maybeServeM5ConfigWithWeather(req, res, incomingUrl) {
  const incomingPathname = decodeURIComponent(incomingUrl.pathname)
  const routePath = basePath === '/' ? '/api/iot/config' : `${basePath}/api/iot/config`
  if (incomingPathname !== routePath || req.method !== 'GET') return false

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const request = new Request(incomingUrl.toString(), {
    method: req.method,
    headers,
  })
  const response = await server.fetch(request)
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || !contentType.includes('application/json')) {
    await writeFetchResponse(res, response)
    return true
  }

  const payload = await response.json()
  const weather = await getM5WeatherWidget()
  const body = {
    ...payload,
    weather,
    config: {
      ...(payload && typeof payload.config === 'object' && payload.config !== null
        ? payload.config
        : {}),
      weather,
    },
  }
  const jsonBody = JSON.stringify(body)
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(jsonBody),
    'Cache-Control': 'no-store',
  })
  res.end(jsonBody)
  return true
}

async function tryServeStatic(req, res) {
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`,
  )
  const requestPathname = decodeURIComponent(url.pathname)
  let pathname = requestPathname

  // Prevent directory traversal
  if (pathname.includes('..')) return false

  if (basePath !== '/') {
    if (pathname.startsWith('/assets/')) {
      // Old HTML or dynamic import maps can still ask for root-relative assets
      // after the workspace is mounted under /workspace. Serve those directly
      // so module scripts are not forced through an SSR redirect.
    } else {
      if (!pathname.startsWith(basePath)) return false
      pathname = pathname.slice(basePath.length) || '/'
    }
  }

  // Asset requests should never fall through to the SSR handler. If a browser
  // asks for a stale hashed JS/CSS chunk after a deploy or branch switch,
  // returning the HTML shell with 200 text/html makes the SPA fail as a black
  // screen. For stale JavaScript chunks, return a tiny recovery module that
  // clears service-worker/cache state and reloads the page. This is especially
  // important for installed iOS PWAs, which can keep old HTML/chunk URLs after
  // a new build. Non-JS missing assets still return a real 404 so health checks
  // can detect broken references.
  if (pathname.startsWith('/assets/')) {
    const filePath = join(CLIENT_DIR, pathname)
    if (!filePath.startsWith(CLIENT_DIR)) return false
    try {
      const fileStat = await stat(filePath)
      if (!fileStat.isFile()) throw new Error('not a file')
    } catch {
      if (pathname.endsWith('.js')) {
        const recoveryModule = `
try {
  const registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in globalThis) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
} catch {}
const url = new URL(globalThis.location.href);
if (!url.searchParams.has('__hermes_recovered')) {
  url.searchParams.set('__hermes_recovered', Date.now().toString());
  globalThis.location.replace(url.toString());
}
export {};
`
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Content-Length': Buffer.byteLength(recoveryModule),
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
        })
        res.end(recoveryModule)
        return true
      }
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
      })
      res.end('Asset not found')
      return true
    }
  }

  const filePath = join(CLIENT_DIR, pathname)

  // Make sure the resolved path is within CLIENT_DIR
  if (!filePath.startsWith(CLIENT_DIR)) return false

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) return false

    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const data = await readFile(filePath)

    const headers = {
      'Content-Type': contentType,
      'Content-Length': data.length,
    }

    // Cache hashed assets aggressively (they have content hashes in filenames).
    // Keep the service worker, manifest, and other top-level PWA control files
    // non-cacheable so mobile clients notice deploys immediately.
    if (pathname.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    } else if (
      pathname === '/sw.js' ||
      pathname === '/manifest.json' ||
      pathname === '/apple-touch-icon.png'
    ) {
      headers['Cache-Control'] =
        'no-store, no-cache, must-revalidate, proxy-revalidate'
    }

    res.writeHead(200, headers)
    res.end(data)
    return true
  } catch {
    return false
  }
}

async function requestHandler(req, res) {
  const incomingUrl = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`,
  )
  let incomingPathname = decodeURIComponent(incomingUrl.pathname)

  // Tailscale subpath proxying can forward /workspace requests to the local
  // server as /. Rewrite that root request internally instead of redirecting,
  // otherwise the public URL loops forever between /workspace and /.
  if (basePath !== '/' && incomingPathname === '/') {
    incomingUrl.pathname = `${basePath}/`
    req.url = `${incomingUrl.pathname}${incomingUrl.search}`
    incomingPathname = decodeURIComponent(incomingUrl.pathname)
  }

  const proxied = await maybeProxyClawos(req, res, incomingUrl)
  if (proxied) return

  const servedPtoTracker = await maybeServePtoTrackerReport(
    req,
    res,
    incomingUrl,
  )
  if (servedPtoTracker) return

  const servedM5Ota = await maybeServeM5Ota(req, res, incomingUrl)
  if (servedM5Ota) return

  const servedM5Config = await maybeServeM5ConfigWithWeather(req, res, incomingUrl)
  if (servedM5Config) return

  // Try static files first (client assets)
  if (req.method === 'GET' || req.method === 'HEAD') {
    const served = await tryServeStatic(req, res)
    if (served) return
  }

  // Fall through to SSR handler
  const url = incomingUrl

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  let body = null
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    duplex: 'half',
  })

  try {
    const response = await server.fetch(request)
    await writeFetchResponse(res, response)
  } catch (err) {
    console.error('Request error:', err)
    res.writeHead(500)
    res.end('Internal Server Error')
  }
}

function listenOn(bindHost) {
  const httpServer = createServer(requestHandler)
  httpServer.listen(port, bindHost, () => {
    console.log(`Hermes Workspace running at http://${bindHost}:${port}`)
  })
  return httpServer
}

listenOn(host)

// Cloudflared remote-managed ingress currently points at http://localhost:10280.
// On macOS, localhost may resolve to ::1 before 127.0.0.1; if Workspace only
// listens on IPv4 loopback, tunneled requests intermittently fail with
// `dial tcp [::1]:10280: connect: connection refused`. Keep the default
// local-only security posture while also serving IPv6 loopback.
if (host === '127.0.0.1') {
  listenOn('::1')
}
