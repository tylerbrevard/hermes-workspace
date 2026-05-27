import {
  buildSettingsDiagnosticBundle,
  getDefaultMobileSettingsSections,
  getPrimarySettingsRecoveryAction,
  getSettingsMobileGroup,
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
  const primaryRecovery = getPrimarySettingsRecoveryAction(settings)
  const schemaReport = getSettingsSchemaReport(settings)
  const currentSection = SETTINGS_NAV_ITEMS.find(
    (item) => item.id === activeSection,
  )
  const affectedRoutes = [
    { label: 'Chat', section: 'chat' as SettingsNavId },
    { label: 'Voice', section: 'voice' as SettingsNavId },
    { label: 'Routing', section: 'routing' as SettingsNavId },
    { label: 'Appearance', section: 'appearance' as SettingsNavId },
  ]

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
    <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
            Settings Control Center
          </p>
          <h2 className="mt-1 text-base font-medium text-primary-900">
            Configuration health and recovery
          </h2>
          <p className="mt-1 text-sm text-primary-600 text-pretty">
            Chat settings and workspace settings are separated, autosaved, and
            backed by localStorage plus Hermes config APIs where available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportSettingsProfile}>
            Export profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResetSection(activeSection)}
          >
            Reset section
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigate('connection')}
            title="Setup wizard for first-run or broken-config recovery"
          >
            Setup wizard
          </Button>
        </div>
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
              <p className="mt-1 text-xs opacity-85">
                {primaryRecovery.detail}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate(primaryRecovery.section)}
            >
              Open{' '}
              {
                SETTINGS_NAV_ITEMS.find(
                  (item) => item.id === primaryRecovery.section,
                )?.label
              }
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-primary-200 bg-white/70 p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
            Health Summary
          </p>
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
          <p className="mt-2 text-xs text-primary-600">
            Provider latency and health are checked from the provider section;
            credentials show validation state without revealing secrets.
          </p>
        </div>

        <div className="rounded-xl border border-primary-200 bg-white/70 p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
            Guardrails
          </p>
          <div className="mt-2 space-y-1.5 text-xs text-primary-700 dark:text-neutral-300">
            <p>
              Paid-call guard and default model fallback controls live in Smart
              Routing.
            </p>
            <p>
              Agent and automation-affecting changes should be reviewed before
              saving.
            </p>
            <p>
              Stale config detection compares persisted settings with env-backed
              server config.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-primary-200 bg-white/70 p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
            Recovery
          </p>
          <div className="mt-2 space-y-1.5 text-xs text-primary-700 dark:text-neutral-300">
            <p>
              Last saved:{' '}
              <span className="font-semibold">
                {saveState === 'autosaved'
                  ? 'autosaved'
                  : saveState === 'unsaved'
                    ? 'saving'
                    : 'save failed'}
              </span>
              .
            </p>
            <p>
              Backup/restore path: export this settings profile before risky
              changes.
            </p>
            <p>
              Schema v{schemaReport.schemaVersion}:{' '}
              {schemaReport.status === 'current'
                ? 'current'
                : `${schemaReport.unknownKeys.length} unknown keys need review`}
              .
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-primary-200 bg-white/70 p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
            Mobile Groups
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {getDefaultMobileSettingsSections().map((section) => (
              <span
                key={section}
                className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] text-primary-700"
              >
                {getSettingsMobileGroup(section)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-primary-600">
            Simplified groups keep daily mobile checks focused on setup,
            provider, voice, theme, and alerts.
          </p>
        </div>

        <div className="rounded-xl border border-primary-200 bg-white/70 p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
            Route Links
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {affectedRoutes.map((route) => (
              <button
                key={route.section}
                type="button"
                onClick={() => onNavigate(route.section)}
                className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] font-medium text-primary-700 transition hover:text-primary-900"
              >
                {route.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-primary-600">
            Current section:{' '}
            <span className="font-medium text-primary-800">
              {currentSection?.label ?? activeSection}
            </span>
            . Keyboard shortcut reference and LILY voice setup checklist are
            exposed from Display and Voice.
          </p>
        </div>
      </div>
    </section>
  )
}
