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
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-4 pb-[calc(var(--tabbar-h,0px)+24px)] sm:px-5 lg:px-6">
        <header className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-accent)]">
                <HugeiconsIcon icon={icon} size={22} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold">{title}</h1>
                <p className="mt-1 max-w-[760px] text-sm text-[var(--theme-muted)]">
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
    loading: ['bg-slate-500', 'Loading'],
    synced: ['bg-emerald-500', 'Synced'],
    syncing: ['bg-sky-500', 'Syncing'],
    offline: ['bg-amber-500', 'Offline cache'],
    conflict: ['bg-violet-500', 'Merged update'],
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
  if (!updatedAt) return 'Not synced yet'
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return undefined
  return `Updated ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--theme-muted)]">{detail}</p>
    </section>
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
  'min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]'

const smallButtonClass =
  'min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--theme-text)]'

function InsightCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[var(--theme-muted)]">{detail}</p>
    </div>
  )
}

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
      title="Wegovy Shots"
      description="Weekly dose log with injection site rotation, weight trend, next due date, and side-effect notes."
      icon={InjectionIcon}
      syncStatus={syncStatus}
      syncDetail={syncDetail(serverUpdatedAt)}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Next shot"
          value={summary.nextDue}
          detail={
            summary.daysUntilDue > 0
              ? `${summary.daysUntilDue} day${summary.daysUntilDue === 1 ? '' : 's'} out`
              : summary.daysUntilDue === 0
                ? 'Due today'
                : `${Math.abs(summary.daysUntilDue)} day${Math.abs(summary.daysUntilDue) === 1 ? '' : 's'} overdue`
          }
        />
        <MetricCard
          label="Current dose"
          value={`${summary.currentDose || Number(doseMg)} mg`}
          detail="Most recent logged dose"
        />
        <MetricCard
          label="Logged shots"
          value={String(summary.totalShots)}
          detail="Stored locally in this browser"
        />
        <MetricCard
          label="Weight delta"
          value={formatSigned(summary.weightChange, ' lb')}
          detail="Compared with previous shot"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Log shot
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
            <Field label="Injection site">
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
            <Field label={`Appetite before shot: ${appetiteBefore}/10`}>
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
            <Field label={`Appetite after shot: ${appetiteAfter}/10`}>
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
          <Field label="Side effects">
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
              placeholder="Meal timing, appetite, sleep, hydration"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Field>
          <button
            type="button"
            onClick={addShot}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-accent)] px-4 text-sm font-semibold text-white sm:w-auto"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={17} /> Add shot
          </button>
        </section>

        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Shot history
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
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-[var(--theme-muted)] sm:grid-cols-3">
                    <span>{shot.doseMg} mg</span>
                    <span>{shot.site}</span>
                    <span>{shot.weightLb || '-'} lb</span>
                  </div>
                  <p className="mt-2 text-sm">
                    {shot.sideEffects || 'No side effects logged.'}
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
                No shots logged yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Shot planning
            </h2>
            <p className="mt-1 text-sm text-[var(--theme-muted)]">
              Reminder, escalation, supply, refill, rotation, and visit-summary
              tools.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(doctorSummary)}
            className={smallButtonClass}
          >
            Copy doctor summary
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            label="Reminder"
            value={`${summary.nextDue} at ${reminderTime}`}
            detail="Weekly shot reminder target"
          />
          <InsightCard
            label="Escalation"
            value={`${dosePlan.current} -> ${dosePlan.next} mg`}
            detail="Dose ladder reference only"
          />
          <InsightCard
            label="Site rotation"
            value={suggestedSite}
            detail="Suggested next injection site"
          />
          <InsightCard
            label="Supply"
            value={`${penSupply} pen${penSupply === 1 ? '' : 's'}`}
            detail={`Refill target ${refillDate}`}
          />
          <InsightCard
            label="Side effects"
            value={sideEffectSummary.label}
            detail={`${sideEffectSummary.nausea} nausea, ${sideEffectSummary.constipation} constipation, ${sideEffectSummary.headache} headache in recent shots`}
          />
          <InsightCard
            label="Appetite"
            value={formatSigned(summary.appetiteChange, ' pts')}
            detail="Latest before/after shot change"
          />
          <InsightCard
            label="Waist"
            value={formatSigned(summary.waistChange, ' in')}
            detail="Compared with previous shot"
          />
          <InsightCard
            label="Cross-check"
            value="Food + Zyn"
            detail="Review food log and Zyn cravings against shot week"
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Reminder time">
            <input
              type="time"
              className={inputClass}
              value={reminderTime}
              onChange={(event) => setReminderTime(event.currentTarget.value)}
            />
          </Field>
          <Field label="Pens on hand">
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
          <Field label="Refill date">
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
  const lastEntry = [...entries].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
  )[0]

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
      title="Zyn Tracker"
      description="Daily pouch count, nicotine estimate, trigger notes, and limit pacing."
      icon={Target02Icon}
      syncStatus={syncStatus}
      syncDetail={syncDetail(serverUpdatedAt)}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Today"
          value={`${summary.count}/${dailyLimit}`}
          detail="Pouches logged"
        />
        <MetricCard
          label="Nicotine"
          value={`${summary.nicotineMg} mg`}
          detail="Estimated from selected strength"
        />
        <MetricCard
          label="Remaining"
          value={String(summary.remaining)}
          detail={
            summary.overLimit ? 'Daily limit exceeded' : 'Before daily cap'
          }
        />
        <MetricCard
          label="Entries"
          value={String(todayEntries.length)}
          detail="Separate moments today"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Quick log
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Daily cap">
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
              Delay 10 minutes
            </button>
            <button
              type="button"
              onClick={logAvoidedCraving}
              className={smallButtonClass}
            >
              Log avoided craving
            </button>
          </div>
          <p className="mt-3 text-sm text-[var(--theme-muted)]">
            {delayStartedAt
              ? `Delay mode started at ${delayStartedAt}. Try water, a walk, or a two-minute breathing reset before logging.`
              : 'Craving mode is ready when you want to delay instead of logging.'}
          </p>
        </section>

        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Today timeline
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
                    Remove
                  </button>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm text-[var(--theme-muted)]">
                No Zyn logged today.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
          Reduction plan
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            label="Weekly average"
            value={`${insights.weeklyAverage}/day`}
            detail="Rolling average across logged days"
          />
          <InsightCard
            label="Under-limit streak"
            value={`${insights.streak} day${insights.streak === 1 ? '' : 's'}`}
            detail="Days at or under the current cap"
          />
          <InsightCard
            label="Risk window"
            value={insights.riskiestHour}
            detail="Most common logged hour"
          />
          <InsightCard
            label="Top trigger"
            value={insights.riskiestTrigger}
            detail="Highest pouch-count tag"
          />
          <InsightCard
            label="Next cap"
            value={`${insights.reductionTarget}/day`}
            detail="Monthly reduction target"
          />
          <InsightCard
            label="Cost"
            value={`$${insights.cost}`}
            detail="Estimated at $0.28 per pouch"
          />
          <InsightCard
            label="Last pouch"
            value={lastEntry ? `${lastEntry.date} ${lastEntry.time}` : 'None'}
            detail="Timer anchor for spacing"
          />
          <InsightCard
            label="Workday compare"
            value="Weekday / weekend"
            detail="Use triggers to compare stress and social patterns"
          />
        </div>
        <div className="mt-4 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
          <h3 className="text-sm font-semibold">Avoided cravings</h3>
          <div className="mt-2 grid gap-1 text-sm text-[var(--theme-muted)]">
            {avoided.length ? (
              avoided.map((entry) => <span key={entry}>{entry}</span>)
            ) : (
              <span>No avoided cravings logged yet.</span>
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
  const todayEntries = entries.filter((entry) => entry.date === todayKey())

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
      title="Food Log"
      description="Cal AI-style meal capture with natural-language estimates, macro review, daily totals, and editable meal cards."
      icon={Apple01Icon}
      syncStatus={syncStatus}
      syncDetail={syncDetail(serverUpdatedAt)}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Calories"
          value={String(summary.calories)}
          detail="Today total"
        />
        <MetricCard
          label="Protein"
          value={`${summary.protein} g`}
          detail="Today total"
        />
        <MetricCard
          label="Carbs"
          value={`${summary.carbs} g`}
          detail="Today total"
        />
        <MetricCard
          label="Fat"
          value={`${summary.fat} g`}
          detail="Today total"
        />
        <MetricCard
          label="Meals"
          value={String(summary.count)}
          detail="Logged today"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Capture meal
            </h2>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-muted)]">
              <HugeiconsIcon icon={AiScanIcon} size={15} /> Estimate
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
            <Field label="What did you eat?">
              <textarea
                className={cn(inputClass, 'min-h-28 py-2')}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                placeholder="Example: grilled chicken bowl with rice, avocado, peppers, and salsa"
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
                  className={inputClass}
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
                Photo ready for meal review: {photoName}
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
            {estimate.confidence}% estimate confidence. Adjust text detail to
            improve the estimate.
          </div>
          <button
            type="button"
            onClick={addFood}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-accent)] px-4 text-sm font-semibold text-white sm:w-auto"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={17} /> Add meal
          </button>
          <button
            type="button"
            onClick={() => saveFavorite(description)}
            className={cn(smallButtonClass, 'ml-0 mt-2 sm:ml-2')}
          >
            Save favorite
          </button>
        </section>

        <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Today meals
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
                      Remove
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
                No food logged today.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
          Nutrition targets
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            label="Calories left"
            value={String(Math.max(0, calorieTarget - summary.calories))}
            detail={`Target ${calorieTarget} calories`}
          />
          <InsightCard
            label="Protein score"
            value={`${Math.min(100, Math.round((summary.protein / proteinTarget) * 100))}%`}
            detail={`Target ${proteinTarget} g`}
          />
          <InsightCard
            label="Fiber"
            value={`${summary.fiber} g`}
            detail="Daily fiber total"
          />
          <InsightCard
            label="Water"
            value={`${summary.waterOz} oz`}
            detail="Water logged with meals"
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Calorie target">
            <input
              className={inputClass}
              type="number"
              value={calorieTarget}
              onChange={(event) =>
                setCalorieTarget(Number(event.currentTarget.value) || 0)
              }
            />
          </Field>
          <Field label="Protein target">
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
            <h3 className="text-sm font-semibold">Meal templates</h3>
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
                  className="rounded-lg border border-[var(--theme-border)] px-3 py-2 text-left text-xs text-[var(--theme-muted)]"
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
                    className="rounded-lg border border-[var(--theme-border)] px-3 py-2 text-left text-xs text-[var(--theme-muted)]"
                  >
                    {favorite}
                  </button>
                ))
              ) : (
                <p className="text-sm text-[var(--theme-muted)]">
                  Save frequent meals here.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <h3 className="text-sm font-semibold">GLP-1 meal coach</h3>
            <p className="mt-2 text-sm text-[var(--theme-muted)]">
              {coaching.glpSuggestion}
            </p>
            <p className="mt-2 text-sm text-[var(--theme-muted)]">
              Late-night flag: review any meal logged after 9 PM.
            </p>
            <ProgressBar value={coaching.proteinScore} tone="good" />
          </div>
        </div>
      </section>
    </TrackerShell>
  )
}
