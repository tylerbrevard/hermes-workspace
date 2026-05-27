import { describe, expect, it } from 'vitest'
import {
  buildMemoryDiagnostics,
  buildMemoryHealth,
  buildRecallCommand,
  buildUseMemoryContext,
  classifyMemoryProvenance,
  classifyMemoryScope,
  classifyMemorySource,
  detectMemoryConflicts,
  getMemoryFilesForTab,
  getMemoryFreshnessLabel,
  splitFiles,
} from './memory-browser-screen'

const NOW = Date.parse('2026-05-26T12:00:00.000Z')

describe('MemoryBrowserScreen operators', () => {
  const files = [
    {
      path: 'MEMORY.md',
      name: 'MEMORY.md',
      size: 1200,
      modified: '2026-05-26T10:00:00.000Z',
    },
    {
      path: 'rollout_summaries/session-a.md',
      name: 'session-a.md',
      size: 800,
      modified: '2026-05-25T10:00:00.000Z',
      attention: 'watch' as const,
    },
    {
      path: 'workspace/memory/hermes.md',
      name: 'hermes.md',
      size: 500,
      modified: '2026-04-01T10:00:00.000Z',
    },
    {
      path: 'workspace/memory/codex/hermes.md',
      name: 'hermes.md',
      size: 0,
      modified: '2026-05-10T10:00:00.000Z',
    },
  ]

  it('splits active files and tab filters by freshness', () => {
    const split = splitFiles(files)

    expect(split.rootMemory?.path).toBe('MEMORY.md')
    expect(split.activeFiles.map((file) => file.path)).toEqual([
      'rollout_summaries/session-a.md',
    ])

    expect(getMemoryFilesForTab(files, 'active', NOW)).toHaveLength(1)
    expect(
      getMemoryFilesForTab(files, 'stale', NOW).map((file) => file.path),
    ).toEqual(['workspace/memory/hermes.md'])
    expect(getMemoryFreshnessLabel(files[2], NOW)).toBe('stale 55d')
  })

  it('classifies provenance, scope, health, and conflicts', () => {
    expect(classifyMemoryProvenance('rollout_summaries/session-a.md')).toBe(
      'source session',
    )
    expect(classifyMemoryProvenance('automation/jobs/run.md')).toBe(
      'automation',
    )
    expect(classifyMemoryScope('workspace/memory/hermes.md')).toBe('Hermes')
    expect(classifyMemoryScope('workspace/memory/codex/outlook.md')).toBe(
      'mailbox',
    )

    const health = buildMemoryHealth(files, NOW)
    expect(health.count).toBe(4)
    expect(health.staleCount).toBe(1)
    expect(health.brokenLinks).toBe(1)
    expect(detectMemoryConflicts(files)[0]).toMatchObject({
      name: 'hermes.md',
      paths: ['workspace/memory/hermes.md', 'workspace/memory/codex/hermes.md'],
    })
    expect(classifyMemorySource('rollout_summaries/session-a.md')).toBe(
      'rollouts',
    )
    expect(classifyMemorySource('workspace/memory/codex/outlook.md')).toBe(
      'codex',
    )
    expect(classifyMemorySource('workspace/memory/hermes.md')).toBe('hermes')
  })

  it('builds copy-ready recall commands without losing quotes', () => {
    expect(buildRecallCommand('MEMORY.md', 'Hermes "workspace"')).toBe(
      'python3 /Users/tylerlyon/.hermes/workspace/scripts/second_brain.py recall "Hermes \\"workspace\\""',
    )
  })

  it('builds safe diagnostics and task-use context', () => {
    const diagnostics = JSON.parse(
      buildMemoryDiagnostics({
        query: 'Hermes workspace',
        sourceFilter: 'codex',
        selectedPath: 'workspace/memory/codex/hermes.md',
        files,
        apiStatus: 'ready',
      }),
    )

    expect(diagnostics).toMatchObject({
      route: '/workspace/memory',
      query: 'Hermes workspace',
      sourceFilter: 'codex',
      selectedPath: 'workspace/memory/codex/hermes.md',
      apiStatus: 'ready',
      fileCount: 4,
      staleCount: 1,
      secretsIncluded: false,
    })
    expect(JSON.stringify(diagnostics)).not.toContain('token')

    const context = buildUseMemoryContext({
      path: 'MEMORY.md',
      provenance: 'manual note',
      freshness: 'fresh today',
      content: 'A'.repeat(1300),
    })
    expect(context).toContain('Use this memory in the current task')
    expect(context).toContain('Path: MEMORY.md')
    expect(context.length).toBeLessThan(1400)
  })
})
