import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Alert01Icon,
  Calendar01Icon,
  Chat01Icon,
  Clock01Icon,
  ComputerIcon,
  File01Icon,
  Mail01Icon,
  Mic01Icon,
  SentIcon,
  Task01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons'
import {
  ActionLink,
  Card,
  EmptyState,
  ExternalAction,
} from './phone-cockpit-ui'
import {
  PhoneCommandDashboardSection,
  PhoneDailyLoopsSection,
  PhoneDeskModeSection,
  PhoneFastActionsSection,
  PhoneFloatingLilyAction,
  PhoneHeroSection,
  PhoneSystemStatusSection,
  PhoneTabsSection,
  PhoneThumbControlDock,
  PhoneTravelModeSection,
  PhoneViewControlsSection,
  PhoneWorkspaceShortcutsSection,
} from './phone-cockpit-sections'
import {
  DEFAULT_PHONE_COLLAPSED_CARDS,
  PHONE_COMPACT_BADGES_KEY,
  PHONE_HIGH_CONTRAST_KEY,
  PHONE_LOW_DATA_KEY,
  buildPhoneAtAGlance,
  buildPhoneCommandDashboard,
  buildPhoneDailyLoopSignals,
  buildPhoneFreshnessNotice,
  buildPhoneModeReadouts,
  buildPhoneSignalRail,
  buildPhoneTravelGlance,
  captureModeMeta,
  cx,
  describeQueuedCapture,
  fmtTime,
  formatFreshness,
  isStandalonePwa,
  mergeUnknownEntries,
  nextPhoneTab,
  quickLogPhoneFood,
  quickLogPhoneWegovy,
  quickLogPhoneZyn,
  readBooleanPreference,
  readCollapsedCards,
  readLocalJson,
  readPhoneTravelMode,
  readPinnedCards,
  readQueuedCaptures,
  relativeMinutes,
  removePhoneQuickLog,
  toggleCollapsedCardSet,
  toneClass,
  writeBooleanPreference,
  writeCollapsedCards,
  writeLocalJson,
  writePhoneTravelMode,
  writePinnedCards,
  writeQueuedCaptures,
} from './lib/phone-cockpit-helpers'
import type {
  CaptureMode,
  NotificationState,
  PhoneCardId,
  PhoneTab,
  PhoneTravelMode,
  QueuedCapture,
  QuickUndo,
} from './lib/phone-cockpit-helpers'
import type {
  PhoneAttentionItem,
  PhoneCockpitAction,
  PhoneCockpitSnapshot,
} from '@/server/phone-cockpit'
import { apiPath } from '@/lib/base-path'
import { hapticTap } from '@/lib/haptics'
import {
  HealthTrackersClientConflictError,
  fetchHealthTrackersState,
  patchHealthTrackersState,
} from '@/lib/health-trackers-client'
import { toast } from '@/components/ui/toast'

export function PhoneCockpitScreen() {
  const search = useSearch({ from: '/phone' })
  const [snapshot, setSnapshot] = useState<PhoneCockpitSnapshot | null>(null)
  const [error, setError] = useState('')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('note')
  const [activeTab, setActiveTab] = useState<PhoneTab>('today')
  const [captureText, setCaptureText] = useState('')
  const [captureSheetOpen, setCaptureSheetOpen] = useState(false)
  const [quickFoodText, setQuickFoodText] = useState('')
  const [quickFoodMeal, setQuickFoodMeal] = useState('Snack')
  const [quickFoodBarcode, setQuickFoodBarcode] = useState('')
  const [quickFoodPhotoName, setQuickFoodPhotoName] = useState('')
  const [quickZynStrengthMg, setQuickZynStrengthMg] = useState(3)
  const [quickWegovyDoseMg, setQuickWegovyDoseMg] = useState('0.25')
  const [quickWegovySite, setQuickWegovySite] = useState('Abdomen')
  const [quickUndo, setQuickUndo] = useState<QuickUndo | null>(null)
  const [dailyLoopVersion, setDailyLoopVersion] = useState(0)
  const [healthServerUpdatedAt, setHealthServerUpdatedAt] = useState<
    string | null
  >(null)
  const [draftRecipient, setDraftRecipient] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [latestPrompt, setLatestPrompt] = useState<PhoneAttentionItem | null>(
    null,
  )
  const [queuedCaptures, setQueuedCaptures] = useState<Array<QueuedCapture>>([])
  const [lastCaptureError, setLastCaptureError] = useState('')
  const [captureAnnouncement, setCaptureAnnouncement] = useState('')
  const [sourceWarningsIgnored, setSourceWarningsIgnored] = useState(false)
  const [lowDataMode, setLowDataMode] = useState(false)
  const [highContrastMode, setHighContrastMode] = useState(false)
  const [compactBadgesMode, setCompactBadgesMode] = useState(false)
  const [travelMode, setTravelMode] = useState<PhoneTravelMode>('standard')
  const [collapsedCards, setCollapsedCards] = useState<Set<PhoneCardId>>(
    () => new Set(DEFAULT_PHONE_COLLAPSED_CARDS),
  )
  const [pinnedCards, setPinnedCards] = useState<Set<PhoneCardId>>(
    () => new Set(),
  )
  const [notifications, setNotifications] = useState<NotificationState>(
    typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.permission,
  )
  const [standalonePwa, setStandalonePwa] = useState(false)
  const tabSwipeStartX = useRef<number | null>(null)
  const captureInputRef = useRef<HTMLTextAreaElement | null>(null)

  async function load() {
    try {
      const response = await fetch(apiPath('/api/phone-cockpit'), {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSnapshot((await response.json()) as PhoneCockpitSnapshot)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setStandalonePwa(isStandalonePwa())
    setQueuedCaptures(readQueuedCaptures())
    setLowDataMode(readBooleanPreference(PHONE_LOW_DATA_KEY))
    setHighContrastMode(readBooleanPreference(PHONE_HIGH_CONTRAST_KEY))
    setCompactBadgesMode(readBooleanPreference(PHONE_COMPACT_BADGES_KEY))
    setTravelMode(readPhoneTravelMode())
    setCollapsedCards(readCollapsedCards())
    setPinnedCards(readPinnedCards())
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchHealthTrackersState()
      .then((state) => {
        if (cancelled) return
        writeLocalJson('workspace.health.wegovy.shots', state.wegovy.shots)
        writeLocalJson('workspace.health.wegovy.supply', state.wegovy.supply)
        writeLocalJson('workspace.health.wegovy.refill', state.wegovy.refill)
        writeLocalJson(
          'workspace.health.wegovy.reminder',
          state.wegovy.reminder,
        )
        writeLocalJson('workspace.health.zyn.entries', state.zyn.entries)
        writeLocalJson('workspace.health.zyn.limit', state.zyn.limit)
        writeLocalJson('workspace.health.zyn.avoided', state.zyn.avoided)
        writeLocalJson('workspace.health.food.entries', state.food.entries)
        writeLocalJson('workspace.health.food.favorites', state.food.favorites)
        writeLocalJson(
          'workspace.health.food.calorie-target',
          state.food.calorieTarget,
        )
        writeLocalJson(
          'workspace.health.food.protein-target',
          state.food.proteinTarget,
        )
        setHealthServerUpdatedAt(state.updatedAt)
        setDailyLoopVersion((version) => version + 1)
      })
      .catch(() => {
        // Daily loop tiles will use the offline local cache.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!search.capture) return
    setActiveTab('today')
    setCaptureMode(search.capture)
    if (search.text) setCaptureText(search.text)
    setCaptureAnnouncement(
      `${captureModeMeta[search.capture].label} capture selected`,
    )
    window.requestAnimationFrame(() => {
      captureInputRef.current?.focus()
      hapticTap()
    })
  }, [search.capture, search.text])

  const sourceWarnings = useMemo(
    () => Object.values(snapshot?.sources || {}).filter((source) => !source.ok),
    [snapshot],
  )

  const topSignal = useMemo(() => {
    if (!snapshot) return 'Phone'
    if (snapshot.attention[0]) return snapshot.attention[0].title
    if (snapshot.schedule.nextMeeting)
      return `${snapshot.schedule.nextMeeting.title} in ${relativeMinutes(snapshot.schedule.nextMeeting.minutesUntil)}`
    if (snapshot.inbox.unread !== null)
      return `${snapshot.inbox.unread} unread mail`
    return snapshot.presence.activity || 'Clear'
  }, [snapshot])

  const modeReadouts = useMemo(
    () => buildPhoneModeReadouts(snapshot),
    [snapshot],
  )
  const atAGlance = useMemo(() => buildPhoneAtAGlance(snapshot), [snapshot])
  const signalRail = useMemo(() => buildPhoneSignalRail(snapshot), [snapshot])
  const travelGlance = useMemo(
    () => buildPhoneTravelGlance(snapshot, travelMode),
    [snapshot, travelMode],
  )
  const freshnessNotice = useMemo(
    () =>
      buildPhoneFreshnessNotice(
        snapshot?.checkedAt,
        sourceWarnings.length,
        snapshot?.sources,
      ),
    [snapshot?.checkedAt, snapshot?.sources, sourceWarnings.length],
  )
  const dailyLoopSignals = useMemo(
    () => buildPhoneDailyLoopSignals(),
    [dailyLoopVersion, snapshot],
  )
  const commandDashboard = useMemo(
    () => buildPhoneCommandDashboard(snapshot, dailyLoopSignals),
    [dailyLoopSignals, snapshot],
  )

  function persistQueuedCaptures(nextQueue: Array<QueuedCapture>) {
    setQueuedCaptures(nextQueue)
    writeQueuedCaptures(nextQueue)
  }

  function toggleLowDataMode() {
    setLowDataMode((current) => {
      const next = !current
      writeBooleanPreference(PHONE_LOW_DATA_KEY, next)
      hapticTap()
      return next
    })
  }

  function toggleHighContrastMode() {
    setHighContrastMode((current) => {
      const next = !current
      writeBooleanPreference(PHONE_HIGH_CONTRAST_KEY, next)
      hapticTap()
      return next
    })
  }

  function toggleCompactBadgesMode() {
    setCompactBadgesMode((current) => {
      const next = !current
      writeBooleanPreference(PHONE_COMPACT_BADGES_KEY, next)
      hapticTap()
      return next
    })
  }

  function changeTravelMode(mode: PhoneTravelMode) {
    setTravelMode(mode)
    writePhoneTravelMode(mode)
    hapticTap()
    setCaptureAnnouncement(
      mode === 'standard'
        ? 'Normal phone view selected'
        : `${mode} glance selected`,
    )
  }

  function toggleCardCollapsed(cardId: PhoneCardId) {
    setCollapsedCards((current) => {
      const next = toggleCollapsedCardSet(current, cardId)
      writeCollapsedCards(next)
      hapticTap()
      return next
    })
  }

  function isCollapsed(cardId: PhoneCardId) {
    return collapsedCards.has(cardId)
  }

  function toggleCardPinned(cardId: PhoneCardId) {
    setPinnedCards((current) => {
      const next = new Set(current)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      writePinnedCards(next)
      hapticTap()
      return next
    })
  }

  function isPinned(cardId: PhoneCardId) {
    return pinnedCards.has(cardId)
  }

  function queueCapture(
    payload: PhoneCockpitAction,
    mode: CaptureMode,
    label: string,
    error: string,
  ) {
    const nextQueue = [
      ...queuedCaptures,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        mode,
        label,
        payload,
        error,
      },
    ]
    setLastCaptureError(error)
    persistQueuedCaptures(nextQueue)
  }

  async function postCapture(payload: PhoneCockpitAction) {
    const response = await fetch(apiPath('/api/phone-cockpit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(body?.error || `HTTP ${response.status}`)
    }
  }

  async function retryQueuedCaptures() {
    if (!queuedCaptures.length) return
    setSaving(true)
    const failed: Array<QueuedCapture> = []
    for (const capture of queuedCaptures) {
      try {
        await postCapture(capture.payload)
      } catch (err) {
        failed.push({
          ...capture,
          retryCount: (capture.retryCount ?? 0) + 1,
          lastTriedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    persistQueuedCaptures(failed)
    if (failed.length) {
      const message = failed[0]?.error || 'Sync failed'
      setLastCaptureError(message)
      toast(
        `${failed.length} queued capture${failed.length === 1 ? '' : 's'} still offline.`,
        {
          type: 'warning',
        },
      )
    } else {
      setLastCaptureError('')
      setCaptureSheetOpen(false)
      hapticTap()
      toast('Offline queue synced.', { type: 'success' })
      void load()
    }
    setSaving(false)
  }

  useEffect(() => {
    if (!snapshot || notifications !== 'granted') return
    const nextPrompt = snapshot.attention.find(
      (item) => item.severity !== 'info',
    )
    if (!nextPrompt || latestPrompt?.id === nextPrompt.id) return
    setLatestPrompt(nextPrompt)
    new Notification(nextPrompt.title, {
      body: nextPrompt.body,
      tag: nextPrompt.id,
    })
  }, [latestPrompt?.id, notifications, snapshot])

  async function submitCapture() {
    const text = captureText.trim()
    if (!text) {
      toast('Add text first.', { type: 'warning' })
      return
    }
    setSaving(true)
    try {
      if (captureMode === 'draft') {
        const ok = window.confirm(
          'Queue this draft for later review? Nothing will be sent.',
        )
        if (!ok) return
      }
      const payload: PhoneCockpitAction =
        captureMode === 'note'
          ? { kind: 'note' as const, text, source: 'phone-pwa' }
          : captureMode === 'task'
            ? {
                kind: 'task' as const,
                title: text,
                priority: 'medium' as const,
              }
            : {
                kind: 'draft' as const,
                recipient: draftRecipient.trim() || undefined,
                subject: draftSubject.trim() || undefined,
                body: text,
              }
      const label =
        captureMode === 'task'
          ? text
          : captureMode === 'draft'
            ? draftSubject.trim() || draftRecipient.trim() || 'Draft'
            : text
      await postCapture(payload)
      setCaptureText('')
      setDraftRecipient('')
      setDraftSubject('')
      setLastCaptureError('')
      hapticTap()
      toast(
        captureMode === 'draft' ? 'Draft queued for review.' : 'Captured.',
        {
          type: 'success',
        },
      )
      void load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture failed'
      const payload =
        captureMode === 'note'
          ? { kind: 'note' as const, text, source: 'phone-pwa-offline' }
          : captureMode === 'task'
            ? {
                kind: 'task' as const,
                title: text,
                priority: 'medium' as const,
              }
            : {
                kind: 'draft' as const,
                recipient: draftRecipient.trim() || undefined,
                subject: draftSubject.trim() || undefined,
                body: text,
              }
      const label =
        captureMode === 'task'
          ? text
          : captureMode === 'draft'
            ? draftSubject.trim() || draftRecipient.trim() || 'Draft'
            : text
      queueCapture(payload, captureMode, label, message)
      setCaptureSheetOpen(false)
      toast('Saved offline. Retry when back online.', {
        type: 'warning',
      })
    } finally {
      setSaving(false)
    }
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      setNotifications('unsupported')
      return
    }
    const result = await Notification.requestPermission()
    setNotifications(result)
    if (result === 'granted') {
      new Notification('Hermes phone alerts', {
        body: 'Only critical local alerts from this PWA will notify.',
      })
    }
  }

  function openCapture(mode: CaptureMode, text = '') {
    setActiveTab('today')
    setCaptureMode(mode)
    setCaptureText(text)
    setCaptureSheetOpen(true)
    setCaptureAnnouncement(`${captureModeMeta[mode].label} capture selected`)
    window.requestAnimationFrame(() => captureInputRef.current?.focus())
    hapticTap()
  }

  function replyLater(
    message: PhoneCockpitSnapshot['inbox']['focused'][number],
  ) {
    setActiveTab('today')
    setCaptureMode('draft')
    setDraftRecipient(message.sender)
    setDraftSubject(`Re: ${message.subject}`)
    setCaptureText(`Reply intent: ${message.subject}`)
    setCaptureSheetOpen(true)
    setCaptureAnnouncement(
      'Reply Later draft intent filled from focused inbox message',
    )
    window.requestAnimationFrame(() => captureInputRef.current?.focus())
    hapticTap()
  }

  function closeoutCapture() {
    setActiveTab('today')
    setCaptureMode('task')
    setCaptureText(
      'Closeout: turn loose notes into tomorrow tasks. Review inbox, calendar prep, and open captures.',
    )
    setCaptureSheetOpen(true)
    setCaptureAnnouncement('Closeout capture ready')
    window.requestAnimationFrame(() => captureInputRef.current?.focus())
    hapticTap()
  }

  function refreshDailyLoops(message: string, undo?: QuickUndo) {
    setDailyLoopVersion((version) => version + 1)
    setQuickUndo(undo ?? null)
    hapticTap()
    toast(message, { type: 'success' })
  }

  function syncPhoneHealthPatch() {
    const shots = readLocalJson('workspace.health.wegovy.shots')
    const supply = readLocalJson('workspace.health.wegovy.supply')
    const zynEntries = readLocalJson('workspace.health.zyn.entries')
    const foodEntries = readLocalJson('workspace.health.food.entries')

    const patch = {
      wegovy: {
        ...(Array.isArray(shots) ? { shots } : {}),
        ...(typeof supply === 'number' ? { supply } : {}),
      },
      zyn: Array.isArray(zynEntries) ? { entries: zynEntries } : undefined,
      food: Array.isArray(foodEntries) ? { entries: foodEntries } : undefined,
    }

    void patchHealthTrackersState(patch, healthServerUpdatedAt)
      .then((state) => setHealthServerUpdatedAt(state.updatedAt))
      .catch((error) => {
        if (error instanceof HealthTrackersClientConflictError) {
          const mergedZyn =
            Array.isArray(zynEntries) &&
            Array.isArray(error.current.zyn.entries)
              ? mergeUnknownEntries(zynEntries, error.current.zyn.entries)
              : zynEntries
          const mergedFood =
            Array.isArray(foodEntries) &&
            Array.isArray(error.current.food.entries)
              ? mergeUnknownEntries(foodEntries, error.current.food.entries)
              : foodEntries
          const mergedShots =
            Array.isArray(shots) && Array.isArray(error.current.wegovy.shots)
              ? mergeUnknownEntries(shots, error.current.wegovy.shots)
              : shots
          if (Array.isArray(mergedZyn)) {
            writeLocalJson('workspace.health.zyn.entries', mergedZyn)
          }
          if (Array.isArray(mergedFood)) {
            writeLocalJson('workspace.health.food.entries', mergedFood)
          }
          if (Array.isArray(mergedShots)) {
            writeLocalJson('workspace.health.wegovy.shots', mergedShots)
          }
          setHealthServerUpdatedAt(error.current.updatedAt)
          setDailyLoopVersion((version) => version + 1)
          void patchHealthTrackersState(
            {
              wegovy: {
                ...(Array.isArray(mergedShots) ? { shots: mergedShots } : {}),
                ...(typeof supply === 'number' ? { supply } : {}),
              },
              zyn: Array.isArray(mergedZyn)
                ? { entries: mergedZyn }
                : undefined,
              food: Array.isArray(mergedFood)
                ? { entries: mergedFood }
                : undefined,
            },
            error.current.updatedAt,
          )
            .then((state) => setHealthServerUpdatedAt(state.updatedAt))
            .catch(() => {
              // Local storage remains the offline cache.
            })
        }
      })
  }

  function logQuickZyn() {
    const entry = quickLogPhoneZyn(new Date(), quickZynStrengthMg)
    syncPhoneHealthPatch()
    refreshDailyLoops('Zyn logged.', {
      label: 'Undo Zyn',
      action: () => {
        removePhoneQuickLog('workspace.health.zyn.entries', entry.id)
        syncPhoneHealthPatch()
      },
    })
  }

  function logQuickWegovy() {
    const result = quickLogPhoneWegovy(new Date(), {
      doseMg: Number(quickWegovyDoseMg),
      site: quickWegovySite,
    })
    if (result.alreadyLogged) {
      toast('Wegovy already logged today.', { type: 'warning' })
      return
    }
    if (!result.entry) return
    syncPhoneHealthPatch()
    refreshDailyLoops('Wegovy shot logged.', {
      label: 'Undo Wegovy',
      action: () => {
        removePhoneQuickLog(
          'workspace.health.wegovy.shots',
          result.entry.id,
          true,
        )
        syncPhoneHealthPatch()
      },
    })
  }

  function logQuickFood() {
    const entry = quickLogPhoneFood(quickFoodText, {
      meal: quickFoodMeal,
      barcode: quickFoodBarcode,
      photoName: quickFoodPhotoName,
    })
    if (!entry) {
      toast('Enter food first.', { type: 'warning' })
      return
    }
    setQuickFoodText('')
    setQuickFoodBarcode('')
    setQuickFoodPhotoName('')
    syncPhoneHealthPatch()
    refreshDailyLoops('Food logged.', {
      label: 'Undo food',
      action: () => {
        removePhoneQuickLog('workspace.health.food.entries', entry.id)
        syncPhoneHealthPatch()
      },
    })
  }

  function undoQuickLog() {
    if (!quickUndo) return
    quickUndo.action()
    const label = quickUndo.label
    setQuickUndo(null)
    setDailyLoopVersion((version) => version + 1)
    hapticTap()
    toast(`${label} complete.`, { type: 'success' })
  }

  function handleTabTouchStart(event: React.TouchEvent<HTMLElement>) {
    tabSwipeStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleTabTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = tabSwipeStartX.current
    tabSwipeStartX.current = null
    if (start === null) return
    const end = event.changedTouches[0]?.clientX ?? start
    const delta = end - start
    if (Math.abs(delta) < 48) return
    setActiveTab((current) => {
      const next = nextPhoneTab(current, delta < 0 ? 'next' : 'previous')
      if (next !== current) hapticTap()
      return next
    })
  }

  const attention = snapshot?.attention || []
  const highValueMail = snapshot?.inbox.focused || []
  const taskItems = snapshot?.tasks.items || []
  const nextMeeting = snapshot?.schedule.nextMeeting
  const showMeetingPrep = Boolean(
    snapshot?.meetingPrep.openActionItems.length ||
    snapshot?.meetingPrep.lastMeetingSummary?.summary,
  )

  return (
    <div
      className={cx(
        'min-h-full bg-[#070b0f] text-[#e8eeee]',
        highContrastMode && 'bg-black text-white',
      )}
    >
      <PhoneFloatingLilyAction />
      <main
        className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-3 pb-[calc(176px+env(safe-area-inset-bottom))] pt-[calc(8px+env(safe-area-inset-top))] md:gap-3 md:pb-[calc(112px+env(safe-area-inset-bottom))] md:pt-[calc(10px+env(safe-area-inset-top))]"
        onTouchStart={handleTabTouchStart}
        onTouchEnd={handleTabTouchEnd}
      >
        <PhoneHeroSection
          topSignal={topSignal}
          freshnessNotice={freshnessNotice}
          signalRail={signalRail}
          compactBadgesMode={compactBadgesMode}
          snapshot={snapshot}
          atAGlance={atAGlance}
          error={error}
          onRetry={() => void load()}
        />

        <PhoneCommandDashboardSection
          posture={commandDashboard.posture}
          nextAction={commandDashboard.nextAction}
          nextDetail={commandDashboard.nextDetail}
          tiles={commandDashboard.tiles}
          mix={commandDashboard.mix}
          loopPercent={commandDashboard.loopPercent}
          onOpenNeeds={() => setActiveTab('today')}
          onOpenCapture={() => openCapture('note')}
        />

        <PhoneViewControlsSection
          lowDataMode={lowDataMode}
          highContrastMode={highContrastMode}
          compactBadgesMode={compactBadgesMode}
          travelMode={travelMode}
          sourceWarningsIgnored={sourceWarningsIgnored}
          sourceWarningsCount={sourceWarnings.length}
          onToggleLowDataMode={toggleLowDataMode}
          onToggleHighContrastMode={toggleHighContrastMode}
          onToggleCompactBadgesMode={toggleCompactBadgesMode}
          onTravelModeChange={changeTravelMode}
        />

        <PhoneFastActionsSection
          onOpenNeeds={() => setActiveTab('today')}
          onOpenCapture={() => openCapture('note')}
        />

        {travelMode !== 'standard' ? (
          <PhoneTravelModeSection
            glance={travelGlance}
            onOpenCapture={() =>
              openCapture(travelMode === 'driving' ? 'note' : 'task')
            }
          />
        ) : null}

        {travelMode === 'standard' ? (
          <PhoneDailyLoopsSection
            collapsed={isCollapsed('dailyloops')}
            pinned={isPinned('dailyloops')}
            dailyLoopSignals={dailyLoopSignals}
            quickZynStrengthMg={quickZynStrengthMg}
            quickWegovyDoseMg={quickWegovyDoseMg}
            quickWegovySite={quickWegovySite}
            quickFoodMeal={quickFoodMeal}
            quickFoodBarcode={quickFoodBarcode}
            quickFoodPhotoName={quickFoodPhotoName}
            quickFoodText={quickFoodText}
            quickUndo={quickUndo}
            onTogglePinned={toggleCardPinned}
            onToggleCollapsed={toggleCardCollapsed}
            onLogQuickZyn={logQuickZyn}
            onLogQuickWegovy={logQuickWegovy}
            onLogQuickFood={logQuickFood}
            onUndoQuickLog={undoQuickLog}
            onQuickZynStrengthChange={setQuickZynStrengthMg}
            onQuickWegovyDoseChange={setQuickWegovyDoseMg}
            onQuickWegovySiteChange={setQuickWegovySite}
            onQuickFoodMealChange={setQuickFoodMeal}
            onQuickFoodBarcodeChange={setQuickFoodBarcode}
            onQuickFoodPhotoNameChange={setQuickFoodPhotoName}
            onQuickFoodTextChange={setQuickFoodText}
          />
        ) : null}

        {travelMode === 'standard' ? (
          <div className="hidden md:block">
            <PhoneTabsSection
              activeTab={activeTab}
              compactBadgesMode={compactBadgesMode}
              onChange={(tab) => {
                hapticTap()
                setActiveTab(tab)
              }}
            />
          </div>
        ) : null}

        {travelMode === 'standard' && !captureSheetOpen ? (
          <PhoneThumbControlDock
            activeTab={activeTab}
            onChangeTab={(tab) => {
              hapticTap()
              setActiveTab(tab)
            }}
            onOpenCapture={() => openCapture('note')}
          />
        ) : null}

        {travelMode === 'standard' &&
        !compactBadgesMode &&
        activeTab === 'today' ? (
          <>
            <Card
              cardId="needs"
              title="Needs Tyler"
              kicker={attention.length ? `${attention.length}` : 'Clear'}
              freshness={formatFreshness(snapshot?.checkedAt)}
              icon={Alert01Icon}
              collapsed={isCollapsed('needs')}
              pinned={isPinned('needs')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
            >
              {attention.length ? (
                <ul className="space-y-2" aria-live="polite">
                  {attention.map((item) => (
                    <li
                      key={item.id}
                      className={cx(
                        'rounded-[8px] border px-3 py-2.5',
                        toneClass(item.severity),
                      )}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{item.title}</p>
                          {item.body ? (
                            <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-current/90">
                              {item.body}
                            </p>
                          ) : null}
                        </div>
                        <ExternalAction item={item} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-sm font-semibold text-[#b7c6c9] sm:hidden">
                    Clear.
                  </p>
                  <div className="hidden sm:block">
                    <EmptyState>
                      No urgent meeting, task, mail, or source issues right now.
                    </EmptyState>
                  </div>
                </>
              )}
            </Card>

            <div className="hidden gap-2.5 md:grid md:grid-cols-2">
              <Card
                cardId="modes"
                title="Commute mode"
                kicker="Readout"
                freshness={formatFreshness(snapshot?.checkedAt)}
                icon={Clock01Icon}
                collapsed={isCollapsed('modes')}
                pinned={isPinned('modes')}
                onTogglePinned={toggleCardPinned}
                onToggleCollapsed={toggleCardCollapsed}
              >
                <div className="space-y-2 text-sm leading-6 text-[#d7e2e4]">
                  <p className="font-medium text-white">
                    {modeReadouts.commute.title}
                  </p>
                  <p>{modeReadouts.commute.detail}</p>
                  <ActionLink
                    to="/lily"
                    label="Open Lily readout"
                    className="w-full gap-2"
                  >
                    <HugeiconsIcon
                      icon={Video01Icon}
                      size={16}
                      aria-hidden="true"
                    />
                    Read me the day
                  </ActionLink>
                  <ActionLink
                    to="/lily"
                    label="Ask Lily what am I forgetting"
                    className="w-full gap-2"
                  >
                    <HugeiconsIcon
                      icon={Alert01Icon}
                      size={16}
                      aria-hidden="true"
                    />
                    What am I forgetting?
                  </ActionLink>
                </div>
              </Card>

              <Card
                cardId="modes"
                title="Meeting mode"
                kicker={modeReadouts.meeting.active ? 'Now' : 'Standby'}
                freshness={formatFreshness(
                  snapshot?.sources.calendar?.checkedAt,
                )}
                icon={Calendar01Icon}
                collapsed={isCollapsed('modes')}
                pinned={isPinned('modes')}
                onTogglePinned={toggleCardPinned}
                onToggleCollapsed={toggleCardCollapsed}
              >
                <div className="space-y-2 text-sm leading-6 text-[#d7e2e4]">
                  <p className="font-medium text-white">
                    {modeReadouts.meeting.title}
                  </p>
                  <p>{modeReadouts.meeting.detail}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ActionLink to="/meetings" label="Open meeting prep">
                      <HugeiconsIcon
                        icon={File01Icon}
                        size={16}
                        aria-hidden="true"
                      />{' '}
                      Prep
                    </ActionLink>
                    {nextMeeting?.joinUrl ? (
                      <a
                        href={nextMeeting.joinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
                      >
                        <HugeiconsIcon
                          icon={Video01Icon}
                          size={16}
                          aria-hidden="true"
                        />
                        Join
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="min-h-11 rounded-[8px] border border-white/10 bg-white/[0.02] px-3 text-sm font-medium text-[#78888c]"
                      >
                        No join link
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <Card
              cardId="capture"
              title="Capture"
              kicker={
                queuedCaptures.length
                  ? `${queuedCaptures.length} queued`
                  : captureModeMeta[captureMode].label
              }
              freshness="Offline queue"
              icon={Add01Icon}
              className="hidden md:block"
              collapsed={isCollapsed('capture')}
              pinned={isPinned('capture')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
            >
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="Capture type"
              >
                {(['note', 'task', 'draft'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={captureMode === mode}
                    onClick={() => setCaptureMode(mode)}
                    className={cx(
                      'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[8px] border px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70',
                      captureMode === mode
                        ? 'border-[#8ee7d5] bg-[#8ee7d5]/15 text-[#b8fff3]'
                        : 'border-white/10 bg-white/[0.04] text-[#cbd8da]',
                    )}
                  >
                    <HugeiconsIcon
                      icon={captureModeMeta[mode].icon}
                      size={15}
                      aria-hidden="true"
                    />
                    <span>{captureModeMeta[mode].label}</span>
                  </button>
                ))}
              </div>
              {captureMode === 'draft' ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium text-[#b7c6c9]">
                    Recipient
                    <input
                      name="draft-recipient"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      spellCheck={false}
                      value={draftRecipient}
                      onChange={(event) =>
                        setDraftRecipient(event.target.value)
                      }
                      placeholder="person@example.com…"
                      className="min-h-11 rounded-[8px] border border-white/10 bg-[#080c10] px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-[#b7c6c9]">
                    Subject
                    <input
                      name="draft-subject"
                      autoComplete="off"
                      value={draftSubject}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      placeholder="Reply topic…"
                      className="min-h-11 rounded-[8px] border border-white/10 bg-[#080c10] px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
                    />
                  </label>
                </div>
              ) : null}
              <label className="mt-2.5 grid gap-1 text-xs font-medium text-[#b7c6c9]">
                {captureMode === 'task'
                  ? 'Task'
                  : captureMode === 'draft'
                    ? 'Draft body'
                    : 'Note'}
                <textarea
                  ref={captureInputRef}
                  name="phone-capture"
                  value={captureText}
                  onChange={(event) => setCaptureText(event.target.value)}
                  placeholder={
                    captureMode === 'note'
                      ? 'Remember this…'
                      : captureMode === 'task'
                        ? 'Add a task…'
                        : 'Draft the reply…'
                  }
                  rows={3}
                  className="w-full resize-none rounded-[8px] border border-white/10 bg-[#080c10] px-3 py-3 text-base leading-6 text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
                />
              </label>
              <div aria-live="polite" className="sr-only">
                {captureAnnouncement}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                {(['task', 'note', 'draft'] as const).map((mode) => (
                  <button
                    key={`one-tap-${mode}`}
                    type="button"
                    onClick={() => openCapture(mode)}
                    className="min-h-10 rounded-[8px] border border-white/10 bg-white/[0.04] px-2 font-medium text-[#dbe7e8]"
                  >
                    {captureModeMeta[mode].label}
                  </button>
                ))}
                <ActionLink to="/meetings" label="Create meeting prep">
                  Prep
                </ActionLink>
              </div>
              <button
                type="button"
                onClick={() => void submitCapture()}
                disabled={saving}
                className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#8ee7d5] px-4 text-sm font-semibold text-[#071111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 disabled:opacity-60"
              >
                <HugeiconsIcon
                  icon={captureMode === 'draft' ? SentIcon : Add01Icon}
                  size={16}
                  aria-hidden="true"
                />
                {saving
                  ? 'Saving…'
                  : captureMode === 'task'
                    ? 'Add task'
                    : captureMode === 'draft'
                      ? 'Queue draft'
                      : 'Save note'}
              </button>
              {queuedCaptures.length ? (
                <div
                  role="status"
                  className="mt-2.5 rounded-[8px] border border-[#f7b267]/35 bg-[#f7b267]/10 p-3 text-sm leading-5 text-[#ffd39d]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        Sync failed: {queuedCaptures.length} queued capture
                        {queuedCaptures.length === 1 ? '' : 's'}
                      </p>
                      <p className="mt-1 line-clamp-2 break-words">
                        Offline queue saved locally
                        {lastCaptureError ? ` · ${lastCaptureError}` : ''}
                      </p>
                      <div className="mt-2 space-y-1 text-xs">
                        {queuedCaptures.slice(0, 3).map((capture) => {
                          const status = describeQueuedCapture(capture)
                          return (
                            <p key={capture.id}>
                              {capture.label}: {status.age} · {status.retries} ·
                              last error {status.lastError}
                            </p>
                          )
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void retryQueuedCaptures()}
                      disabled={saving}
                      className="min-h-10 shrink-0 rounded-[8px] border border-[#f7b267]/45 px-3 text-xs font-semibold text-[#ffe0b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b267]/70 disabled:opacity-60"
                    >
                      Retry sync
                    </button>
                  </div>
                </div>
              ) : null}
              {captureMode === 'draft' ? (
                <p className="mt-2 text-xs leading-5 text-[#b7c6c9]">
                  Drafts become tasks for later review. Nothing is sent from
                  this screen.
                </p>
              ) : null}
              <ActionLink
                to="/lily"
                label="Open LILY voice capture"
                className="mt-2.5 w-full gap-2"
              >
                <HugeiconsIcon
                  icon={Video01Icon}
                  size={16}
                  aria-hidden="true"
                />
                Voice capture with LILY
              </ActionLink>
              <button
                type="button"
                onClick={closeoutCapture}
                className="mt-2.5 min-h-11 w-full rounded-[8px] border border-[#8ee7d5]/40 bg-[#8ee7d5]/10 px-3 text-sm font-medium text-[#b8fff3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
              >
                Closeout capture for tomorrow
              </button>
            </Card>

            {!lowDataMode ? (
              <div className="hidden gap-2.5 md:grid md:grid-cols-2">
                <Card
                  cardId="meeting"
                  title="Next meeting"
                  kicker={
                    nextMeeting
                      ? relativeMinutes(nextMeeting.minutesUntil)
                      : 'None'
                  }
                  freshness={formatFreshness(
                    snapshot?.sources.calendar?.checkedAt,
                  )}
                  icon={Calendar01Icon}
                  collapsed={isCollapsed('meeting')}
                  pinned={isPinned('meeting')}
                  onTogglePinned={toggleCardPinned}
                  onToggleCollapsed={toggleCardCollapsed}
                >
                  {nextMeeting ? (
                    <div className="space-y-2.5 text-sm">
                      <div>
                        <p className="line-clamp-2 break-words text-base font-semibold text-white">
                          {nextMeeting.title}
                        </p>
                        <p className="mt-1 text-[#b7c6c9]">
                          {fmtTime(nextMeeting.date)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ActionLink to="/meetings" label="Open meeting prep">
                          <HugeiconsIcon
                            icon={File01Icon}
                            size={16}
                            aria-hidden="true"
                          />{' '}
                          Prep
                        </ActionLink>
                        {nextMeeting.joinUrl ? (
                          <a
                            href={nextMeeting.joinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
                          >
                            <HugeiconsIcon
                              icon={Video01Icon}
                              size={16}
                              aria-hidden="true"
                            />
                            Join
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="min-h-11 rounded-[8px] border border-white/10 bg-white/[0.02] px-3 text-sm font-medium text-[#78888c]"
                          >
                            No join link
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <EmptyState>
                      No upcoming meeting in the current Hermes window.
                    </EmptyState>
                  )}
                </Card>
              </div>
            ) : null}

            {showMeetingPrep && !lowDataMode ? (
              <Card
                cardId="prep"
                title="Meeting prep"
                className="hidden md:block"
                kicker={`${snapshot?.meetingPrep.openActionItems.length ?? 0} actions`}
                freshness={formatFreshness(
                  snapshot?.sources.meetingPrep?.checkedAt,
                )}
                icon={Clock01Icon}
                collapsed={isCollapsed('prep')}
                pinned={isPinned('prep')}
                onTogglePinned={toggleCardPinned}
                onToggleCollapsed={toggleCardCollapsed}
              >
                <div className="space-y-2.5">
                  <p className="line-clamp-2 break-words text-sm font-medium text-white">
                    {snapshot?.meetingPrep.meetingTitle ||
                      snapshot?.meetingPrep.message ||
                      'Prep available'}
                  </p>
                  {snapshot?.meetingPrep.openActionItems.length ? (
                    <ul className="space-y-2">
                      {snapshot.meetingPrep.openActionItems
                        .slice(0, 3)
                        .map((item) => (
                          <li
                            key={item.id}
                            className="line-clamp-2 rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm leading-5 text-[#d7e2e4]"
                          >
                            {item.text}
                            {item.assignee ? (
                              <span className="text-[#8ee7d5]">
                                {' '}
                                — {item.assignee}
                              </span>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  {snapshot?.meetingPrep.lastMeetingSummary?.summary ? (
                    <p className="line-clamp-3 rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm leading-5 text-[#d7e2e4]">
                      {snapshot.meetingPrep.lastMeetingSummary.summary}
                    </p>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </>
        ) : null}

        {travelMode === 'standard' &&
        !compactBadgesMode &&
        activeTab === 'work' ? (
          <div className="grid gap-2.5 md:grid-cols-2">
            <Card
              cardId="triage"
              title="Task triage sheet"
              kicker={`${snapshot?.tasks.today ?? 0} today`}
              freshness={formatFreshness(snapshot?.sources.tasks?.checkedAt)}
              icon={Task01Icon}
              collapsed={isCollapsed('triage')}
              pinned={isPinned('triage')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
            >
              <div className="space-y-2 text-sm text-[#d7e2e4]">
                {[
                  ['Overdue', snapshot?.tasks.overdue ?? 0],
                  ['Urgent', snapshot?.tasks.urgent ?? 0],
                  ['Today', snapshot?.tasks.today ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-[8px] bg-white/[0.04] px-3 py-2.5"
                  >
                    <span className="font-medium text-white">{label}</span>
                    <span className="tabular-nums text-[#8ee7d5]">{value}</span>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openCapture('task')}
                    className="min-h-11 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
                  >
                    Add next task
                  </button>
                  <ActionLink to="/tasks" label="Open full task board">
                    Open board
                  </ActionLink>
                </div>
              </div>
            </Card>

            {!lowDataMode ? (
              <Card
                cardId="tasks"
                title="Tasks"
                kicker={`${snapshot?.tasks.total ?? 0} open`}
                freshness={formatFreshness(snapshot?.sources.tasks?.checkedAt)}
                icon={Task01Icon}
                collapsed={isCollapsed('tasks')}
                pinned={isPinned('tasks')}
                onTogglePinned={toggleCardPinned}
                onToggleCollapsed={toggleCardCollapsed}
              >
                {taskItems.length ? (
                  <ul className="space-y-2">
                    {taskItems.slice(0, 5).map((task) => (
                      <li
                        key={task.id}
                        className="rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0 break-words font-medium text-white">
                            {task.title}
                          </span>
                          <span className="shrink-0 text-xs uppercase text-[#8ee7d5]">
                            {task.priority}
                          </span>
                        </div>
                        {task.dueDate ? (
                          <p className="mt-0.5 text-xs text-[#b7c6c9]">
                            Due {task.dueDate}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>No open Hermes tasks.</EmptyState>
                )}
              </Card>
            ) : null}
            <Card
              cardId="reply"
              title="Reply later queue"
              kicker={`${highValueMail.length} candidates`}
              freshness={formatFreshness(snapshot?.sources.mail?.checkedAt)}
              icon={Mail01Icon}
              collapsed={isCollapsed('reply')}
              pinned={isPinned('reply')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
            >
              <p className="mb-2 text-xs leading-5 text-[#b7c6c9]">
                Reply intent auto-fills from focused inbox messages before the
                draft is queued for review.
              </p>
              {highValueMail.length ? (
                <ul className="space-y-2">
                  {highValueMail.slice(0, 3).map((message) => (
                    <li
                      key={`reply-${message.receivedDateTime}-${message.subject}`}
                      className="rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm"
                    >
                      <p className="line-clamp-1 font-medium text-white">
                        {message.subject}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-xs text-[#b7c6c9]">
                          {message.sender}
                        </span>
                        <button
                          type="button"
                          onClick={() => replyLater(message)}
                          className="min-h-10 shrink-0 rounded-[8px] border border-white/10 px-3 text-xs font-semibold text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
                        >
                          Reply later
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>No mail needs a reply-later draft.</EmptyState>
              )}
            </Card>

            {!lowDataMode ? (
              <Card
                cardId="mail"
                title="Important mail"
                kicker={
                  snapshot?.inbox.warning
                    ? 'Warning'
                    : `${highValueMail.length}`
                }
                freshness={formatFreshness(snapshot?.sources.mail?.checkedAt)}
                icon={Mail01Icon}
                collapsed={isCollapsed('mail')}
                pinned={isPinned('mail')}
                onTogglePinned={toggleCardPinned}
                onToggleCollapsed={toggleCardCollapsed}
              >
                {highValueMail.length ? (
                  <ul className="space-y-2">
                    {highValueMail.slice(0, 3).map((message) => (
                      <li
                        key={`${message.receivedDateTime}-${message.subject}`}
                      >
                        <a
                          href={message.webLink || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.99]"
                        >
                          <span className="block truncate font-medium text-white">
                            {message.subject}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[#b7c6c9]">
                            {message.sender} ·{' '}
                            {message.isRead ? 'read' : 'unread'} ·{' '}
                            {message.importance || 'normal'}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : snapshot?.inbox.warning ? (
                  <p role="alert" className="text-sm text-[#ffb0bb]">
                    {snapshot.inbox.warning}
                  </p>
                ) : (
                  <EmptyState>
                    No unread high-importance or recent actionable mail.
                  </EmptyState>
                )}
              </Card>
            ) : null}

            <Card
              cardId="connectwise"
              title="ConnectWise urgent"
              kicker="Ops"
              freshness="Live queue shortcut"
              icon={ComputerIcon}
              collapsed={isCollapsed('connectwise')}
              pinned={isPinned('connectwise')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
            >
              <div className="space-y-2 text-sm leading-6 text-[#d7e2e4]">
                <p>
                  Jump straight to the IT Ops surface for urgent tickets and
                  approval checks.
                </p>
                <ActionLink
                  to="/it-ops"
                  label="Open ConnectWise urgent queue"
                  className="w-full"
                >
                  Open ConnectWise
                </ActionLink>
              </div>
            </Card>
          </div>
        ) : null}

        {travelMode === 'standard' &&
        !compactBadgesMode &&
        activeTab === 'systems' ? (
          <>
            <PhoneDeskModeSection
              title={modeReadouts.desk.title}
              detail={modeReadouts.desk.detail}
              online={modeReadouts.desk.online}
              freshness={formatFreshness(snapshot?.devices.office.checkedAt)}
              collapsed={isCollapsed('desk')}
              pinned={isPinned('desk')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
              onAwayMode={() => {
                setActiveTab('today')
                setCaptureMode('note')
                setCaptureText(
                  'Away mode: I am away from desk. Route urgent items to phone/LILY.',
                )
                hapticTap()
              }}
            />

            <PhoneSystemStatusSection
              snapshot={snapshot}
              sourceWarningsCount={sourceWarnings.length}
              sourceWarningsIgnored={sourceWarningsIgnored}
              notifications={notifications}
              standalonePwa={standalonePwa}
              collapsed={isCollapsed('status')}
              pinned={isPinned('status')}
              onTogglePinned={toggleCardPinned}
              onToggleCollapsed={toggleCardCollapsed}
              onRetrySources={() => void load()}
              onToggleSourceWarningsIgnored={() =>
                setSourceWarningsIgnored((value) => !value)
              }
              onEnableNotifications={() => void enableNotifications()}
            />

            {!lowDataMode ? (
              <PhoneWorkspaceShortcutsSection
                collapsed={isCollapsed('shortcuts')}
                pinned={isPinned('shortcuts')}
                onTogglePinned={toggleCardPinned}
                onToggleCollapsed={toggleCardCollapsed}
              />
            ) : null}
          </>
        ) : null}
      </main>
      {captureSheetOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${captureModeMeta[captureMode].label} capture`}
          onClick={() => setCaptureSheetOpen(false)}
        >
          <div
            className="absolute inset-x-3 bottom-3 rounded-[28px] border border-white/12 bg-[#0b1218]/96 p-3 shadow-[0_28px_80px_rgba(0,0,0,.58)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/25" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-10 place-items-center rounded-[16px] bg-[#8ee7d5]/15 text-[#8ee7d5]">
                  <HugeiconsIcon
                    icon={captureModeMeta[captureMode].icon}
                    size={19}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ee7d5]">
                    Capture
                  </p>
                  <p className="truncate text-base font-semibold text-white">
                    {captureModeMeta[captureMode].label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCaptureSheetOpen(false)}
                className="grid size-10 place-items-center rounded-[14px] border border-white/10 text-[#b7c6c9]"
                aria-label="Close capture"
              >
                ×
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-[18px] bg-black/25 p-1">
              {(['note', 'task', 'draft'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={captureMode === mode}
                  onClick={() => {
                    setCaptureMode(mode)
                    hapticTap()
                  }}
                  className={cx(
                    'min-h-10 rounded-[14px] text-sm font-semibold transition-colors',
                    captureMode === mode
                      ? 'bg-white text-[#071111]'
                      : 'text-[#b7c6c9]',
                  )}
                >
                  {captureModeMeta[mode].label}
                </button>
              ))}
            </div>

            {captureMode === 'draft' ? (
              <div className="mt-3 grid gap-2">
                <input
                  value={draftRecipient}
                  onChange={(event) => setDraftRecipient(event.target.value)}
                  placeholder="Recipient"
                  inputMode="email"
                  className="min-h-11 rounded-[16px] border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5]"
                />
                <input
                  value={draftSubject}
                  onChange={(event) => setDraftSubject(event.target.value)}
                  placeholder="Subject"
                  className="min-h-11 rounded-[16px] border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5]"
                />
              </div>
            ) : null}

            <textarea
              ref={captureInputRef}
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              placeholder={
                captureMode === 'note'
                  ? 'Remember this...'
                  : captureMode === 'task'
                    ? 'Add a task...'
                    : 'Draft the reply...'
              }
              rows={5}
              className="mt-3 w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-3 py-3 text-base leading-6 text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5]"
            />

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCaptureSheetOpen(false)}
                className="min-h-12 flex-1 rounded-[18px] border border-white/10 text-sm font-semibold text-[#dbe7e8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCapture()}
                disabled={saving || !captureText.trim()}
                className="min-h-12 flex-[1.4] rounded-[18px] bg-[#8ee7d5] text-sm font-semibold text-[#071111] disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : captureMode === 'draft'
                    ? 'Queue'
                    : 'Save'}
              </button>
            </div>

            {queuedCaptures.length ? (
              <button
                type="button"
                onClick={() => void retryQueuedCaptures()}
                className="mt-2 min-h-10 w-full rounded-[16px] border border-[#f7b267]/35 bg-[#f7b267]/10 text-xs font-semibold text-[#ffd39d]"
              >
                Retry {queuedCaptures.length} offline
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
