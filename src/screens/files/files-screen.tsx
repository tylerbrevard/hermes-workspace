import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  FILE_BROWSER_MODE_LABEL,
  FILE_BROWSER_REMOTE_HELP,
  IGNORED_DIRS,
  buildFilesDiagnosticBundle,
  classifyFileOwnership,
  filterEntries,
  flattenRecentFiles,
  getAbsoluteFileReference,
  getExt,
  getFileOperationStatus,
  getPathSafetyMessage,
  getPinnedWorkspaceRoots,
  getSearchHighlightParts,
  isCodeFile,
  isEditableFile,
  isHtmlFile,
  isImageFile,
  isMarkdownFile,
  isOutsideWorkspaceBoundary,
  summarizeFileHealth,
} from './lib/file-workflow'
import type { ReactNode } from 'react'
import type {
  FileEntry,
  FileReadResponse,
  FileTypeFilter,
  FilesListResponse,
} from './lib/file-workflow'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/prompt-kit/markdown'

type PromptState = {
  mode: 'rename' | 'new-folder'
  targetPath: string
  defaultValue?: string
}

type ContextMenuState = {
  x: number
  y: number
  entry: FileEntry
}


function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'folder') return '📁'
  const ext = getExt(entry.name)
  if (ext === 'md' || ext === 'mdx') return '📄'
  if (ext === 'json') return '📋'
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx')
    return '📜'
  if (isImageFile(entry.name)) return '🖼'
  return '📃'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

function getParentPath(pathValue: string): string {
  const parts = pathValue.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

function getUnsafeFileNameMessage(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed === '.' || trimmed === '..') return "Name cannot be '.' or '..'."
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Use a name only, not a path.'
  }
  if (trimmed.includes('\0')) return 'Name cannot include null bytes.'
  return null
}

async function getFetchErrorMessage(res: Response) {
  try {
    const data = (await res.json()) as { error?: unknown }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // Fall back to status text below.
  }
  return `HTTP ${res.status}`
}

function formatRelativeModified(iso: string): string {
  const modifiedAt = Date.parse(iso)
  if (!Number.isFinite(modifiedAt)) return formatDate(iso)

  const diffMs = Date.now() - modifiedAt
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

// ──────────────────────────────────────────────────────────────────────────────
// Line-by-line diff (no external lib)
// ──────────────────────────────────────────────────────────────────────────────

type DiffLineKind = 'unchanged' | 'added' | 'removed'

type DiffLine = {
  kind: DiffLineKind
  text: string
  leftNum: number | null // original line number
  rightNum: number | null // new line number
}

/**
 * Very simple LCS-based diff. Produces a list of DiffLine entries that can be
 * rendered in a split/unified view.
 */
function computeDiff(original: string, updated: string): Array<DiffLine> {
  const aLines = original.split('\n')
  const bLines = updated.split('\n')
  const m = aLines.length
  const n = bLines.length

  // Build LCS table
  const dp: Array<Array<number>> = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack
  const result: Array<DiffLine> = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.push({
        kind: 'unchanged',
        text: aLines[i - 1],
        leftNum: i,
        rightNum: j,
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({
        kind: 'added',
        text: bLines[j - 1],
        leftNum: null,
        rightNum: j,
      })
      j--
    } else {
      result.push({
        kind: 'removed',
        text: aLines[i - 1],
        leftNum: i,
        rightNum: null,
      })
      i--
    }
  }
  return result.reverse()
}

// ──────────────────────────────────────────────────────────────────────────────
// Basic syntax highlighting (CSS-class only, no library)
// ──────────────────────────────────────────────────────────────────────────────

const KEYWORDS = new Set([
  'import',
  'export',
  'default',
  'from',
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'class',
  'extends',
  'new',
  'this',
  'type',
  'interface',
  'async',
  'await',
  'try',
  'catch',
  'throw',
  'null',
  'undefined',
  'true',
  'false',
  'typeof',
  'instanceof',
  'void',
  'in',
  'of',
  'break',
  'continue',
  'switch',
  'case',
  'delete',
])

type HighlightKind =
  | 'plain'
  | 'comment'
  | 'jsonKey'
  | 'keyword'
  | 'number'
  | 'string'
  | 'type'

type HighlightToken = {
  text: string
  kind: HighlightKind
}

const HIGHLIGHT_CLASS_BY_KIND: Record<
  Exclude<HighlightKind, 'plain'>,
  string
> = {
  comment: 'hl-comment',
  jsonKey: 'hl-key',
  keyword: 'hl-kw',
  number: 'hl-num',
  string: 'hl-str',
  type: 'hl-type',
}

function pushHighlightToken(
  tokens: Array<HighlightToken>,
  text: string,
  kind: HighlightKind = 'plain',
) {
  if (!text) return
  tokens.push({ text, kind })
}

function tokenizeJson(code: string): Array<HighlightToken> {
  const tokens: Array<HighlightToken> = []
  const pattern =
    /("(?:[^"\\]|\\.)*")(\s*:)?|-?\d+\.?\d*|\b(?:true|false|null)\b/g
  let lastIndex = 0

  for (const match of code.matchAll(pattern)) {
    const index = match.index
    pushHighlightToken(tokens, code.slice(lastIndex, index))

    const [value, stringValue, colon] = match
    if (stringValue) {
      pushHighlightToken(tokens, stringValue, colon ? 'jsonKey' : 'string')
      if (colon) pushHighlightToken(tokens, colon)
    } else if (value === 'true' || value === 'false' || value === 'null') {
      pushHighlightToken(tokens, value, 'keyword')
    } else {
      pushHighlightToken(tokens, value, 'number')
    }

    lastIndex = index + value.length
  }

  pushHighlightToken(tokens, code.slice(lastIndex))
  return tokens
}

function tokenizeCode(code: string): Array<HighlightToken> {
  const tokens: Array<HighlightToken> = []
  const pattern =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|(["'`])(?:(?!\1)[^\\]|\\.)*?\1|(?<![a-zA-Z_$])\b\d+\.?\d*\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g
  let lastIndex = 0

  for (const match of code.matchAll(pattern)) {
    const index = match.index
    const value = match[0]
    pushHighlightToken(tokens, code.slice(lastIndex, index))

    if (value.startsWith('//') || value.startsWith('/*')) {
      pushHighlightToken(tokens, value, 'comment')
    } else if (
      value.startsWith('"') ||
      value.startsWith("'") ||
      value.startsWith('`')
    ) {
      pushHighlightToken(tokens, value, 'string')
    } else if (/^-?\d+\.?\d*$/.test(value)) {
      pushHighlightToken(tokens, value, 'number')
    } else if (KEYWORDS.has(value)) {
      pushHighlightToken(tokens, value, 'keyword')
    } else if (/^[A-Z]/.test(value)) {
      pushHighlightToken(tokens, value, 'type')
    } else {
      pushHighlightToken(tokens, value)
    }

    lastIndex = index + value.length
  }

  pushHighlightToken(tokens, code.slice(lastIndex))
  return tokens
}

function highlightCode(code: string, ext: string): Array<ReactNode> {
  const tokens = ext === 'json' ? tokenizeJson(code) : tokenizeCode(code)
  return tokens.map((token, index) => {
    if (token.kind === 'plain') {
      return <Fragment key={index}>{token.text}</Fragment>
    }

    return (
      <span key={index} className={HIGHLIGHT_CLASS_BY_KIND[token.kind]}>
        {token.text}
      </span>
    )
  })
}

function highlightCodeContent(code: string, ext: string): Array<ReactNode> {
  if (ext === 'json') {
    return highlightCode(code, 'json')
  }
  return highlightCode(code, ext)
}

// ──────────────────────────────────────────────────────────────────────────────
// Diff Modal
// ──────────────────────────────────────────────────────────────────────────────

type DiffModalProps = {
  open: boolean
  fileName: string
  original: string
  updated: string
  onSave: () => void
  onCancel: () => void
}

function DiffModal({
  open,
  fileName,
  original,
  updated,
  onSave,
  onCancel,
}: DiffModalProps) {
  const diffLines = useMemo(
    () => (open ? computeDiff(original, updated) : []),
    [open, original, updated],
  )

  const addedCount = diffLines.filter((l) => l.kind === 'added').length
  const removedCount = diffLines.filter((l) => l.kind === 'removed').length

  // Separate left (original) and right (new) columns for split view
  const leftLines = diffLines.filter((l) => l.kind !== 'added')
  const rightLines = diffLines.filter((l) => l.kind !== 'removed')

  if (!open) return null

  return (
    <DialogRoot
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <DialogContent className="max-w-5xl w-full">
        <div className="flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary-200 dark:border-neutral-800 px-5 py-3">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-primary-900 dark:text-neutral-100 truncate">
                Review changes — {fileName}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-primary-500 dark:text-neutral-400">
                <span className="text-emerald-600 font-medium">
                  +{addedCount} added
                </span>
                {' · '}
                <span className="text-red-600 font-medium">
                  −{removedCount} removed
                </span>
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave}>
                Save anyway
              </Button>
            </div>
          </div>

          {/* Split diff view */}
          <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-primary-200 dark:divide-neutral-800">
            {/* Left — original */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <div className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-primary-500 dark:text-neutral-400 bg-primary-100/60 dark:bg-neutral-900/60 border-b border-primary-200 dark:border-neutral-800 uppercase tracking-wide">
                Original
              </div>
              <div className="flex-1 overflow-auto">
                <div className="font-mono text-[11px] leading-relaxed">
                  {leftLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-0',
                        line.kind === 'removed'
                          ? 'bg-red-50 dark:bg-red-950/25'
                          : '',
                      )}
                    >
                      <span className="shrink-0 w-10 select-none px-2 text-right text-primary-300 dark:text-neutral-600 text-[10px] leading-relaxed border-r border-primary-200 dark:border-neutral-800">
                        {line.leftNum ?? ''}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 w-5 select-none text-center leading-relaxed',
                          line.kind === 'removed'
                            ? 'text-red-500'
                            : 'text-transparent',
                        )}
                      >
                        {line.kind === 'removed' ? '−' : ' '}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all px-1',
                          line.kind === 'removed'
                            ? 'text-red-800 dark:text-red-300'
                            : 'text-primary-800 dark:text-neutral-300',
                        )}
                      >
                        {line.text || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — new */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <div className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-primary-500 dark:text-neutral-400 bg-primary-100/60 dark:bg-neutral-900/60 border-b border-primary-200 dark:border-neutral-800 uppercase tracking-wide">
                New
              </div>
              <div className="flex-1 overflow-auto">
                <div className="font-mono text-[11px] leading-relaxed">
                  {rightLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-0',
                        line.kind === 'added'
                          ? 'bg-emerald-50 dark:bg-emerald-950/25'
                          : '',
                      )}
                    >
                      <span className="shrink-0 w-10 select-none px-2 text-right text-primary-300 dark:text-neutral-600 text-[10px] leading-relaxed border-r border-primary-200 dark:border-neutral-800">
                        {line.rightNum ?? ''}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 w-5 select-none text-center leading-relaxed',
                          line.kind === 'added'
                            ? 'text-emerald-600'
                            : 'text-transparent',
                        )}
                      >
                        {line.kind === 'added' ? '+' : ' '}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all px-1',
                          line.kind === 'added'
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-primary-800 dark:text-neutral-300',
                        )}
                      >
                        {line.text || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Directory tree node
// ──────────────────────────────────────────────────────────────────────────────

type TreeNodeProps = {
  entry: FileEntry
  depth: number
  expanded: Set<string>
  selectedPath: string | null
  searchQuery: string
  onToggle: (path: string) => void
  onSelect: (entry: FileEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
}

function TreeNode({
  entry,
  depth,
  expanded,
  selectedPath,
  searchQuery,
  onToggle,
  onSelect,
  onContextMenu,
}: TreeNodeProps) {
  const isExpanded = expanded.has(entry.path)
  const isSelected = selectedPath === entry.path
  const icon = getFileIcon(entry)
  const paddingLeft = 12 + depth * 16

  const handleClick = () => {
    if (entry.type === 'folder') {
      onToggle(entry.path)
    } else {
      onSelect(entry)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors',
          isSelected
            ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
            : 'text-primary-900 dark:text-neutral-200 hover:bg-primary-200 dark:hover:bg-neutral-800',
        )}
        style={{ paddingLeft }}
      >
        {entry.type === 'folder' ? (
          <span
            className={cn(
              'shrink-0 text-primary-400 transition-transform duration-150 text-xs',
              isExpanded ? 'rotate-90' : 'rotate-0',
            )}
          >
            ▶
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0 text-base leading-none">{icon}</span>
        <span className="truncate">
          {getSearchHighlightParts(entry.name, searchQuery).map(
            (part, index) =>
              part.match ? (
                <mark
                  key={`${part.text}-${index}`}
                  className="rounded bg-amber-200/80 px-0.5 text-primary-950 dark:bg-amber-400/30 dark:text-amber-100"
                >
                  {part.text}
                </mark>
              ) : (
                <Fragment key={`${part.text}-${index}`}>{part.text}</Fragment>
              ),
          )}
        </span>
      </button>

      {entry.type === 'folder' && isExpanded && entry.children ? (
        <div>
          {entry.children
            .filter((c) => !IGNORED_DIRS.has(c.name))
            .map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                expanded={expanded}
                selectedPath={selectedPath}
                searchQuery={searchQuery}
                onToggle={onToggle}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
              />
            ))}
        </div>
      ) : null}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Breadcrumb
// ──────────────────────────────────────────────────────────────────────────────

function Breadcrumb({ path }: { path: string }) {
  const parts = path ? path.split('/').filter(Boolean) : []
  return (
    <div className="flex items-center gap-1 truncate text-xs text-primary-500 dark:text-neutral-400 min-w-0">
      <span className="shrink-0">workspace</span>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          <span className="shrink-0 text-primary-300 dark:text-neutral-600">
            /
          </span>
          <span
            className={cn(
              'truncate',
              i === parts.length - 1
                ? 'text-primary-700 dark:text-neutral-300 font-medium'
                : '',
            )}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// File panel — viewer / editor
// All hooks are called unconditionally at the top.
// ──────────────────────────────────────────────────────────────────────────────

type FilePanelProps = {
  selectedEntry: FileEntry | null
  rootPath: string
}

function FilePanel({ selectedEntry, rootPath }: FilePanelProps) {
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [editValue, setEditValue] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [rawMode, setRawMode] = useState(false)
  const [imageFit, setImageFit] = useState<'fit' | 'actual'>('fit')
  const [showDiff, setShowDiff] = useState(false)
  const prevPathRef = useRef<string | null>(null)

  // Derive file type info (safe regardless of selectedEntry nullity)
  const fileName = selectedEntry?.name ?? ''
  const ext = getExt(fileName)
  const isImage = isImageFile(fileName)
  const isMd = isMarkdownFile(fileName)
  const isHtml = isHtmlFile(fileName)
  const isCode = isCodeFile(fileName)
  const isEditable = isEditableFile(fileName)
  const ownership = selectedEntry
    ? classifyFileOwnership(selectedEntry)
    : 'workspace file'
  const protectedMode = selectedEntry ? isProtectedFile(selectedEntry) : false
  const outsideBoundary = selectedEntry
    ? isOutsideWorkspaceBoundary(selectedEntry)
    : false
  const absoluteReference = selectedEntry
    ? getAbsoluteFileReference(rootPath, selectedEntry)
    : ''
  const safetyMessage = selectedEntry
    ? getPathSafetyMessage(selectedEntry)
    : null
  const saveStatus = getFileOperationStatus('save', selectedEntry, {
    dirty,
    saving,
  })

  const highlighted = useMemo<Array<ReactNode>>(
    () =>
      isCode && !isMd && content ? highlightCodeContent(content, ext) : [],
    [isCode, isMd, content, ext],
  )

  const loadFile = useCallback(async (path: string) => {
    setLoadingFile(true)
    setFileError(null)
    setContent('')
    setDataUrl('')
    setDirty(false)
    setRawMode(false)
    try {
      const res = await fetch(
        `/api/files?action=read&path=${encodeURIComponent(path)}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as FileReadResponse
      if (data.type === 'image') {
        setDataUrl(data.content)
      } else {
        setContent(data.content)
        setEditValue(data.content)
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingFile(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedEntry || selectedEntry.type === 'folder') return
    if (prevPathRef.current === selectedEntry.path) return
    prevPathRef.current = selectedEntry.path
    void loadFile(selectedEntry.path)
  }, [selectedEntry, loadFile])

  /** Actually write to disk (called after diff confirmation or if nothing changed) */
  const commitSave = useCallback(async (path: string, value: string) => {
    setSaving(true)
    setShowDiff(false)
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'write', path, content: value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setContent(value)
      setDirty(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [])

  /** Save button handler — shows diff modal when content has changed */
  const handleSave = useCallback(() => {
    if (!selectedEntry || !dirty) return
    if (editValue !== content) {
      // Show diff first
      setShowDiff(true)
    } else {
      void commitSave(selectedEntry.path, editValue)
    }
  }, [selectedEntry, dirty, editValue, content, commitSave])

  // ── Diff Modal (always rendered so hooks stay consistent) ─────────────────

  const diffModal = (
    <DiffModal
      open={showDiff}
      fileName={selectedEntry?.name ?? ''}
      original={content}
      updated={editValue}
      onSave={() => {
        if (selectedEntry) void commitSave(selectedEntry.path, editValue)
      }}
      onCancel={() => setShowDiff(false)}
    />
  )

  // ── Empty / folder states ──────────────────────────────────────────────────

  if (!selectedEntry) {
    return (
      <>
        {diffModal}
        <div className="flex h-full items-center justify-center text-center text-primary-400 dark:text-neutral-600">
          <div>
            <div className="text-5xl mb-3 opacity-40">📂</div>
            <p className="text-sm">Select a file to preview or edit</p>
          </div>
        </div>
      </>
    )
  }

  if (selectedEntry.type === 'folder') {
    return (
      <>
        {diffModal}
        <div className="flex h-full items-center justify-center text-center text-primary-400 dark:text-neutral-600">
          <div>
            <div className="text-5xl mb-3 opacity-40">📁</div>
            <p className="text-sm font-medium">{selectedEntry.name}</p>
            <p className="text-xs mt-1 opacity-70">
              Select a file inside to preview
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── Shared header / footer ─────────────────────────────────────────────────

  const header = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary-200 px-3 py-2 dark:border-neutral-800 md:flex-nowrap md:gap-3 md:px-4 md:py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg">{getFileIcon(selectedEntry)}</span>
        <span className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
          {selectedEntry.name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void copyToClipboard(absoluteReference)}
        >
          Copy Reference
        </Button>
        {(isMd || isHtml) && !isImage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRawMode((v) => !v)}
          >
            {rawMode
              ? isHtml
                ? 'Preview HTML'
                : 'Preview'
              : isHtml
                ? 'Raw HTML'
                : 'Raw'}
          </Button>
        )}
        {isEditable && (
          <Button
            size="sm"
            variant={savedOk ? 'outline' : 'default'}
            disabled={!saveStatus.enabled}
            onClick={handleSave}
            title={saveStatus.reason}
          >
            {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  )

  const footer = (
    <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-primary-200 dark:border-neutral-800 px-4 py-1.5 text-xs text-primary-400 dark:text-neutral-500">
      <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300">
        Source: server workspace
      </span>
      <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300">
        Owner: {ownership}
      </span>
      <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300">
        {protectedMode
          ? 'Read-only mode recommended'
          : 'Editable workspace file'}
      </span>
      {outsideBoundary ? (
        <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Outside workspace boundary
        </span>
      ) : null}
      {safetyMessage ? (
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {safetyMessage}
        </span>
      ) : null}
      {selectedEntry.size !== undefined && (
        <span>{formatBytes(selectedEntry.size)}</span>
      )}
      {selectedEntry.modifiedAt && (
        <span>Modified {formatDate(selectedEntry.modifiedAt)}</span>
      )}
      <button
        type="button"
        onClick={() => void copyToClipboard(absoluteReference)}
        className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-0.5 text-primary-600 underline-offset-2 hover:underline dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300"
      >
        Copy absolute path:1
      </button>
      {dirty && (
        <span className="text-accent-500 font-medium">Unsaved changes</span>
      )}
    </div>
  )

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loadingFile) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="flex flex-1 items-center justify-center text-sm text-primary-400 dark:text-neutral-500">
            Loading…
          </div>
          {footer}
        </div>
      </>
    )
  }

  if (fileError) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="flex flex-1 items-center justify-center p-4 text-sm text-red-600 dark:text-red-400">
            {fileError}
          </div>
          {footer}
        </div>
      </>
    )
  }

  // ── Image ──────────────────────────────────────────────────────────────────

  if (isImage) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="flex shrink-0 items-center gap-2 border-b border-primary-200 px-4 py-2 text-xs dark:border-neutral-800">
            <span className="text-primary-500 dark:text-neutral-400">
              Preview quality
            </span>
            {(['fit', 'actual'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setImageFit(mode)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-medium',
                  imageFit === mode
                    ? 'border-primary-700 bg-primary-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                    : 'border-primary-200 text-primary-600 dark:border-neutral-800 dark:text-neutral-300',
                )}
              >
                {mode === 'fit' ? 'Fit' : 'Actual size'}
              </button>
            ))}
          </div>
          <div className="flex flex-1 min-h-0 items-center justify-center overflow-auto p-6">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={selectedEntry.name}
                className={cn(
                  'rounded-lg border border-primary-200 object-contain shadow-sm dark:border-neutral-800',
                  imageFit === 'fit' ? 'max-h-full max-w-full' : 'max-w-none',
                )}
              />
            ) : (
              <div className="text-sm text-primary-400">No preview</div>
            )}
          </div>
          {footer}
        </div>
      </>
    )
  }

  // ── Markdown preview ───────────────────────────────────────────────────────

  if (isMd && !rawMode) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <ScrollAreaRoot className="flex-1 min-h-0">
            <ScrollAreaViewport>
              <div className="markdown-preview px-6 py-5 text-sm text-primary-900 dark:text-neutral-200">
                <Markdown className="gap-3">{content}</Markdown>
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
            <ScrollAreaCorner />
          </ScrollAreaRoot>
          {footer}
        </div>
      </>
    )
  }

  // ── HTML preview ───────────────────────────────────────────────────────────

  if (isHtml && !rawMode) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="min-h-0 flex-1 bg-white">
            <iframe
              title={`HTML preview: ${selectedEntry.name}`}
              srcDoc={content}
              sandbox="allow-same-origin"
              className="h-full w-full border-0 bg-white"
            />
          </div>
          {footer}
        </div>
      </>
    )
  }

  // ── Code viewer (syntax highlighted) — also raw mode for md ───────────────

  if (isCode) {
    const displayContent = isMd
      ? highlightCodeContent(content, 'md')
      : highlighted
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <ScrollAreaRoot className="flex-1 min-h-0">
            <ScrollAreaViewport>
              <pre className="code-viewer whitespace-pre-wrap break-words px-4 py-4 text-xs font-mono leading-relaxed text-primary-800 dark:text-neutral-300">
                <code>{displayContent}</code>
              </pre>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
            <ScrollAreaScrollbar orientation="horizontal">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
            <ScrollAreaCorner />
          </ScrollAreaRoot>
          {footer}
        </div>
      </>
    )
  }

  // ── Editable textarea (plain text, raw md, etc.) ───────────────────────────

  return (
    <>
      {diffModal}
      <div className="flex h-full flex-col">
        {header}
        <div className="flex-1 min-h-0 p-3">
          <textarea
            className={cn(
              'h-full w-full resize-none rounded-lg border border-primary-200 dark:border-neutral-800',
              'bg-white dark:bg-neutral-900 px-3 py-2 font-mono text-xs leading-relaxed',
              'text-primary-900 dark:text-neutral-200 placeholder:text-primary-300',
              'focus:outline-none focus:ring-2 focus:ring-accent-500/30',
            )}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              setDirty(e.target.value !== content)
            }}
            spellCheck={false}
          />
        </div>
        {footer}
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main FilesScreen
// ──────────────────────────────────────────────────────────────────────────────

export function FilesScreen() {
  usePageTitle('Files')

  const [entries, setEntries] = useState<Array<FileEntry>>([])
  const [rootPath, setRootPath] = useState('')
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [lastApiError, setLastApiError] = useState<string | null>(null)
  const [operationStatus, setOperationStatus] = useState<string>(
    'Ready for server workspace file operations.',
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null)
  const [treeSearch, setTreeSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('recent')

  // CRUD state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [promptState, setPromptState] = useState<PromptState | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptBusy, setPromptBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<FileEntry | null>(null)

  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    setTreeError(null)
    setOperationStatus('Refreshing server workspace files...')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch('/api/files?action=list&maxDepth=3', {
        signal: controller.signal,
      })
      if (!res.ok)
        throw new Error(
          `HTTP ${res.status} — check that HERMES_WORKSPACE_DIR is set`,
        )
      const data = (await res.json()) as FilesListResponse
      setEntries(Array.isArray(data.entries) ? data.entries : [])
      setRootPath(data.root || data.base || '')
      setOperationStatus('Server workspace files refreshed.')
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Could not load files — request timed out. Check that HERMES_WORKSPACE_DIR is set.'
          : err instanceof Error
            ? err.message
            : String(err)
      setLastApiError(message)
      setOperationStatus(`Files API error: ${message}`)
      if (err instanceof Error && err.name === 'AbortError') {
        setTreeError(
          'Could not load files — request timed out. Check that HERMES_WORKSPACE_DIR is set.',
        )
      } else {
        setTreeError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      clearTimeout(timeoutId)
      setTreeLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('contextmenu', handleClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('contextmenu', handleClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  const handleToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleSelect = useCallback((entry: FileEntry) => {
    setSelectedEntry(entry)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, entry })
    },
    [],
  )

  // ── CRUD actions ────────────────────────────────────────────────────────────

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteConfirm) return
    const status = getFileOperationStatus('delete', deleteConfirm)
    if (!status.enabled) {
      setOperationStatus(status.reason ?? status.label)
      return
    }
    try {
      setOperationStatus(`Deleting ${deleteConfirm.path}...`)
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', path: deleteConfirm.path }),
      })
      if (!res.ok) throw new Error(await getFetchErrorMessage(res))
      if (selectedEntry?.path === deleteConfirm.path) {
        setSelectedEntry(null)
      }
      setOperationStatus(`Deleted ${deleteConfirm.path}.`)
      setDeleteConfirm(null)
      await loadTree()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLastApiError(message)
      setOperationStatus(`Delete failed: ${message}`)
    }
  }, [deleteConfirm, selectedEntry, loadTree])

  const handleDownload = useCallback(async (entry: FileEntry) => {
    const status = getFileOperationStatus('download', entry)
    if (!status.enabled) {
      setOperationStatus(status.reason ?? status.label)
      return
    }
    try {
      setOperationStatus(`Downloading ${entry.path}...`)
      const res = await fetch(
        `/api/files?action=download&path=${encodeURIComponent(entry.path)}`,
      )
      if (!res.ok) throw new Error(await getFetchErrorMessage(res))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = entry.name
      anchor.click()
      URL.revokeObjectURL(url)
      setOperationStatus(`Downloaded ${entry.path}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLastApiError(message)
      setOperationStatus(`Download failed: ${message}`)
    }
  }, [])

  const openRenamePrompt = useCallback((entry: FileEntry) => {
    setPromptState({
      mode: 'rename',
      targetPath: entry.path,
      defaultValue: entry.name,
    })
    setPromptValue(entry.name)
    setPromptError(null)
  }, [])

  const openNewFolderPrompt = useCallback(() => {
    setPromptState({ mode: 'new-folder', targetPath: '' })
    setPromptValue('')
    setPromptError(null)
  }, [])

  const handlePromptSubmit = useCallback(async () => {
    if (!promptState) return
    const value = promptValue.trim()
    const unsafeMessage = getUnsafeFileNameMessage(value)
    if (unsafeMessage) {
      setPromptError(unsafeMessage)
      return
    }

    setPromptBusy(true)
    setPromptError(null)

    try {
      if (promptState.mode === 'rename') {
        const targetEntry =
          selectedEntry?.path === promptState.targetPath
            ? selectedEntry
            : {
                name: promptState.defaultValue ?? promptState.targetPath,
                path: promptState.targetPath,
                type: 'file' as const,
              }
        const status = getFileOperationStatus('rename', targetEntry)
        if (!status.enabled) throw new Error(status.reason ?? status.label)
        setOperationStatus(`Renaming ${promptState.targetPath}...`)
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'rename',
            from: promptState.targetPath,
            name: value,
          }),
        })
        if (!res.ok) throw new Error(await getFetchErrorMessage(res))

        if (selectedEntry?.path === promptState.targetPath) {
          const parent = getParentPath(promptState.targetPath)
          setSelectedEntry({
            ...selectedEntry,
            name: value,
            path: parent ? `${parent}/${value}` : value,
          })
        }
        setOperationStatus(`Renamed ${promptState.targetPath} to ${value}.`)
      } else {
        // new-folder
        setOperationStatus('Creating folder...')
        const nextPath = promptState.targetPath
          ? `${promptState.targetPath}/${value}`
          : value
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'mkdir', path: nextPath }),
        })
        if (!res.ok) throw new Error(await getFetchErrorMessage(res))
        setOperationStatus(`Created folder ${nextPath}.`)
      }

      setPromptState(null)
      setPromptValue('')
      await loadTree()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLastApiError(message)
      setOperationStatus(`File operation failed: ${message}`)
      setPromptError(message)
    } finally {
      setPromptBusy(false)
    }
  }, [promptState, promptValue, selectedEntry, loadTree])

  const selectedPath = selectedEntry?.path ?? null
  const entryCounts = useMemo(() => countEntries(entries), [entries])
  const filteredEntries = useMemo(
    () => filterEntries(entries, treeSearch, typeFilter),
    [entries, treeSearch, typeFilter],
  )
  const filteredCounts = useMemo(
    () => countEntries(filteredEntries),
    [filteredEntries],
  )
  const recentChangedFiles = useMemo(
    () => flattenRecentFiles(entries),
    [entries],
  )
  const fileHealth = useMemo(() => summarizeFileHealth(entries), [entries])
  const pinnedRoots = useMemo(() => getPinnedWorkspaceRoots(entries), [entries])
  const hasActiveFilter = treeSearch.trim().length > 0 || typeFilter !== 'all'
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-primary-50/95 dark:bg-neutral-950 md:flex-row">
      {/* ── Left panel — directory tree ─────────────────────────────────── */}
      <aside
        className={cn(
          'flex h-[min(42dvh,360px)] w-auto shrink-0 flex-col overflow-hidden md:h-full md:w-[260px]',
          'rounded-xl border border-primary-200 bg-primary-50/95 shadow-sm',
          'dark:border-neutral-800 dark:bg-neutral-900/80',
          'm-2 mb-0 md:mr-0',
        )}
      >
        {/* Tree header */}
        <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-primary-200 bg-primary-50/95 px-3 dark:border-neutral-800 dark:bg-neutral-900/95">
          <Breadcrumb path={selectedEntry?.path ?? ''} />
          <div className="flex shrink-0 items-center gap-0.5 ml-2">
            <button
              type="button"
              onClick={openNewFolderPrompt}
              title="Create folder in server workspace root"
              aria-label="Create folder in server workspace root"
              className="rounded p-1 text-sm text-primary-400 hover:bg-primary-200 dark:hover:bg-neutral-800 hover:text-primary-600 dark:hover:text-neutral-300 transition-colors leading-none"
            >
              📁+
            </button>
            <button
              type="button"
              onClick={() => void loadTree()}
              title="Refresh server workspace files"
              aria-label="Refresh server workspace files"
              className="rounded p-1 text-lg text-primary-400 hover:bg-primary-200 dark:hover:bg-neutral-800 hover:text-primary-600 dark:hover:text-neutral-300 transition-colors leading-none"
            >
              ↺
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-b border-primary-200 px-2 py-2 text-[11px] dark:border-neutral-800">
          {[
            ['Files', filteredCounts.files],
            ['Folders', filteredCounts.folders],
            ['Editable', filteredCounts.editable],
            ['Images', filteredCounts.images],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-md border border-primary-200 bg-white/70 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-950/40"
            >
              <span className="text-primary-400 dark:text-neutral-500">
                {label}
              </span>
              <span className="ml-1 font-semibold text-primary-800 dark:text-neutral-100">
                {String(value)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-b border-primary-200 px-2 py-2 dark:border-neutral-800">
          <label className="sr-only" htmlFor="files-tree-search">
            Search files
          </label>
          <input
            id="files-tree-search"
            type="search"
            value={treeSearch}
            onChange={(event) => setTreeSearch(event.currentTarget.value)}
            placeholder="Search names or paths"
            className="h-8 w-full rounded-md border border-primary-200 bg-white/80 px-2 text-xs text-primary-900 outline-none transition focus:border-primary-400 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-100"
          />
          <div className="flex flex-wrap gap-1">
            {[
              ['recent', 'Recent'],
              ['all', 'All'],
              ['folders', 'Folders'],
              ['editable', 'Editable'],
              ['images', 'Images'],
              ['modified', 'Modified'],
              ['untracked', 'Untracked'],
              ['generated', 'Generated'],
              ['agent-touched', 'Agent touched'],
              ['docs', 'Docs'],
              ['tests', 'Tests'],
              ['config', 'Config'],
              ['runtime', 'Runtime'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value as FileTypeFilter)}
                className={cn(
                  'rounded-full border px-2 py-1 text-[10px] font-medium transition',
                  typeFilter === value
                    ? 'border-primary-700 bg-primary-900 text-white dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-950'
                    : 'border-primary-200 bg-white/60 text-primary-500 hover:text-primary-800 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {hasActiveFilter ? (
            <div className="flex items-center justify-between gap-2 text-[11px] text-primary-500 dark:text-neutral-400">
              <span>
                Showing {filteredCounts.files + filteredCounts.folders} of{' '}
                {entryCounts.files + entryCounts.folders} entries
              </span>
              <button
                type="button"
                onClick={() => {
                  setTreeSearch('')
                  setTypeFilter('all')
                }}
                className="font-medium text-primary-700 hover:underline dark:text-neutral-200"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-b border-primary-200 px-2 py-2 text-[11px] dark:border-neutral-800">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-semibold uppercase tracking-[0.08em] text-primary-500 dark:text-neutral-400">
              Pinned roots
            </span>
          </div>
          {pinnedRoots.length === 0 ? (
            <div className="rounded-md border border-dashed border-primary-200 px-2 py-1 text-primary-400 dark:border-neutral-800 dark:text-neutral-500">
              Waiting for common roots.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {pinnedRoots.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => {
                    if (entry.type === 'folder') handleToggle(entry.path)
                    else handleSelect(entry)
                  }}
                  className="rounded-full border border-primary-200 bg-white/70 px-2 py-1 font-medium text-primary-700 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {entry.path}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 rounded-md border border-primary-200 bg-white/70 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300">
            {operationStatus}
          </div>
          {lastApiError ? (
            <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              Last API error: {lastApiError}
            </div>
          ) : null}
        </div>

        {/* Tree body */}
        <ScrollAreaRoot className="flex-1 min-h-0">
          <ScrollAreaViewport className="px-1 py-1">
            <div className="mx-2 mb-2 rounded-md border border-primary-200 bg-white/70 px-2 py-1.5 text-[11px] text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
              <span className="font-medium text-primary-700 dark:text-neutral-200">
                {FILE_BROWSER_MODE_LABEL}
              </span>{' '}
              · {FILE_BROWSER_REMOTE_HELP}
            </div>
            <section
              aria-label="File workflow health"
              className="mx-2 mb-2 rounded-md border border-primary-200 bg-white/80 p-2 text-[11px] text-primary-500 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400"
            >
              <div className="mb-1 font-semibold uppercase tracking-[0.08em] text-primary-500 dark:text-neutral-400">
                File health
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span>Huge files {fileHealth.hugeFiles}</span>
                <span>Stale generated {fileHealth.staleGeneratedFiles}</span>
                <span>Missing tests {fileHealth.missingTests}</span>
                <span>
                  Protected runtime {fileHealth.protectedRuntimeFiles}
                </span>
              </div>
              <div className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                Dirty git awareness: preview diffs before saving and avoid
                overwriting unrelated workspace changes.
              </div>
              <div className="mt-1.5">
                Pinned areas: routes, screens, server, scripts, docs. Search
                scopes are saved by workflow mode in this panel.
              </div>
            </section>
            <section
              aria-label="Recent changed files"
              className="mx-2 mb-2 rounded-md border border-primary-200 bg-white/80 p-2 dark:border-neutral-800 dark:bg-neutral-950/50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-500 dark:text-neutral-400">
                  Recent changes
                </h2>
                {recentChangedFiles.length > 0 ? (
                  <span className="shrink-0 text-[10px] text-primary-400 dark:text-neutral-500">
                    {recentChangedFiles.length}
                  </span>
                ) : null}
              </div>
              {treeLoading ? (
                <div className="text-[11px] text-primary-400 dark:text-neutral-500">
                  Loading recent files...
                </div>
              ) : recentChangedFiles.length === 0 ? (
                <div className="text-[11px] text-primary-400 dark:text-neutral-500">
                  No recent file changes loaded.
                </div>
              ) : (
                <div className="space-y-1">
                  {recentChangedFiles.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={cn(
                        'flex w-full min-w-0 items-start gap-2 rounded-md border px-2 py-1.5 text-left transition',
                        selectedPath === entry.path
                          ? 'border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-300'
                          : 'border-transparent text-primary-800 hover:border-primary-200 hover:bg-primary-100 dark:text-neutral-200 dark:hover:border-neutral-800 dark:hover:bg-neutral-900',
                      )}
                    >
                      <span className="mt-0.5 shrink-0 text-sm leading-none">
                        {getFileIcon(entry)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {entry.name}
                        </span>
                        <span className="block truncate text-[10px] text-primary-500 dark:text-neutral-500">
                          {entry.path}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-primary-400 dark:text-neutral-500">
                        {formatRelativeModified(entry.modifiedAt ?? '')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            {treeLoading ? (
              <div className="px-3 py-2 text-xs text-primary-400 dark:text-neutral-500">
                Loading server workspace…
              </div>
            ) : treeError ? (
              <div className="space-y-1 px-3 py-2 text-xs text-red-500">
                <div>{treeError}</div>
                <div className="text-primary-400 dark:text-neutral-500">
                  Check the server workspace catalog or HERMES_WORKSPACE_DIR;
                  this browser no longer needs local folder access.
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="px-3 py-2 text-xs text-primary-400 dark:text-neutral-500">
                Server workspace is empty. Create a folder from the toolbar.
                Agent-created files will appear here in the configured workspace
                path.
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="space-y-2 px-3 py-2 text-xs text-primary-400 dark:text-neutral-500">
                <div>No files match the current search or type filter.</div>
                <button
                  type="button"
                  onClick={() => {
                    setTreeSearch('')
                    setTypeFilter('all')
                  }}
                  className="rounded-md border border-primary-200 px-2 py-1 text-primary-700 hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <TreeNode
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  expanded={expanded}
                  selectedPath={selectedPath}
                  searchQuery={treeSearch}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  onContextMenu={handleContextMenu}
                />
              ))
            )}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical">
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
          <ScrollAreaCorner />
        </ScrollAreaRoot>
      </aside>

      {/* ── Right panel — file viewer / editor ─────────────────────────── */}
      <main
        className={cn(
          'flex min-h-[260px] flex-1 flex-col overflow-hidden md:h-full md:min-w-0 md:min-h-0',
          'rounded-xl border border-primary-200 bg-primary-50/95 shadow-sm',
          'dark:border-neutral-800 dark:bg-neutral-900/80',
          'm-2',
        )}
      >
        <section className="shrink-0 border-b border-primary-200 bg-white/70 px-3 py-2 text-xs text-primary-600 dark:border-neutral-800 dark:bg-neutral-950/30 dark:text-neutral-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Recent changed files default
            </span>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Ownership/source chips
            </span>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Safe preview/edit distinction
            </span>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Diff preview before write
            </span>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Breadcrumbs match ownership boundaries
            </span>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Image/document preview quality controls
            </span>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Route smoke links: routes, screens, server, scripts, docs
            </span>
            <button
              type="button"
              onClick={() =>
                void copyToClipboard(
                  [
                    'file review roots',
                    'src/routes',
                    'src/screens',
                    'src/server',
                    'scripts',
                    'docs',
                  ].join('\n'),
                )
              }
              className="rounded-md border border-primary-200 px-2 py-1 font-medium text-primary-700 hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Copy review roots
            </button>
            <span className="rounded-md border border-primary-200 px-2 py-1 dark:border-neutral-800">
              Shortcuts: search, refresh, new file, copy path
            </span>
          </div>
        </section>
        <FilePanel selectedEntry={selectedEntry} rootPath={rootPath} />
      </main>

      {/* ── Context menu ──────────────────────────────────────────────────── */}
      {contextMenu ? (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg bg-primary-50 dark:bg-neutral-900 p-1 text-sm text-primary-900 dark:text-neutral-100 shadow-lg outline outline-primary-900/10 dark:outline-neutral-700"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            disabled={
              !getFileOperationStatus('rename', contextMenu.entry).enabled
            }
            title={getFileOperationStatus('rename', contextMenu.entry).reason}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800"
            onClick={() => {
              openRenamePrompt(contextMenu.entry)
              setContextMenu(null)
            }}
          >
            ✏️ Rename
          </button>
          {contextMenu.entry.type === 'folder' ? (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 dark:hover:bg-neutral-800"
              onClick={() => {
                setPromptState({
                  mode: 'new-folder',
                  targetPath: contextMenu.entry.path,
                })
                setPromptValue('')
                setContextMenu(null)
              }}
            >
              📁 New folder inside
            </button>
          ) : (
            <button
              disabled={
                !getFileOperationStatus('download', contextMenu.entry).enabled
              }
              title={
                getFileOperationStatus('download', contextMenu.entry).reason
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800"
              onClick={() => {
                void handleDownload(contextMenu.entry)
                setContextMenu(null)
              }}
            >
              ⬇️ Download
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 dark:hover:bg-neutral-800"
            onClick={() => {
              void copyToClipboard(
                getAbsoluteFileReference(rootPath, contextMenu.entry),
              )
              setContextMenu(null)
            }}
          >
            📋 Copy file reference
          </button>
          <button
            disabled={
              !getFileOperationStatus('delete', contextMenu.entry).enabled
            }
            title={getFileOperationStatus('delete', contextMenu.entry).reason}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={() => {
              setDeleteConfirm(contextMenu.entry)
              setContextMenu(null)
            }}
          >
            🗑️ Delete
          </button>
        </div>
      ) : null}

      {/* ── Rename / New-folder prompt dialog ─────────────────────────────── */}
      <DialogRoot
        open={Boolean(promptState)}
        onOpenChange={(open) => {
          if (!open) {
            setPromptState(null)
            setPromptError(null)
          }
        }}
      >
        <DialogContent>
          <div className="p-5 space-y-3">
            <DialogTitle>
              {promptState?.mode === 'rename' ? 'Rename' : 'New Folder'}
            </DialogTitle>
            <DialogDescription>
              {promptState?.mode === 'rename'
                ? 'Enter a new name.'
                : 'Enter a folder name to create.'}
            </DialogDescription>
            <input
              value={promptValue}
              onChange={(e) => {
                setPromptValue(e.target.value)
                setPromptError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                  void handlePromptSubmit()
              }}
              className="w-full rounded-md border border-primary-200 dark:border-neutral-700 bg-primary-50 dark:bg-neutral-900 px-3 py-2 text-sm text-primary-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              autoFocus
            />
            {promptError ? (
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                {promptError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button
                onClick={() => void handlePromptSubmit()}
                disabled={promptBusy}
              >
                {promptBusy ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>

      {/* ── Delete confirm dialog ──────────────────────────────────────────── */}
      <DialogRoot
        open={Boolean(deleteConfirm)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
      >
        <DialogContent>
          <div className="p-5 space-y-3">
            <DialogTitle>
              Delete {deleteConfirm?.type === 'folder' ? 'Folder' : 'File'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteConfirm?.name}</strong>?
              {deleteConfirm?.type === 'folder' &&
                ' This will delete all contents inside.'}{' '}
              This action cannot be undone.
            </DialogDescription>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirmed()}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
