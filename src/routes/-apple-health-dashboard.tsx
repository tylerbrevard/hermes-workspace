import { HugeiconsIcon } from '@hugeicons/react'
import {
  Activity01Icon,
  Apple01Icon,
  ChartAverageIcon,
  Moon02Icon,
  Pulse01Icon,
  RunningShoesIcon,
} from '@hugeicons/core-free-icons'
import { useEffect, useMemo, useState } from 'react'
import type { AppleHealthDashboardPayload } from '@/lib/apple-health-client'
import type { ToolsStatusRailItem } from '@/components/tools-action-dock'
import { usePageTitle } from '@/hooks/use-page-title'
import { fetchAppleHealthDashboard } from '@/lib/apple-health-client'
import { cn } from '@/lib/utils'
import { withBasePath } from '@/lib/base-path'
import {
  ToolsActionDock,
  ToolsStatusRail,
} from '@/components/tools-action-dock'
import {
  DualLineChart,
  MiniBars,
  SleepDebtMeter,
} from '@/components/health/health-visuals'

type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: AppleHealthDashboardPayload; error: null }
  | { status: 'error'; data: null; error: string }

const tileIcons = {
  steps: RunningShoesIcon,
  sleep: Moon02Icon,
  hrv: Pulse01Icon,
  'resting-heart-rate': Activity01Icon,
  'active-energy': ChartAverageIcon,
  exercise: Activity01Icon,
}

function formatDate(value: string | null) {
  if (!value) return 'No data'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateTime(value: string | null) {
  if (!value) return 'Never'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function compactNumber(value: number | null, suffix = '') {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value).toLocaleString()}${suffix}`
}

function Sparkline({
  values,
  tone,
}: {
  values: Array<number | null>
  tone: 'good' | 'watch' | 'neutral'
}) {
  const valid = values
    .slice()
    .reverse()
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } =>
      Number.isFinite(item.value),
    )
  if (valid.length < 2) {
    return (
      <div className="flex h-12 items-center text-xs text-[var(--theme-muted)]">
        No trend
      </div>
    )
  }

  const min = Math.min(...valid.map((item) => item.value))
  const max = Math.max(...valid.map((item) => item.value))
  const range = max - min || 1
  const width = 180
  const height = 46
  const points = valid
    .map((item, index) => {
      const x = (index / Math.max(1, valid.length - 1)) * width
      const y = height - ((item.value - min) / range) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="30 day trend"
      className="h-12 w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        points={points}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          tone === 'good'
            ? 'stroke-emerald-500'
            : tone === 'watch'
              ? 'stroke-amber-500'
              : 'stroke-[var(--theme-accent)]',
        )}
      />
    </svg>
  )
}

function StatusPill({ payload }: { payload: AppleHealthDashboardPayload }) {
  const stale = payload.source.status !== 'fresh'
  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-xs font-semibold">
      <span
        className={cn(
          'size-2 rounded-full',
          stale ? 'bg-amber-500' : 'bg-emerald-500',
        )}
      />
      <span>{stale ? 'Sync' : 'Fresh'}</span>
      <span className="hidden font-normal text-[var(--theme-muted)] sm:inline">
        {formatDate(payload.source.latestDate)}
      </span>
    </div>
  )
}

function MetricTile({
  tile,
}: {
  tile: AppleHealthDashboardPayload['tiles'][number]
}) {
  const Icon = tileIcons[tile.id as keyof typeof tileIcons] || ChartAverageIcon
  return (
    <section className="min-h-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-sm sm:min-h-[176px] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            {tile.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl">
            {tile.value}
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-accent)]">
          <HugeiconsIcon icon={Icon} size={18} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-2 sm:mt-4">
        <Sparkline values={tile.series} tone={tile.tone} />
      </div>
      <p
        className={cn(
          'mt-1 line-clamp-1 text-xs sm:mt-2 sm:line-clamp-none',
          tile.tone === 'good'
            ? 'text-emerald-600'
            : tile.tone === 'watch'
              ? 'text-amber-600'
              : 'text-[var(--theme-muted)]',
        )}
      >
        {tile.detail}
      </p>
    </section>
  )
}

function getTile(payload: AppleHealthDashboardPayload, id: string) {
  return payload.tiles.find((tile) => tile.id === id) ?? null
}

function countMissingRecentDays(payload: AppleHealthDashboardPayload) {
  return payload.days
    .slice(0, 7)
    .filter(
      (day) =>
        day.steps == null &&
        day.sleepDurationMinutes == null &&
        day.activeEnergyKcal == null &&
        day.exerciseMinutes == null,
    ).length
}

function HealthCommandCenter({
  payload,
}: {
  payload: AppleHealthDashboardPayload
}) {
  const sleep = getTile(payload, 'sleep')
  const steps = getTile(payload, 'steps')
  const hrv = getTile(payload, 'hrv')
  const exercise = getTile(payload, 'exercise')
  const watchCount =
    payload.tiles.filter((tile) => tile.tone === 'watch').length +
    (payload.source.status === 'fresh' ? 0 : 1)
  const missingDays = countMissingRecentDays(payload)
  const posture =
    payload.review.status === 'stale' || payload.review.status === 'empty'
      ? 'Sync needed'
      : watchCount >= 3
        ? 'Watch recovery'
        : watchCount > 0
          ? 'Light watch'
          : 'On track'
  const postureTone =
    payload.review.status === 'stale' || payload.review.status === 'empty'
      ? 'watch'
      : watchCount >= 3
        ? 'watch'
        : watchCount > 0
          ? 'neutral'
          : 'good'
  const actionTiles: Array<ToolsStatusRailItem> = [
    {
      id: 'recovery',
      label: 'Recovery',
      value: hrv?.value ?? '—',
      tone: hrv?.tone === 'watch' ? 'warning' : (hrv?.tone ?? 'neutral'),
      progress: hrv?.tone === 'watch' ? 82 : 36,
    },
    {
      id: 'activity',
      label: 'Activity',
      value: steps?.value ?? '—',
      tone: steps?.tone === 'watch' ? 'warning' : (steps?.tone ?? 'neutral'),
      progress: steps?.tone === 'watch' ? 72 : 44,
    },
    {
      id: 'sleep',
      label: 'Sleep',
      value: sleep?.value ?? '—',
      tone: sleep?.tone === 'watch' ? 'warning' : (sleep?.tone ?? 'neutral'),
      progress: sleep?.tone === 'watch' ? 78 : 42,
    },
    {
      id: 'exercise',
      label: 'Exercise',
      value: exercise?.value ?? '—',
      tone:
        exercise?.tone === 'watch' ? 'warning' : (exercise?.tone ?? 'neutral'),
      progress: exercise?.tone === 'watch' ? 68 : 40,
    },
  ]

  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
            Today risk
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{posture}</h2>
        </div>
        <span
          className={cn(
            'inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold',
            postureTone === 'good'
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-600'
              : postureTone === 'watch'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-600'
                : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-muted)]',
          )}
        >
          {watchCount} watch · {missingDays} gaps
        </span>
      </div>
      <ToolsStatusRail
        className="mt-4"
        label="Apple Health status"
        items={actionTiles}
      />
    </section>
  )
}

function AiReview({ payload }: { payload: AppleHealthDashboardPayload }) {
  const { review } = payload
  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            AI Health Review
          </p>
          <h2 className="mt-2 text-lg font-semibold">{review.headline}</h2>
        </div>
        <span
          className={cn(
            'inline-flex w-fit rounded-lg px-3 py-1 text-xs font-semibold',
            review.status === 'ready'
              ? 'bg-emerald-500/15 text-emerald-600'
              : review.status === 'stale'
                ? 'bg-amber-500/15 text-amber-600'
                : review.status === 'empty'
                  ? 'bg-slate-500/15 text-slate-600'
                  : 'bg-rose-500/15 text-rose-600',
          )}
        >
          {review.status}
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Signals</h3>
          <ul className="mt-2 grid gap-2 text-sm text-[var(--theme-muted)]">
            {review.evidence.map((item) => (
              <li key={item} className="rounded-lg bg-[var(--theme-bg)] p-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Actions</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {review.advice.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-xs text-[var(--theme-muted)]">
        {review.caveats.join(' ')}
      </p>
    </section>
  )
}

function DailyTable({ payload }: { payload: AppleHealthDashboardPayload }) {
  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Days</h2>
        <span className="text-xs text-[var(--theme-muted)]">
          {payload.days.length}
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Steps</th>
              <th className="py-2 pr-4">Sleep</th>
              <th className="py-2 pr-4">HRV</th>
              <th className="py-2 pr-4">Resting HR</th>
              <th className="py-2 pr-4">Exercise</th>
            </tr>
          </thead>
          <tbody>
            {payload.days.slice(0, 10).map((day) => (
              <tr
                key={day.date}
                className="border-t border-[var(--theme-border)]"
              >
                <td className="py-2 pr-4 font-medium">
                  {formatDate(day.date)}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {compactNumber(day.steps)}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {day.sleepDurationMinutes == null
                    ? '—'
                    : `${(day.sleepDurationMinutes / 60).toFixed(1)}h`}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {compactNumber(day.hrvAvg, ' ms')}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {compactNumber(day.restingHeartRate, ' bpm')}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {compactNumber(day.exerciseMinutes, ' min')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Workouts({ payload }: { payload: AppleHealthDashboardPayload }) {
  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Workouts</h2>
        <span className="text-xs text-[var(--theme-muted)]">
          {payload.recentWorkouts.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {payload.recentWorkouts.length ? (
          payload.recentWorkouts.map((workout) => (
            <div
              key={`${workout.type}-${workout.startDate}`}
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{workout.type}</span>
                <span className="text-xs text-[var(--theme-muted)]">
                  {formatDate(workout.startDate.slice(0, 10))}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--theme-muted)]">
                {compactNumber(workout.activeEnergyKcal, ' kcal')}
                {workout.avgHeartRate
                  ? ` · ${compactNumber(workout.avgHeartRate, ' bpm avg')}`
                  : ''}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-[var(--theme-bg)] p-3 text-sm text-[var(--theme-muted)]">
            No workouts.
          </p>
        )}
      </div>
    </section>
  )
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  )
  if (!valid.length) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function HealthPatternPanel({
  payload,
}: {
  payload: AppleHealthDashboardPayload
}) {
  const days = payload.days.slice(0, 14).reverse()
  const sleep7 = average(
    payload.days.slice(0, 7).map((day) => day.sleepDurationMinutes),
  )
  const sleepDebt7 = Math.max(0, 8 * 60 - sleep7)
  const strainSeries = days.map((day) => day.activeEnergyKcal)
  const recoverySeries = days.map((day) => day.hrvAvg)
  const stepSeries = days.map((day) => day.steps)
  const exerciseSeries = days.map((day) => day.exerciseMinutes)
  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            Recovery / strain
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {sleepDebt7 > 60 ? 'Protect recovery' : 'Activity balance'}
          </h2>
        </div>
        <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-1 text-xs font-semibold text-[var(--theme-muted)]">
          14d
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <DualLineChart
          primary={recoverySeries}
          secondary={strainSeries}
          primaryLabel="HRV"
          secondaryLabel="Energy"
        />
        <div className="grid gap-3">
          <SleepDebtMeter actualMinutes={sleep7} />
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Steps</span>
              <span className="text-[var(--theme-muted)]">14d</span>
            </div>
            <MiniBars values={stepSeries} tone="neutral" />
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Exercise</span>
              <span className="text-[var(--theme-muted)]">min</span>
            </div>
            <MiniBars values={exerciseSeries} tone="good" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function AppleHealthDashboardPage() {
  usePageTitle('Apple Health')
  const [state, setState] = useState<LoadState>({
    status: 'loading',
    data: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    fetchAppleHealthDashboard()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: 'error',
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Apple Health load failed',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const payload = state.data
  const headerDetail = useMemo(() => {
    if (!payload) return 'Loading Health Bridge.'
    return `${payload.healthDb.totalDays}d · ${payload.healthDb.totalMetrics} metrics · ${formatDateTime(payload.healthDb.lastIngested)}`
  }, [payload])

  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 px-3 py-3 pb-[calc(var(--tabbar-h,0px)+16px)] sm:gap-4 sm:px-5 sm:py-4 sm:pb-[calc(var(--tabbar-h,0px)+24px)] lg:px-6">
        <header className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-3 shadow-sm sm:px-4 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-accent)] sm:size-11">
                <HugeiconsIcon icon={Apple01Icon} size={22} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold">Health</h1>
                <p className="mt-1 line-clamp-1 text-xs text-[var(--theme-muted)] sm:text-sm">
                  {headerDetail}
                </p>
              </div>
            </div>
            {payload ? <StatusPill payload={payload} /> : null}
          </div>
          <ToolsActionDock
            className="mt-3 sm:mt-4"
            label="Apple Health quick actions"
            items={[
              {
                id: 'food',
                label: 'Food',
                icon: 'add',
                href: withBasePath('/food-log'),
                meta: 'Log',
                tone: 'primary',
              },
              {
                id: 'zyn',
                label: 'Zyn',
                icon: 'check',
                href: withBasePath('/zyn-tracker'),
                meta: 'Pace',
              },
              {
                id: 'wegovy',
                label: 'Wegovy',
                icon: 'apple',
                href: withBasePath('/wegovy'),
                meta: 'Dose',
              },
              {
                id: 'challenge',
                label: '75',
                icon: 'calendar',
                href: withBasePath('/75-tracker'),
                meta: 'Hard/Soft',
              },
              {
                id: 'task',
                label: 'Task',
                icon: 'task',
                href: withBasePath('/tasks?create=task&source=apple-health'),
                meta: 'Action',
                tone: 'good',
              },
            ]}
          />
        </header>

        {state.status === 'loading' ? (
          <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-sm text-[var(--theme-muted)]">
            Loading Health.
          </section>
        ) : null}

        {state.status === 'error' ? (
          <section className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700">
            {state.error}
          </section>
        ) : null}

        {payload ? (
          <>
            <HealthCommandCenter payload={payload} />
            <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>section:nth-child(n+5)]:hidden sm:[&>section:nth-child(n+5)]:block">
              {payload.tiles.map((tile) => (
                <MetricTile key={tile.id} tile={tile} />
              ))}
            </div>
            <div className="hidden gap-4 md:grid lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <AiReview payload={payload} />
              <Workouts payload={payload} />
            </div>
            <div className="hidden md:block">
              <HealthPatternPanel payload={payload} />
            </div>
            <div className="hidden md:block">
              <DailyTable payload={payload} />
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
