import type { buildDashboardNextAction } from '../lib/command-center'

export function DashboardCommandStrip({
  nextAction,
  hiddenCount,
  onRunNext,
  onEditHiddenWidgets,
}: {
  nextAction: ReturnType<typeof buildDashboardNextAction>
  hiddenCount: number
  onRunNext: () => void
  onEditHiddenWidgets: () => void
}) {
  const tone =
    nextAction.severity === 'error'
      ? 'var(--theme-danger)'
      : nextAction.severity === 'warn'
        ? 'var(--theme-warning)'
        : nextAction.severity === 'info'
          ? 'var(--theme-accent)'
          : 'var(--theme-success)'
  return (
    <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]/70 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Next action
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: `${tone}66`,
                color: tone,
                background: 'color-mix(in srgb, currentColor 10%, transparent)',
              }}
            >
              {nextAction.severity}
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-ink">
            {nextAction.label}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
            {nextAction.detail}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRunNext}
            className="min-h-10 rounded-lg px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--theme-on-accent,white)] transition hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${tone}, color-mix(in srgb, ${tone} 72%, var(--theme-accent)))`,
            }}
          >
            {nextAction.action}
          </button>
          <button
            type="button"
            onClick={onEditHiddenWidgets}
            className="min-h-10 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-[var(--theme-accent-border)] hover:text-ink"
          >
            Hidden widgets {hiddenCount}
          </button>
        </div>
      </div>
    </section>
  )
}
