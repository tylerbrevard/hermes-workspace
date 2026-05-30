import { participantList } from './lib/meeting-workflow'
import type { Meeting } from './lib/meeting-workflow'

export type ActionDraft = {
  text: string
  assignee: string
  priority: string
  dueDate: string
}

export type IssueDraft = {
  title: string
  description: string
  status: string
  priority: string
  assignee: string
}

export type DecisionDraft = {
  text: string
  decisionMaker: string
  impact: string
}

export function shellClassName() {
  return 'rounded-xl border border-primary-200 bg-primary-50/85 p-3 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/92'
}

export function toneForType(type?: string) {
  switch (type) {
    case 'client':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-200'
    case 'project':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200'
    case 'team':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
    case 'it-ops':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
    default:
      return 'border-primary-200 bg-primary-100/70 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
  }
}

export function formatWhen(value: string) {
  const date = new Date(value)
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatFreshness(value?: string | null) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function compactText(value: string, maxLength = 64) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 3).replace(/[.,;:\s]+$/, '')}...`
}

export function stripTone(state: 'ok' | 'warn' | 'bad') {
  if (state === 'ok') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  if (state === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
  }
  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
}

export function participantLabel(meeting: Meeting) {
  const names = participantList(meeting)
  return names.slice(0, 4).join(', ')
}

export function participantSummary(meeting: Meeting) {
  const names = participantList(meeting)
  if (names.length === 0) return 'No attendees'
  if (names.length <= 2) return names.join(', ')
  return `${names.length} attendees`
}
