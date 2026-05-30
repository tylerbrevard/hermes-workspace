import { Fragment } from 'react'
import { getExt, isImageFile } from './lib/file-workflow'
import type { ReactNode } from 'react'
import type { FileEntry } from './lib/file-workflow'

export type DiffLineKind = 'unchanged' | 'added' | 'removed'

export type DiffLine = {
  kind: DiffLineKind
  text: string
  leftNum: number | null
  rightNum: number | null
}

export function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'folder') return '📁'
  const ext = getExt(entry.name)
  if (ext === 'md' || ext === 'mdx') return '📄'
  if (ext === 'json') return '📋'
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return '📜'
  }
  if (isImageFile(entry.name)) return '🖼'
  return '📃'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function copyToClipboard(value: string) {
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

export function getParentPath(pathValue: string): string {
  const parts = pathValue.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

export function getUnsafeFileNameMessage(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed === '.' || trimmed === '..') return "Name cannot be '.' or '..'."
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Use a name only, not a path.'
  }
  if (trimmed.includes('\0')) return 'Name cannot include null bytes.'
  return null
}

export async function getFetchErrorMessage(res: Response) {
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

export function formatRelativeModified(iso: string): string {
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

export function computeDiff(
  original: string,
  updated: string,
): Array<DiffLine> {
  const aLines = original.split('\n')
  const bLines = updated.split('\n')
  const m = aLines.length
  const n = bLines.length

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

export function highlightCodeContent(
  code: string,
  ext: string,
): Array<ReactNode> {
  if (ext === 'json') {
    return highlightCode(code, 'json')
  }
  return highlightCode(code, ext)
}
