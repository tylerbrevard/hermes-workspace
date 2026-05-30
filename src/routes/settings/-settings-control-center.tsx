import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  RefreshIcon,
  Shield01Icon,
  ToolsIcon,
} from '@hugeicons/core-free-icons'
import {
  buildSettingsDiagnosticBundle,
  calculateSettingsHealthScore,
  getPrimarySettingsRecoveryAction,
  getSettingsCockpitTiles,
  getSettingsPrioritySections,
  getSettingsSchemaReport,
  getSettingsSectionForValidation,
  getSettingsValidationStates,
} from './-settings-utils'
import type { SettingsNavId } from '@/components/settings/settings-sidebar'
import type { StudioSettings } from '@/hooks/use-settings'
import { SETTINGS_NAV_ITEMS } from '@/components/settings/settings-sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SettingsSaveState = 'autosaved' | 'unsaved' | 'failed'

export function SettingsControlCenter({
  activeSection,
  settings,
  saveState,
  onNavigate,
  onResetSection,
}: {
  activeSection: SettingsNavId
  settings: StudioSettings
  saveState: SettingsSaveState
  onNavigate: (section: SettingsNavId) => void
  onResetSection: (section: SettingsNavId) => void
}) {
  const health = getSettingsValidationStates(settings)
  const score = calculateSettingsHealthScore(settings)
  const cockpitTiles = getSettingsCockpitTiles(settings).slice(0, 3)
  const prioritySections = getSettingsPrioritySections(settings)
  const primaryRecovery = getPrimarySettingsRecoveryAction(settings)
  const schemaReport = getSettingsSchemaReport(settings)
  const currentSection = SETTINGS_NAV_ITEMS.find(
    (item) => item.id === activeSection,
  )
  const scoreTone =
    score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-red-500'

  function exportSettingsProfile() {
    const bundle = buildSettingsDiagnosticBundle(settings)
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'hermes-workspace-settings-profile.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
            Settings cockpit
          </p>
          <h2 className="mt-1 text-base font-medium text-primary-900">
            {currentSection?.label ?? activeSection}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={exportSettingsProfile}
            aria-label="Export settings profile"
            title="Export settings profile"
          >
            <HugeiconsIcon icon={Download01Icon} size={16} strokeWidth={1.7} />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => onResetSection(activeSection)}
            aria-label="Reset current settings section"
            title="Reset current section"
          >
            <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.7} />
          </Button>
          <Button
            size="icon-sm"
            onClick={() => onNavigate('connection')}
            title="Setup wizard for first-run or broken-config recovery"
            aria-label="Open setup wizard"
          >
            <HugeiconsIcon icon={ToolsIcon} size={16} strokeWidth={1.7} />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,0.9fr)_minmax(0,1.8fr)]">
        <div className="rounded-xl border border-primary-200 bg-white/80 p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
                Health score
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-primary-950 dark:text-neutral-50">
                {score}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white',
                scoreTone,
              )}
            >
              {primaryRecovery.severity === 'ok'
                ? 'ready'
                : primaryRecovery.severity}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-100">
            <div
              className={cn('h-full rounded-full', scoreTone)}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-primary-600 dark:text-neutral-300">
            Save state:{' '}
            <span className="font-semibold">
              {saveState === 'autosaved'
                ? 'saved'
                : saveState === 'unsaved'
                  ? 'saving'
                  : 'failed'}
            </span>
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {cockpitTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              title={tile.detail}
              onClick={() => onNavigate(tile.section)}
              className="min-h-20 min-w-0 rounded-xl border border-primary-200 bg-white/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.12em] text-primary-500">
                  {tile.label}
                </p>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    tile.status === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : tile.status === 'missing'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {tile.metric}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {prioritySections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              activeSection === item.id
                ? 'border-primary-400 bg-primary-900 text-white'
                : 'border-primary-200 bg-white/80 text-primary-700 hover:border-primary-300',
            )}
          >
            <HugeiconsIcon icon={item.icon} size={14} strokeWidth={1.7} />
            {item.label}
          </button>
        ))}
      </div>

      {primaryRecovery.severity !== 'ok' ? (
        <div
          className={cn(
            'mt-4 rounded-xl border p-3',
            primaryRecovery.severity === 'critical'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-100'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100',
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{primaryRecovery.label}</p>
              <p className="mt-1 line-clamp-1 text-xs opacity-85">
                {primaryRecovery.detail}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate(primaryRecovery.section)}
            >
              Open
            </Button>
          </div>
        </div>
      ) : null}

      <details className="mt-3 rounded-xl border border-primary-200 bg-white/70 p-3 dark:border-neutral-700 dark:bg-neutral-950">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
          Diagnostics
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={15}
                strokeWidth={1.7}
              />
              Health
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {health.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.detail}
                  onClick={() =>
                    onNavigate(getSettingsSectionForValidation(item.id))
                  }
                  className={cn(
                    'rounded-full border px-2 py-1 text-[11px] font-medium',
                    item.status === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : item.status === 'missing'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {item.label}: {item.status}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
              <HugeiconsIcon icon={Shield01Icon} size={15} strokeWidth={1.7} />
              Guardrails
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-primary-700 dark:text-neutral-300">
              <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1">
                paid calls
              </span>
              <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1">
                agent review
              </span>
              <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1">
                stale config
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
              <HugeiconsIcon icon={Alert02Icon} size={15} strokeWidth={1.7} />
              Recovery
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-primary-700 dark:text-neutral-300">
              <p>
                Last saved:{' '}
                <span className="font-semibold">
                  {saveState === 'autosaved'
                    ? 'saved'
                    : saveState === 'unsaved'
                      ? 'saving'
                      : 'failed'}
                </span>
              </p>
              <p>
                Schema v{schemaReport.schemaVersion}:{' '}
                {schemaReport.status === 'current'
                  ? 'current'
                  : `${schemaReport.unknownKeys.length} unknown`}
              </p>
            </div>
          </div>
        </div>
      </details>
    </section>
  )
}
