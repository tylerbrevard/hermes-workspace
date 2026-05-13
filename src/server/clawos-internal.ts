const RAW_CLAWOS_INTERNAL_ORIGIN =
  process.env.CLAWOS_INTERNAL_ORIGIN || 'http://127.0.0.1:3000'

export const CLAWOS_INTERNAL_ORIGIN = RAW_CLAWOS_INTERNAL_ORIGIN.replace(
  /\/$/,
  '',
)

type ClawosInit = RequestInit & {
  searchParams?: Record<string, string | number | boolean | undefined | null>
}

function buildUrl(
  path: string,
  searchParams?: Record<string, string | number | boolean | undefined | null>,
) {
  const url = new URL(path, `${CLAWOS_INTERNAL_ORIGIN}/`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

async function readResponseError(response: Response) {
  try {
    const data = await response.json()
    if (data && typeof data.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // ignore
  }

  try {
    const text = await response.text()
    if (text.trim()) return text.trim()
  } catch {
    // ignore
  }

  return `${response.status} ${response.statusText}`.trim()
}

export async function fetchClawos(
  path: string,
  init: ClawosInit = {},
): Promise<Response> {
  const { searchParams, ...rest } = init
  const url = buildUrl(path, searchParams)
  const requestInit: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.headers || {}),
    },
  }

  if (requestInit.body && !requestInit.method) {
    requestInit.method = 'POST'
  }

  if (requestInit.body) {
    ;(requestInit as RequestInit & { duplex?: 'half' }).duplex = 'half'
  }

  return fetch(url, requestInit)
}

export async function fetchClawosJson<T>(
  path: string,
  init: ClawosInit = {},
): Promise<T> {
  const response = await fetchClawos(path, init)
  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }
  return (await response.json()) as T
}
