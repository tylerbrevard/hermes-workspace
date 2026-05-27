import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BrainIcon,
  Copy01Icon,
  PencilEdit02Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { writeTextToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

type MemoryFileMeta = {
  path: string
  name: string
  size: number
  modified: string
  attention?: 'regression' | 'watch' | 'operations'
}

type MemorySearchMatch = {
  path: string
  line: number
  text: string
}

type ListResponse = { files?: Array<MemoryFileMeta> }
type ReadResponse = { path?: string; content?: string }
type SearchResponse = { results?: Array<MemorySearchMatch> }
type WriteResponse = { success?: boolean; path?: string; error?: string }
type MemoryFileTab = 'active' | 'recent' | 'stale' | 'all'
type SearchMode = 'semantic' | 'filename'
type MemorySourceFilter =
  | 'all'
  | 'codex'
  | 'hermes'
  | 'rollouts'
  | 'skills'
  | 'workspace'

const STALE_MEMORY_DAYS = 30

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatModified(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatDateTime(value?: string): string {
  if (!value) return 'unknown'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

function daysSince(value?: string): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000))
}

function downloadTextFile(filename: string, content: string) {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function isDailyMemoryPath(pathValue: string): boolean {
  return /^memories?\/\d{4}-\d{2}-\d{2}\.md$/.test(pathValue)
}

export function splitFiles(files: Array<MemoryFileMeta>) {
  const rootMemory = files.find((file) => file.path === 'MEMORY.md') || null
  const activeFiles = files
    .filter((file) => Boolean(file.attention))
    .sort((a, b) => {
      const priority = { regression: 0, watch: 1, operations: 2 }
      const aPriority = priority[a.attention ?? 'operations']
      const bPriority = priority[b.attention ?? 'operations']
      if (aPriority !== bPriority) return aPriority - bPriority
      return (
        Date.parse(b.modified) - Date.parse(a.modified) ||
        a.path.localeCompare(b.path)
      )
    })
  const memoryFiles = files
    .filter(
      (file) =>
        file.path !== 'MEMORY.md' &&
        !file.attention &&
        (file.path.startsWith('memory/') ||
          file.path.startsWith('memories/') ||
          file.path === 'workspace/MEMORY.md' ||
          file.path.startsWith('workspace/memory/') ||
          file.path.startsWith('workspace/memories/')),
    )
    .sort((a, b) => {
      if (isDailyMemoryPath(a.path) && isDailyMemoryPath(b.path)) {
        return b.path.localeCompare(a.path)
      }
      return (
        Date.parse(b.modified) - Date.parse(a.modified) ||
        a.path.localeCompare(b.path)
      )
    })

  return { activeFiles, rootMemory, memoryFiles }
}

export function classifyMemoryProvenance(pathValue: string): string {
  const lower = pathValue.toLowerCase()
  if (lower.includes('rollout') || lower.includes('session'))
    return 'source session'
  if (lower.includes('automation') || lower.includes('jobs/'))
    return 'automation'
  if (lower.includes('import') || lower.includes('docs/')) return 'imported doc'
  if (lower.includes('note') || lower.includes('ad_hoc')) return 'manual note'
  return 'manual note'
}

export function classifyMemoryScope(pathValue: string): string {
  const lower = pathValue.toLowerCase()
  if (lower.includes('mail') || lower.includes('outlook')) return 'mailbox'
  if (lower.includes('codex')) return 'Codex'
  if (lower.includes('hermes')) return 'Hermes'
  if (lower.startsWith('workspace/')) return 'workspace'
  return 'machine-wide'
}

export function classifyMemorySource(pathValue: string): MemorySourceFilter {
  const lower = pathValue.toLowerCase()
  if (lower.includes('rollout_summaries') || lower.includes('session'))
    return 'rollouts'
  if (lower.includes('/skills/') || lower.startsWith('skills/')) return 'skills'
  if (lower.includes('codex')) return 'codex'
  if (lower.includes('hermes')) return 'hermes'
  if (lower.startsWith('workspace/') || lower.includes('/workspace/'))
    return 'workspace'
  return 'all'
}

function getMemoryAgeDays(
  file: MemoryFileMeta,
  now = Date.now(),
): number | null {
  const parsed = Date.parse(file.modified)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.floor((now - parsed) / 86_400_000))
}

export function getMemoryFreshnessLabel(
  file: MemoryFileMeta | null,
  now = Date.now(),
): string {
  if (!file) return 'freshness unknown'
  const age = getMemoryAgeDays(file, now)
  if (age == null) return 'freshness unknown'
  if (age === 0) return 'fresh today'
  if (age <= 7) return `fresh ${age}d`
  if (age <= STALE_MEMORY_DAYS) return `last-used ${age}d`
  return `stale ${age}d`
}

export function getMemoryFilesForTab(
  files: Array<MemoryFileMeta>,
  tab: MemoryFileTab,
  now = Date.now(),
): Array<MemoryFileMeta> {
  const sorted = [...files].sort(
    (a, b) =>
      Date.parse(b.modified) - Date.parse(a.modified) ||
      a.path.localeCompare(b.path),
  )
  if (tab === 'active') return sorted.filter((file) => Boolean(file.attention))
  if (tab === 'stale') {
    return sorted.filter((file) => {
      const age = getMemoryAgeDays(file, now)
      return age != null && age > STALE_MEMORY_DAYS
    })
  }
  if (tab === 'all') return sorted
  return sorted.filter((file) => {
    const age = getMemoryAgeDays(file, now)
    return age == null || age <= STALE_MEMORY_DAYS
  })
}

export function buildMemoryHealth(
  files: Array<MemoryFileMeta>,
  now = Date.now(),
) {
  const newest = files.reduce<MemoryFileMeta | null>((current, file) => {
    if (!current) return file
    return Date.parse(file.modified) > Date.parse(current.modified)
      ? file
      : current
  }, null)
  const staleCount = files.filter((file) => {
    const age = getMemoryAgeDays(file, now)
    return age != null && age > STALE_MEMORY_DAYS
  }).length
  const brokenLinks = files.filter(
    (file) => file.size === 0 || file.path.includes('missing'),
  ).length
  return {
    count: files.length,
    staleCount,
    brokenLinks,
    newest,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
  }
}

export function buildMemoryDiagnostics(input: {
  query: string
  sourceFilter: MemorySourceFilter
  selectedPath: string | null
  files: Array<MemoryFileMeta>
  apiStatus: 'loading' | 'error' | 'ready'
}): string {
  const health = buildMemoryHealth(input.files)
  return JSON.stringify(
    {
      route: '/workspace/memory',
      query: input.query.trim() || 'none',
      sourceFilter: input.sourceFilter,
      selectedPath: input.selectedPath ?? 'none',
      apiStatus: input.apiStatus,
      fileCount: health.count,
      staleCount: health.staleCount,
      brokenLinks: health.brokenLinks,
      newest: health.newest?.path ?? 'none',
      secretsIncluded: false,
    },
    null,
    2,
  )
}

export function buildUseMemoryContext(input: {
  path: string
  provenance: string
  freshness: string
  content: string
}): string {
  const excerpt = input.content.trim().slice(0, 1200)
  return [
    'Use this memory in the current task after verifying drift-prone facts.',
    `Path: ${input.path}`,
    `Provenance: ${input.provenance}`,
    `Freshness: ${input.freshness}`,
    '',
    excerpt || '[No content loaded]',
  ].join('\n')
}

export function detectMemoryConflicts(files: Array<MemoryFileMeta>) {
  const byName = new Map<string, Array<string>>()
  for (const file of files) {
    const key = file.name.toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), file.path])
  }
  return [...byName.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([name, paths]) => ({ name, paths }))
}

export function buildRecallCommand(pathValue: string, query = ''): string {
  const safeQuery = (query.trim() || pathValue).replace(/"/g, '\\"')
  return `python3 /Users/tylerlyon/.hermes/workspace/scripts/second_brain.py recall "${safeQuery}"`
}

function getAttentionLabel(file: MemoryFileMeta): string {
  switch (file.attention) {
    case 'regression':
      return 'Regression'
    case 'watch':
      return 'Watch'
    case 'operations':
      return 'Ops'
    default:
      return 'Memory'
  }
}

function highlightMatch(
  text: string,
  query: string,
): Array<{ text: string; hit: boolean }> {
  const needle = query.trim()
  if (!needle) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const matchLower = needle.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let cursor = 0
  while (cursor < text.length) {
    const index = lower.indexOf(matchLower, cursor)
    if (index < 0) {
      parts.push({ text: text.slice(cursor), hit: false })
      break
    }
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), hit: false })
    }
    parts.push({ text: text.slice(index, index + needle.length), hit: true })
    cursor = index + needle.length
  }
  return parts.length > 0 ? parts : [{ text, hit: false }]
}

export function MemoryBrowserScreen() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [memoryTab, setMemoryTab] = useState<MemoryFileTab>('active')
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic')
  const [sourceFilter, setSourceFilter] = useState<MemorySourceFilter>('all')
  const deferredSearch = useDeferredValue(searchInput)
  const [mobileFilesOpen, setMobileFilesOpen] = useState(true)
  const [focusLine, setFocusLine] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDiffPreview, setShowDiffPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const queryClient = useQueryClient()
  const searchTerm = deferredSearch.trim()

  const filesQuery = useQuery({
    queryKey: ['memory', 'list'],
    queryFn: () => readJson<ListResponse>('/api/memory/list'),
  })

  const files = filesQuery.data?.files ?? []
  const { activeFiles, rootMemory, memoryFiles } = useMemo(
    () => splitFiles(files),
    [files],
  )

  useEffect(() => {
    if (selectedPath) return
    if (activeFiles[0]) {
      setSelectedPath(activeFiles[0].path)
      return
    }
    if (rootMemory) {
      setSelectedPath(rootMemory.path)
      return
    }
    if (memoryFiles[0]) setSelectedPath(memoryFiles[0].path)
  }, [selectedPath, activeFiles, rootMemory, memoryFiles])

  const contentQuery = useQuery({
    queryKey: ['memory', 'read', selectedPath],
    queryFn: () =>
      readJson<ReadResponse>(
        `/api/memory/read?path=${encodeURIComponent(selectedPath || '')}`,
      ),
    enabled: Boolean(selectedPath),
  })

  const searchEnabled = searchMode === 'semantic' && searchTerm.length > 0
  const searchQuery = useQuery({
    queryKey: ['memory', 'search', searchTerm],
    queryFn: () =>
      readJson<SearchResponse>(
        `/api/memory/search?q=${encodeURIComponent(searchTerm)}`,
      ),
    enabled: searchEnabled,
  })

  const content = contentQuery.data?.content || ''
  const lines = useMemo(() => content.split(/\r?\n/), [content])

  useEffect(() => {
    if (isEditing) return
    setDraftContent(content)
    setHasUnsavedChanges(false)
  }, [content, isEditing, selectedPath])

  useEffect(() => {
    if (!focusLine) return
    const target = lineRefs.current[focusLine]
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusLine, lines, selectedPath])

  const fileItems = useMemo(() => {
    const items: Array<MemoryFileMeta> = []
    items.push(...activeFiles)
    if (rootMemory) items.push(rootMemory)
    items.push(...memoryFiles)
    return items
  }, [activeFiles, rootMemory, memoryFiles])
  const filteredFileItems = useMemo(() => {
    const tabFiles = getMemoryFilesForTab(fileItems, memoryTab)
    const sourceFiles =
      sourceFilter === 'all'
        ? tabFiles
        : tabFiles.filter(
            (file) => classifyMemorySource(file.path) === sourceFilter,
          )
    if (!searchTerm || searchMode !== 'filename') return sourceFiles
    const lower = searchTerm.toLowerCase()
    return sourceFiles.filter((file) => file.path.toLowerCase().includes(lower))
  }, [fileItems, memoryTab, searchMode, searchTerm, sourceFilter])
  const selectedFileMeta = useMemo(
    () => fileItems.find((file) => file.path === selectedPath) ?? null,
    [fileItems, selectedPath],
  )
  const memoryStats = useMemo(() => buildMemoryHealth(fileItems), [fileItems])
  const selectedAgeDays = daysSince(selectedFileMeta?.modified)
  const selectedProvenance = selectedPath
    ? classifyMemoryProvenance(selectedPath)
    : 'manual note'
  const selectedScope = selectedPath
    ? classifyMemoryScope(selectedPath)
    : 'machine-wide'
  const selectedFreshness = getMemoryFreshnessLabel(selectedFileMeta)
  const memoryConflicts = useMemo(
    () => detectMemoryConflicts(fileItems),
    [fileItems],
  )
  const recallCommand = buildRecallCommand(
    selectedPath || 'MEMORY.md',
    searchTerm,
  )
  const diffPreview = useMemo(() => {
    if (!hasUnsavedChanges) return null
    const beforeLines = content.split(/\r?\n/)
    const afterLines = draftContent.split(/\r?\n/)
    return {
      before: beforeLines.length,
      after: afterLines.length,
      changed: Math.abs(afterLines.length - beforeLines.length),
    }
  }, [content, draftContent, hasUnsavedChanges])

  const searchResults = searchQuery.data?.results ?? []

  function trySelectFile(nextPath: string, nextFocusLine?: number): boolean {
    if (nextPath !== selectedPath && isEditing && hasUnsavedChanges) {
      const confirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(
              'You have unsaved changes. Discard them and switch files?',
            )
      if (!confirmed) return false
    }

    if (nextPath !== selectedPath && isEditing) {
      setIsEditing(false)
      setHasUnsavedChanges(false)
      setDraftContent('')
    }

    setSelectedPath(nextPath)
    setFocusLine(nextFocusLine ?? null)
    return true
  }

  function handleStartEditing() {
    setDraftContent(content)
    setHasUnsavedChanges(false)
    setShowDiffPreview(false)
    setIsEditing(true)
  }

  function handleCancelEditing() {
    setDraftContent(content)
    setHasUnsavedChanges(false)
    setShowDiffPreview(false)
    setIsEditing(false)
  }

  async function handleSaveEditing() {
    if (!selectedPath || isSaving) return
    if (hasUnsavedChanges && !showDiffPreview) {
      setShowDiffPreview(true)
      toast('Preview diff before memory writeback', { type: 'warning' })
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch('/api/memory/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, content: draftContent }),
      })
      const payload = (await response.json().catch(() => ({}))) as WriteResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Save failed (${response.status})`)
      }

      await queryClient.invalidateQueries({ queryKey: ['memory'] })
      setIsEditing(false)
      setHasUnsavedChanges(false)
      setShowDiffPreview(false)
      toast('Saved ✓', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save file'
      toast(message, { type: 'warning' })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopySelected() {
    if (!selectedPath) return
    try {
      await writeTextToClipboard(content)
      toast(`Copied ${selectedPath}`, { type: 'success' })
    } catch {
      toast('Clipboard unavailable', { type: 'warning' })
    }
  }

  async function handleCopyRecallCommand() {
    try {
      await writeTextToClipboard(recallCommand)
      toast('Copied recall command', { type: 'success' })
    } catch {
      toast('Clipboard unavailable', { type: 'warning' })
    }
  }

  async function handleCopyWorkflow(label: string, value: string) {
    try {
      await writeTextToClipboard(value)
      toast(`Copied ${label}`, { type: 'success' })
    } catch {
      toast('Clipboard unavailable', { type: 'warning' })
    }
  }

  async function handleCopyUseInTask() {
    if (!selectedPath) return
    const context = buildUseMemoryContext({
      path: selectedPath,
      provenance: selectedProvenance,
      freshness: selectedFreshness,
      content,
    })
    await handleCopyWorkflow('memory task context', context)
  }

  function handleExportSelected() {
    if (!selectedPath) return
    downloadTextFile(selectedPath.split('/').pop() || 'memory.md', content)
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}
    >
      <div
        className="px-3 py-3 md:px-4"
        style={{
          borderBottom: '1px solid var(--theme-border)',
          backgroundColor: 'var(--theme-bg)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="inline-flex size-9 items-center justify-center rounded-xl"
            style={{
              border: '1px solid var(--theme-border)',
              backgroundColor: 'var(--theme-card)',
              color: 'var(--theme-text)',
            }}
          >
            <HugeiconsIcon icon={BrainIcon} size={18} strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                strokeWidth={1.7}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--theme-muted)' }}
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search memory files"
                className="w-full rounded-xl py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent-500"
                style={{
                  border: '1px solid var(--theme-border)',
                  backgroundColor: 'var(--theme-card)',
                  color: 'var(--theme-text)',
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-primary-500 dark:text-neutral-400">
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Source: local memory registry
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Owner: Hermes Knowledge
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Last indexed: {formatDateTime(memoryStats.newest?.modified)}
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Memory health: {memoryStats.count} files · {memoryStats.staleCount}{' '}
            stale · {memoryStats.brokenLinks} broken links
          </span>
          {memoryStats.staleCount > 0 ? (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {memoryStats.staleCount} stale over 30d
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleCopyRecallCommand}
            className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Copy recall command
          </button>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Mobile quick recall ready
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Ops Intelligence evidence linked
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            LILY readout/writeback status visible
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Preview diff required before writeback
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Provenance lanes: source session · automation · manual note ·
            imported doc
          </span>
          <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            Scope lanes: machine-wide · workspace · Hermes · Codex · mailbox
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-3 md:p-4">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-primary-200 bg-primary-50 dark:border-neutral-800 dark:bg-neutral-950 md:col-span-1">
          <button
            type="button"
            className="flex items-center justify-between px-3 py-2 text-left md:cursor-default"
            onClick={() => setMobileFilesOpen((value) => !value)}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
              Memory Files ({fileItems.length})
            </span>
            <span className="md:hidden text-primary-500 dark:text-neutral-400">
              <HugeiconsIcon
                icon={mobileFilesOpen ? ArrowUp01Icon : ArrowDown01Icon}
                size={16}
                strokeWidth={1.7}
              />
            </span>
          </button>

          <div className="grid grid-cols-2 gap-1 px-2 pb-2 text-[11px] font-semibold">
            {[
              ['active', 'Active regression'] as const,
              ['recent', 'Recent memories'] as const,
              ['stale', 'Stale memories'] as const,
              ['all', 'All files'] as const,
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMemoryTab(tab)}
                className={cn(
                  'rounded-md border px-2 py-1 text-left transition-colors',
                  memoryTab === tab
                    ? 'border-accent-500/70 bg-accent-500/10 text-primary-900 dark:text-neutral-100'
                    : 'border-primary-200 bg-primary-50/80 text-primary-500 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:bg-neutral-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 px-2 pb-2 text-[11px] font-semibold">
            {[
              ['semantic', 'Semantic'] as const,
              ['filename', 'Filename'] as const,
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSearchMode(mode)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 transition-colors',
                  searchMode === mode
                    ? 'border-primary-400 bg-primary-100 text-primary-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
                    : 'border-primary-200 bg-primary-50/80 text-primary-500 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:bg-neutral-900',
                )}
              >
                {label} filter
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 px-2 pb-2 text-[11px] font-semibold">
            {[
              ['all', 'All sources'] as const,
              ['codex', 'Codex'] as const,
              ['hermes', 'Hermes'] as const,
              ['rollouts', 'Rollouts'] as const,
              ['skills', 'Skills'] as const,
              ['workspace', 'Workspace'] as const,
            ].map(([source, label]) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={cn(
                  'rounded-md border px-2 py-1 text-left transition-colors',
                  sourceFilter === source
                    ? 'border-accent-500/70 bg-accent-500/10 text-primary-900 dark:text-neutral-100'
                    : 'border-primary-200 bg-primary-50/80 text-primary-500 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:bg-neutral-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {searchEnabled ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-primary-400 dark:text-neutral-500">
                Search Results
              </div>
              <div className="space-y-1">
                {searchQuery.isLoading ? (
                  <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 text-xs text-primary-400 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-500">
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 text-xs text-primary-400 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-500">
                    No matches
                  </div>
                ) : (
                  searchResults.map((result, index) => (
                    <button
                      key={`${result.path}:${result.line}:${index}`}
                      type="button"
                      onClick={() => {
                        if (trySelectFile(result.path, result.line)) {
                          setMobileFilesOpen(false)
                        }
                      }}
                      className="w-full rounded-lg border border-primary-200 bg-primary-50/80 px-2.5 py-2 text-left hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                    >
                      <div className="truncate text-[11px] text-primary-500 dark:text-neutral-400">
                        {result.path}:{result.line}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-primary-700 dark:text-neutral-200">
                        {highlightMatch(result.text, searchTerm).map(
                          (part, partIndex) => (
                            <span
                              key={partIndex}
                              className={
                                part.hit
                                  ? 'rounded bg-yellow-300/30 px-0.5 text-yellow-200'
                                  : undefined
                              }
                            >
                              {part.text || ' '}
                            </span>
                          ),
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'min-h-0 flex-1 px-2 pb-2',
                !mobileFilesOpen && 'hidden md:block',
              )}
            >
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1 md:h-full md:max-h-none">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-primary-400 dark:text-neutral-500">
                  {memoryTab === 'active'
                    ? 'Active regression/watch files'
                    : memoryTab === 'recent'
                      ? 'Recent memories'
                      : memoryTab === 'stale'
                        ? 'Stale memories'
                        : 'All files'}
                </div>
                {filteredFileItems.length === 0 ? (
                  <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 text-xs text-primary-400 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-500">
                    No files in this memory view
                  </div>
                ) : (
                  filteredFileItems.map((file) => (
                    <FileRow
                      key={file.path}
                      file={file}
                      selected={selectedPath === file.path}
                      badge={
                        file.attention
                          ? getAttentionLabel(file)
                          : getMemoryFreshnessLabel(file)
                      }
                      onSelect={(pathValue) => {
                        trySelectFile(pathValue)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </aside>

        <section className="min-h-0 rounded-2xl border border-primary-200 bg-primary-50 dark:border-neutral-800 dark:bg-neutral-950 md:col-span-2">
          <div className="flex items-center justify-between border-b border-primary-200 px-3 py-2 dark:border-neutral-800">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm text-primary-900 dark:text-neutral-100">
                {selectedPath || 'Select a file'}
              </div>
              {selectedPath ? (
                <div className="text-xs text-primary-400 dark:text-neutral-500">
                  {selectedFileMeta?.size != null
                    ? `${formatBytes(selectedFileMeta.size)} · modified ${formatDateTime(selectedFileMeta.modified)}${selectedAgeDays != null && selectedAgeDays > 30 ? ` · stale ${selectedAgeDays}d` : ''}`
                    : 'Loading metadata...'}
                </div>
              ) : null}
            </div>
            {selectedPath ? (
              <div className="ml-3 flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveEditing}
                      className="rounded-md bg-[var(--theme-accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving
                        ? 'Saving...'
                        : showDiffPreview
                          ? 'Confirm write'
                          : 'Preview diff'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleCancelEditing}
                      className="rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                    {hasUnsavedChanges ? (
                      <span
                        title="Unsaved changes"
                        className="inline-block size-2 rounded-full bg-amber-400"
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCopySelected}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        size={14}
                        strokeWidth={1.7}
                      />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSelected}
                      className="rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={handleStartEditing}
                      className="relative inline-flex items-center gap-1.5 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        size={14}
                        strokeWidth={1.7}
                      />
                      Edit
                      {hasUnsavedChanges ? (
                        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-400" />
                      ) : null}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {selectedPath ? (
            <div className="border-b border-primary-200 px-3 py-2 text-xs dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Provenance: {selectedProvenance}
                </span>
                <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Scope: {selectedScope}
                </span>
                <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Freshness: {selectedFreshness}
                </span>
                <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Last-used badge: {selectedFreshness}
                </span>
                {selectedAgeDays != null &&
                selectedAgeDays > STALE_MEMORY_DAYS ? (
                  <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    Stale warning: review before using in agent decisions
                  </span>
                ) : null}
                <span className="rounded-md border border-primary-200 bg-primary-100/60 px-2 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Duplicate/conflict check: {memoryConflicts.length}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyRecallCommand}
                  className="rounded-md border border-primary-200 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Recall command
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyUseInTask()}
                  className="rounded-md border border-primary-200 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Use in current task
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyWorkflow(
                      'promote to durable memory',
                      `Promote to durable memory from chat/tasks/LILY:\n${selectedPath}`,
                    )
                  }
                  className="rounded-md border border-primary-200 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Promote to durable memory
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyWorkflow(
                      'review task',
                      `Review this memory and verify current truth:\n${selectedPath}`,
                    )
                  }
                  className="rounded-md border border-primary-200 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Review this memory
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyWorkflow(
                      'safe archive plan',
                      `Safe archive confirmation required before delete/archive:\n${selectedPath}`,
                    )
                  }
                  className="rounded-md border border-primary-200 px-2 py-1 font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Safe delete/archive
                </button>
                <span className="rounded-md border border-primary-200 px-2 py-1 text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
                  Graph/backlinks:{' '}
                  {selectedPath.split('/').slice(0, 2).join(' / ')}
                </span>
                <span className="rounded-md border border-primary-200 px-2 py-1 text-primary-500 dark:border-neutral-800 dark:text-neutral-400">
                  Route links: Chat · Tasks · LILY · Ops Intelligence
                </span>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              'h-full p-2 md:p-3',
              isEditing ? 'overflow-hidden' : 'overflow-auto',
            )}
          >
            {filesQuery.isLoading ? (
              <StateBox label="Loading memory files..." />
            ) : filesQuery.error instanceof Error ? (
              <StateBox label={filesQuery.error.message} error />
            ) : !selectedPath ? (
              <StateBox label="No memory files found" />
            ) : contentQuery.isLoading ? (
              <StateBox label="Loading file..." />
            ) : contentQuery.error instanceof Error ? (
              <StateBox label={contentQuery.error.message} error />
            ) : isEditing ? (
              <div
                className="flex h-full flex-col gap-2 rounded-xl p-2"
                style={{
                  border: '1px solid var(--theme-border)',
                  backgroundColor: 'var(--theme-card)',
                }}
              >
                {showDiffPreview && diffPreview ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                    <div className="font-semibold">
                      Preview diff before writeback
                    </div>
                    <div className="mt-1">
                      Before {diffPreview.before} lines · after{' '}
                      {diffPreview.after} lines · line delta{' '}
                      {diffPreview.after - diffPreview.before}
                    </div>
                    <div className="mt-1 text-amber-800 dark:text-amber-200">
                      Confirm write only after checking this memory does not
                      overwrite a fresher note from chat/tasks/LILY.
                    </div>
                  </div>
                ) : null}
                <textarea
                  value={draftContent}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setDraftContent(nextValue)
                    setHasUnsavedChanges(nextValue !== content)
                    setShowDiffPreview(false)
                  }}
                  className="min-h-0 flex-1 resize-none rounded-lg px-3 py-2 font-mono text-[13px] outline-none ring-0"
                  style={{
                    border: '1px solid var(--theme-border)',
                    backgroundColor: 'var(--theme-bg)',
                    color: 'var(--theme-text)',
                  }}
                  spellCheck={false}
                />
              </div>
            ) : (
              <div
                className="rounded-xl"
                style={{
                  border: '1px solid var(--theme-border)',
                  backgroundColor: 'var(--theme-card)',
                }}
              >
                <div className="font-mono text-xs">
                  {lines.map((line, index) => {
                    const lineNumber = index + 1
                    const highlighted = focusLine === lineNumber
                    return (
                      <div
                        key={lineNumber}
                        ref={(node) => {
                          lineRefs.current[lineNumber] = node
                        }}
                        className={cn(
                          'grid grid-cols-[56px_1fr] gap-0 border-b border-primary-200/80 last:border-b-0 dark:border-neutral-900/80',
                          highlighted && 'bg-yellow-300/10',
                        )}
                      >
                        <div
                          className={cn(
                            'select-none border-r border-primary-200 px-2 py-0.5 text-right text-primary-400 dark:border-neutral-800 dark:text-neutral-600',
                            highlighted && 'text-yellow-200',
                          )}
                        >
                          {lineNumber}
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-0.5 text-primary-800 dark:text-neutral-200">
                          {line || ' '}
                        </pre>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function FileRow({
  file,
  selected,
  badge,
  onSelect,
}: {
  file: MemoryFileMeta
  selected: boolean
  badge?: string
  onSelect: (pathValue: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(file.path)}
      className={cn(
        'w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
        selected
          ? 'border-accent-500/70 bg-accent-500/10'
          : 'border-primary-200 bg-primary-50/80 hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="truncate font-mono text-xs text-primary-900 dark:text-neutral-100">
          {file.path}
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 text-[11px] text-primary-400 dark:text-neutral-500">
        {formatBytes(file.size)} · {formatModified(file.modified)}
      </div>
    </button>
  )
}

function StateBox({ label, error }: { label: string; error?: boolean }) {
  return (
    <div
      className={cn(
        'flex min-h-32 items-center justify-center rounded-xl border px-4 text-sm',
        error
          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300'
          : 'border-primary-200 bg-primary-50 text-primary-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400',
      )}
    >
      {label}
    </div>
  )
}
