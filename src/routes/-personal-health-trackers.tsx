import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiScanIcon,
  Apple01Icon,
  ChartAverageIcon,
  InjectionIcon,
  PlusSignIcon,
  Target02Icon,
} from '@hugeicons/core-free-icons'
import { useEffect, useState } from 'react'
import {
  InjectionSiteMap,
  MacroRings,
  MiniBars,
  TriggerHeatmap,
} from '@/components/health/health-visuals'
import { ToolsStatusRail } from '@/components/tools-action-dock'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  HealthTrackersClientConflictError,
  fetchHealthTrackersState,
  patchHealthTrackersState,
} from '@/lib/health-trackers-client'
import { readJsonStorage, writeJsonStorage } from '@/lib/typed-storage'
import { cn } from '@/lib/utils'

const todayKey = () => new Date().toISOString().slice(0, 10)

type SyncStatus = 'loading' | 'synced' | 'syncing' | 'offline' | 'conflict'

type TrackerShellProps = {
  title: string
  description: string
  icon: typeof Apple01Icon
  syncStatus?: SyncStatus
  syncDetail?: string
  children: React.ReactNode
}

function TrackerShell({
  title,
  description,
  icon,
  syncStatus,
  syncDetail,
  children,
}: TrackerShellProps) {
  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-3 py-3 pb-[calc(var(--tabbar-h,0px)+16px)] sm:gap-4 sm:px-5 sm:py-4 sm:pb-[calc(var(--tabbar-h,0px)+24px)] lg:px-6">
        <header className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-3 shadow-sm sm:px-4 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-accent)] sm:size-11">
                <HugeiconsIcon icon={icon} size={22} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold">{title}</h1>
                <p className="mt-1 line-clamp-1 max-w-[760px] text-xs text-[var(--theme-muted)] sm:text-sm">
                  {description}
                </p>
              </div>
            </div>
            {syncStatus ? (
              <SyncPill status={syncStatus} detail={syncDetail} />
            ) : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  )
}

function SyncPill({ status, detail }: { status: SyncStatus; detail?: string }) {
  const meta = {
    loading: ['bg-slate-500', 'Load'],
    synced: ['bg-emerald-500', 'Saved'],
    syncing: ['bg-sky-500', 'Sync'],
    offline: ['bg-amber-500', 'Offline'],
    conflict: ['bg-violet-500', 'Merged'],
  } satisfies Record<SyncStatus, [string, string]>
  const [dot, label] = meta[status]
  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-xs font-semibold text-[var(--theme-text)]">
      <span className={cn('size-2 rounded-full', dot)} />
      <span>{label}</span>
      {detail ? (
        <span className="hidden font-normal text-[var(--theme-muted)] sm:inline">
          {detail}
        </span>
      ) : null}
    </div>
  )
}

function mergeById<T extends { id: string }>(
  local: Array<T>,
  server: Array<T>,
): Array<T> {
  const byId = new Map<string, T>()
  for (const entry of server) byId.set(entry.id, entry)
  for (const entry of local) byId.set(entry.id, entry)
  return Array.from(byId.values())
}

function syncDetail(updatedAt: string | null) {
  if (!updatedAt) return 'No sync'
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return undefined
  return `Upd ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

type TrackerDashboardTile = {
  label: string
  value: string
  detail: string
  trend: Array<number>
  tone?: 'accent' | 'warn' | 'good'
}

function clampTrend(value: number) {
  return Math.max(8, Math.min(100, value))
}

function TrendStrip({
  values,
  tone = 'accent',
}: {
  values: Array<number>
  tone?: 'accent' | 'warn' | 'good'
}) {
  const barClass =
    tone === 'warn'
      ? 'bg-rose-500'
      : tone === 'good'
        ? 'bg-emerald-500'
        : 'bg-[var(--theme-accent)]'
  return (
    <div className="mt-3 flex h-9 items-end gap-1" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={cn('w-full rounded-t-sm opacity-85', barClass)}
          style={{ height: `${clampTrend(value)}%` }}
        />
      ))}
    </div>
  )
}

function DashboardTile({ tile }: { tile: TrackerDashboardTile }) {
  return (
    <article className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-sm sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
        {tile.label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl">
        {tile.value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--theme-muted)]">
        {tile.detail}
      </p>
      <div className="hidden sm:block">
        <TrendStrip values={tile.trend} tone={tile.tone} />
      </div>
    </article>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'min-h-11 w-full min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]'

const smallButtonClass =
  'min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--theme-text)]'

function ProgressBar({
  value,
  tone = 'accent',
}: {
  value: number
  tone?: 'accent' | 'warn' | 'good'
}) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-[var(--theme-bg)]">
      <div
        className={cn(
          'h-full rounded-full',
          tone === 'warn'
            ? 'bg-rose-500'
            : tone === 'good'
              ? 'bg-emerald-500'
              : 'bg-[var(--theme-accent)]',
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function DoseLadder({
  plan,
  current,
  next,
}: {
  plan: Array<number>
  current: number
  next: number
}) {
  return (
    <div className="grid gap-2">
      {plan.map((dose) => {
        const isCurrent = dose === current
        const isNext = dose === next && next !== current
        return (
          <div key={dose} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
            <span className="text-xs font-semibold tabular-nums text-[var(--theme-muted)]">
              {dose}mg
            </span>
            <span
              className={cn(
                'h-3 rounded-full border',
                isCurrent
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]'
                  : isNext
                    ? 'border-emerald-400/50 bg-emerald-500/30'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg)]',
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

function MealTimeline({
  entries,
}: {
  entries: Array<{ meal: string; time?: string }>
}) {
  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {meals.map((meal) => {
        const match = entries.find((entry) => entry.meal === meal)
        return (
          <div
            key={meal}
            className={cn(
              'rounded-lg border p-3 text-sm',
              match
                ? 'border-emerald-400/40 bg-emerald-500/10'
                : 'border-[var(--theme-border)] bg-[var(--theme-bg)]',
            )}
          >
            <span className="block font-semibold">{meal}</span>
            <span className="text-xs text-[var(--theme-muted)]">
              {match?.time ?? 'Open'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatSigned(value: number, unit: string) {
  return `${value > 0 ? '+' : ''}${value}${unit}`
}

export type WegovyShot = {
  id: string
  date: string
  doseMg: number
  site: string
  weightLb: number
  sideEffects: string
  notes: string
  appetiteBefore?: number
  appetiteAfter?: number
  waistIn?: number
  hydrationOz?: number
  proteinG?: number
  constipation?: boolean
  nausea?: boolean
  headache?: boolean
}

export function isWegovyShotArray(value: unknown): value is Array<WegovyShot> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as WegovyShot).id === 'string' &&
        typeof (entry as WegovyShot).date === 'string' &&
        typeof (entry as WegovyShot).doseMg === 'number' &&
        typeof (entry as WegovyShot).site === 'string' &&
        typeof (entry as WegovyShot).weightLb === 'number' &&
        typeof (entry as WegovyShot).sideEffects === 'string' &&
        typeof (entry as WegovyShot).notes === 'string',
    )
  )
}

export function getWegovySummary(shots: Array<WegovyShot>, now = new Date()) {
  const sorted = [...shots].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  const previous = sorted[1]
  const nextDue = latest
    ? new Date(new Date(`${latest.date}T12:00:00`).getTime() + 7 * 86400000)
        .toISOString()
        .slice(0, 10)
    : todayKey()
  const daysUntilDue = Math.ceil(
    (new Date(`${nextDue}T12:00:00`).getTime() - now.getTime()) / 86400000,
  )
  return {
    totalShots: shots.length,
    latest,
    nextDue,
    daysUntilDue,
    currentDose: latest?.doseMg ?? 0,
    weightChange:
      latest && previous
        ? Number((latest.weightLb - previous.weightLb).toFixed(1))
        : 0,
    waistChange:
      latest?.waistIn && previous?.waistIn
        ? Number((latest.waistIn - previous.waistIn).toFixed(1))
        : 0,
    appetiteChange:
      latest?.appetiteBefore && latest?.appetiteAfter
        ? latest.appetiteAfter - latest.appetiteBefore
        : 0,
  }
}

export function getWegovyDosePlan(currentDose: number) {
  const plan = [0.25, 0.5, 1, 1.7, 2.4]
  const currentIndex = Math.max(
    0,
    plan.findIndex((dose) => dose >= currentDose),
  )
  return {
    current: plan[currentIndex] ?? currentDose,
    next: plan[Math.min(plan.length - 1, currentIndex + 1)],
    plan,
  }
}

export function getWegovySiteSuggestion(shots: Array<WegovyShot>) {
  const sites = [
    'Abdomen left',
    'Abdomen right',
    'Thigh left',
    'Thigh right',
    'Arm left',
    'Arm right',
  ]
  const latestSite = [...shots].sort((a, b) => b.date.localeCompare(a.date))[0]
    ?.site
  const latestIndex = Math.max(0, sites.indexOf(latestSite ?? sites[0]))
  return sites[(latestIndex + 1) % sites.length]
}

export function getWegovySideEffectSummary(shots: Array<WegovyShot>) {
  const recent = [...shots]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
  const nausea = recent.filter(
    (shot) => shot.nausea || /nausea/i.test(shot.sideEffects),
  ).length
  const constipation = recent.filter(
    (shot) => shot.constipation || /constipation/i.test(shot.sideEffects),
  ).length
  const headache = recent.filter(
    (shot) => shot.headache || /headache/i.test(shot.sideEffects),
  ).length
  const severity = nausea + constipation + headache
  return {
    nausea,
    constipation,
    headache,
    severity,
    label: severity >= 5 ? 'High' : severity >= 2 ? 'Moderate' : 'Low',
  }
}

export function getWegovyDashboardTiles(
  summary: ReturnType<typeof getWegovySummary>,
  sideEffectSummary: ReturnType<typeof getWegovySideEffectSummary>,
  penSupply: number,
): Array<TrackerDashboardTile> {
  const duePressure =
    summary.daysUntilDue < 0 ? 95 : summary.daysUntilDue === 0 ? 72 : 34
  const effectPressure =
    sideEffectSummary.severity === 0
      ? 14
      : Math.min(100, 24 + sideEffectSummary.severity * 14)
  const weightPressure = Math.min(100, 30 + Math.abs(summary.weightChange) * 16)
  const supplyPressure = Math.min(100, Math.max(12, (penSupply / 4) * 100))
  return [
    {
      label: 'Shot runway',
      value:
        summary.daysUntilDue > 0
          ? `${summary.daysUntilDue}d`
          : summary.daysUntilDue === 0
            ? 'Today'
            : `${Math.abs(summary.daysUntilDue)}d late`,
      detail: `Next shot ${summary.nextDue}`,
      trend: [18, 28, 42, duePressure],
      tone: summary.daysUntilDue < 0 ? 'warn' : 'accent',
    },
    {
      label: 'Effect load',
      value: sideEffectSummary.label,
      detail: `${sideEffectSummary.nausea} nausea · ${sideEffectSummary.constipation} constipation`,
      trend: [12, 22, 36, effectPressure],
      tone: sideEffectSummary.severity >= 5 ? 'warn' : 'good',
    },
    {
      label: 'Weight delta',
      value: formatSigned(summary.weightChange, ' lb'),
      detail: 'Latest shot versus prior shot',
      trend: [26, 34, 42, weightPressure],
      tone: summary.weightChange > 0 ? 'warn' : 'good',
    },
    {
      label: 'Pen supply',
      value: `${penSupply}`,
      detail: 'Pens remaining before refill',
      trend: [100, 76, 52, supplyPressure],
      tone: penSupply <= 1 ? 'warn' : 'accent',
    },
  ]
}

export function WegovyTrackerPage() {
  usePageTitle('Wegovy Shots')
  const [shots, setShots] = useState<Array<WegovyShot>>([])
  const [date, setDate] = useState(todayKey())
  const [doseMg, setDoseMg] = useState('0.25')
  const [site, setSite] = useState('Abdomen left')
  const [weightLb, setWeightLb] = useState('')
  const [waistIn, setWaistIn] = useState('')
  const [appetiteBefore, setAppetiteBefore] = useState(5)
  const [appetiteAfter, setAppetiteAfter] = useState(3)
  const [hydrationOz, setHydrationOz] = useState('80')
  const [proteinG, setProteinG] = useState('120')
  const [constipation, setConstipation] = useState(false)
  const [nausea, setNausea] = useState(false)
  const [headache, setHeadache] = useState(false)
  const [sideEffects, setSideEffects] = useState('')
  const [notes, setNotes] = useState('')
  const [penSupply, setPenSupply] = useState(4)
  const [refillDate, setRefillDate] = useState(todayKey())
  const [reminderTime, setReminderTime] = useState('08:00')
  const [hydrated, setHydrated] = useState(false)
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const storageKey = 'workspace.health.wegovy.shots'
  const supplyKey = 'workspace.health.wegovy.supply'
  const refillKey = 'workspace.health.wegovy.refill'
  const reminderKey = 'workspace.health.wegovy.reminder'
  const summary = getWegovySummary(shots)
  const dosePlan = getWegovyDosePlan(summary.currentDose || Number(doseMg))
  const sideEffectSummary = getWegovySideEffectSummary(shots)
  const suggestedSite = getWegovySiteSuggestion(shots)
  const dashboardTiles = getWegovyDashboardTiles(
    summary,
    sideEffectSummary,
    penSupply,
  )
  const latestProtein = summary.latest?.proteinG ?? Number(proteinG)
  const latestHydration = summary.latest?.hydrationOz ?? Number(hydrationOz)
  const doseHold =
    sideEffectSummary.severity >= 5 ||
    latestProtein < 80 ||
    latestHydration < 60
  const shotTrend = [...shots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map((shot) => shot.weightLb || null)
  const doctorSummary = `Wegovy summary: ${shots.length} shot${shots.length === 1 ? '' : 's'} logged. Current dose ${summary.currentDose || Number(doseMg)} mg. Next due ${summary.nextDue}. Weight delta ${formatSigned(summary.weightChange, ' lb')}. Side-effect load ${sideEffectSummary.label}.`

  useEffect(() => {
    let cancelled = false
    const localShots = readJsonStorage(storageKey, [], isWegovyShotArray).value
    const localSupply = readJsonStorage(
      supplyKey,
      4,
      (value): value is number => typeof value === 'number',
    ).value
    const localRefill = readJsonStorage(
      refillKey,
      todayKey(),
      (value): value is string => typeof value === 'string',
    ).value
    const localReminder = readJsonStorage(
      reminderKey,
      '08:00',
      (value): value is string => typeof value === 'string',
    ).value

    setShots(localShots)
    setPenSupply(localSupply)
    setRefillDate(localRefill)
    setReminderTime(localReminder)

    fetchHealthTrackersState()
      .then((state) => {
        if (cancelled) return
        const hasServerState = Boolean(state.updatedAt)
        const serverShots = isWegovyShotArray(state.wegovy.shots)
          ? state.wegovy.shots
          : localShots
        setShots(
          hasServerState || serverShots.length ? serverShots : localShots,
        )
        setPenSupply(hasServerState ? state.wegovy.supply : localSupply)
        setRefillDate(hasServerState ? state.wegovy.refill : localRefill)
        setReminderTime(hasServerState ? state.wegovy.reminder : localReminder)
        setServerUpdatedAt(state.updatedAt)
        setSyncStatus('synced')
      })
      .catch(() => {
        setSyncStatus('offline')
        // Offline cache is already loaded.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeJsonStorage(storageKey, shots)
    writeJsonStorage(supplyKey, penSupply)
    writeJsonStorage(refillKey, refillDate)
    writeJsonStorage(reminderKey, reminderTime)
    setSyncStatus('syncing')
    const patch = {
      wegovy: {
        shots,
        supply: penSupply,
        refill: refillDate,
        reminder: reminderTime,
      },
    }
    void patchHealthTrackersState(patch, serverUpdatedAt)
      .then((state) => {
        setServerUpdatedAt(state.updatedAt)
        setSyncStatus('synced')
      })
      .catch((error) => {
        if (error instanceof HealthTrackersClientConflictError) {
          const serverShots = isWegovyShotArray(error.current.wegovy.shots)
            ? error.current.wegovy.shots
            : []
          const mergedShots = mergeById(shots, serverShots).sort((a, b) =>
            b.date.localeCompare(a.date),
          )
          const mergedPatch = {
            wegovy: {
              shots: mergedShots,
              supply: penSupply,
              refill: refillDate,
              reminder: reminderTime,
            },
          }
          setShots(mergedShots)
          setServerUpdatedAt(error.current.updatedAt)
          setSyncStatus('conflict')
          void patchHealthTrackersState(mergedPatch, error.current.updatedAt)
            .then((state) => {
              setServerUpdatedAt(state.updatedAt)
              setSyncStatus('synced')
            })
            .catch(() => setSyncStatus('offline'))
          return
        }
        setSyncStatus('offline')
      })
  }, [hydrated, penSupply, refillDate, reminderTime, shots])

  function addShot() {
    const entry: WegovyShot = {
      id: crypto.randomUUID(),
      date,
      doseMg: Number(doseMg) || 0,
      site,
      weightLb: Number(weightLb) || 0,
      waistIn: Number(waistIn) || 0,
      appetiteBefore,
      appetiteAfter,
      hydrationOz: Number(hydrationOz) || 0,
      proteinG: Number(proteinG) || 0,
      constipation,
      nausea,
      headache,
      sideEffects,
      notes,
    }
    setShots((current) =>
      [entry, ...current.filter((shot) => shot.id !== entry.id)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    )
    setSideEffects('')
    setNotes('')
    setPenSupply((current) => Math.max(0, current - 1))
  }

  return (
    <TrackerShell
      title="Wegovy"
      description="Dose, site, effects."
      icon={InjectionIcon}
      syncStatus={syncStatus}
      syncDetail={syncDetail(serverUpdatedAt)}
    >
      <section aria-label="Wegovy dashboard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardTiles.map((tile) => (
            <DashboardTile key={tile.label} tile={tile} />
          ))}
        </div>
      </section>

      <section
        aria-label="Wegovy visual plan"
        className="grid gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.9fr)]"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Rotation
          </h2>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">
            Current and next safest site.
          </p>
          <div className="mt-3">
            <InjectionSiteMap selected={site} suggested={suggestedSite} />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Dose ladder
          </h2>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">
            Hold when effects or intake are off.
          </p>
          <div className="mt-3">
            <DoseLadder
              plan={dosePlan.plan}
              current={dosePlan.current}
              next={dosePlan.next}
            />
          </div>
        </div>
        <div className="grid gap-3">
          <div
            className={cn(
              'rounded-lg border p-3',
              doseHold
                ? 'border-amber-400/40 bg-amber-500/10'
                : 'border-emerald-400/40 bg-emerald-500/10',
            )}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Next dose call</span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                {doseHold ? 'Hold' : 'Clear'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--theme-muted)]">
              Protein {latestProtein}g · water {latestHydration}oz · effects{' '}
              {sideEffectSummary.label.toLowerCase()}.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Weight trace</span>
              <span className="text-xs text-[var(--theme-muted)]">last 8</span>
            </div>
            <MiniBars values={shotTrend} tone="neutral" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 sm:p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Log
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input
                className={inputClass}
                type="date"
                value={date}
                onChange={(e) => setDate(e.currentTarget.value)}
              />
            </Field>
            <Field label="Dose">
              <select
                className={inputClass}
                value={doseMg}
                onChange={(e) => setDoseMg(e.currentTarget.value)}
              >
                {['0.25', '0.5', '1', '1.7', '2.4'].map((dose) => (
                  <option key={dose} value={dose}>
                    {dose} mg
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Site">
              <select
                className={inputClass}
                value={site}
                onChange={(e) => setSite(e.currentTarget.value)}
              >
                {[
                  'Abdomen left',
                  'Abdomen right',
                  'Thigh left',
                  'Thigh right',
                  'Arm left',
                  'Arm right',
                ].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weight">
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="lb"
                value={weightLb}
                onChange={(e) => setWeightLb(e.currentTarget.value)}
              />
            </Field>
            <Field label="Waist">
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="in"
                value={waistIn}
                onChange={(e) => setWaistIn(e.currentTarget.value)}
              />
            </Field>
            <Field label="Hydration">
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="oz"
                value={hydrationOz}
                onChange={(e) => setHydrationOz(e.currentTarget.value)}
              />
            </Field>
            <Field label="Protein">
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="g"
                value={proteinG}
                onChange={(e) => setProteinG(e.currentTarget.value)}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={`Appetite before: ${appetiteBefore}/10`}>
              <input
                type="range"
                min={1}
                max={10}
                value={appetiteBefore}
                onChange={(e) =>
                  setAppetiteBefore(Number(e.currentTarget.value))
                }
                className="accent-[var(--theme-accent)]"
              />
            </Field>
            <Field label={`Appetite after: ${appetiteAfter}/10`}>
              <input
                type="range"
                min={1}
                max={10}
                value={appetiteAfter}
                onChange={(e) =>
                  setAppetiteAfter(Number(e.currentTarget.value))
                }
                className="accent-[var(--theme-accent)]"
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-sm">
              <input
                type="checkbox"
                checked={nausea}
                onChange={(event) => setNausea(event.currentTarget.checked)}
                className="size-4 accent-[var(--theme-accent)]"
              />
              Nausea
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-sm">
              <input
                type="checkbox"
                checked={constipation}
                onChange={(event) =>
                  setConstipation(event.currentTarget.checked)
                }
                className="size-4 accent-[var(--theme-accent)]"
              />
              Constipation
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-sm">
              <input
                type="checkbox"
                checked={headache}
                onChange={(event) => setHeadache(event.currentTarget.checked)}
                className="size-4 accent-[var(--theme-accent)]"
              />
              Headache
            </label>
          </div>
          <Field label="Effects">
            <input
              className={cn(inputClass, 'mt-1')}
              placeholder="Nausea, headache, none"
              value={sideEffects}
              onChange={(e) => setSideEffects(e.currentTarget.value)}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={cn(inputClass, 'mt-1 min-h-24 py-2')}
              placeholder="Meals, sleep, hydration"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Field>
          <button
            type="button"
            onClick={addShot}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-accent)] px-4 text-sm font-semibold text-white sm:w-auto"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={17} /> Add
          </button>
        </section>

        <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 md:block">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            History
          </h2>
          <div className="mt-4 grid gap-3">
            {shots.length ? (
              shots.map((shot) => (
                <article
                  key={shot.id}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{shot.date}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setShots((current) =>
                          current.filter((item) => item.id !== shot.id),
                        )
                      }
                      className="min-h-8 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--theme-muted)]"
                    >
                      Del
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-[var(--theme-muted)] sm:grid-cols-3">
                    <span>{shot.doseMg} mg</span>
                    <span>{shot.site}</span>
                    <span>{shot.weightLb || '-'} lb</span>
                  </div>
                  <p className="mt-2 text-sm">
                    {shot.sideEffects || 'No effects.'}
                  </p>
                  {shot.notes ? (
                    <p className="mt-1 text-sm text-[var(--theme-muted)]">
                      {shot.notes}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm text-[var(--theme-muted)]">
                No shots.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 md:block">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Plan
            </h2>
            <p className="mt-1 text-sm text-[var(--theme-muted)]">
              Reminder, supply, rotation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(doctorSummary)}
            className={smallButtonClass}
          >
            Copy
          </button>
        </div>
        <ToolsStatusRail
          label="Wegovy plan"
          className="mt-4"
          items={[
            {
              id: 'reminder',
              label: 'Reminder',
              value: `${summary.nextDue} ${reminderTime}`,
              tone: summary.daysUntilDue < 0 ? 'warning' : 'neutral',
            },
            {
              id: 'dose',
              label: 'Dose',
              value: `${dosePlan.current}->${dosePlan.next} mg`,
            },
            { id: 'site', label: 'Site', value: suggestedSite },
            {
              id: 'supply',
              label: 'Supply',
              value: `${penSupply}`,
              tone: penSupply <= 1 ? 'warning' : 'neutral',
              progress: (penSupply / 4) * 100,
            },
            {
              id: 'effects',
              label: 'Effects',
              value: sideEffectSummary.label,
              tone: sideEffectSummary.severity >= 5 ? 'warning' : 'good',
            },
            {
              id: 'appetite',
              label: 'Appetite',
              value: formatSigned(summary.appetiteChange, ' pts'),
              progress: Math.abs(summary.appetiteChange) * 10,
            },
            {
              id: 'waist',
              label: 'Waist',
              value: formatSigned(summary.waistChange, ' in'),
            },
            { id: 'check', label: 'Check', value: 'Food + Zyn' },
          ]}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Time">
            <input
              type="time"
              className={inputClass}
              value={reminderTime}
              onChange={(event) => setReminderTime(event.currentTarget.value)}
            />
          </Field>
          <Field label="Pens">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={penSupply}
              onChange={(event) =>
                setPenSupply(Number(event.currentTarget.value) || 0)
              }
            />
          </Field>
          <Field label="Refill">
            <input
              type="date"
              className={inputClass}
              value={refillDate}
              onChange={(event) => setRefillDate(event.currentTarget.value)}
            />
          </Field>
        </div>
      </section>
    </TrackerShell>
  )
}

export type ZynEntry = {
  id: string
  date: string
  time: string
  count: number
  strengthMg: number
  trigger: string
  note: string
}

export function isZynEntryArray(value: unknown): value is Array<ZynEntry> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as ZynEntry).id === 'string' &&
        typeof (entry as ZynEntry).date === 'string' &&
        typeof (entry as ZynEntry).time === 'string' &&
        typeof (entry as ZynEntry).count === 'number' &&
        typeof (entry as ZynEntry).strengthMg === 'number' &&
        typeof (entry as ZynEntry).trigger === 'string' &&
        typeof (entry as ZynEntry).note === 'string',
    )
  )
}

export function getZynDailySummary(
  entries: Array<ZynEntry>,
  date = todayKey(),
  dailyLimit = 8,
) {
  const today = entries.filter((entry) => entry.date === date)
  const count = today.reduce((sum, entry) => sum + entry.count, 0)
  const nicotineMg = today.reduce(
    (sum, entry) => sum + entry.count * entry.strengthMg,
    0,
  )
  return {
    count,
    nicotineMg,
    remaining: Math.max(0, dailyLimit - count),
    overLimit: count > dailyLimit,
  }
}

export function getZynInsights(entries: Array<ZynEntry>, dailyLimit = 8) {
  const byDate = new Map<string, number>()
  const byTrigger = new Map<string, number>()
  const byHour = new Map<string, number>()
  for (const entry of entries) {
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.count)
    byTrigger.set(
      entry.trigger,
      (byTrigger.get(entry.trigger) ?? 0) + entry.count,
    )
    const hour = entry.time.slice(0, 2)
    byHour.set(hour, (byHour.get(hour) ?? 0) + entry.count)
  }
  const days = Array.from(byDate.entries()).sort((a, b) =>
    b[0].localeCompare(a[0]),
  )
  const weeklyAverage = days.length
    ? Number(
        (
          days.slice(0, 7).reduce((sum, [, count]) => sum + count, 0) /
          Math.min(7, days.length)
        ).toFixed(1),
      )
    : 0
  const streak = days.reduce(
    (current, [, count]) => (count <= dailyLimit ? current + 1 : current),
    0,
  )
  const riskiestTrigger =
    Array.from(byTrigger.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'None yet'
  const riskiestHour =
    Array.from(byHour.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'No window'
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  return {
    weeklyAverage,
    streak,
    riskiestTrigger,
    riskiestHour,
    total,
    cost: Number((total * 0.28).toFixed(2)),
    reductionTarget: Math.max(1, dailyLimit - 1),
  }
}

export function getZynDashboardTiles(
  summary: ReturnType<typeof getZynDailySummary>,
  insights: ReturnType<typeof getZynInsights>,
  dailyLimit: number,
): Array<TrackerDashboardTile> {
  const pace = Math.min(100, (summary.count / Math.max(1, dailyLimit)) * 100)
  const averagePace = Math.min(
    100,
    (insights.weeklyAverage / Math.max(1, dailyLimit)) * 100,
  )
  return [
    {
      label: 'Today pace',
      value: `${summary.count}/${dailyLimit}`,
      detail: `${summary.remaining} remaining before cap`,
      trend: [18, 36, 58, pace],
      tone: summary.overLimit ? 'warn' : 'accent',
    },
    {
      label: 'Nicotine load',
      value: `${summary.nicotineMg} mg`,
      detail: 'Estimated intake today',
      trend: [12, 26, 44, Math.min(100, summary.nicotineMg * 3)],
      tone: summary.overLimit ? 'warn' : 'accent',
    },
    {
      label: '7d average',
      value: `${insights.weeklyAverage}/day`,
      detail: `Reduction target ${insights.reductionTarget}/day`,
      trend: [averagePace + 18, averagePace + 8, averagePace, averagePace],
      tone: insights.weeklyAverage > dailyLimit ? 'warn' : 'good',
    },
    {
      label: 'Risk trigger',
      value: insights.riskiestTrigger,
      detail: `Common hour ${insights.riskiestHour}`,
      trend: [24, 46, 32, 64],
      tone: 'accent',
    },
  ]
}

export function ZynTrackerPage() {
  usePageTitle('Zyn Tracker')
  const [entries, setEntries] = useState<Array<ZynEntry>>([])
  const [dailyLimit, setDailyLimit] = useState(8)
  const [strengthMg, setStrengthMg] = useState(3)
  const [trigger, setTrigger] = useState('Focus')
  const [note, setNote] = useState('')
  const [avoided, setAvoided] = useState<Array<string>>([])
  const [delayStartedAt, setDelayStartedAt] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const storageKey = 'workspace.health.zyn.entries'
  const limitKey = 'workspace.health.zyn.limit'
  const avoidedKey = 'workspace.health.zyn.avoided'
  const summary = getZynDailySummary(entries, todayKey(), dailyLimit)
  const todayEntries = entries.filter((entry) => entry.date === todayKey())
  const insights = getZynInsights(entries, dailyLimit)
  const dashboardTiles = getZynDashboardTiles(summary, insights, dailyLimit)
  const lastEntry = [...entries].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
  )[0]
  const dayProgress = (new Date().getHours() + 1) / 24
  const paceForecast = Math.max(
    summary.count,
    Math.ceil(summary.count / Math.max(0.1, dayProgress)),
  )
  const substitutionNotes = ['Water', 'Walk', 'Gum', 'Breathe']

  useEffect(() => {
    let cancelled = false
    const localEntries = readJsonStorage(storageKey, [], isZynEntryArray).value
    const localLimit = readJsonStorage(
      limitKey,
      8,
      (value): value is number => typeof value === 'number',
    ).value
    const localAvoided = readJsonStorage(
      avoidedKey,
      [],
      (value): value is Array<string> =>
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'string'),
    ).value

    setEntries(localEntries)
    setDailyLimit(localLimit)
    setAvoided(localAvoided)

    fetchHealthTrackersState()
      .then((state) => {
        if (cancelled) return
        const hasServerState = Boolean(state.updatedAt)
        const serverEntries = isZynEntryArray(state.zyn.entries)
          ? state.zyn.entries
          : localEntries
        setEntries(
          hasServerState || serverEntries.length ? serverEntries : localEntries,
        )
        setDailyLimit(hasServerState ? state.zyn.limit : localLimit)
        setAvoided(hasServerState ? state.zyn.avoided : localAvoided)
        setServerUpdatedAt(state.updatedAt)
        setSyncStatus('synced')
      })
      .catch(() => {
        setSyncStatus('offline')
        // Offline cache is already loaded.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeJsonStorage(storageKey, entries)
    writeJsonStorage(limitKey, dailyLimit)
    writeJsonStorage(avoidedKey, avoided)
    setSyncStatus('syncing')
    const patch = {
      zyn: {
        entries,
        limit: dailyLimit,
        avoided,
      },
    }
    void patchHealthTrackersState(patch, serverUpdatedAt)
      .then((state) => {
        setServerUpdatedAt(state.updatedAt)
        setSyncStatus('synced')
      })
      .catch((error) => {
        if (error instanceof HealthTrackersClientConflictError) {
          const serverEntries = isZynEntryArray(error.current.zyn.entries)
            ? error.current.zyn.entries
            : []
          const mergedEntries = mergeById(entries, serverEntries).sort((a, b) =>
            `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
          )
          const mergedAvoided = Array.from(
            new Set([...avoided, ...error.current.zyn.avoided]),
          ).slice(0, 8)
          const mergedPatch = {
            zyn: {
              entries: mergedEntries,
              limit: dailyLimit,
              avoided: mergedAvoided,
            },
          }
          setEntries(mergedEntries)
          setAvoided(mergedAvoided)
          setServerUpdatedAt(error.current.updatedAt)
          setSyncStatus('conflict')
          void patchHealthTrackersState(mergedPatch, error.current.updatedAt)
            .then((state) => {
              setServerUpdatedAt(state.updatedAt)
              setSyncStatus('synced')
            })
            .catch(() => setSyncStatus('offline'))
          return
        }
        setSyncStatus('offline')
      })
  }, [avoided, dailyLimit, entries, hydrated])

  function addEntry(count: number) {
    const now = new Date()
    setEntries((current) => [
      {
        id: crypto.randomUUID(),
        date: todayKey(),
        time: now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        count,
        strengthMg,
        trigger,
        note,
      },
      ...current,
    ])
    setNote('')
  }

  function logAvoidedCraving() {
    const label = `${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })} avoided ${trigger.toLowerCase()} craving${note ? ` - ${note}` : ''}`
    setAvoided((current) => [label, ...current].slice(0, 8))
    setNote('')
  }

  return (
    <TrackerShell
      title="Zyn"
      description="Pouches, triggers, pace."
      icon={Target02Icon}
      syncStatus={syncStatus}
      syncDetail={syncDetail(serverUpdatedAt)}
    >
      <section aria-label="Zyn dashboard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardTiles.map((tile) => (
            <DashboardTile key={tile.label} tile={tile} />
          ))}
        </div>
      </section>

      <section
        aria-label="Zyn visual plan"
        className="grid gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      >
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                Pace forecast
              </h2>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {paceForecast}/{dailyLimit}
              </p>
            </div>
            <span
              className={cn(
                'rounded-lg border px-3 py-1 text-xs font-semibold',
                paceForecast > dailyLimit
                  ? 'border-rose-400/40 bg-rose-500/10 text-rose-600'
                  : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600',
              )}
            >
              {paceForecast > dailyLimit ? 'Over pace' : 'On pace'}
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar
              value={(paceForecast / Math.max(1, dailyLimit)) * 100}
              tone={paceForecast > dailyLimit ? 'warn' : 'good'}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {substitutionNotes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setNote(item)}
                className={smallButtonClass}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Trigger heatmap
          </h2>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">
            Darker cells show repeat pouch windows.
          </p>
          <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <TriggerHeatmap entries={entries} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 sm:p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Log
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Cap">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) =>
                  setDailyLimit(Number(e.currentTarget.value) || 1)
                }
              />
            </Field>
            <Field label="Strength">
              <select
                className={inputClass}
                value={strengthMg}
                onChange={(e) => setStrengthMg(Number(e.currentTarget.value))}
              >
                {[3, 6].map((mg) => (
                  <option key={mg} value={mg}>
                    {mg} mg
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trigger">
              <select
                className={inputClass}
                value={trigger}
                onChange={(e) => setTrigger(e.currentTarget.value)}
              >
                {[
                  'Focus',
                  'Stress',
                  'After meal',
                  'Driving',
                  'Craving',
                  'Social',
                ].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note">
              <input
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                placeholder="Optional context"
              />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => addEntry(count)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--theme-accent)] px-3 text-sm font-semibold text-white"
              >
                <HugeiconsIcon icon={PlusSignIcon} size={16} /> {count}
              </button>
            ))}
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--theme-bg)]">
            <ProgressBar
              value={(summary.count / dailyLimit) * 100}
              tone={summary.overLimit ? 'warn' : 'accent'}
            />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDelayStartedAt(new Date().toLocaleTimeString())}
              className={smallButtonClass}
            >
              Delay
            </button>
            <button
              type="button"
              onClick={logAvoidedCraving}
              className={smallButtonClass}
            >
              Avoided
            </button>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm font-semibold text-[var(--theme-muted)]">
            {delayStartedAt ? `Delay ${delayStartedAt}` : 'Ready'}
          </div>
        </section>

        <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 md:block">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Timeline
          </h2>
          <div className="mt-4 grid gap-3">
            {todayEntries.length ? (
              todayEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="grid gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="text-sm font-semibold tabular-nums">
                    {entry.time}
                  </span>
                  <span className="text-sm text-[var(--theme-muted)]">
                    {entry.count} pouch{entry.count === 1 ? '' : 'es'} at{' '}
                    {entry.strengthMg} mg - {entry.trigger}
                    {entry.note ? ` - ${entry.note}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEntries((current) =>
                        current.filter((item) => item.id !== entry.id),
                      )
                    }
                    className="min-h-8 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--theme-muted)]"
                  >
                    Del
                  </button>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm text-[var(--theme-muted)]">
                No Zyn today.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 md:block">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
          Plan
        </h2>
        <ToolsStatusRail
          label="Zyn plan"
          className="mt-4"
          items={[
            {
              id: 'average',
              label: '7d avg',
              value: `${insights.weeklyAverage}/day`,
              tone: insights.weeklyAverage > dailyLimit ? 'warning' : 'good',
              progress:
                (insights.weeklyAverage / Math.max(1, dailyLimit)) * 100,
            },
            {
              id: 'streak',
              label: 'Streak',
              value: `${insights.streak}d`,
              tone: insights.streak > 0 ? 'good' : 'neutral',
            },
            {
              id: 'window',
              label: 'Window',
              value: insights.riskiestHour,
            },
            {
              id: 'trigger',
              label: 'Trigger',
              value: insights.riskiestTrigger,
            },
            {
              id: 'next',
              label: 'Next',
              value: `${insights.reductionTarget}/day`,
            },
            { id: 'cost', label: 'Cost', value: `$${insights.cost}` },
            {
              id: 'last',
              label: 'Last',
              value: lastEntry ? lastEntry.time : 'None',
            },
            { id: 'compare', label: 'Compare', value: 'Weekday' },
          ]}
        />
        <div className="mt-4 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
          <h3 className="text-sm font-semibold">Avoided</h3>
          <div className="mt-2 grid gap-1 text-sm text-[var(--theme-muted)]">
            {avoided.length ? (
              avoided.map((entry) => <span key={entry}>{entry}</span>)
            ) : (
              <span>No avoids.</span>
            )}
          </div>
        </div>
      </section>
    </TrackerShell>
  )
}

export type FoodEntry = {
  id: string
  date: string
  time?: string
  meal: string
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  waterOz?: number
  barcode?: string
  confidence: number
}

export function isFoodEntryArray(value: unknown): value is Array<FoodEntry> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as FoodEntry).id === 'string' &&
        typeof (entry as FoodEntry).date === 'string' &&
        typeof (entry as FoodEntry).meal === 'string' &&
        typeof (entry as FoodEntry).description === 'string' &&
        typeof (entry as FoodEntry).calories === 'number' &&
        typeof (entry as FoodEntry).protein === 'number' &&
        typeof (entry as FoodEntry).carbs === 'number' &&
        typeof (entry as FoodEntry).fat === 'number' &&
        typeof (entry as FoodEntry).confidence === 'number',
    )
  )
}

export function estimateFoodFromText(description: string) {
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
  const calories =
    280 +
    (hasLeanProtein ? 180 : 0) +
    (hasCarb ? 160 : 0) +
    (hasFat ? 140 : 0) -
    (hasVegetable ? 40 : 0)
  return {
    calories,
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

export function getFoodSummary(entries: Array<FoodEntry>, date = todayKey()) {
  const today = entries.filter((entry) => entry.date === date)
  return today.reduce(
    (sum, entry) => ({
      calories: sum.calories + entry.calories,
      protein: sum.protein + entry.protein,
      carbs: sum.carbs + entry.carbs,
      fat: sum.fat + entry.fat,
      fiber: sum.fiber + (entry.fiber ?? 0),
      waterOz: sum.waterOz + (entry.waterOz ?? 0),
      count: sum.count + 1,
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      waterOz: 0,
      count: 0,
    },
  )
}

export function getFoodCoaching(summary: ReturnType<typeof getFoodSummary>) {
  const proteinScore = Math.min(100, Math.round((summary.protein / 150) * 100))
  const calorieRemaining = Math.max(0, 2200 - summary.calories)
  const lateNightFlag = false
  const glpSuggestion =
    summary.protein < 100
      ? 'Prioritize lean protein next meal.'
      : summary.fiber < 25
        ? 'Add fiber and water to keep GLP-1 meals easier.'
        : 'Keep meals small, protein-forward, and hydrated.'
  return { proteinScore, calorieRemaining, lateNightFlag, glpSuggestion }
}

export function getFoodDashboardTiles(
  summary: ReturnType<typeof getFoodSummary>,
  coaching: ReturnType<typeof getFoodCoaching>,
  calorieTarget = 2200,
  proteinTarget = 150,
): Array<TrackerDashboardTile> {
  const caloriePace = Math.min(
    100,
    (summary.calories / Math.max(1, calorieTarget)) * 100,
  )
  const proteinPace = Math.min(
    100,
    (summary.protein / Math.max(1, proteinTarget)) * 100,
  )
  return [
    {
      label: 'Calorie runway',
      value: String(Math.max(0, calorieTarget - summary.calories)),
      detail: `${summary.calories} logged of ${calorieTarget}`,
      trend: [18, 32, 54, caloriePace],
      tone: summary.calories > calorieTarget ? 'warn' : 'accent',
    },
    {
      label: 'Protein score',
      value: `${Math.round(proteinPace)}%`,
      detail: `${summary.protein} g of ${proteinTarget} g`,
      trend: [20, 38, 56, proteinPace],
      tone: proteinPace >= 70 ? 'good' : 'accent',
    },
    {
      label: 'Fiber + water',
      value: `${summary.fiber}g / ${summary.waterOz}oz`,
      detail: 'GLP-1 comfort guardrail',
      trend: [
        10,
        Math.min(100, summary.fiber * 3),
        Math.min(100, summary.waterOz),
        Math.min(100, summary.fiber * 3 + summary.waterOz / 2),
      ],
      tone: summary.fiber >= 20 && summary.waterOz >= 64 ? 'good' : 'accent',
    },
    {
      label: 'Meal count',
      value: String(summary.count),
      detail: coaching.glpSuggestion,
      trend: [14, 28, 42, Math.min(100, summary.count * 24)],
      tone: 'accent',
    },
  ]
}

export function FoodLogPage() {
  usePageTitle('Food Log')
  const [entries, setEntries] = useState<Array<FoodEntry>>([])
  const [meal, setMeal] = useState('Lunch')
  const [description, setDescription] = useState('')
  const [estimate, setEstimate] = useState(() =>
    estimateFoodFromText('chicken rice vegetables'),
  )
  const [barcode, setBarcode] = useState('')
  const [favoriteMeals, setFavoriteMeals] = useState<Array<string>>([])
  const [photoName, setPhotoName] = useState('')
  const [calorieTarget, setCalorieTarget] = useState(2200)
  const [proteinTarget, setProteinTarget] = useState(150)
  const [hydrated, setHydrated] = useState(false)
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const storageKey = 'workspace.health.food.entries'
  const favoriteKey = 'workspace.health.food.favorites'
  const calorieTargetKey = 'workspace.health.food.calorie-target'
  const proteinTargetKey = 'workspace.health.food.protein-target'
  const summary = getFoodSummary(entries)
  const coaching = getFoodCoaching(summary)
  const dashboardTiles = getFoodDashboardTiles(
    summary,
    coaching,
    calorieTarget,
    proteinTarget,
  )
  const todayEntries = entries.filter((entry) => entry.date === todayKey())
  const macroWatch =
    summary.count > 0 &&
    (summary.protein < proteinTarget * 0.5 ||
      summary.calories < calorieTarget * 0.35)

  useEffect(() => {
    let cancelled = false
    const localEntries = readJsonStorage(storageKey, [], isFoodEntryArray).value
    const localFavorites = readJsonStorage(
      favoriteKey,
      [],
      (value): value is Array<string> =>
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'string'),
    ).value
    const localCalories = readJsonStorage(
      calorieTargetKey,
      2200,
      (value): value is number => typeof value === 'number',
    ).value
    const localProtein = readJsonStorage(
      proteinTargetKey,
      150,
      (value): value is number => typeof value === 'number',
    ).value

    setEntries(localEntries)
    setFavoriteMeals(localFavorites)
    setCalorieTarget(localCalories)
    setProteinTarget(localProtein)

    fetchHealthTrackersState()
      .then((state) => {
        if (cancelled) return
        const hasServerState = Boolean(state.updatedAt)
        const serverEntries = isFoodEntryArray(state.food.entries)
          ? state.food.entries
          : localEntries
        setEntries(
          hasServerState || serverEntries.length ? serverEntries : localEntries,
        )
        setFavoriteMeals(hasServerState ? state.food.favorites : localFavorites)
        setCalorieTarget(
          hasServerState ? state.food.calorieTarget : localCalories,
        )
        setProteinTarget(
          hasServerState ? state.food.proteinTarget : localProtein,
        )
        setServerUpdatedAt(state.updatedAt)
        setSyncStatus('synced')
      })
      .catch(() => {
        setSyncStatus('offline')
        // Offline cache is already loaded.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeJsonStorage(storageKey, entries)
    writeJsonStorage(favoriteKey, favoriteMeals)
    writeJsonStorage(calorieTargetKey, calorieTarget)
    writeJsonStorage(proteinTargetKey, proteinTarget)
    setSyncStatus('syncing')
    const patch = {
      food: {
        entries,
        favorites: favoriteMeals,
        calorieTarget,
        proteinTarget,
      },
    }
    void patchHealthTrackersState(patch, serverUpdatedAt)
      .then((state) => {
        setServerUpdatedAt(state.updatedAt)
        setSyncStatus('synced')
      })
      .catch((error) => {
        if (error instanceof HealthTrackersClientConflictError) {
          const serverEntries = isFoodEntryArray(error.current.food.entries)
            ? error.current.food.entries
            : []
          const mergedEntries = mergeById(entries, serverEntries).sort((a, b) =>
            `${b.date} ${b.time ?? ''}`.localeCompare(
              `${a.date} ${a.time ?? ''}`,
            ),
          )
          const mergedFavorites = Array.from(
            new Set([...favoriteMeals, ...error.current.food.favorites]),
          ).slice(0, 6)
          const mergedPatch = {
            food: {
              entries: mergedEntries,
              favorites: mergedFavorites,
              calorieTarget,
              proteinTarget,
            },
          }
          setEntries(mergedEntries)
          setFavoriteMeals(mergedFavorites)
          setServerUpdatedAt(error.current.updatedAt)
          setSyncStatus('conflict')
          void patchHealthTrackersState(mergedPatch, error.current.updatedAt)
            .then((state) => {
              setServerUpdatedAt(state.updatedAt)
              setSyncStatus('synced')
            })
            .catch(() => setSyncStatus('offline'))
          return
        }
        setSyncStatus('offline')
      })
  }, [calorieTarget, entries, favoriteMeals, hydrated, proteinTarget])

  useEffect(() => {
    if (description.trim()) setEstimate(estimateFoodFromText(description))
  }, [description])

  function addFood() {
    if (!description.trim()) return
    setEntries((current) => [
      {
        id: crypto.randomUUID(),
        date: todayKey(),
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        meal,
        description: description.trim(),
        barcode,
        ...estimate,
      },
      ...current,
    ])
    setDescription('')
    setBarcode('')
  }

  function applyTemplate(nextDescription: string) {
    setDescription(nextDescription)
    setEstimate(estimateFoodFromText(nextDescription))
  }

  function saveFavorite(descriptionToSave: string) {
    if (!descriptionToSave.trim()) return
    setFavoriteMeals((current) =>
      [
        descriptionToSave.trim(),
        ...current.filter((item) => item !== descriptionToSave.trim()),
      ].slice(0, 6),
    )
  }

  return (
    <TrackerShell
      title="Food"
      description="Meals, macros, totals."
      icon={Apple01Icon}
      syncStatus={syncStatus}
      syncDetail={syncDetail(serverUpdatedAt)}
    >
      <section aria-label="Food dashboard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardTiles.map((tile) => (
            <DashboardTile key={tile.label} tile={tile} />
          ))}
        </div>
      </section>

      <section
        aria-label="Food visual targets"
        className="grid gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Macro rings
          </h2>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">
            Calories, protein, fiber against targets.
          </p>
          <div className="mt-3">
            <MacroRings
              calories={summary.calories}
              calorieTarget={calorieTarget}
              protein={summary.protein}
              proteinTarget={proteinTarget}
              fiber={summary.fiber}
            />
          </div>
        </div>
        <div className="grid gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Meal timing
            </h2>
            <p className="mt-1 text-sm text-[var(--theme-muted)]">
              One glance at today&apos;s intake gaps.
            </p>
          </div>
          <MealTimeline entries={todayEntries} />
          <div
            className={cn(
              'rounded-lg border p-3 text-sm',
              macroWatch
                ? 'border-amber-400/40 bg-amber-500/10'
                : 'border-[var(--theme-border)] bg-[var(--theme-bg)]',
            )}
          >
            <span className="font-semibold">
              {macroWatch ? 'Low intake watch' : 'GLP-1 guardrail'}
            </span>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              {coaching.glpSuggestion}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Capture
            </h2>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-muted)]">
              <HugeiconsIcon icon={AiScanIcon} size={15} /> AI est.
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="Meal">
              <select
                className={inputClass}
                value={meal}
                onChange={(e) => setMeal(e.currentTarget.value)}
              >
                {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Food">
              <textarea
                className={cn(inputClass, 'min-h-28 py-2')}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                placeholder="Chicken bowl, rice, avocado, salsa"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Barcode">
                <input
                  className={inputClass}
                  value={barcode}
                  onChange={(event) => setBarcode(event.currentTarget.value)}
                  placeholder="Scan or type code"
                />
              </Field>
              <Field label="Photo">
                <input
                  className={cn(
                    inputClass,
                    'max-w-full file:mr-2 file:rounded-md file:border-0 file:bg-[var(--theme-card)] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[var(--theme-text)]',
                  )}
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setPhotoName(event.currentTarget.files?.[0]?.name ?? '')
                  }
                />
              </Field>
            </div>
            {photoName ? (
              <p className="text-sm text-[var(--theme-muted)]">
                Photo ready: {photoName}
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              ['Calories', 'calories'],
              ['Protein', 'protein'],
              ['Carbs', 'carbs'],
              ['Fat', 'fat'],
            ].map(([label, key]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                  {label}
                </p>
                <input
                  className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                  inputMode="numeric"
                  value={String(estimate[key as keyof typeof estimate])}
                  onChange={(event) =>
                    setEstimate((current) => ({
                      ...current,
                      [key]: Number(event.currentTarget.value) || 0,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--theme-muted)]">
            <HugeiconsIcon icon={ChartAverageIcon} size={17} />
            {estimate.confidence}% confidence
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addFood}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-accent)] px-4 text-sm font-semibold text-white sm:w-auto"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={17} /> Add
            </button>
            <button
              type="button"
              onClick={() => saveFavorite(description)}
              className={smallButtonClass}
            >
              Favorite
            </button>
          </div>
        </section>

        <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 md:block">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Meals
          </h2>
          <div className="mt-4 grid gap-3">
            {todayEntries.length ? (
              todayEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{entry.meal}</h3>
                      <p className="mt-1 text-sm text-[var(--theme-muted)]">
                        {entry.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEntries((current) =>
                          current.filter((item) => item.id !== entry.id),
                        )
                      }
                      className="min-h-8 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--theme-muted)]"
                    >
                      Del
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <span className="rounded-lg border border-[var(--theme-border)] p-2">
                      {entry.calories} cal
                    </span>
                    <span className="rounded-lg border border-[var(--theme-border)] p-2">
                      {entry.protein}g P
                    </span>
                    <span className="rounded-lg border border-[var(--theme-border)] p-2">
                      {entry.carbs}g C
                    </span>
                    <span className="rounded-lg border border-[var(--theme-border)] p-2">
                      {entry.fat}g F
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm text-[var(--theme-muted)]">
                No food today.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 md:block">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
          Targets
        </h2>
        <ToolsStatusRail
          label="Food targets"
          className="mt-4"
          items={[
            {
              id: 'left',
              label: 'Left',
              value: String(Math.max(0, calorieTarget - summary.calories)),
              tone: summary.calories > calorieTarget ? 'warning' : 'neutral',
              progress: (summary.calories / Math.max(1, calorieTarget)) * 100,
            },
            {
              id: 'protein',
              label: 'Protein',
              value: `${Math.min(100, Math.round((summary.protein / proteinTarget) * 100))}%`,
              tone: summary.protein >= proteinTarget * 0.7 ? 'good' : 'neutral',
              progress: (summary.protein / Math.max(1, proteinTarget)) * 100,
            },
            {
              id: 'fiber',
              label: 'Fiber',
              value: `${summary.fiber}g`,
              progress: (summary.fiber / 25) * 100,
            },
            {
              id: 'water',
              label: 'Water',
              value: `${summary.waterOz}oz`,
              progress: (summary.waterOz / 80) * 100,
            },
          ]}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Cal goal">
            <input
              className={inputClass}
              type="number"
              value={calorieTarget}
              onChange={(event) =>
                setCalorieTarget(Number(event.currentTarget.value) || 0)
              }
            />
          </Field>
          <Field label="Protein goal">
            <input
              className={inputClass}
              type="number"
              value={proteinTarget}
              onChange={(event) =>
                setProteinTarget(Number(event.currentTarget.value) || 1)
              }
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <h3 className="text-sm font-semibold">Templates</h3>
            <div className="mt-2 grid gap-2">
              {[
                'grilled chicken bowl with rice, avocado, peppers, and salsa',
                'greek yogurt with granola and banana',
                'salmon with potato and asparagus',
                'restaurant burger with fries',
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-lg border border-[var(--theme-border)] px-3 py-2 text-left text-xs leading-snug text-[var(--theme-muted)] [overflow-wrap:anywhere]"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <h3 className="text-sm font-semibold">Favorites</h3>
            <div className="mt-2 grid gap-2">
              {favoriteMeals.length ? (
                favoriteMeals.map((favorite) => (
                  <button
                    key={favorite}
                    type="button"
                    onClick={() => applyTemplate(favorite)}
                    className="truncate rounded-lg border border-[var(--theme-border)] px-3 py-2 text-left text-xs text-[var(--theme-muted)]"
                  >
                    {favorite}
                  </button>
                ))
              ) : (
                <p className="text-sm text-[var(--theme-muted)]">
                  Save frequent meals.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <h3 className="text-sm font-semibold">Coach</h3>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--theme-muted)]">
              {coaching.glpSuggestion}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Late meal: 9 PM
            </p>
            <ProgressBar value={coaching.proteinScore} tone="good" />
          </div>
        </div>
      </section>
    </TrackerShell>
  )
}
