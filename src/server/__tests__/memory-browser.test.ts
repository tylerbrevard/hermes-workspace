import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { existsSync, readFileSync, statSync, readdirSync } = vi.hoisted(() => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
  statSync: vi.fn().mockReturnValue({ isFile: () => false, mtimeMs: 0 }),
  readdirSync: vi.fn().mockReturnValue([]),
}))

vi.mock('node:fs', () => ({
  default: { existsSync, readFileSync, statSync, readdirSync },
  existsSync,
  readFileSync,
  statSync,
  readdirSync,
}))

const { homedir } = vi.hoisted(() => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}))

vi.mock('node:os', () => ({
  default: { homedir },
  homedir,
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.HERMES_HOME
  delete process.env.CLAUDE_HOME
})

async function loadMod() {
  vi.resetModules()
  return import('../memory-browser')
}

describe('memory-browser', () => {
  it('normalizes workspace root with HERMES_HOME via path.resolve', async () => {
    process.env.HERMES_HOME = '/custom/hermes'
    const mod = await loadMod()
    const root = mod.getMemoryWorkspaceRoot()
    expect(root).toBe(path.resolve('/custom/hermes'))
  })

  it('falls back to ~/.hermes when HERMES_HOME is not set', async () => {
    const mod = await loadMod()
    const root = mod.getMemoryWorkspaceRoot()
    expect(root).toBe(path.resolve('/home/testuser/.hermes'))
  })

  it('uses path.resolve on env path with trailing slash', async () => {
    process.env.HERMES_HOME = '/custom/hermes/'
    const mod = await loadMod()
    const root = mod.getMemoryWorkspaceRoot()
    expect(root).toBe(path.resolve('/custom/hermes'))
  })

  it('tags regression and watch memory files', async () => {
    const mod = await loadMod()

    expect(
      mod.getMemoryFileAttention('workspace/memory/evolve-regression-watch.md'),
    ).toBe('regression')
    expect(
      mod.getMemoryFileAttention('workspace/memory/health-monitor.md'),
    ).toBe('watch')
    expect(mod.getMemoryFileAttention('memories/mail-failure-triage.md')).toBe(
      'operations',
    )
  })

  it('lists workspace memory and sorts active watch files first', async () => {
    process.env.HERMES_HOME = '/custom/hermes'
    readdirSync.mockImplementation((dirPath) => {
      const normalized = String(dirPath)
      if (normalized === '/custom/hermes/memory') return ['daily.md']
      if (normalized === '/custom/hermes/memories') return []
      if (normalized === '/custom/hermes/workspace/memory') {
        return ['evolve-regression-watch.md']
      }
      if (normalized === '/custom/hermes/workspace/memories') return []
      return []
    })
    statSync.mockImplementation((filePath) => {
      const normalized = String(filePath)
      if (
        normalized.endsWith('/memory') ||
        normalized.endsWith('/memories') ||
        normalized.endsWith('/workspace/memory') ||
        normalized.endsWith('/workspace/memories')
      ) {
        return { isDirectory: () => true, isFile: () => false }
      }
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: normalized.includes('regression') ? 200 : 100,
        mtime: new Date(
          normalized.includes('regression')
            ? '2026-05-25T10:00:00.000Z'
            : '2026-05-26T10:00:00.000Z',
        ),
      }
    })

    const mod = await loadMod()
    const files = mod.listMemoryFiles()

    expect(files[0]).toMatchObject({
      path: 'workspace/memory/evolve-regression-watch.md',
      attention: 'regression',
    })
    expect(files.map((file) => file.path)).toContain('memory/daily.md')
  })
})
