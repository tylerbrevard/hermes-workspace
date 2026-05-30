export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  children?: Array<FileEntry>
}

export type FilesListResponse = {
  root: string
  base: string
  entries: Array<FileEntry>
}

export const FILE_BROWSER_MODE_LABEL = 'Server'
export const FILE_BROWSER_REMOTE_HELP = '/api/files live workspace'

export type FileReadResponse = {
  type: 'text' | 'image'
  path: string
  content: string
}

export type FileTypeFilter =
  | 'recent'
  | 'all'
  | 'folders'
  | 'editable'
  | 'images'
  | 'modified'
  | 'untracked'
  | 'generated'
  | 'agent-touched'
  | 'docs'
  | 'tests'
  | 'config'
  | 'runtime'

export type FileOwnershipKind =
  | 'workspace file'
  | 'generated file'
  | 'runtime file'
  | 'config file'

export type FileHealthSummary = {
  hugeFiles: number
  staleGeneratedFiles: number
  missingTests: number
  protectedRuntimeFiles: number
}

export type FileOperationName =
  | 'copy-reference'
  | 'download'
  | 'rename'
  | 'delete'
  | 'new-folder'
  | 'save'

export type FileOperationStatus = {
  action: FileOperationName
  enabled: boolean
  label: string
  reason?: string
}

export type FileDiagnosticBundle = {
  generatedAt: string
  root: string
  currentPath: string
  selectedFile: {
    name: string
    path: string
    type: FileEntry['type']
    ownership: FileOwnershipKind
    protected: boolean
    outsideWorkspaceBoundary: boolean
  } | null
  filter: {
    query: string
    type: FileTypeFilter
  }
  lastApiError: string | null
  counts: {
    files: number
    folders: number
    editable: number
    images: number
  }
  health: FileHealthSummary
  secretsIncluded: false
}

export type HighlightPart = {
  text: string
  match: boolean
}

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'dist',
])

export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
export const CODE_EXTS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'css',
  'html',
  'yml',
  'yaml',
  'sh',
  'py',
  'env',
])

export function getExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(getExt(name))
}

export function isCodeFile(name: string): boolean {
  return CODE_EXTS.has(getExt(name))
}

export function isMarkdownFile(name: string): boolean {
  const ext = getExt(name)
  return ext === 'md' || ext === 'mdx'
}

export function isHtmlFile(name: string): boolean {
  const ext = getExt(name)
  return ext === 'html' || ext === 'htm'
}

export function isEditableFile(name: string): boolean {
  return !isImageFile(name)
}

export function isDocumentFile(entry: FileEntry): boolean {
  const ext = getExt(entry.name)
  return ['md', 'mdx', 'pdf', 'doc', 'docx', 'txt'].includes(ext)
}

export function isTestFile(entry: FileEntry): boolean {
  return /(^|[./_-])(test|spec)([./_-]|$)/i.test(entry.path)
}

export function isConfigFile(entry: FileEntry): boolean {
  const ext = getExt(entry.name)
  return (
    entry.name.startsWith('.') ||
    ['json', 'yaml', 'yml', 'toml', 'env', 'config'].includes(ext) ||
    /(^|\/)(package|tsconfig|vite|tailwind|eslint|prettier|playwright)\b/i.test(
      entry.path,
    )
  )
}

export function isGeneratedFile(entry: FileEntry): boolean {
  return /(^|\/)(dist|build|coverage|generated|artifacts|node_modules)\//i.test(
    `${entry.path}/`,
  )
}

export function isRuntimeFile(entry: FileEntry): boolean {
  return /(^|\/)(runtime|logs?|tmp|cache|\.hermes|state|sessions)\//i.test(
    `${entry.path}/`,
  )
}

export function isAgentTouchedFile(entry: FileEntry): boolean {
  return /(^|\/)(agent|agents|swarm|jobs|conductor|hermes|codex)(\/|[-_.])/i.test(
    `${entry.path}/`,
  )
}

export function isOutsideWorkspaceBoundary(entry: FileEntry): boolean {
  return (
    entry.path.startsWith('/') ||
    entry.path.startsWith('..') ||
    entry.path.includes('/../') ||
    entry.path.includes('\\')
  )
}

export function classifyFileOwnership(entry: FileEntry): FileOwnershipKind {
  if (isRuntimeFile(entry)) return 'runtime file'
  if (isConfigFile(entry)) return 'config file'
  if (isGeneratedFile(entry)) return 'generated file'
  return 'workspace file'
}

export function isProtectedFile(entry: FileEntry): boolean {
  const ownership = classifyFileOwnership(entry)
  return ownership === 'runtime file' || ownership === 'config file'
}

export function getPathSafetyMessage(entry: FileEntry): string | null {
  if (isOutsideWorkspaceBoundary(entry)) {
    return 'Blocked: path is outside the configured workspace boundary.'
  }
  if (isProtectedFile(entry)) {
    return 'Protected: preview first and avoid destructive changes unless intentional.'
  }
  return null
}

export function getAbsoluteFileReference(
  rootPath: string,
  entry: FileEntry,
): string {
  const root = rootPath.replace(/\/+$/, '')
  const rel = entry.path.replace(/^\/+/, '')
  const absolute = root ? `${root}/${rel}` : entry.path
  return entry.type === 'file' ? `${absolute}:1` : absolute
}

export function getSearchHighlightParts(
  value: string,
  query: string,
): Array<HighlightPart> {
  const needle = query.trim()
  if (!needle) return [{ text: value, match: false }]
  const lowerValue = value.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const parts: Array<HighlightPart> = []
  let cursor = 0
  let index = lowerValue.indexOf(lowerNeedle)
  while (index >= 0) {
    if (index > cursor) {
      parts.push({ text: value.slice(cursor, index), match: false })
    }
    parts.push({
      text: value.slice(index, index + needle.length),
      match: true,
    })
    cursor = index + needle.length
    index = lowerValue.indexOf(lowerNeedle, cursor)
  }
  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), match: false })
  }
  return parts.length ? parts : [{ text: value, match: false }]
}

export function countEntries(entries: Array<FileEntry>): {
  files: number
  folders: number
  editable: number
  images: number
} {
  return entries.reduce(
    (counts, entry) => {
      if (entry.type === 'folder') {
        counts.folders += 1
        if (entry.children) {
          const childCounts = countEntries(entry.children)
          counts.files += childCounts.files
          counts.folders += childCounts.folders
          counts.editable += childCounts.editable
          counts.images += childCounts.images
        }
      } else {
        counts.files += 1
        if (isEditableFile(entry.name)) counts.editable += 1
        if (isImageFile(entry.name)) counts.images += 1
      }
      return counts
    },
    { files: 0, folders: 0, editable: 0, images: 0 },
  )
}

export function entryMatchesFilter(
  entry: FileEntry,
  query: string,
  typeFilter: FileTypeFilter,
): boolean {
  const q = query.trim().toLowerCase()
  const matchesQuery =
    !q ||
    entry.name.toLowerCase().includes(q) ||
    entry.path.toLowerCase().includes(q)
  if (!matchesQuery) return false
  switch (typeFilter) {
    case 'recent':
      return entry.type === 'file' && Boolean(entry.modifiedAt)
    case 'all':
      return true
    case 'folders':
      return entry.type === 'folder'
    case 'editable':
      return entry.type === 'file' && isEditableFile(entry.name)
    case 'images':
      return entry.type === 'file' && isImageFile(entry.name)
    case 'modified':
      return false
    case 'untracked':
      return false
    case 'generated':
      return isGeneratedFile(entry)
    case 'agent-touched':
      return entry.type === 'file' && isAgentTouchedFile(entry)
    case 'docs':
      return entry.type === 'file' && isDocumentFile(entry)
    case 'tests':
      return entry.type === 'file' && isTestFile(entry)
    case 'config':
      return isConfigFile(entry)
    case 'runtime':
      return isRuntimeFile(entry)
  }
}

export function filterEntries(
  entries: Array<FileEntry>,
  query: string,
  typeFilter: FileTypeFilter,
): Array<FileEntry> {
  return entries
    .filter((entry) => !IGNORED_DIRS.has(entry.name))
    .map((entry) => {
      const children = entry.children
        ? filterEntries(entry.children, query, typeFilter)
        : undefined
      const selfMatches = entryMatchesFilter(entry, query, typeFilter)
      if (!selfMatches && (!children || children.length === 0)) return null
      return children ? { ...entry, children } : entry
    })
    .filter((entry): entry is FileEntry => Boolean(entry))
}

export function flattenRecentFiles(
  entries: Array<FileEntry>,
  limit = 8,
): Array<FileEntry> {
  const files: Array<FileEntry> = []

  const visit = (items: Array<FileEntry>) => {
    for (const entry of items) {
      if (IGNORED_DIRS.has(entry.name)) continue
      if (entry.type === 'file' && entry.modifiedAt) {
        files.push(entry)
      }
      if (entry.children) visit(entry.children)
    }
  }

  visit(entries)

  return files
    .sort((a, b) => {
      const byModified =
        Date.parse(b.modifiedAt ?? '') - Date.parse(a.modifiedAt ?? '')
      if (byModified !== 0) return byModified
      return a.path.localeCompare(b.path)
    })
    .slice(0, limit)
}

export function flattenFiles(entries: Array<FileEntry>): Array<FileEntry> {
  const files: Array<FileEntry> = []
  const visit = (items: Array<FileEntry>) => {
    for (const entry of items) {
      if (IGNORED_DIRS.has(entry.name)) continue
      if (entry.type === 'file') files.push(entry)
      if (entry.children) visit(entry.children)
    }
  }
  visit(entries)
  return files
}

export function summarizeFileHealth(
  entries: Array<FileEntry>,
): FileHealthSummary {
  const files = flattenFiles(entries)
  const now = Date.now()
  return files.reduce<FileHealthSummary>(
    (summary, entry) => {
      if ((entry.size ?? 0) > 1024 * 1024) summary.hugeFiles += 1
      if (
        isGeneratedFile(entry) &&
        entry.modifiedAt &&
        now - Date.parse(entry.modifiedAt) > 7 * 24 * 60 * 60 * 1000
      ) {
        summary.staleGeneratedFiles += 1
      }
      if (
        /^src\//.test(entry.path) &&
        /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
        !isTestFile(entry)
      ) {
        const stem = entry.path.replace(/\.(ts|tsx|js|jsx)$/, '')
        const hasMatchingTest = files.some((candidate) => {
          return (
            candidate.path.startsWith(stem) &&
            /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(candidate.name)
          )
        })
        if (!hasMatchingTest) summary.missingTests += 1
      }
      if (isProtectedFile(entry)) summary.protectedRuntimeFiles += 1
      return summary
    },
    {
      hugeFiles: 0,
      staleGeneratedFiles: 0,
      missingTests: 0,
      protectedRuntimeFiles: 0,
    },
  )
}

export function getPinnedWorkspaceRoots(
  entries: Array<FileEntry>,
): Array<FileEntry> {
  const preferred = [
    'src',
    'src/routes',
    'src/screens',
    'src/server',
    'scripts',
    'docs',
  ]
  const allEntries = new Map<string, FileEntry>()
  const visit = (items: Array<FileEntry>) => {
    for (const entry of items) {
      allEntries.set(entry.path, entry)
      if (entry.children) visit(entry.children)
    }
  }
  visit(entries)
  return preferred
    .map((pathValue) => allEntries.get(pathValue))
    .filter((entry): entry is FileEntry => Boolean(entry))
}

export function getFileOperationStatus(
  action: FileOperationName,
  entry: FileEntry | null,
  options: { dirty?: boolean; saving?: boolean } = {},
): FileOperationStatus {
  if (action === 'new-folder') {
    return {
      action,
      enabled: true,
      label: 'Create folder',
    }
  }
  if (!entry) {
    return {
      action,
      enabled: false,
      label: 'Select a file first',
      reason: 'No file or folder is selected.',
    }
  }
  if (isOutsideWorkspaceBoundary(entry)) {
    return {
      action,
      enabled: false,
      label: 'Outside workspace',
      reason: 'This path is blocked because it leaves the workspace boundary.',
    }
  }
  if (action === 'download' && entry.type !== 'file') {
    return {
      action,
      enabled: false,
      label: 'Folders cannot download',
      reason: 'Select a file to download.',
    }
  }
  if (
    (action === 'rename' || action === 'delete' || action === 'save') &&
    isProtectedFile(entry)
  ) {
    return {
      action,
      enabled: false,
      label: 'Protected file',
      reason: 'Runtime and config files require deliberate manual handling.',
    }
  }
  if (action === 'save' && !options.dirty) {
    return {
      action,
      enabled: false,
      label: 'No changes',
      reason: 'Edit the file before saving.',
    }
  }
  if (action === 'save' && options.saving) {
    return {
      action,
      enabled: false,
      label: 'Saving',
      reason: 'The current save request is still running.',
    }
  }
  return {
    action,
    enabled: true,
    label:
      action === 'copy-reference'
        ? 'Copy reference'
        : action === 'download'
          ? 'Download'
          : action === 'rename'
            ? 'Rename'
            : action === 'delete'
              ? 'Delete'
              : action === 'save'
                ? 'Save'
                : 'Create folder',
  }
}

export function buildFilesDiagnosticBundle({
  rootPath,
  selectedEntry,
  entries,
  query,
  typeFilter,
  lastApiError,
}: {
  rootPath: string
  selectedEntry: FileEntry | null
  entries: Array<FileEntry>
  query: string
  typeFilter: FileTypeFilter
  lastApiError: string | null
}): FileDiagnosticBundle {
  return {
    generatedAt: new Date().toISOString(),
    root: rootPath,
    currentPath: selectedEntry?.path ?? '',
    selectedFile: selectedEntry
      ? {
          name: selectedEntry.name,
          path: selectedEntry.path,
          type: selectedEntry.type,
          ownership: classifyFileOwnership(selectedEntry),
          protected: isProtectedFile(selectedEntry),
          outsideWorkspaceBoundary: isOutsideWorkspaceBoundary(selectedEntry),
        }
      : null,
    filter: {
      query,
      type: typeFilter,
    },
    lastApiError,
    counts: countEntries(entries),
    health: summarizeFileHealth(entries),
    secretsIncluded: false,
  }
}
