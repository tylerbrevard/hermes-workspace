import { describe, expect, it } from 'vitest'
import {
  buildSkillInventoryExport,
  buildSkillInvocationCommand,
  getSkillCompatibility,
  getSkillDiagnostics,
  getSkillMutationRisk,
  getSkillProvenance,
  getSkillRouteLinks,
  getSkillSearchSnippet,
  normalizeSkillUsageKey,
  resolveSkillDataSourceState,
} from './skills-workflow'

describe('SkillsScreen helpers', () => {
  it('normalizes skill usage names for dashboard-to-skill matching', () => {
    expect(normalizeSkillUsageKey('Git & GitHub / gh-address-comments')).toBe(
      'gitgithubghaddresscomments',
    )
    expect(normalizeSkillUsageKey(' gh_address-comments ')).toBe(
      'ghaddresscomments',
    )
  })

  it('distinguishes loading, empty, unavailable, disabled, and ready states', () => {
    expect(
      resolveSkillDataSourceState({ loading: true, error: false, count: 0 }),
    ).toBe('loading')
    expect(
      resolveSkillDataSourceState({ loading: false, disabled: true, count: 0 }),
    ).toBe('disabled')
    expect(
      resolveSkillDataSourceState({ loading: false, error: true, count: 0 }),
    ).toBe('unavailable')
    expect(
      resolveSkillDataSourceState({ loading: false, error: false, count: 0 }),
    ).toBe('empty')
    expect(
      resolveSkillDataSourceState({ loading: false, error: false, count: 1 }),
    ).toBe('ready')
  })

  it('summarizes provenance, compatibility, diagnostics, and inventory export', () => {
    const skill = {
      id: 'browser',
      slug: 'browser',
      name: 'Browser',
      description: 'Use Playwright browser automation',
      author: 'Hermes',
      triggers: ['browser'],
      tags: ['browser', 'frontend'],
      homepage: null,
      category: 'Browser & Automation',
      icon: '',
      content: '# Browser',
      fileCount: 1,
      sourcePath:
        '/Users/tylerlyon/.codex/plugins/cache/openai-bundled/browser/SKILL.md',
      installed: true,
      enabled: false,
      origin: 'builtin' as const,
    }

    expect(getSkillProvenance(skill)).toBe('bundled')
    expect(getSkillCompatibility(skill)).toBe('workspace tools: browser-ready')
    expect(getSkillDiagnostics(skill)).toContain('disabled')
    expect(buildSkillInvocationCommand(skill)).toBe('Invoke skill: Browser')
    expect(buildSkillInventoryExport([skill])).toContain(
      '"provenance": "bundled"',
    )
  })

  it('explains search matches, MCP links, and mutation risk', () => {
    const skill = {
      id: 'mcp-tool',
      slug: 'mcp-tool',
      name: 'MCP Tool Setup',
      description: 'Configure a server for workspace tool calls',
      author: 'Tyler',
      triggers: ['tool-call'],
      tags: ['mcp', 'server'],
      homepage: null,
      category: 'AI & LLMs',
      icon: '',
      content: '# MCP',
      fileCount: 1,
      sourcePath: '/Users/tylerlyon/Documents/New project/.agents/skills/mcp',
      installed: true,
      enabled: true,
      origin: 'agent-created' as const,
      security: {
        level: 'medium' as const,
        flags: ['network access'],
        score: 4,
      },
    }

    expect(getSkillSearchSnippet(skill, 'server')).toBe('Tag match: server')
    expect(getSkillRouteLinks(skill)).toContain('/mcp')
    expect(getSkillMutationRisk('install', skill)).toBe('medium')
    expect(getSkillMutationRisk('uninstall', skill)).toBe('high')
    expect(getSkillMutationRisk('toggle', skill)).toBe('low')
  })
})
