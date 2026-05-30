export function normalizeBasePath(raw: string | undefined): string {
  if (!raw || raw === '/') return '/'
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.endsWith('/')
    ? withLeading.slice(0, -1) || '/'
    : withLeading
}

export const APP_BASE_PATH = normalizeBasePath(
  import.meta.env.VITE_APP_BASE_PATH,
)

export function withBasePath(path: string): string {
  if (!path.startsWith('/') || APP_BASE_PATH === '/') return path
  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`))
    return path
  return `${APP_BASE_PATH}${path}`
}

export function apiPath(path: string): string {
  return withBasePath(
    path.startsWith('/api')
      ? path
      : `/api${path.startsWith('/') ? path : `/${path}`}`,
  )
}
