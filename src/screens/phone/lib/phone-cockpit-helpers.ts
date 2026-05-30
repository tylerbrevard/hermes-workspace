import {
  Apple01Icon,
  Calendar01Icon,
  Dumbbell01Icon,
  InjectionIcon,
  Note01Icon,
  PencilEdit01Icon,
  Target02Icon,
  Task01Icon,
} from '@hugeicons/core-free-icons'

import type {
  PhoneAttentionItem,
  PhoneCockpitAction,
  PhoneCockpitSnapshot,
} from '@/server/phone-cockpit'
import { formatWorkspaceFreshness } from '@/lib/source-freshness'
import {
  isStringArray,
  readJsonStorage,
  writeJsonStorage,
} from '@/lib/typed-storage'

export type CaptureMode = 'note' | 'task' | 'draft'
export type NotificationState = NotificationPermission | 'unsupported'
export type PhoneTab = 'today' | 'work' | 'systems'
export type PhoneTravelMode = 'standard' | 'driving' | 'walking'
export type PhoneSignalRailItem = {
  id: string
  label: string
  value: string
  tone: 'ok' | 'warn' | 'bad' | 'muted'
}
export type PhoneCardId =
  | 'needs'
  | 'modes'
  | 'capture'
  | 'meeting'
  | 'prep'
  | 'triage'
  | 'tasks'
  | 'reply'
  | 'mail'
  | 'habit'
  | 'connectwise'
  | 'desk'
  | 'status'
  | 'shortcuts'
  | 'dailyloops'
export type QueuedCapture = {
  id: string
  createdAt: string
  lastTriedAt?: string
  retryCount?: number
  mode: CaptureMode
  label: string
  payload: PhoneCockpitAction
  error?: string
}
export type QuickUndo = {
  label: string
  action: () => void
}

type HugeIcon = typeof Note01Icon

export const PHONE_CARD_IDS = [
  'needs',
  'modes',
  'capture',
  'meeting',
  'prep',
  'triage',
  'tasks',
  'reply',
  'mail',
  'habit',
  'connectwise',
  'desk',
  'status',
  'shortcuts',
  'dailyloops',
] as const

export const PHONE_LOW_DATA_KEY = 'hermes-phone-low-data-v1'
export const PHONE_HIGH_CONTRAST_KEY = 'hermes-phone-high-contrast-v1'
export const PHONE_COMPACT_BADGES_KEY = 'hermes-phone-compact-badges-v1'
export const PHONE_TRAVEL_MODE_KEY = 'hermes-phone-travel-mode-v1'

const PHONE_CAPTURE_QUEUE_KEY = 'hermes-phone-capture-queue-v1'
const PHONE_COLLAPSED_CARDS_KEY = 'hermes-phone-collapsed-cards-v1'
const PHONE_PINNED_CARDS_KEY = 'hermes-phone-pinned-cards-v1'
export const DEFAULT_PHONE_COLLAPSED_CARDS: Array<PhoneCardId> = [
  'dailyloops',
  'modes',
]

const PHONE_SOURCE_STALE_MINUTES: Partial<
  Record<keyof PhoneCockpitSnapshot['sources'], number>
> = {
  presence: 8,
  calendar: 20,
  meetingPrep: 45,
  mail: 20,
  tasks: 30,
  devices: 8,
}

export const WEGOVY_DOSE_OPTIONS = ['0.25', '0.5', '1', '1.7', '2.4']
export const WEGOVY_SITE_OPTIONS = [
  'Abdomen',
  'Left thigh',
  'Right thigh',
  'Left arm',
  'Right arm',
]
export const FOOD_MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

export const PHONE_TABS: Array<{ id: PhoneTab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'work', label: 'Work' },
  { id: 'systems', label: 'Systems' },
]

export const captureModeMeta: Record<
  CaptureMode,
  { label: string; icon: HugeIcon }
> = {
  note: { label: 'Note', icon: Note01Icon },
  task: { label: 'Task', icon: Task01Icon },
  draft: { label: 'Draft', icon: PencilEdit01Icon },
}

export function fmtTime(value?: string | null) {
  if (!value) return 'No time'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function fmtShortTime(value?: string | null) {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function relativeMinutes(minutes: number) {
  if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))}h ago`
  if (minutes < 0) return `${Math.abs(minutes)}m ago`
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}

export function formatFreshness(value?: string | null) {
  return formatWorkspaceFreshness(value, {
    emptyLabel: 'Not synced',
    invalidLabel: 'Sync unknown',
  })
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  )
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function nextPhoneTab(
  current: PhoneTab,
  direction: 'next' | 'previous',
) {
  const index = PHONE_TABS.findIndex((tab) => tab.id === current)
  const nextIndex =
    direction === 'next'
      ? Math.min(index + 1, PHONE_TABS.length - 1)
      : Math.max(index - 1, 0)
  return PHONE_TABS[nextIndex]?.id ?? current
}

export function readQueuedCaptures(): Array<QueuedCapture> {
  return readJsonStorage(PHONE_CAPTURE_QUEUE_KEY, [], isQueuedCaptureArray)
    .value
}

export function writeQueuedCaptures(queue: Array<QueuedCapture>) {
  writeJsonStorage(PHONE_CAPTURE_QUEUE_KEY, queue)
}

export function readBooleanPreference(key: string) {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(key) === '1'
}

export function writeBooleanPreference(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, value ? '1' : '0')
}

export function readPhoneTravelMode(): PhoneTravelMode {
  if (typeof window === 'undefined') return 'standard'
  const value = window.localStorage.getItem(PHONE_TRAVEL_MODE_KEY)
  return value === 'driving' || value === 'walking' ? value : 'standard'
}

export function writePhoneTravelMode(value: PhoneTravelMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PHONE_TRAVEL_MODE_KEY, value)
}

export function readCollapsedCards(): Set<PhoneCardId> {
  if (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(PHONE_COLLAPSED_CARDS_KEY) === null
  ) {
    return new Set(DEFAULT_PHONE_COLLAPSED_CARDS)
  }
  const value = readJsonStorage(
    PHONE_COLLAPSED_CARDS_KEY,
    DEFAULT_PHONE_COLLAPSED_CARDS,
    isPhoneCardIdArray,
  ).value
  return new Set(value)
}

export function readPinnedCards(): Set<PhoneCardId> {
  const value = readJsonStorage(
    PHONE_PINNED_CARDS_KEY,
    [],
    isPhoneCardIdArray,
  ).value
  return new Set(value)
}

export function writePinnedCards(cards: Set<PhoneCardId>) {
  writeJsonStorage(PHONE_PINNED_CARDS_KEY, Array.from(cards))
}

export function writeCollapsedCards(cards: Set<PhoneCardId>) {
  writeJsonStorage(PHONE_COLLAPSED_CARDS_KEY, Array.from(cards))
}

function isPhoneCardId(value: string): value is PhoneCardId {
  return PHONE_CARD_IDS.includes(value as PhoneCardId)
}

function isPhoneCardIdArray(value: unknown): value is Array<PhoneCardId> {
  return isStringArray(value) && value.every(isPhoneCardId)
}

function isQueuedCaptureArray(value: unknown): value is Array<QueuedCapture> {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const candidate = entry as Partial<QueuedCapture>
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.createdAt === 'string' &&
        typeof candidate.label === 'string' &&
        ['note', 'task', 'draft'].includes(String(candidate.mode)) &&
        Boolean(candidate.payload) &&
        typeof candidate.payload === 'object'
      )
    })
  )
}

export function toggleCollapsedCardSet(
  cards: Set<PhoneCardId>,
  cardId: PhoneCardId,
) {
  const next = new Set(cards)
  if (next.has(cardId)) next.delete(cardId)
  else next.add(cardId)
  return next
}

export function buildPhoneModeReadouts(snapshot: PhoneCockpitSnapshot | null): {
  commute: { title: string; detail: string }
  meeting: { title: string; detail: string; active: boolean }
  desk: { title: string; detail: string; online: boolean }
} {
  const overdue = snapshot?.tasks.overdue ?? 0
  const unread = snapshot?.inbox.unread ?? 0
  const attention = snapshot?.attention.length ?? 0
  const nextMeeting = snapshot?.schedule.nextMeeting
  const office = snapshot?.devices.office

  return {
    commute: {
      title: nextMeeting
        ? `Next: ${nextMeeting.title}`
        : attention
          ? `${attention} item${attention === 1 ? '' : 's'} need Tyler`
          : 'No urgent blockers',
      detail: `${unread} unread mail, ${overdue} overdue tasks, ${attention} attention item${attention === 1 ? '' : 's'}.`,
    },
    meeting: {
      title: nextMeeting
        ? `${nextMeeting.title} in ${relativeMinutes(nextMeeting.minutesUntil)}`
        : 'No meeting window',
      detail: nextMeeting?.joinUrl
        ? 'Join link is ready. Open prep before joining.'
        : nextMeeting
          ? 'Prep is available. No join link detected.'
          : 'Meeting mode will wake up before the next calendar event.',
      active: Boolean(
        nextMeeting &&
        nextMeeting.minutesUntil >= -5 &&
        nextMeeting.minutesUntil <= 30,
      ),
    },
    desk: {
      title:
        office?.status === 'online'
          ? 'Office bridge online'
          : office?.status === 'stale'
            ? 'Office bridge idle'
            : 'Office bridge unknown',
      detail:
        [
          office?.displayMode ? `display ${office.displayMode}` : null,
          office?.deskMode ? `desk ${office.deskMode}` : null,
          office?.replyLength ? `reply ${office.replyLength}` : null,
          office?.quietHours ? 'quiet hours on' : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'No live desk preferences reported.',
      online: office?.status === 'online',
    },
  }
}

export function buildPhoneAtAGlance(snapshot: PhoneCockpitSnapshot | null) {
  const nextMeeting = snapshot?.schedule.nextMeeting
  const sourceWarnings = Object.values(snapshot?.sources || {}).filter(
    (source) => !source.ok,
  )
  const waitingOnMe =
    (snapshot?.attention.filter((item) => item.severity !== 'info').length ??
      0) + (snapshot?.tasks.overdue ?? 0)
  const waitingOnOthers = snapshot?.inbox.focused.length ?? 0

  const signals = [
    {
      label: 'Next event',
      value: nextMeeting
        ? `${nextMeeting.title} ${relativeMinutes(nextMeeting.minutesUntil)}`
        : 'No meeting',
    },
    { label: 'Tasks', value: String(snapshot?.tasks.total ?? 0) },
    {
      label: 'Waiting',
      value: `${waitingOnMe} me / ${waitingOnOthers} others`,
    },
    {
      label: 'Desk state',
      value:
        snapshot?.devices.office.status === 'stale'
          ? 'idle'
          : (snapshot?.devices.office.status ?? 'unknown'),
    },
    {
      label: 'Source health',
      value: sourceWarnings.length ? `${sourceWarnings.length} degraded` : 'OK',
    },
  ]
  return signals
}

export function buildPhoneSignalRail(
  snapshot: PhoneCockpitSnapshot | null,
): Array<PhoneSignalRailItem> {
  const degradedSources = Object.values(snapshot?.sources || {}).filter(
    (source) => !source.ok,
  ).length
  const nextMeeting = snapshot?.schedule.nextMeeting
  const signals: Array<PhoneSignalRailItem> = [
    {
      id: 'meeting',
      label: 'Meeting',
      value: nextMeeting ? relativeMinutes(nextMeeting.minutesUntil) : 'Clear',
      tone:
        nextMeeting &&
        nextMeeting.minutesUntil >= -5 &&
        nextMeeting.minutesUntil <= 20
          ? 'warn'
          : 'ok',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      value: String(snapshot?.tasks.overdue || 0),
      tone: (snapshot?.tasks.overdue ?? 0) > 0 ? 'bad' : 'ok',
    },
    {
      id: 'mail',
      label: 'Mail',
      value: String(snapshot?.inbox.unread ?? 0),
      tone: (snapshot?.inbox.focused.length ?? 0) > 0 ? 'warn' : 'ok',
    },
    {
      id: 'desk',
      label: 'Desk',
      value:
        snapshot?.devices.office.status === 'stale'
          ? 'idle'
          : (snapshot?.devices.office.status ?? 'unknown'),
      tone: snapshot?.devices.office.status === 'online' ? 'ok' : 'muted',
    },
    {
      id: 'sources',
      label: 'Sources',
      value: degradedSources ? String(degradedSources) : 'OK',
      tone: degradedSources ? 'warn' : 'ok',
    },
  ]
  return signals
}

export function buildPhoneTravelGlance(
  snapshot: PhoneCockpitSnapshot | null,
  mode: PhoneTravelMode,
) {
  const nextMeeting = snapshot?.schedule.nextMeeting
  const overdue = snapshot?.tasks.overdue ?? 0
  const focused = snapshot?.inbox.focused.length ?? 0
  const nextEvent = nextMeeting
    ? `${nextMeeting.title} ${relativeMinutes(nextMeeting.minutesUntil)}`
    : 'No meeting'
  const blockerCount =
    (snapshot?.attention.filter((item) => item.severity !== 'info').length ??
      0) + overdue
  const modeLabel =
    mode === 'driving' ? 'Driving' : mode === 'walking' ? 'Walking' : 'Standard'
  return {
    modeLabel,
    title:
      mode === 'driving'
        ? blockerCount
          ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`
          : nextEvent
        : nextEvent,
    urgentCount: overdue,
    nextEvent,
    captureLabel: mode === 'driving' ? 'Voice note' : 'Capture',
    lilyLabel: mode === 'driving' ? 'Hands-free LILY' : 'LILY mic',
    detail:
      mode === 'driving'
        ? `${overdue} overdue, ${focused} focused mail.`
        : `${overdue} overdue tasks, ${focused} focused mail, ${blockerCount} blockers.`,
  }
}

export type DailyLoopSignal = {
  id: string
  label: string
  value: string
  detail: string
  href: string
  icon: HugeIcon
  tone: 'ok' | 'warn' | 'bad' | 'muted'
  priority: number
}

export type PhoneDashboardTile = {
  id: string
  label: string
  value: string
  detail: string
  tone: 'ok' | 'warn' | 'bad' | 'muted'
  progress: number
}

export function buildPhoneCommandDashboard(
  snapshot: PhoneCockpitSnapshot | null,
  dailyLoopSignals: Array<DailyLoopSignal>,
): {
  posture: string
  nextAction: string
  nextDetail: string
  tiles: Array<PhoneDashboardTile>
  mix: Array<{ label: string; value: number; tone: PhoneDashboardTile['tone'] }>
  loopPercent: number
} {
  const overdue = snapshot?.tasks.overdue ?? 0
  const focusedMail = snapshot?.inbox.focused.length ?? 0
  const attention =
    snapshot?.attention.filter((item) => item.severity !== 'info').length ?? 0
  const degradedSources = Object.values(snapshot?.sources || {}).filter(
    (source) => !source.ok,
  ).length
  const nextMeeting = snapshot?.schedule.nextMeeting
  const openLoops = dailyLoopSignals.filter((signal) => signal.tone !== 'ok')
  const completedLoops = dailyLoopSignals.length - openLoops.length
  const loopPercent = dailyLoopSignals.length
    ? Math.round((completedLoops / dailyLoopSignals.length) * 100)
    : 0
  const totalWork = overdue + focusedMail + attention
  const posture =
    overdue || degradedSources >= 2
      ? 'Stabilize'
      : attention || focusedMail
        ? 'Triage'
        : openLoops.length
          ? 'Loop check'
          : 'Clear'
  const nextAction =
    overdue > 0
      ? 'Clear overdue task'
      : attention > 0
        ? (snapshot?.attention.find((item) => item.severity !== 'info')
            ?.title ?? 'Review attention item')
        : nextMeeting
          ? `Prep ${nextMeeting.title}`
          : openLoops[0]
            ? `Finish ${openLoops[0].label}`
            : 'Capture loose note'
  const nextDetail =
    overdue > 0
      ? `${overdue} overdue`
      : nextMeeting
        ? `${relativeMinutes(nextMeeting.minutesUntil)} · ${focusedMail} focused mail`
        : `${openLoops.length} health loops open · ${degradedSources} degraded sources`

  return {
    posture,
    nextAction,
    nextDetail,
    loopPercent,
    mix: [
      { label: 'Tasks', value: overdue, tone: overdue ? 'bad' : 'ok' },
      { label: 'Mail', value: focusedMail, tone: focusedMail ? 'warn' : 'ok' },
      { label: 'Needs', value: attention, tone: attention ? 'warn' : 'ok' },
      {
        label: 'Sources',
        value: degradedSources,
        tone: degradedSources ? 'warn' : 'ok',
      },
    ],
    tiles: [
      {
        id: 'workload',
        label: 'Workload',
        value: String(totalWork),
        detail: `${overdue} overdue · ${focusedMail} mail`,
        tone: overdue ? 'bad' : totalWork ? 'warn' : 'ok',
        progress: Math.min(100, totalWork * 18),
      },
      {
        id: 'loops',
        label: 'Loops',
        value: `${completedLoops}/${dailyLoopSignals.length || 0}`,
        detail: openLoops[0]?.label
          ? `${openLoops[0].label} next`
          : 'Daily loops clear',
        tone: openLoops.length ? 'warn' : 'ok',
        progress: loopPercent,
      },
      {
        id: 'meeting',
        label: 'Meeting',
        value: nextMeeting
          ? relativeMinutes(nextMeeting.minutesUntil)
          : 'Clear',
        detail: nextMeeting?.title ?? 'No meeting window',
        tone:
          nextMeeting &&
          nextMeeting.minutesUntil >= -5 &&
          nextMeeting.minutesUntil <= 20
            ? 'warn'
            : 'ok',
        progress: nextMeeting
          ? Math.max(8, Math.min(100, 100 - nextMeeting.minutesUntil * 2))
          : 8,
      },
      {
        id: 'sources',
        label: 'Sources',
        value: degradedSources ? String(degradedSources) : 'OK',
        detail: degradedSources ? 'Refresh before trusting' : 'Fresh enough',
        tone: degradedSources ? 'warn' : 'ok',
        progress: degradedSources ? Math.min(100, degradedSources * 24) : 100,
      },
    ],
  }
}

export function readLocalJson(key: string): unknown {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeLocalJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function mergeUnknownEntries(
  local: Array<unknown>,
  server: Array<unknown>,
) {
  const byId = new Map<string, unknown>()
  for (const entry of server) {
    if (entry && typeof entry === 'object' && 'id' in entry) {
      byId.set(String(entry.id), entry)
    }
  }
  for (const entry of local) {
    if (entry && typeof entry === 'object' && 'id' in entry) {
      byId.set(String(entry.id), entry)
    }
  }
  return Array.from(byId.values())
}

function makeLocalId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function shortLocalTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function estimatePhoneFood(description: string) {
  const text = description.toLowerCase()
  const hasLeanProtein =
    /chicken|turkey|fish|salmon|tuna|egg|greek yogurt|steak|beef/.test(text)
  const hasCarb =
    /rice|bread|tortilla|pasta|potato|oat|granola|banana|beans/.test(text)
  const hasFat = /avocado|cheese|oil|butter|nuts|peanut|mayo|dressing/.test(
    text,
  )
  const hasVegetable =
    /salad|broccoli|spinach|greens|pepper|onion|vegetable|asparagus/.test(text)
  return {
    calories:
      280 +
      (hasLeanProtein ? 180 : 0) +
      (hasCarb ? 160 : 0) +
      (hasFat ? 140 : 0) -
      (hasVegetable ? 40 : 0),
    protein: hasLeanProtein ? 38 : 12,
    carbs: hasCarb ? 42 : hasVegetable ? 14 : 22,
    fat: hasFat ? 24 : 9,
    fiber: hasVegetable ? 8 : hasCarb ? 4 : 1,
    waterOz: 0,
    confidence: Math.min(
      92,
      58 +
        [hasLeanProtein, hasCarb, hasFat, hasVegetable].filter(Boolean).length *
          8,
    ),
  }
}

export function buildPhoneDailyLoopSignals(): Array<DailyLoopSignal> {
  const today = todayKey()
  const habitState = readLocalJson(`workspace.75-tracker.quick:${today}`)
  const habitComplete =
    Boolean(habitState) &&
    typeof habitState === 'object' &&
    Object.values(habitState as Record<string, unknown>).filter(Boolean)
      .length >= 6
  const wegovyShots = readLocalJson('workspace.health.wegovy.shots')
  const zynEntries = readLocalJson('workspace.health.zyn.entries')
  const foodEntries = readLocalJson('workspace.health.food.entries')
  const zynToday = Array.isArray(zynEntries)
    ? zynEntries
        .filter((entry) => entry?.date === today)
        .reduce((sum, entry) => sum + (Number(entry?.count) || 0), 0)
    : 0
  const foodToday = Array.isArray(foodEntries)
    ? foodEntries.filter((entry) => entry?.date === today).length
    : 0
  const latestWegovy = Array.isArray(wegovyShots)
    ? [...wegovyShots].sort((a, b) =>
        String(b?.date ?? '').localeCompare(String(a?.date ?? '')),
      )[0]
    : null

  const signals: Array<DailyLoopSignal> = [
    {
      id: '75',
      label: '75',
      value: habitComplete ? 'Done' : 'Open',
      detail: habitComplete ? 'Daily loop complete' : 'Habit check pending',
      href: '/75-tracker',
      icon: Dumbbell01Icon,
      tone: habitComplete ? 'ok' : 'warn',
      priority: habitComplete ? 40 : 10,
    },
    {
      id: 'wegovy',
      label: 'Wegovy',
      value: latestWegovy?.date ?? 'Log',
      detail: latestWegovy
        ? `${latestWegovy.doseMg ?? '-'} mg`
        : 'No shot logged',
      href: '/wegovy',
      icon: InjectionIcon,
      tone: latestWegovy ? 'ok' : 'muted',
      priority: latestWegovy ? 50 : 30,
    },
    {
      id: 'zyn',
      label: 'Zyn',
      value: String(zynToday),
      detail: 'entries today',
      href: '/zyn-tracker',
      icon: Target02Icon,
      tone: zynToday ? 'warn' : 'ok',
      priority: zynToday >= 6 ? 5 : zynToday ? 20 : 45,
    },
    {
      id: 'food',
      label: 'Food',
      value: String(foodToday),
      detail: 'meals today',
      href: '/food-log',
      icon: Apple01Icon,
      tone: foodToday ? 'ok' : 'warn',
      priority: foodToday ? 35 : 8,
    },
    {
      id: 'pto',
      label: 'PTO',
      value: 'Review',
      detail: 'Team tracker',
      href: '/pto-tracker',
      icon: Calendar01Icon,
      tone: 'muted',
      priority: 70,
    },
  ]
  return signals.sort((a, b) => a.priority - b.priority)
}

export function quickLogPhoneZyn(now = new Date(), strengthMg = 3) {
  const key = 'workspace.health.zyn.entries'
  const existing = readLocalJson(key)
  const entries = Array.isArray(existing) ? existing : []
  const entry = {
    id: makeLocalId('phone-zyn'),
    date: todayKey(),
    time: shortLocalTime(now),
    count: 1,
    strengthMg,
    trigger: 'Phone quick log',
    note: '',
  }
  writeLocalJson(key, [entry, ...entries])
  return entry
}

export function quickLogPhoneFood(
  description: string,
  options: { meal?: string; barcode?: string; photoName?: string } = {},
  now = new Date(),
) {
  const trimmed = description.trim()
  if (!trimmed) return null
  const key = 'workspace.health.food.entries'
  const existing = readLocalJson(key)
  const entries = Array.isArray(existing) ? existing : []
  const entry = {
    id: makeLocalId('phone-food'),
    date: todayKey(),
    time: shortLocalTime(now),
    meal: options.meal || 'Snack',
    description: trimmed,
    barcode: options.barcode?.trim() || '',
    photoName: options.photoName?.trim() || '',
    ...estimatePhoneFood(trimmed),
  }
  writeLocalJson(key, [entry, ...entries])
  return entry
}

export function quickLogPhoneWegovy(
  now = new Date(),
  options: { doseMg?: number; site?: string } = {},
) {
  const shotsKey = 'workspace.health.wegovy.shots'
  const supplyKey = 'workspace.health.wegovy.supply'
  const existing = readLocalJson(shotsKey)
  const shots = Array.isArray(existing) ? existing : []
  const today = todayKey()
  const latest = [...shots].sort((a, b) =>
    String(b?.date ?? '').localeCompare(String(a?.date ?? '')),
  )[0]
  const alreadyLogged = shots.some((shot) => shot?.date === today)
  if (alreadyLogged) return { entry: null, alreadyLogged: true }
  const entry = {
    id: makeLocalId('phone-wegovy'),
    date: today,
    doseMg: Number(options.doseMg || latest?.doseMg) || 0.25,
    site: String(options.site || latest?.site || 'Abdomen'),
    weightLb: Number(latest?.weightLb) || 0,
    waistIn: Number(latest?.waistIn) || 0,
    appetiteBefore: 5,
    appetiteAfter: 3,
    hydrationOz: 0,
    proteinG: 0,
    constipation: false,
    nausea: false,
    headache: false,
    sideEffects: '',
    notes: `Phone quick log ${shortLocalTime(now)}`,
  }
  writeLocalJson(
    shotsKey,
    [entry, ...shots].sort((a, b) =>
      String(b?.date ?? '').localeCompare(String(a?.date ?? '')),
    ),
  )
  const supply = readLocalJson(supplyKey)
  if (typeof supply === 'number')
    writeLocalJson(supplyKey, Math.max(0, supply - 1))
  return { entry, alreadyLogged: false }
}

export function removePhoneQuickLog(
  key: string,
  id: string,
  restoreSupply = false,
) {
  const existing = readLocalJson(key)
  if (!Array.isArray(existing)) return false
  const next = existing.filter((entry) => entry?.id !== id)
  if (next.length === existing.length) return false
  writeLocalJson(key, next)
  if (restoreSupply) {
    const supply = readLocalJson('workspace.health.wegovy.supply')
    if (typeof supply === 'number') {
      writeLocalJson('workspace.health.wegovy.supply', supply + 1)
    }
  }
  return true
}

export function buildPhoneFreshnessNotice(
  checkedAt?: string | null,
  sourceWarningCount = 0,
  sources?: PhoneCockpitSnapshot['sources'],
) {
  if (sourceWarningCount) {
    return `${sourceWarningCount} source${sourceWarningCount === 1 ? '' : 's'} degraded`
  }
  const staleSource = Object.entries(sources || {})
    .map(([key, source]) => {
      const checked = Date.parse(source.checkedAt)
      const maxAge =
        PHONE_SOURCE_STALE_MINUTES[
          key as keyof PhoneCockpitSnapshot['sources']
        ] ?? 20
      if (Number.isNaN(checked)) {
        return { label: source.label, ageMinutes: Number.POSITIVE_INFINITY }
      }
      const ageMinutes = Math.round((Date.now() - checked) / 60_000)
      return ageMinutes > maxAge ? { label: source.label, ageMinutes } : null
    })
    .filter(Boolean)
    .sort((a, b) => (b?.ageMinutes ?? 0) - (a?.ageMinutes ?? 0))[0]
  if (staleSource) {
    return `${staleSource.label} stale ${
      staleSource.ageMinutes === Number.POSITIVE_INFINITY
        ? ''
        : `${staleSource.ageMinutes}m`
    }`.trim()
  }
  if (!checkedAt) return 'Not synced'
  const timestamp = Date.parse(checkedAt)
  if (Number.isNaN(timestamp)) return 'Sync unknown'
  const ageMinutes = Math.round((Date.now() - timestamp) / 60_000)
  return ageMinutes > 10 ? formatFreshness(checkedAt) : null
}

export function describeQueuedCapture(
  capture: Pick<
    QueuedCapture,
    'createdAt' | 'lastTriedAt' | 'retryCount' | 'error'
  >,
  now = Date.now(),
) {
  const createdAt = Date.parse(capture.createdAt)
  const ageMinutes = Number.isNaN(createdAt)
    ? null
    : Math.max(0, Math.round((now - createdAt) / 60_000))
  return {
    age: ageMinutes === null ? 'age unknown' : `${ageMinutes}m old`,
    retries: `${capture.retryCount ?? 0} retr${capture.retryCount === 1 ? 'y' : 'ies'}`,
    lastError: capture.error?.trim() || 'No last error',
    lastTriedAt: capture.lastTriedAt || 'not retried',
  }
}

export function toneClass(severity?: PhoneAttentionItem['severity']) {
  if (severity === 'critical')
    return 'border-[#ff9aa8]/40 bg-[#ff9aa8]/10 text-[#ffd6dc]'
  if (severity === 'warning')
    return 'border-[#f7b267]/35 bg-[#f7b267]/10 text-[#ffd39d]'
  return 'border-[#6ec6b8]/30 bg-[#6ec6b8]/10 text-[#b8fff3]'
}

export function sourceTone(ok?: boolean) {
  return ok
    ? 'border-[#6ec6b8]/25 bg-[#6ec6b8]/10 text-[#b8fff3]'
    : 'border-[#f7b267]/35 bg-[#f7b267]/10 text-[#ffd39d]'
}

export function dotClass(tone: 'ok' | 'warn' | 'bad' | 'muted') {
  if (tone === 'bad')
    return 'bg-[#ff9aa8] shadow-[0_0_10px_rgba(255,154,168,.45)]'
  if (tone === 'warn')
    return 'bg-[#f7b267] shadow-[0_0_10px_rgba(247,178,103,.35)]'
  if (tone === 'muted') return 'bg-[#78888c]'
  return 'bg-[#6ec6b8] shadow-[0_0_10px_rgba(110,198,184,.35)]'
}
