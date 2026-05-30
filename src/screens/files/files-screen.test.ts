import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FILE_BROWSER_MODE_LABEL,
  FILE_BROWSER_REMOTE_HELP,
  buildFilesDiagnosticBundle,
  classifyFileOwnership,
  flattenRecentFiles,
  getFileOperationStatus,
  getPathSafetyMessage,
  getPinnedWorkspaceRoots,
  getSearchHighlightParts,
  isOutsideWorkspaceBoundary,
  summarizeFileHealth,
} from './lib/file-workflow'
import {
  computeDiff,
  formatBytes,
  getFileIcon,
  getParentPath,
  getUnsafeFileNameMessage,
} from './file-ui'

const filesScreenPath = path.resolve(__dirname, 'files-screen.tsx')

describe('FilesScreen remote workspace mode', () => {
  it('defaults to server-side file access copy instead of local folder picker copy', () => {
    const source = fs.readFileSync(filesScreenPath, 'utf8')

    expect(FILE_BROWSER_MODE_LABEL).toBe('Server')
    expect(FILE_BROWSER_REMOTE_HELP).toBe('/api/files live workspace')
    expect(source).toContain('Empty workspace. Create a folder')
    expect(source).not.toContain('showDirectoryPicker')
    expect(source).not.toContain('No workspace selected')
  })

  it('surfaces recently changed files ahead of older tree entries', () => {
    const files = flattenRecentFiles(
      [
        {
          name: 'docs',
          path: 'docs',
          type: 'folder',
          modifiedAt: '2026-05-24T10:00:00.000Z',
          children: [
            {
              name: 'old.md',
              path: 'docs/old.md',
              type: 'file',
              modifiedAt: '2026-05-24T10:00:00.000Z',
            },
            {
              name: 'new.md',
              path: 'docs/new.md',
              type: 'file',
              modifiedAt: '2026-05-26T10:00:00.000Z',
            },
          ],
        },
        {
          name: 'node_modules',
          path: 'node_modules',
          type: 'folder',
          modifiedAt: '2026-05-26T11:00:00.000Z',
          children: [
            {
              name: 'ignored.js',
              path: 'node_modules/ignored.js',
              type: 'file',
              modifiedAt: '2026-05-26T11:00:00.000Z',
            },
          ],
        },
      ],
      1,
    )

    expect(files.map((entry) => entry.path)).toEqual(['docs/new.md'])
  })

  it('classifies ownership and file health for workflow safeguards', () => {
    expect(
      classifyFileOwnership({
        name: '.env',
        path: '.env',
        type: 'file',
      }),
    ).toBe('config file')
    expect(
      classifyFileOwnership({
        name: 'state.json',
        path: 'runtime/state.json',
        type: 'file',
      }),
    ).toBe('runtime file')
    expect(
      classifyFileOwnership({
        name: 'bundle.js',
        path: 'dist/bundle.js',
        type: 'file',
      }),
    ).toBe('generated file')

    const health = summarizeFileHealth([
      {
        name: 'src',
        path: 'src',
        type: 'folder',
        children: [
          {
            name: 'feature.tsx',
            path: 'src/feature.tsx',
            type: 'file',
            size: 2 * 1024 * 1024,
            modifiedAt: '2026-05-26T10:00:00.000Z',
          },
          {
            name: '.env',
            path: '.env',
            type: 'file',
          },
        ],
      },
      {
        name: 'artifacts',
        path: 'artifacts',
        type: 'folder',
        children: [
          {
            name: 'old.js',
            path: 'artifacts/old.js',
            type: 'file',
            modifiedAt: '2026-04-01T10:00:00.000Z',
          },
        ],
      },
    ])

    expect(health.hugeFiles).toBe(1)
    expect(health.staleGeneratedFiles).toBeGreaterThanOrEqual(1)
    expect(health.missingTests).toBe(1)
    expect(health.protectedRuntimeFiles).toBe(1)
  })

  it('blocks unsafe workspace paths before UI operations run', () => {
    const unsafe = {
      name: 'secrets.txt',
      path: '../secrets.txt',
      type: 'file' as const,
    }
    const runtime = {
      name: 'state.json',
      path: 'runtime/state.json',
      type: 'file' as const,
    }

    expect(isOutsideWorkspaceBoundary(unsafe)).toBe(true)
    expect(getPathSafetyMessage(unsafe)).toContain('outside')
    expect(getFileOperationStatus('delete', unsafe)).toEqual(
      expect.objectContaining({ enabled: false }),
    )
    expect(getFileOperationStatus('rename', runtime)).toEqual(
      expect.objectContaining({
        enabled: false,
        reason: expect.stringContaining('Runtime and config'),
      }),
    )
  })

  it('builds safe diagnostics without file contents or secrets', () => {
    const bundle = buildFilesDiagnosticBundle({
      rootPath: '/Users/tylerlyon/hermes-workspace',
      selectedEntry: {
        name: '.env',
        path: '.env',
        type: 'file',
      },
      entries: [
        {
          name: '.env',
          path: '.env',
          type: 'file',
        },
      ],
      query: 'env',
      typeFilter: 'config',
      lastApiError: 'HTTP 500',
    })

    expect(bundle.secretsIncluded).toBe(false)
    expect(bundle.currentPath).toBe('.env')
    expect(bundle.selectedFile).toEqual(
      expect.objectContaining({
        ownership: 'config file',
        protected: true,
      }),
    )
    expect(JSON.stringify(bundle)).not.toContain('content')
  })

  it('highlights file search matches and returns pinned workspace roots', () => {
    expect(getSearchHighlightParts('files-screen.tsx', 'screen')).toEqual([
      { text: 'files-', match: false },
      { text: 'screen', match: true },
      { text: '.tsx', match: false },
    ])

    const roots = getPinnedWorkspaceRoots([
      {
        name: 'src',
        path: 'src',
        type: 'folder',
        children: [
          {
            name: 'screens',
            path: 'src/screens',
            type: 'folder',
          },
        ],
      },
      {
        name: 'docs',
        path: 'docs',
        type: 'folder',
      },
    ])

    expect(roots.map((entry) => entry.path)).toEqual([
      'src',
      'src/screens',
      'docs',
    ])
  })

  it('keeps file UI helpers deterministic for diff and action surfaces', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(getParentPath('src/screens/files/files-screen.tsx')).toBe(
      'src/screens/files',
    )
    expect(getUnsafeFileNameMessage('../secret')).toBe(
      'Use a name only, not a path.',
    )
    expect(
      getFileIcon({
        name: 'files-screen.tsx',
        path: 'files-screen.tsx',
        type: 'file',
      }),
    ).toBe('📜')

    const diff = computeDiff('a\nb\nc', 'a\nB\nc')
    expect(diff.map((line) => line.kind)).toEqual([
      'unchanged',
      'removed',
      'added',
      'unchanged',
    ])
  })
})
