import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  isBooleanRecord,
  isStringArray,
  readJsonStorage,
  writeJsonStorage,
} from '@/lib/typed-storage'
import { cn } from '@/lib/utils'
import { withBasePath } from '@/lib/base-path'

export const Route = createFileRoute('/75-tracker')({
  ssr: false,
  component: SeventyFiveTrackerRoute,
})

function SeventyFiveTrackerRoute() {
  usePageTitle('75 Hard/Soft')
  const search = useSearch({ from: '/75-tracker' })
  const [mode, setMode] = useState<'hard' | 'soft'>(() =>
    search.mode === 'hard' ? 'hard' : 'soft',
  )
  const [quickMode, setQuickMode] = useState(search.quick === '1')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [customTemplate, setCustomTemplate] = useState('Mobility')
  const [customTemplates, setCustomTemplates] = useState<Array<string>>([
    'Mobility',
    'No alcohol',
    'Sleep cutoff',
    'Meditation',
  ])
  const [templateDraft, setTemplateDraft] = useState('')
  const [modifiedDay, setModifiedDay] = useState(false)
  const [history, setHistory] = useState<Array<string>>([])
  const todayKey = new Date().toISOString().slice(0, 10)
  const storageKey = `workspace.75-tracker.quick:${todayKey}`
  const notesStorageKey = `workspace.75-tracker.notes:${todayKey}`
  const historyStorageKey = `workspace.75-tracker.history:${todayKey}`
  const settingsStorageKey = 'workspace.75-tracker.settings'
  const habits = useMemo(
    () => getSeventyFiveHabitItems(mode, customTemplate, modifiedDay),
    [customTemplate, mode, modifiedDay],
  )
  const summary = getSeventyFiveHabitSummary(habits, checked)
  const remainingHabits = habits.filter((habit) => !checked[habit.id])
  const heatmap = useMemo(
    () => getSeventyFiveHeatmapDays(new Date(todayKey), checked),
    [checked, todayKey],
  )
  const trend = getSeventyFiveWeeklyTrend(summary.percent)
  const streakRisk = getSeventyFiveStreakRisk(summary, new Date().getHours())
  const report = getSeventyFiveShareReport({
    mode,
    todayKey,
    summary,
    trend,
  })

  useEffect(() => {
    setChecked(readJsonStorage(storageKey, {}, isBooleanRecord).value)
    setNotes(readJsonStorage(notesStorageKey, {}, isStringRecord).value)
    setHistory(readJsonStorage(historyStorageKey, [], isStringArray).value)
    const settings = readJsonStorage(
      settingsStorageKey,
      {
        customTemplate: 'Mobility',
        customTemplates: [
          'Mobility',
          'No alcohol',
          'Sleep cutoff',
          'Meditation',
        ],
        modifiedDay: false,
      },
      isSeventyFiveSettings,
    ).value
    setCustomTemplate(settings.customTemplate)
    setCustomTemplates(settings.customTemplates)
    setModifiedDay(settings.modifiedDay)
  }, [historyStorageKey, notesStorageKey, settingsStorageKey, storageKey])

  useEffect(() => {
    writeJsonStorage(storageKey, checked)
    writeJsonStorage(notesStorageKey, notes)
    writeJsonStorage(historyStorageKey, history)
    writeJsonStorage(settingsStorageKey, {
      customTemplate,
      customTemplates,
      modifiedDay,
    })
  }, [
    checked,
    customTemplate,
    customTemplates,
    history,
    historyStorageKey,
    modifiedDay,
    notes,
    notesStorageKey,
    settingsStorageKey,
    storageKey,
  ])

  useEffect(() => {
    if (search.mode === 'hard' || search.mode === 'soft') setMode(search.mode)
    setQuickMode(search.quick === '1')
  }, [search.mode, search.quick])

  async function copyShareReport() {
    await navigator.clipboard.writeText(report)
  }

  function toggleHabit(habit: HabitItem, nextChecked: boolean) {
    setChecked((current) => ({
      ...current,
      [habit.id]: nextChecked,
    }))
    const action = nextChecked ? 'checked' : 'cleared'
    setHistory((current) =>
      [
        `${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })} ${action} ${habit.label}`,
        ...current,
      ].slice(0, 5),
    )
  }

  function resetToday() {
    if (
      !confirm('Reset today? This clears checkmarks, notes, and edit history.')
    ) {
      return
    }
    setChecked({})
    setNotes({})
    setHistory([])
  }

  function addCustomTemplate() {
    const next = templateDraft.trim()
    if (!next) return
    setCustomTemplates((current) =>
      current.includes(next) ? current : [...current, next],
    )
    setCustomTemplate(next)
    setTemplateDraft('')
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--theme-bg)]">
      <header className="shrink-0 border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
        <div className="mx-auto grid max-w-[1200px] gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[var(--theme-text)]">
              75 Hard/Soft
            </h1>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              Daily tracker for water, workouts, reading, diet, progress photo,
              and custom habits.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['hard', 'soft'] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => setMode(nextMode)}
                  className={cn(
                    'min-h-10 rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
                    mode === nextMode
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
                      : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-muted)]',
                  )}
                >
                  {nextMode}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickMode((value) => !value)}
                className={cn(
                  'min-h-10 rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
                  quickMode
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-accent)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-muted)]',
                )}
              >
                Quick
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
              Today {summary.completed}/{summary.total}
            </span>
            <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
              {summary.percent}% done
            </span>
            <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
              {summary.remaining} left
            </span>
          </div>
        </div>
        <section className="mx-auto mt-3 grid max-w-[1200px] gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-xs text-[var(--theme-muted)] sm:grid-cols-3">
          <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2">
            Compact: {summary.completed}/{summary.total} complete
          </span>
          <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2">
            Next:{' '}
            {remainingHabits[0]
              ? `${remainingHabits[0].label} (${remainingHabits[0].rule})`
              : 'streak clean'}
          </span>
          <span
            className={cn(
              'rounded-lg border px-3 py-2',
              streakRisk.severity === 'danger' &&
                'border-red-300/40 bg-red-500/10 text-red-400',
              streakRisk.severity === 'warning' &&
                'border-amber-300/40 bg-amber-500/10 text-amber-400',
              streakRisk.severity === 'success' &&
                'border-emerald-300/40 bg-emerald-500/10 text-emerald-400',
            )}
          >
            {streakRisk.message}
          </span>
        </section>
        <div className="mx-auto mt-3 grid max-w-[1200px] gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div
            className="grid size-20 place-items-center rounded-full border border-[var(--theme-border)] text-center"
            style={{
              background: `conic-gradient(var(--theme-accent) ${summary.percent}%, var(--theme-bg) 0)`,
            }}
            aria-label={`${summary.percent}% complete today`}
          >
            <span className="grid size-16 place-items-center rounded-full bg-[var(--theme-card)] text-lg font-bold tabular-nums text-[var(--theme-text)]">
              {summary.percent}%
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="grid gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)]"
              >
                <label className="flex min-h-10 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[habit.id])}
                    onChange={(event) =>
                      toggleHabit(habit, event.currentTarget.checked)
                    }
                    aria-label={`${habit.label}: ${habit.rule}`}
                    className="size-5 accent-[var(--theme-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {habit.label}
                    </span>
                    <span className="block truncate text-xs text-[var(--theme-muted)]">
                      {habit.rule}
                    </span>
                  </span>
                </label>
                {!checked[habit.id] ? (
                  <input
                    value={notes[habit.id] ?? ''}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [habit.id]: event.currentTarget.value,
                      }))
                    }
                    placeholder="Recovery note"
                    aria-label={`${habit.label} recovery note`}
                    className="min-h-8 rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 text-xs text-[var(--theme-text)]"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-[1200px] text-xs text-[var(--theme-muted)]">
          {summary.remaining === 0
            ? 'Today is complete. Keep the streak clean.'
            : `${summary.remaining} item${summary.remaining === 1 ? '' : 's'} remain today. Recovery plan: finish the smallest unchecked item first, then open the full tracker for details.`}
          <span
            className={cn(
              'ml-2 font-semibold',
              streakRisk.severity === 'danger' && 'text-red-400',
              streakRisk.severity === 'warning' && 'text-amber-400',
              streakRisk.severity === 'success' && 'text-emerald-400',
            )}
          >
            {streakRisk.message}
          </span>
        </p>
        <section className="mx-auto mt-3 grid max-w-[1200px] gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              What remains today
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--theme-text)]">
              {remainingHabits.length
                ? remainingHabits.map((habit) => habit.label).join(', ')
                : 'All daily items are complete.'}
            </p>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              Source warning: local quick checks are available; full tracker
              sync is embedded below when deeper evidence is needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={withBasePath('/tasks?create=task&source=75-tracker')}
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 py-2 text-xs font-semibold text-[var(--theme-text)]"
            >
              Create task
            </a>
            <a
              href={withBasePath('/lily?readout=75-tracker')}
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 py-2 text-xs font-semibold text-[var(--theme-text)]"
            >
              LILY readout
            </a>
            <a
              href={withBasePath('/dashboard?focus=daily-loops')}
              className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 py-2 text-xs font-semibold text-[var(--theme-text)]"
            >
              Daily Loops
            </a>
            <button
              type="button"
              onClick={resetToday}
              className="min-h-9 rounded-lg border border-red-300/40 px-3 py-2 text-xs font-semibold text-red-400"
            >
              Reset today
            </button>
          </div>
        </section>
        <div
          className={cn(
            'mx-auto mt-3 grid max-w-[1200px] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]',
            quickMode && 'hidden',
          )}
        >
          <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                  Challenge heatmap
                </h2>
                <p className="mt-1 text-xs text-[var(--theme-muted)]">
                  Local quick-check source · synced just now from this browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyShareReport()}
                className="min-h-9 shrink-0 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--theme-text)]"
              >
                Copy report
              </button>
            </div>
            <div
              className="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1"
              aria-label="75 day challenge heatmap"
            >
              {heatmap.map((day) => (
                <span
                  key={day.index}
                  role="img"
                  aria-label={`Day ${day.index}: ${
                    day.isToday ? 'today, ' : ''
                  }${day.complete ? 'complete' : 'incomplete'}`}
                  className={cn(
                    'aspect-square rounded-[3px] border',
                    day.isToday
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]'
                      : day.complete
                        ? 'border-emerald-400/40 bg-emerald-400/60'
                        : 'border-[var(--theme-border)] bg-[var(--theme-card)]',
                  )}
                  title={`Day ${day.index}${day.isToday ? ' - today' : ''}`}
                />
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
              Weekly trend
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--theme-text)]">
              {trend.label}
            </p>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              {trend.detail}
            </p>
            <dl className="mt-2 grid gap-1 rounded-lg border border-[var(--theme-border)] px-3 py-2 text-xs text-[var(--theme-muted)]">
              {getSeventyFiveTrendLegend().map((item) => (
                <div key={item.label} className="flex justify-between gap-2">
                  <dt className="font-semibold text-[var(--theme-text)]">
                    {item.label}
                  </dt>
                  <dd>{item.detail}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 grid gap-2 text-xs text-[var(--theme-muted)]">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--theme-border)] px-3 py-2">
                <span>
                  <span className="block font-semibold text-[var(--theme-text)]">
                    Modified / travel day
                  </span>
                  <span className="block text-[10px]">
                    Keeps the habit active with realistic movement and water
                    rules.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={modifiedDay}
                  onChange={(event) =>
                    setModifiedDay(event.currentTarget.checked)
                  }
                  className="size-5 accent-[var(--theme-accent)]"
                />
              </label>
              <label className="grid gap-1 rounded-lg border border-[var(--theme-border)] px-3 py-2">
                <span className="font-semibold text-[var(--theme-text)]">
                  Custom habit template
                </span>
                <select
                  value={customTemplate}
                  onChange={(event) => setCustomTemplate(event.target.value)}
                  className="min-h-9 rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 text-xs text-[var(--theme-text)]"
                >
                  {customTemplates.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 rounded-lg border border-[var(--theme-border)] px-3 py-2">
                <span className="font-semibold text-[var(--theme-text)]">
                  Add template
                </span>
                <div className="flex gap-2">
                  <input
                    value={templateDraft}
                    onChange={(event) => setTemplateDraft(event.target.value)}
                    className="min-h-9 min-w-0 flex-1 rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 text-xs text-[var(--theme-text)]"
                    placeholder="Sauna, steps, journaling"
                  />
                  <button
                    type="button"
                    onClick={addCustomTemplate}
                    className="min-h-9 rounded-md border border-[var(--theme-border)] px-2 font-semibold text-[var(--theme-text)]"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--theme-border)] px-3 py-2">
                <span className="font-semibold text-[var(--theme-text)]">
                  Edit history
                </span>
                <div className="mt-1 grid gap-1">
                  {history.length ? (
                    history.map((item) => <span key={item}>{item}</span>)
                  ) : (
                    <span>No habit toggles yet today.</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--theme-border)] px-3 py-2">
                Morning nudge: finish water and reading before work starts.
                <a
                  href={withBasePath('/phone?capture=75-morning')}
                  className="mt-2 block min-h-8 rounded-md border border-[var(--theme-border)] px-2 py-1.5 text-center text-[11px] font-semibold text-[var(--theme-text)]"
                >
                  Open Phone Cockpit
                </a>
              </div>
              <div className="rounded-lg border border-[var(--theme-border)] px-3 py-2">
                Evening nudge: photo, diet check, and custom habit closeout.
                <a
                  href={withBasePath('/phone?capture=75-evening')}
                  className="mt-2 block min-h-8 rounded-md border border-[var(--theme-border)] px-2 py-1.5 text-center text-[11px] font-semibold text-[var(--theme-text)]"
                >
                  Open Phone Cockpit
                </a>
              </div>
            </div>
          </section>
        </div>
      </header>
      {!quickMode ? (
        <iframe
          title="75 Hard and 75 Soft Tracker"
          src={withBasePath('/75-day-tracker/index.html')}
          className="h-full w-full flex-1 border-0 bg-[#f6f4ef]"
        />
      ) : null}
    </main>
  )
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

function isSeventyFiveSettings(value: unknown): value is {
  customTemplate: string
  customTemplates: Array<string>
  modifiedDay: boolean
} {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { customTemplate?: unknown }).customTemplate ===
      'string' &&
    isStringArray((value as { customTemplates?: unknown }).customTemplates) &&
    typeof (value as { modifiedDay?: unknown }).modifiedDay === 'boolean'
  )
}

type HabitItem = {
  id: string
  label: string
  rule: string
}

export function getSeventyFiveHabitItems(
  mode: 'hard' | 'soft',
  customTemplate = 'Mobility',
  modifiedDay = false,
): Array<HabitItem> {
  return [
    {
      id: 'water',
      label: 'Water',
      rule: modifiedDay
        ? 'travel target'
        : mode === 'hard'
          ? '1 gallon'
          : 'daily target',
    },
    {
      id: 'workout',
      label: 'Workout',
      rule: modifiedDay
        ? 'modified movement'
        : mode === 'hard'
          ? '2 sessions'
          : 'move today',
    },
    { id: 'reading', label: 'Reading', rule: '10 pages' },
    { id: 'diet', label: 'Diet', rule: 'follow plan' },
    { id: 'photo', label: 'Progress photo', rule: 'daily proof' },
    { id: 'custom', label: customTemplate, rule: 'custom habit' },
  ]
}

export function getSeventyFiveHabitSummary(
  habits: Array<HabitItem>,
  checked: Record<string, boolean>,
): { completed: number; total: number; remaining: number; percent: number } {
  const total = habits.length
  const completed = habits.filter((habit) => checked[habit.id]).length
  return {
    completed,
    total,
    remaining: total - completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  }
}

export function getSeventyFiveHeatmapDays(
  today: Date,
  checked: Record<string, boolean>,
): Array<{ index: number; complete: boolean; isToday: boolean }> {
  const todayIndex = Math.min(75, Math.max(1, Math.ceil(today.getDate())))
  const complete = Object.values(checked).filter(Boolean).length >= 6
  return Array.from({ length: 75 }, (_, index) => ({
    index: index + 1,
    complete: index + 1 < todayIndex || (index + 1 === todayIndex && complete),
    isToday: index + 1 === todayIndex,
  }))
}

export function getSeventyFiveWeeklyTrend(percent: number): {
  label: string
  detail: string
} {
  if (percent === 100) {
    return {
      label: 'On track',
      detail: 'Today is complete; preserve the streak and avoid late edits.',
    }
  }
  if (percent >= 50) {
    return {
      label: 'Recoverable',
      detail: 'Momentum is good; finish the smallest remaining item next.',
    }
  }
  return {
    label: 'Needs push',
    detail: 'Front-load the required items before the day gets noisy.',
  }
}

export function getSeventyFiveTrendLegend(): Array<{
  label: string
  detail: string
}> {
  return [
    { label: 'On track', detail: '100% complete today.' },
    { label: 'Recoverable', detail: '50-99% complete; finish smallest next.' },
    { label: 'Needs push', detail: 'Below 50%; front-load required items.' },
  ]
}

export function getSeventyFiveStreakRisk(
  summary: { remaining: number; percent: number },
  hour: number,
): { severity: 'success' | 'warning' | 'danger'; message: string } {
  if (summary.remaining === 0) {
    return { severity: 'success', message: 'Streak safe.' }
  }
  if (hour >= 20 && summary.remaining > 1) {
    return {
      severity: 'danger',
      message: 'Streak at risk: more than one item remains after 8 PM.',
    }
  }
  if (hour >= 17 || summary.percent < 50) {
    return {
      severity: 'warning',
      message: 'Streak watch: pick the smallest remaining item now.',
    }
  }
  return {
    severity: 'success',
    message: 'Streak on track if the next item gets done early.',
  }
}

export function getSeventyFiveShareReport({
  mode,
  todayKey,
  summary,
  trend,
}: {
  mode: 'hard' | 'soft'
  todayKey: string
  summary: {
    completed: number
    total: number
    remaining: number
    percent: number
  }
  trend: { label: string; detail: string }
}): string {
  return [
    `75 ${mode} tracker - ${todayKey}`,
    `${summary.completed}/${summary.total} complete (${summary.percent}%).`,
    `${summary.remaining} remaining.`,
    `${trend.label}: ${trend.detail}`,
  ].join('\n')
}
