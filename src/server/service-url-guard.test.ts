import { lookup } from 'node:dns/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertAllowedHermesServiceUrl } from './service-url-guard'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}))

const mockLookup = vi.mocked(lookup)

function lookupResult(addresses: Array<string>) {
  return addresses.map((address) => ({
    address,
    family: address.includes(':') ? 6 : 4,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assertAllowedHermesServiceUrl', () => {
  it('allows loopback gateway URLs', async () => {
    await expect(
      assertAllowedHermesServiceUrl('http://127.0.0.1:8642/'),
    ).resolves.toBe('http://127.0.0.1:8642')
  })

  it('allows Tailscale IP URLs', async () => {
    await expect(
      assertAllowedHermesServiceUrl('https://100.64.1.9:9119'),
    ).resolves.toBe('https://100.64.1.9:9119')
  })

  it('allows hostnames only when every resolved address is local or private', async () => {
    mockLookup.mockResolvedValueOnce(lookupResult(['100.64.1.9']) as never)
    mockLookup.mockRejectedValueOnce(new Error('no ipv6'))

    await expect(
      assertAllowedHermesServiceUrl('https://tylers-mac-mini.tail.ts.net'),
    ).resolves.toBe('https://tylers-mac-mini.tail.ts.net')
  })

  it('rejects public hosts so proxy tokens are not forwarded off-network', async () => {
    mockLookup.mockResolvedValueOnce(lookupResult(['93.184.216.34']) as never)
    mockLookup.mockRejectedValueOnce(new Error('no ipv6'))

    await expect(
      assertAllowedHermesServiceUrl('https://example.com'),
    ).rejects.toThrow(/loopback, LAN, or Tailscale/)
  })

  it('rejects embedded credentials', async () => {
    await expect(
      assertAllowedHermesServiceUrl('http://token@127.0.0.1:8642'),
    ).rejects.toThrow(/credentials/)
  })
})
