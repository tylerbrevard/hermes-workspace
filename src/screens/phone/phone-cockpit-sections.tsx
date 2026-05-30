import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Alert01Icon,
  Apple01Icon,
  Calendar01Icon,
  CheckListIcon,
  ComputerIcon,
  DashboardSquare01Icon,
  File01Icon,
  InjectionIcon,
  Mail01Icon,
  Mic01Icon,
  Notification01Icon,
  SlidersHorizontalIcon,
  Target02Icon,
  Task01Icon,
} from '@hugeicons/core-free-icons'
import {
  ActionLink,
  Card,
  IconTile,
  StatPill,
  StatusDot,
} from './phone-cockpit-ui'
import {
  FOOD_MEAL_OPTIONS,
  PHONE_TABS,
  WEGOVY_DOSE_OPTIONS,
  WEGOVY_SITE_OPTIONS,
  captureModeMeta,
  cx,
  fmtShortTime,
  formatFreshness,
  sourceTone,
} from './lib/phone-cockpit-helpers'
import type { ReactNode } from 'react'
import type {
  DailyLoopSignal,
  NotificationState,
  PhoneCardId,
  PhoneDashboardTile,
  PhoneSignalRailItem,
  PhoneTab,
  PhoneTravelMode,
} from './lib/phone-cockpit-helpers'
import type { PhoneCockpitSnapshot } from '@/server/phone-cockpit'

export function PhoneHeroSection({
  topSignal,
  freshnessNotice,
  signalRail,
  compactBadgesMode,
  snapshot,
  atAGlance,
  error,
  onRetry,
}: {
  topSignal: string
  freshnessNotice: string | null
  signalRail: Array<PhoneSignalRailItem>
  compactBadgesMode: boolean
  snapshot: PhoneCockpitSnapshot | null
  atAGlance: Array<{ label: string; value: string }>
  error: string
  onRetry: () => void
}) {
  return (
    <header className="overflow-hidden rounded-[26px] border border-[#6ec6b8]/25 bg-[#0d1419]/90 p-2.5 shadow-[0_20px_48px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl sm:rounded-[30px] sm:p-3.5">
      <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/20 md:hidden" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#8ee7d5]">
          <HugeiconsIcon
            icon={DashboardSquare01Icon}
            size={16}
            aria-hidden="true"
          />
          Today
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#dbe7e8]">
          Phone
        </span>
      </div>
      <h1 className="mt-1.5 line-clamp-2 text-xl font-semibold leading-6 tracking-[0] text-white [text-wrap:balance] sm:mt-2 sm:text-[22px] sm:leading-7">
        {topSignal}
      </h1>
      {freshnessNotice ? (
        <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#b7c6c9] sm:mt-1.5 sm:text-sm">
          {freshnessNotice}
        </p>
      ) : null}
      <div
        className="mt-2 grid grid-cols-5 gap-1.5 sm:mt-2.5"
        aria-label="Signal rail"
      >
        {signalRail.map((item) => (
          <div
            key={item.id}
            className="min-w-0 rounded-full bg-white/[0.055] px-1.5 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.05)] sm:rounded-[16px] sm:border sm:border-white/10 sm:py-2"
          >
            <div className="flex justify-center">
              <StatusDot tone={item.tone} />
            </div>
            <p className="mt-1 truncate text-[9px] uppercase tracking-[0.06em] text-[#9fb0b4] sm:text-[10px] sm:tracking-[0.08em]">
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
      {!compactBadgesMode ? (
        <>
          <div
            className="mt-2 hidden grid-cols-3 gap-1.5 sm:mt-2.5 sm:grid sm:gap-2"
            aria-label="Current counts"
          >
            <StatPill
              icon={Mail01Icon}
              label="Mail"
              value={snapshot?.inbox.unread ?? '—'}
            />
            <StatPill
              icon={Alert01Icon}
              label="Urgent"
              value={snapshot?.tasks.urgent ?? '—'}
            />
            <StatPill
              icon={CheckListIcon}
              label="Due"
              value={snapshot?.tasks.overdue ?? '—'}
            />
          </div>
          <details className="mt-2 hidden rounded-[18px] border border-white/10 bg-white/[0.04] px-2.5 py-2 sm:block">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[#8ee7d5]">
              Detail
            </summary>
            <div
              className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5"
              aria-label="At a glance"
            >
              {atAGlance.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[16px] border border-white/10 bg-black/15 px-2.5 py-2"
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ee7d5]">
                    {item.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-[8px] border border-[#ff9aa8]/30 bg-[#ff9aa8]/10 p-3 text-sm text-[#ffb0bb]"
        >
          <div className="font-medium text-white">Snapshot unavailable</div>
          <div className="mt-1 break-words">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-11 rounded-[8px] border border-[#ff9aa8]/30 px-3 text-xs font-medium text-[#ffd6dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9aa8]/70"
          >
            Retry
          </button>
        </div>
      ) : null}
    </header>
  )
}

export function PhoneViewControlsSection({
  lowDataMode,
  highContrastMode,
  compactBadgesMode,
  travelMode,
  sourceWarningsIgnored,
  sourceWarningsCount,
  onToggleLowDataMode,
  onToggleHighContrastMode,
  onToggleCompactBadgesMode,
  onTravelModeChange,
}: {
  lowDataMode: boolean
  highContrastMode: boolean
  compactBadgesMode: boolean
  travelMode: PhoneTravelMode
  sourceWarningsIgnored: boolean
  sourceWarningsCount: number
  onToggleLowDataMode: () => void
  onToggleHighContrastMode: () => void
  onToggleCompactBadgesMode: () => void
  onTravelModeChange: (mode: PhoneTravelMode) => void
}) {
  const modeLabel = travelMode === 'standard' ? 'Normal' : travelMode
  const warningsLabel = sourceWarningsIgnored
    ? 'ignored'
    : sourceWarningsCount
      ? 'active'
      : 'clear'
  const controls = (
    <>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <PhoneModeToggle
          active={lowDataMode}
          activeClass="border-[#8ee7d5] bg-[#8ee7d5] text-[#071111]"
          onClick={onToggleLowDataMode}
        >
          Low data
        </PhoneModeToggle>
        <PhoneModeToggle
          active={highContrastMode}
          activeClass="border-white bg-white text-black"
          onClick={onToggleHighContrastMode}
        >
          Contrast
        </PhoneModeToggle>
        <PhoneModeToggle
          active={compactBadgesMode}
          activeClass="border-[#8ee7d5] bg-[#8ee7d5] text-[#071111]"
          onClick={onToggleCompactBadgesMode}
        >
          Badges
        </PhoneModeToggle>
      </div>
      <div
        className="mt-2 grid grid-cols-3 gap-2 text-sm"
        aria-label="Daily motion mode"
      >
        {(['standard', 'driving', 'walking'] as const).map((mode) => (
          <PhoneModeToggle
            key={mode}
            active={travelMode === mode}
            activeClass="border-[#8ee7d5] bg-[#8ee7d5] text-[#071111]"
            onClick={() => onTravelModeChange(mode)}
          >
            {mode === 'standard' ? 'Normal' : mode}
          </PhoneModeToggle>
        ))}
      </div>
    </>
  )
  return (
    <>
      <details className="rounded-[18px] border border-white/10 bg-[#111820]/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.11em] text-[#8ee7d5] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <HugeiconsIcon
              icon={SlidersHorizontalIcon}
              size={15}
              aria-hidden="true"
            />
            View
          </span>
          <span className="hidden truncate text-[11px] normal-case tracking-[0] text-[#b7c6c9] sm:inline">
            {modeLabel} · warnings {warningsLabel}
          </span>
        </summary>
        <div className="mt-2">{controls}</div>
      </details>
      <Card
        title="View"
        kicker={lowDataMode ? 'Low data' : 'Full'}
        icon={SlidersHorizontalIcon}
        className="hidden md:block"
      >
        {controls}
        {lowDataMode ? (
          <p className="mt-2 text-xs leading-5 text-[#b7c6c9]">
            Action cards only.
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-[#b7c6c9]">
          Warnings: {warningsLabel}
        </p>
      </Card>
    </>
  )
}

function PhoneProgressBar({
  value,
  tone,
}: {
  value: number
  tone: PhoneDashboardTile['tone']
}) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35">
      <div
        className={cx(
          'h-full rounded-full',
          tone === 'bad'
            ? 'bg-[#ff9aa8]'
            : tone === 'warn'
              ? 'bg-[#f7b267]'
              : tone === 'muted'
                ? 'bg-[#78888c]'
                : 'bg-[#6ec6b8]',
        )}
        style={{ width: `${Math.max(6, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function PhoneThumbControlDock({
  activeTab,
  onChangeTab,
  onOpenCapture,
}: {
  activeTab: PhoneTab
  onChangeTab: (tab: PhoneTab) => void
  onOpenCapture: () => void
}) {
  const tabIconById: Record<PhoneTab, typeof CheckListIcon> = {
    today: DashboardSquare01Icon,
    work: CheckListIcon,
    systems: ComputerIcon,
  }

  return (
    <div className="md:hidden">
      <div className="rounded-[24px] border border-white/12 bg-[#0b1218]/92 p-1.5 shadow-[0_18px_44px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="grid grid-cols-3 gap-1 rounded-[20px] bg-black/25 p-1">
            {PHONE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                aria-label={tab.label}
                onClick={() => onChangeTab(tab.id)}
                className={cx(
                  'grid min-h-12 place-items-center rounded-[16px] px-2 transition-colors',
                  activeTab === tab.id
                    ? 'bg-white text-[#071111] shadow-sm'
                    : 'text-[#b7c6c9]',
                )}
              >
                <HugeiconsIcon
                  icon={tabIconById[tab.id]}
                  size={19}
                  aria-hidden="true"
                />
                <span className="sr-only">{tab.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenCapture}
            className="grid size-14 place-items-center rounded-[20px] bg-[#8ee7d5] text-[#071111] shadow-[0_12px_28px_rgba(142,231,213,.28)]"
            aria-label="Open capture"
          >
            <HugeiconsIcon icon={Add01Icon} size={24} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function PhoneCommandDashboardSection({
  posture,
  nextAction,
  nextDetail,
  tiles,
  mix,
  loopPercent,
  onOpenCapture,
  onOpenNeeds,
}: {
  posture: string
  nextAction: string
  nextDetail: string
  tiles: Array<PhoneDashboardTile>
  mix: Array<{ label: string; value: number; tone: PhoneDashboardTile['tone'] }>
  loopPercent: number
  onOpenCapture: () => void
  onOpenNeeds: () => void
}) {
  const total = Math.max(
    1,
    mix.reduce((sum, item) => sum + item.value, 0),
  )
  return (
    <Card
      title="Command"
      kicker={posture}
      icon={DashboardSquare01Icon}
      className="bg-[#121c24]/90"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2 sm:grid-cols-[minmax(0,1fr)_130px]">
        <div className="rounded-[20px] border border-[#8ee7d5]/25 bg-[#8ee7d5]/10 p-2.5 sm:rounded-[22px] sm:p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ee7d5]">
            <span className="sm:hidden">Next</span>
            <span className="hidden sm:inline">Next best action</span>
          </p>
          <p className="mt-1 line-clamp-2 text-base font-semibold leading-5 text-white sm:text-lg sm:leading-6">
            {nextAction}
          </p>
          <p className="mt-1 hidden line-clamp-1 text-xs text-[#b7c6c9] sm:block">
            {nextDetail}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:mt-3">
            <button
              type="button"
              onClick={onOpenNeeds}
              className="min-h-10 rounded-[14px] border border-white/10 bg-black/20 px-3 font-semibold text-[#dbe7e8] sm:min-h-12 sm:rounded-[16px]"
            >
              Needs
            </button>
            <button
              type="button"
              onClick={onOpenCapture}
              className="min-h-10 rounded-[14px] bg-[#8ee7d5] px-3 font-semibold text-[#071111] sm:min-h-12 sm:rounded-[16px]"
            >
              Capture
            </button>
          </div>
        </div>
        <div className="grid place-items-center rounded-[20px] border border-white/10 bg-white/[0.055] p-2 sm:rounded-[22px] sm:p-3">
          <div
            className="grid size-20 place-items-center rounded-full text-center sm:size-24"
            style={{
              background: `conic-gradient(#6ec6b8 ${loopPercent}%, rgba(255,255,255,.08) 0)`,
            }}
            aria-label={`${loopPercent}% loop completion`}
          >
            <span className="grid size-12 place-items-center rounded-full bg-[#080c10] text-sm font-bold text-white sm:size-16 sm:text-lg">
              {loopPercent}%
            </span>
          </div>
          <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8ee7d5] sm:mt-2 sm:text-[10px] sm:tracking-[0.12em]">
            Loops
          </p>
        </div>
      </div>
      <div className="mt-2 hidden grid-cols-2 gap-2 sm:grid">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className="rounded-[20px] border border-white/10 bg-white/[0.055] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8ee7d5]">
                {tile.label}
              </p>
              <StatusDot tone={tile.tone} />
            </div>
            <p className="mt-1 text-lg font-semibold text-white">
              {tile.value}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#b7c6c9]">
              {tile.detail}
            </p>
            <PhoneProgressBar value={tile.progress} tone={tile.tone} />
          </div>
        ))}
      </div>
      <div
        className="mt-2 hidden h-8 overflow-hidden rounded-[16px] border border-white/10 bg-black/25 sm:flex"
        aria-label="Work mix"
      >
        {mix.map((item) => (
          <div
            key={item.label}
            title={`${item.label}: ${item.value}`}
            className={cx(
              'min-w-[10px]',
              item.tone === 'bad'
                ? 'bg-[#ff9aa8]'
                : item.tone === 'warn'
                  ? 'bg-[#f7b267]'
                  : item.tone === 'muted'
                    ? 'bg-[#78888c]'
                    : 'bg-[#6ec6b8]',
            )}
            style={{ width: `${Math.max(8, (item.value / total) * 100)}%` }}
          />
        ))}
      </div>
    </Card>
  )
}

export function PhoneTravelModeSection({
  glance,
  onOpenCapture,
}: {
  glance: {
    modeLabel: string
    title: string
    urgentCount: number
    nextEvent: string
    captureLabel: string
    lilyLabel: string
    detail: string
  }
  onOpenCapture: () => void
}) {
  return (
    <Card title={`${glance.modeLabel} glance`} kicker="Daily" icon={Mic01Icon}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[8px] border border-[#f7b267]/35 bg-[#f7b267]/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ffd39d]">
            Urgent
          </p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {glance.urgentCount}
          </p>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8ee7d5]">
            Next
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">
            {glance.nextEvent}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-5 text-[#dbe7e8]">{glance.title}</p>
      <p className="mt-1 text-xs leading-5 text-[#b7c6c9]">{glance.detail}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <button
          type="button"
          onClick={onOpenCapture}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[8px] border border-[#8ee7d5]/40 bg-[#8ee7d5]/10 px-3 font-semibold text-[#b8fff3]"
        >
          <HugeiconsIcon icon={Add01Icon} size={17} aria-hidden="true" />
          {glance.captureLabel}
        </button>
        <ActionLink to="/lily" label="Open LILY mic" className="min-h-14 gap-2">
          <HugeiconsIcon icon={Mic01Icon} size={17} aria-hidden="true" />
          {glance.lilyLabel}
        </ActionLink>
      </div>
    </Card>
  )
}

function PhoneModeToggle({
  active,
  activeClass,
  onClick,
  children,
}: {
  active: boolean
  activeClass: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'min-h-11 rounded-[8px] border px-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70',
        active ? activeClass : 'border-white/10 bg-white/[0.04] text-[#dbe7e8]',
      )}
    >
      {children}
    </button>
  )
}

export function PhoneFastActionsSection({
  onOpenNeeds,
  onOpenCapture,
}: {
  onOpenNeeds: () => void
  onOpenCapture: () => void
}) {
  return (
    <Card
      title="Fast actions"
      kicker="Daily"
      icon={DashboardSquare01Icon}
      className="hidden md:block"
    >
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenNeeds}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 font-medium text-[#dbe7e8]"
        >
          <HugeiconsIcon icon={Alert01Icon} size={16} aria-hidden="true" />
          Needs Tyler
        </button>
        <button
          type="button"
          onClick={onOpenCapture}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 font-medium text-[#dbe7e8]"
        >
          <HugeiconsIcon icon={Add01Icon} size={16} aria-hidden="true" />
          Capture
        </button>
        <ActionLink
          to="/meetings"
          label="Open next meeting prep"
          className="gap-2"
        >
          <HugeiconsIcon icon={Calendar01Icon} size={16} aria-hidden="true" />
          Next Meeting
        </ActionLink>
        <ActionLink to="/lily" label="Open LILY mic" className="gap-2">
          <HugeiconsIcon icon={Mic01Icon} size={16} aria-hidden="true" />
          LILY mic
        </ActionLink>
        <ActionLink to="/tasks" label="Open task board" className="gap-2">
          <HugeiconsIcon icon={Task01Icon} size={16} aria-hidden="true" />
          Tasks
        </ActionLink>
        <ActionLink
          to="/it-ops"
          label="Open ConnectWise queue"
          className="gap-2"
        >
          <HugeiconsIcon icon={ComputerIcon} size={16} aria-hidden="true" />
          ConnectWise
        </ActionLink>
      </div>
    </Card>
  )
}

export function PhoneDailyLoopsSection({
  collapsed,
  pinned,
  dailyLoopSignals,
  quickZynStrengthMg,
  quickWegovyDoseMg,
  quickWegovySite,
  quickFoodMeal,
  quickFoodBarcode,
  quickFoodPhotoName,
  quickFoodText,
  quickUndo,
  onTogglePinned,
  onToggleCollapsed,
  onLogQuickZyn,
  onLogQuickWegovy,
  onLogQuickFood,
  onUndoQuickLog,
  onQuickZynStrengthChange,
  onQuickWegovyDoseChange,
  onQuickWegovySiteChange,
  onQuickFoodMealChange,
  onQuickFoodBarcodeChange,
  onQuickFoodPhotoNameChange,
  onQuickFoodTextChange,
}: {
  collapsed: boolean
  pinned: boolean
  dailyLoopSignals: Array<DailyLoopSignal>
  quickZynStrengthMg: number
  quickWegovyDoseMg: string
  quickWegovySite: string
  quickFoodMeal: string
  quickFoodBarcode: string
  quickFoodPhotoName: string
  quickFoodText: string
  quickUndo: { label: string } | null
  onTogglePinned: (cardId: PhoneCardId) => void
  onToggleCollapsed: (cardId: PhoneCardId) => void
  onLogQuickZyn: () => void
  onLogQuickWegovy: () => void
  onLogQuickFood: () => void
  onUndoQuickLog: () => void
  onQuickZynStrengthChange: (value: number) => void
  onQuickWegovyDoseChange: (value: string) => void
  onQuickWegovySiteChange: (value: string) => void
  onQuickFoodMealChange: (value: string) => void
  onQuickFoodBarcodeChange: (value: string) => void
  onQuickFoodPhotoNameChange: (value: string) => void
  onQuickFoodTextChange: (value: string) => void
}) {
  return (
    <Card
      cardId="dailyloops"
      title="Daily loops"
      kicker="Subpages"
      icon={CheckListIcon}
      collapsed={collapsed}
      pinned={pinned}
      onTogglePinned={onTogglePinned}
      onToggleCollapsed={onToggleCollapsed}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="grid gap-1">
          <button
            type="button"
            onClick={onLogQuickZyn}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 font-semibold text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
          >
            <HugeiconsIcon icon={Target02Icon} size={16} aria-hidden="true" />
            Zyn +1
          </button>
          <label className="sr-only" htmlFor="phone-zyn-strength">
            Zyn strength
          </label>
          <select
            id="phone-zyn-strength"
            value={quickZynStrengthMg}
            onChange={(event) =>
              onQuickZynStrengthChange(Number(event.target.value) || 3)
            }
            className="min-h-9 rounded-[8px] border border-white/10 bg-[#080c10] px-2 text-xs font-medium text-[#dbe7e8] outline-none focus-visible:border-[#8ee7d5]"
          >
            {[3, 6].map((strength) => (
              <option key={strength} value={strength}>
                {strength} mg
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <button
            type="button"
            onClick={onLogQuickWegovy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 font-semibold text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
          >
            <HugeiconsIcon icon={InjectionIcon} size={16} aria-hidden="true" />
            Wegovy done
          </button>
          <div className="grid grid-cols-2 gap-1">
            <label className="sr-only" htmlFor="phone-wegovy-dose">
              Wegovy dose
            </label>
            <select
              id="phone-wegovy-dose"
              value={quickWegovyDoseMg}
              onChange={(event) => onQuickWegovyDoseChange(event.target.value)}
              className="min-h-9 min-w-0 rounded-[8px] border border-white/10 bg-[#080c10] px-2 text-xs font-medium text-[#dbe7e8] outline-none focus-visible:border-[#8ee7d5]"
            >
              {WEGOVY_DOSE_OPTIONS.map((dose) => (
                <option key={dose} value={dose}>
                  {dose} mg
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="phone-wegovy-site">
              Wegovy site
            </label>
            <select
              id="phone-wegovy-site"
              value={quickWegovySite}
              onChange={(event) => onQuickWegovySiteChange(event.target.value)}
              className="min-h-9 min-w-0 rounded-[8px] border border-white/10 bg-[#080c10] px-2 text-xs font-medium text-[#dbe7e8] outline-none focus-visible:border-[#8ee7d5]"
            >
              {WEGOVY_SITE_OPTIONS.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="col-span-2 grid gap-1 text-xs font-medium text-[#b7c6c9]">
          Food quick log
          <div className="grid grid-cols-3 gap-1">
            <select
              value={quickFoodMeal}
              onChange={(event) => onQuickFoodMealChange(event.target.value)}
              className="min-h-9 rounded-[8px] border border-white/10 bg-[#080c10] px-2 text-xs font-medium text-[#dbe7e8] outline-none focus-visible:border-[#8ee7d5]"
              aria-label="Meal"
            >
              {FOOD_MEAL_OPTIONS.map((meal) => (
                <option key={meal} value={meal}>
                  {meal}
                </option>
              ))}
            </select>
            <input
              value={quickFoodBarcode}
              onChange={(event) => onQuickFoodBarcodeChange(event.target.value)}
              inputMode="numeric"
              placeholder="Barcode"
              className="min-h-9 min-w-0 rounded-[8px] border border-white/10 bg-[#080c10] px-2 text-xs text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5]"
            />
            <input
              value={quickFoodPhotoName}
              onChange={(event) =>
                onQuickFoodPhotoNameChange(event.target.value)
              }
              placeholder="Photo note"
              className="min-h-9 min-w-0 rounded-[8px] border border-white/10 bg-[#080c10] px-2 text-xs text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5]"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={quickFoodText}
              onChange={(event) => onQuickFoodTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onLogQuickFood()
              }}
              placeholder="Chicken rice bowl..."
              className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-[#080c10] px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
            />
            <button
              type="button"
              onClick={onLogQuickFood}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[#8ee7d5] px-3 text-sm font-semibold text-[#071111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
            >
              <HugeiconsIcon icon={Apple01Icon} size={16} aria-hidden="true" />
              Log
            </button>
          </div>
        </label>
        {quickUndo ? (
          <button
            type="button"
            onClick={onUndoQuickLog}
            className="col-span-2 min-h-10 rounded-[8px] border border-[#f7b267]/35 bg-[#f7b267]/10 px-3 text-sm font-semibold text-[#ffd39d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b267]/70"
          >
            {quickUndo.label}
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {dailyLoopSignals.map((item) => (
          <IconTile
            key={item.id}
            to={item.href}
            icon={item.icon}
            label={`${item.label}: ${item.value}`}
            detail={item.detail}
            tone={item.tone}
          />
        ))}
      </div>
    </Card>
  )
}

export function PhoneTabsSection({
  activeTab,
  compactBadgesMode,
  onChange,
}: {
  activeTab: PhoneTab
  compactBadgesMode: boolean
  onChange: (tab: PhoneTab) => void
}) {
  if (compactBadgesMode) return null
  return (
    <nav
      aria-label="Phone cockpit sections"
      className="grid grid-cols-3 gap-1 rounded-[10px] border border-white/10 bg-[#0d1419] p-1"
    >
      {PHONE_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-pressed={activeTab === tab.id}
          className={cx(
            'min-h-10 rounded-[8px] px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70',
            activeTab === tab.id
              ? 'bg-[#8ee7d5] text-[#071111]'
              : 'text-[#b7c6c9]',
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export function PhoneSystemStatusSection({
  snapshot,
  sourceWarningsCount,
  sourceWarningsIgnored,
  notifications,
  standalonePwa,
  collapsed,
  pinned,
  onTogglePinned,
  onToggleCollapsed,
  onRetrySources,
  onToggleSourceWarningsIgnored,
  onEnableNotifications,
}: {
  snapshot: PhoneCockpitSnapshot | null
  sourceWarningsCount: number
  sourceWarningsIgnored: boolean
  notifications: NotificationState
  standalonePwa: boolean
  collapsed: boolean
  pinned: boolean
  onTogglePinned: (cardId: PhoneCardId) => void
  onToggleCollapsed: (cardId: PhoneCardId) => void
  onRetrySources: () => void
  onToggleSourceWarningsIgnored: () => void
  onEnableNotifications: () => void
}) {
  return (
    <Card
      cardId="status"
      title="System status / Source health drawer"
      kicker={sourceWarningsCount ? `${sourceWarningsCount} warnings` : 'OK'}
      freshness={`${formatFreshness(snapshot?.checkedAt)} · Endpoint: /api/phone-cockpit · Install/PWA readiness checklist · Voice-loop status · Browser mic · LiveKit transport · LILY worker · speaking state`}
      icon={ComputerIcon}
      collapsed={collapsed}
      pinned={pinned}
      onTogglePinned={onTogglePinned}
      onToggleCollapsed={onToggleCollapsed}
    >
      <div className="space-y-2 text-sm text-[#d7e2e4]">
        <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5">
          <p className="flex items-center gap-2 font-medium text-white">
            <HugeiconsIcon
              icon={Notification01Icon}
              size={15}
              aria-hidden="true"
            />{' '}
            Teams
          </p>
          <p className="mt-0.5 line-clamp-1 text-[#b7c6c9]">
            {snapshot?.presence.activity || 'Unknown'} ·{' '}
            {snapshot?.presence.displayName || 'Presence unavailable'}
          </p>
        </div>
        <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5">
          <p className="flex items-center gap-2 font-medium text-white">
            <HugeiconsIcon icon={ComputerIcon} size={15} aria-hidden="true" />{' '}
            Desk device
          </p>
          <p className="mt-0.5 text-[#b7c6c9]">
            {snapshot?.devices.office.status || 'unknown'}
            {snapshot?.devices.office.checkedAt
              ? ` · ${fmtShortTime(snapshot.devices.office.checkedAt)}`
              : ''}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-[8px] bg-white/[0.04] px-2 py-2">
            <p className="text-[#8ee7d5]">Alerts</p>
            <p className="mt-0.5 text-[#b7c6c9]">{notifications}</p>
          </div>
          <div className="rounded-[8px] bg-white/[0.04] px-2 py-2">
            <p className="text-[#8ee7d5]">PWA</p>
            <p className="mt-0.5 text-[#b7c6c9]">
              {standalonePwa ? 'installed' : 'browser'}
            </p>
          </div>
          <div className="rounded-[8px] bg-white/[0.04] px-2 py-2">
            <p className="text-[#8ee7d5]">Shortcuts</p>
            <p className="mt-0.5 text-[#b7c6c9]">
              {snapshot?.shortcuts.enabled ? 'ready' : 'token needed'}
            </p>
          </div>
        </div>
        <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-xs leading-5 text-[#d7e2e4]">
          <p className="font-medium text-white">Voice-loop status</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              [
                'Browser mic',
                notifications === 'granted' ? 'ready' : 'permission needed',
              ],
              [
                'LiveKit transport',
                snapshot?.shortcuts.enabled ? 'configured' : 'not configured',
              ],
              [
                'LILY worker',
                snapshot?.sources.devices?.ok ? 'reachable' : 'check source',
              ],
              ['Speaking state', 'idle'],
            ].map(([label, value]) => (
              <span
                key={label}
                className="rounded border border-white/10 bg-black/20 px-2 py-1"
              >
                {label}: {value}
              </span>
            ))}
          </div>
        </div>
        {snapshot?.shortcuts.endpoint ? (
          <div className="rounded-[8px] bg-white/[0.04] px-3 py-2 text-[11px] leading-5 text-[#b7c6c9]">
            <code className="block break-all">
              {snapshot.shortcuts.endpoint}
            </code>
            <code className="mt-1 block break-all">
              {'POST {"kind":"note","text":"..."}'}
            </code>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {Object.values(snapshot?.sources || {}).map((source) => (
            <div
              key={source.label}
              className={cx(
                'rounded-[8px] border px-3 py-2 text-xs',
                sourceTone(source.ok),
              )}
            >
              {source.label}: {source.ok ? 'OK' : 'degraded'}
            </div>
          ))}
        </div>
        <details className="rounded-[8px] border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-[#d7e2e4]">
          <summary className="cursor-pointer font-medium text-white">
            Source health drawer
          </summary>
          <div className="mt-2 space-y-2">
            {Object.entries(snapshot?.sources || {}).map(([key, source]) => (
              <div key={key} className="rounded bg-black/20 p-2">
                <div>{source.label}</div>
                <div>Endpoint: /api/phone-cockpit#{key}</div>
                <div>Checked at: {source.checkedAt}</div>
                {source.error ? <div>Error: {source.error}</div> : null}
              </div>
            ))}
            <button
              type="button"
              onClick={onRetrySources}
              className="min-h-10 rounded-[8px] border border-white/10 px-3 font-semibold text-[#dbe7e8]"
            >
              Retry source refresh
            </button>
          </div>
        </details>
        {sourceWarningsCount ? (
          <button
            type="button"
            onClick={onToggleSourceWarningsIgnored}
            className="min-h-11 w-full rounded-[8px] border border-[#f7b267]/35 bg-[#f7b267]/10 px-3 text-sm font-medium text-[#ffd39d]"
          >
            {sourceWarningsIgnored
              ? 'Safe to ignore source warnings: on'
              : 'Mark stale source warnings safe to ignore off-hours'}
          </button>
        ) : null}
        <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-xs leading-5 text-[#d7e2e4]">
          <p className="font-medium text-white">
            Install/PWA readiness checklist
          </p>
          <div className="mt-1">
            HTTPS/local route ready · standalone{' '}
            {standalonePwa ? 'installed' : 'not installed'} · shortcuts{' '}
            {snapshot?.shortcuts.enabled ? 'ready' : 'needs token'} ·
            notifications {notifications}
          </div>
        </div>
        {notifications !== 'granted' && notifications !== 'unsupported' ? (
          <button
            type="button"
            onClick={onEnableNotifications}
            className="min-h-11 w-full rounded-[8px] border border-[#8ee7d5]/40 bg-[#8ee7d5]/10 px-3 text-sm font-medium text-[#b8fff3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
          >
            Enable critical local alerts
          </button>
        ) : null}
      </div>
    </Card>
  )
}

export function PhoneWorkspaceShortcutsSection({
  collapsed,
  pinned,
  onTogglePinned,
  onToggleCollapsed,
}: {
  collapsed: boolean
  pinned: boolean
  onTogglePinned: (cardId: PhoneCardId) => void
  onToggleCollapsed: (cardId: PhoneCardId) => void
}) {
  return (
    <Card
      cardId="shortcuts"
      title="Workspace shortcuts"
      kicker="Links"
      icon={DashboardSquare01Icon}
      collapsed={collapsed}
      pinned={pinned}
      onTogglePinned={onTogglePinned}
      onToggleCollapsed={onToggleCollapsed}
    >
      <nav
        aria-label="Workspace shortcuts"
        className="grid grid-cols-3 gap-2 pb-[env(safe-area-inset-bottom)]"
      >
        <ActionLink to="/phone" label="Open today">
          <HugeiconsIcon
            icon={DashboardSquare01Icon}
            size={18}
            aria-hidden="true"
          />
        </ActionLink>
        <ActionLink to="/lily" label="Open Lily">
          <HugeiconsIcon icon={Mic01Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/chat/main" label="Open chat">
          <HugeiconsIcon icon={Mail01Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/files" label="Open files">
          <HugeiconsIcon icon={File01Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/meetings" label="Open meetings">
          <HugeiconsIcon icon={Calendar01Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/tasks" label="Open tasks">
          <HugeiconsIcon icon={Task01Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/wegovy" label="Open Wegovy shots">
          <HugeiconsIcon icon={InjectionIcon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/zyn-tracker" label="Open Zyn tracker">
          <HugeiconsIcon icon={Target02Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/food-log" label="Open food log">
          <HugeiconsIcon icon={Apple01Icon} size={18} aria-hidden="true" />
        </ActionLink>
        <ActionLink to="/it-ops" label="Open ConnectWise">
          <HugeiconsIcon icon={ComputerIcon} size={18} aria-hidden="true" />
        </ActionLink>
      </nav>
    </Card>
  )
}

export function PhoneDeskModeSection({
  title,
  detail,
  online,
  freshness,
  collapsed,
  pinned,
  onTogglePinned,
  onToggleCollapsed,
  onAwayMode,
}: {
  title: string
  detail: string
  online: boolean
  freshness: string
  collapsed: boolean
  pinned: boolean
  onTogglePinned: (cardId: PhoneCardId) => void
  onToggleCollapsed: (cardId: PhoneCardId) => void
  onAwayMode: () => void
}) {
  return (
    <Card
      cardId="desk"
      title="Desk mode"
      kicker={online ? 'Online' : 'Check'}
      freshness={freshness}
      icon={ComputerIcon}
      collapsed={collapsed}
      pinned={pinned}
      onTogglePinned={onTogglePinned}
      onToggleCollapsed={onToggleCollapsed}
    >
      <div className="space-y-2.5 text-sm leading-6 text-[#d7e2e4]">
        <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5">
          <p className="font-medium text-white">{title}</p>
          <p className="mt-0.5 text-[#b7c6c9]">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onAwayMode}
          className="min-h-11 w-full rounded-[8px] border border-[#8ee7d5]/40 bg-[#8ee7d5]/10 px-3 text-sm font-medium text-[#b8fff3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
        >
          Away mode quick note
        </button>
      </div>
    </Card>
  )
}

export function PhoneFloatingLilyAction() {
  return (
    <ActionLink
      to="/lily"
      label="Open LILY microphone"
      className="fixed bottom-[calc(154px+env(safe-area-inset-bottom))] right-4 z-[66] size-12 rounded-[18px] border-[#8ee7d5]/50 bg-[#8ee7d5] p-0 text-[#071111] shadow-[0_14px_34px_rgba(0,0,0,.45)] md:hidden"
    >
      <HugeiconsIcon icon={Mic01Icon} size={22} aria-hidden="true" />
    </ActionLink>
  )
}
