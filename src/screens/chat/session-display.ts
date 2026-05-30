import type { SessionMeta } from './types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidLike(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

export function compactSessionText(value: string, maxLength = 42): string {
  const cleaned = value
    .replace(/^\[IMPORTANT:\s*/i, '')
    .replace(/^Review recent Codex memory under\s+/i, 'Review memory ')
    .replace(/^You are analyzing a meeting transcript\/notes\.\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 3).replace(/[.,;:\s]+$/, '')}...`
}

function normalizeTitleValue(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (isUuidLike(trimmed)) return null
  return trimmed
}

export function getSessionShortId(session: SessionMeta): string {
  const candidates = [session.friendlyId, session.key]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed.length === 0) continue
    return trimmed.slice(0, 8)
  }
  return ''
}

export function getSessionDisplayTitle(
  session: SessionMeta,
  isGenerating = false,
): string {
  const label = normalizeTitleValue(session.label)
  if (label) return compactSessionText(label)

  const derivedTitle = normalizeTitleValue(session.derivedTitle)
  if (derivedTitle) return compactSessionText(derivedTitle)

  const title = normalizeTitleValue(session.title)
  if (title) return compactSessionText(title)

  if (isGenerating) return 'Naming...'
  const shortId = getSessionShortId(session)
  return shortId ? `Session ${shortId}` : 'Session'
}

export function getFriendlyIdLabel(friendlyId: string): string {
  if (!isUuidLike(friendlyId)) return friendlyId
  return `ID ${friendlyId.slice(0, 8)}`
}
