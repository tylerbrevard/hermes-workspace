import { lookup } from 'node:dns/promises'

function isAllowedServiceAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  ) {
    return true
  }

  const parts = normalized.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  const [a, b] = parts
  return (
    a === 10 ||
    a === 100 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

export async function assertAllowedHermesServiceUrl(
  value: string,
  label = 'URL',
): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include credentials`)
  }

  const hostname = parsed.hostname.toLowerCase()
  if (isAllowedServiceAddress(hostname)) {
    return parsed.toString().replace(/\/+$/, '')
  }

  if (hostname.endsWith('.local')) {
    return parsed.toString().replace(/\/+$/, '')
  }

  const records = await Promise.allSettled([
    lookup(hostname, { all: true, family: 4 }),
    lookup(hostname, { all: true, family: 6 }),
  ])
  const addresses = records.flatMap((record) =>
    record.status === 'fulfilled'
      ? record.value.map((entry) => entry.address)
      : [],
  )

  if (addresses.length === 0) {
    throw new Error(`${label} host could not be resolved`)
  }
  if (!addresses.every(isAllowedServiceAddress)) {
    throw new Error(
      `${label} must resolve only to loopback, LAN, or Tailscale addresses`,
    )
  }

  return parsed.toString().replace(/\/+$/, '')
}
