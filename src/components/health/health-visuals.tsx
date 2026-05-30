import { cn } from '@/lib/utils'

type Tone = 'good' | 'watch' | 'neutral' | 'bad'

function toneClass(tone: Tone) {
  if (tone === 'good') return 'bg-emerald-500'
  if (tone === 'watch') return 'bg-amber-500'
  if (tone === 'bad') return 'bg-rose-500'
  return 'bg-[var(--theme-accent)]'
}

function asFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function MiniBars({
  values,
  tone = 'neutral',
}: {
  values: Array<number | null | undefined>
  tone?: Tone
}) {
  const valid = values.map(asFinite).filter((value): value is number => value != null)
  const max = Math.max(...valid, 1)
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden="true">
      {values.map((raw, index) => {
        const value = asFinite(raw)
        return (
          <span
            key={`${index}-${value ?? 'x'}`}
            className={cn(
              'w-full rounded-t-sm opacity-85',
              value == null ? 'bg-[var(--theme-border)]' : toneClass(tone),
            )}
            style={{ height: `${value == null ? 10 : Math.max(10, (value / max) * 100)}%` }}
          />
        )
      })}
    </div>
  )
}

export function DualLineChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  primary: Array<number | null | undefined>
  secondary: Array<number | null | undefined>
  primaryLabel: string
  secondaryLabel: string
}) {
  const width = 220
  const height = 74
  const series = [primary, secondary]
  const valid = series.flatMap((items) =>
    items.map(asFinite).filter((value): value is number => value != null),
  )
  const min = Math.min(...valid, 0)
  const max = Math.max(...valid, 1)
  const range = max - min || 1
  const toPoints = (values: Array<number | null | undefined>) =>
    values
      .map(asFinite)
      .map((value, index) => {
        if (value == null) return null
        const x = (index / Math.max(1, values.length - 1)) * width
        const y = height - ((value - min) / range) * (height - 10) - 5
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .filter(Boolean)
      .join(' ')

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${primaryLabel} and ${secondaryLabel}`}
        className="h-20 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <polyline
          points={toPoints(primary)}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-[var(--theme-accent)]"
        />
        <polyline
          points={toPoints(secondary)}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-amber-500"
        />
      </svg>
      <div className="mt-2 flex gap-3 text-[11px] text-[var(--theme-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-[var(--theme-accent)]" />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-500" />
          {secondaryLabel}
        </span>
      </div>
    </div>
  )
}

export function SleepDebtMeter({
  actualMinutes,
  targetMinutes = 8 * 60,
}: {
  actualMinutes: number
  targetMinutes?: number
}) {
  const debt = Math.max(0, targetMinutes - actualMinutes)
  const percent = Math.min(100, (actualMinutes / targetMinutes) * 100)
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">Sleep debt</span>
        <span className="tabular-nums text-[var(--theme-muted)]">
          {(debt / 60).toFixed(1)}h
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--theme-card)]">
        <div
          className={cn(
            'h-full rounded-full',
            percent >= 85 ? 'bg-emerald-500' : percent >= 70 ? 'bg-amber-500' : 'bg-rose-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function MacroRings({
  calories,
  calorieTarget,
  protein,
  proteinTarget,
  fiber,
  fiberTarget = 25,
}: {
  calories: number
  calorieTarget: number
  protein: number
  proteinTarget: number
  fiber: number
  fiberTarget?: number
}) {
  const rings = [
    ['Cal', calories, calorieTarget, 'stroke-[var(--theme-accent)]'],
    ['Protein', protein, proteinTarget, 'stroke-emerald-500'],
    ['Fiber', fiber, fiberTarget, 'stroke-amber-500'],
  ] as const
  return (
    <div className="grid grid-cols-3 gap-2">
      {rings.map(([label, value, target, color]) => {
        const pct = Math.max(0, Math.min(100, (value / Math.max(1, target)) * 100))
        return (
          <div
            key={label}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center"
          >
            <svg viewBox="0 0 42 42" className="mx-auto size-16 -rotate-90">
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                className="stroke-[var(--theme-border)]"
                strokeWidth="5"
              />
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                className={color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${pct} 100`}
                pathLength={100}
              />
            </svg>
            <div className="mt-1 text-xs font-semibold">{label}</div>
            <div className="text-[11px] text-[var(--theme-muted)]">{Math.round(pct)}%</div>
          </div>
        )
      })}
    </div>
  )
}

export function InjectionSiteMap({
  selected,
  suggested,
}: {
  selected: string
  suggested: string
}) {
  const sites = ['Arm left', 'Arm right', 'Abdomen left', 'Abdomen right', 'Thigh left', 'Thigh right']
  return (
    <div className="grid grid-cols-2 gap-2">
      {sites.map((site) => (
        <div
          key={site}
          className={cn(
            'rounded-lg border px-3 py-2 text-xs font-semibold',
            site === selected
              ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
              : site === suggested
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600'
                : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-muted)]',
          )}
        >
          {site}
        </div>
      ))}
    </div>
  )
}

export function TriggerHeatmap({
  entries,
}: {
  entries: Array<{ time: string; count: number }>
}) {
  const buckets = Array.from({ length: 24 }, (_, hour) => {
    const label = String(hour).padStart(2, '0')
    const count = entries
      .filter((entry) => entry.time.slice(0, 2) === label)
      .reduce((sum, entry) => sum + entry.count, 0)
    return { hour, count }
  })
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1)
  return (
    <div className="grid grid-cols-12 gap-1">
      {buckets.map((bucket) => (
        <span
          key={bucket.hour}
          title={`${bucket.hour}:00 ${bucket.count}`}
          className="aspect-square rounded-[3px] border border-[var(--theme-border)]"
          style={{
            backgroundColor:
              bucket.count === 0
                ? 'var(--theme-bg)'
                : `color-mix(in srgb, var(--theme-accent) ${Math.max(20, (bucket.count / max) * 100)}%, transparent)`,
          }}
        />
      ))}
    </div>
  )
}
