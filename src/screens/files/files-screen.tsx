import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Alert02Icon,
  Clock01Icon,
  File01Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'
import {
  FILE_BROWSER_MODE_LABEL,
  FILE_BROWSER_REMOTE_HELP,
  IGNORED_DIRS,
  buildFilesDiagnosticBundle,
  classifyFileOwnership,
  countEntries,
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
  isProtectedFile,
  summarizeFileHealth,
} from './lib/file-workflow'
import {
  copyToClipboard,
  formatBytes,
  formatDate,
  formatRelativeModified,
  getFetchErrorMessage,
  getFileIcon,
  getParentPath,
  getUnsafeFileNameMessage,
  highlightCodeContent,
} from './file-ui'
import { DiffModal } from './file-diff-modal'
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
import {
  AppSectionHeader,
  AppStatusPill,
  AppSurface,
  AppTile,
} from '@/components/app-surface'

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

function compactFilePath(value: string, maxLength = 34): string {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  const parts = cleaned.split('/').filter(Boolean)
  const leaf = parts.at(-1) || cleaned
  if (leaf.length <= maxLength) return leaf
  return `${leaf.slice(0, maxLength - 3).replace(/[._\-\s]+$/, '')}...`
}

// ──────────────────────────────────────────────────────────────────────────────
// Diff Modal
// ──────────────────────────────────────────────────────────────────────────────

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
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">
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
        Copy absolute path
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
  const healthAlerts =
    fileHealth.hugeFiles +
    fileHealth.staleGeneratedFiles +
    fileHealth.missingTests +
    fileHealth.protectedRuntimeFiles
  const selectedOwnership = selectedEntry
    ? classifyFileOwnership(selectedEntry)
    : 'no file selected'
  const selectedStatus = selectedEntry
    ? getFileOperationStatus('save', selectedEntry)
    : null
  const copyDiagnosticsBundle = useCallback(() => {
    void copyToClipboard(
      JSON.stringify(
        buildFilesDiagnosticBundle({
          rootPath,
          selectedEntry,
          entries,
          query: treeSearch,
          typeFilter,
          lastApiError,
        }),
        null,
        2,
      ),
    )
    setOperationStatus('Copied file diagnostics bundle.')
  }, [entries, lastApiError, rootPath, selectedEntry, treeSearch, typeFilter])
  const filesCockpitTiles = useMemo(
    () => [
      {
        id: 'visible',
        title: 'Visible',
        value: String(filteredCounts.files),
        detail: `${filteredCounts.folders} folders`,
        icon: File01Icon,
        tone: 'neutral' as const,
        onClick: () => setTypeFilter('all'),
      },
      {
        id: 'recent',
        title: 'Recent',
        value: String(recentChangedFiles.length),
        detail: 'Changed files',
        icon: Clock01Icon,
        tone:
          recentChangedFiles.length > 0
            ? ('green' as const)
            : ('neutral' as const),
        onClick: () => setTypeFilter('recent'),
      },
      {
        id: 'alerts',
        title: 'Alerts',
        value: String(healthAlerts),
        detail: healthAlerts > 0 ? 'Review first' : 'Clear',
        icon: Alert02Icon,
        tone: healthAlerts > 0 ? ('amber' as const) : ('green' as const),
        onClick: copyDiagnosticsBundle,
      },
      {
        id: 'pins',
        title: 'Pins',
        value: String(pinnedRoots.length),
        detail: pinnedRoots.length > 0 ? 'Root jumps' : 'None',
        icon: Folder01Icon,
        tone: pinnedRoots.length > 0 ? ('blue' as const) : ('neutral' as const),
        onClick: () => setTreeSearch(''),
      },
    ],
    [
      copyDiagnosticsBundle,
      filteredCounts.files,
      filteredCounts.folders,
      healthAlerts,
      pinnedRoots.length,
      recentChangedFiles.length,
    ],
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-primary-50/95 dark:bg-neutral-950 md:flex-row md:overflow-hidden">
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
                {filteredCounts.files + filteredCounts.folders}/
                {entryCounts.files + entryCounts.folders}
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
              Pins
            </span>
          </div>
          {pinnedRoots.length === 0 ? (
            <div className="rounded-md border border-dashed border-primary-200 px-2 py-1 text-primary-400 dark:border-neutral-800 dark:text-neutral-500">
              No roots yet.
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
                Health
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span>Huge {fileHealth.hugeFiles}</span>
                <span>Stale {fileHealth.staleGeneratedFiles}</span>
                <span>Tests {fileHealth.missingTests}</span>
                <span>Runtime {fileHealth.protectedRuntimeFiles}</span>
              </div>
              <div className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                Diff first.
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {['routes', 'screens', 'server', 'scripts', 'docs'].map(
                  (root) => (
                    <span
                      key={root}
                      className="rounded-full border border-primary-200 px-1.5 py-0.5 dark:border-neutral-800"
                    >
                      {root}
                    </span>
                  ),
                )}
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
                      title={entry.path}
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
                        <span className="block break-words text-xs font-medium [overflow-wrap:anywhere]">
                          {compactFilePath(entry.name, 30)}
                        </span>
                        <span className="block break-words text-[10px] text-primary-500 [overflow-wrap:anywhere] dark:text-neutral-500">
                          {compactFilePath(getParentPath(entry.path), 28)}
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
                  Check workspace catalog or HERMES_WORKSPACE_DIR.
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="px-3 py-2 text-xs text-primary-400 dark:text-neutral-500">
                Empty workspace. Create a folder from the toolbar.
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
          'flex min-h-[260px] flex-1 flex-col overflow-visible md:h-full md:min-w-0 md:min-h-0 md:overflow-hidden',
          'rounded-xl border border-primary-200 bg-primary-50/95 shadow-sm',
          'dark:border-neutral-800 dark:bg-neutral-900/80',
          'm-2',
        )}
      >
        <section className="shrink-0 border-b border-primary-200 bg-white/70 px-3 py-3 text-xs text-primary-600 dark:border-neutral-800 dark:bg-neutral-950/30 dark:text-neutral-400">
          <AppSurface className="border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
            <AppSectionHeader
              title={
                selectedEntry
                  ? selectedEntry.name
                  : treeLoading
                    ? 'Loading workspace'
                    : 'File cockpit'
              }
              meta={
                selectedEntry
                  ? selectedOwnership
                  : `${recentChangedFiles.length} recent · ${filteredCounts.files} files`
              }
              action={
                <AppStatusPill tone={healthAlerts > 0 ? 'amber' : 'green'}>
                  {healthAlerts > 0 ? `${healthAlerts} alerts` : 'Clear'}
                </AppStatusPill>
              }
            />
            <p className="mb-3 line-clamp-2 text-[11px] text-primary-500 dark:text-neutral-500">
              {selectedEntry
                ? selectedStatus?.reason ||
                  getPathSafetyMessage(selectedEntry) ||
                  'Preview, copy, edit.'
                : 'Browse, filter, inspect.'}
            </p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {filesCockpitTiles.map((tile) => (
                <AppTile
                  key={tile.id}
                  title={tile.title}
                  value={tile.value}
                  detail={tile.detail}
                  icon={tile.icon}
                  tone={tile.tone}
                  className="min-h-[92px] rounded-[18px] p-2 md:min-h-[112px] md:rounded-[22px] md:p-3"
                  onClick={tile.onClick}
                />
              ))}
            </div>
          </AppSurface>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadTree()}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Refresh tree
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('recent')}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Recent changes
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('editable')}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Editable files
            </button>
            <button
              type="button"
              onClick={copyDiagnosticsBundle}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Copy diagnostics
            </button>
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
