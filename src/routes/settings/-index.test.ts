import { describe, expect, it } from 'vitest'
import {
  buildSettingsDiagnosticBundle,
  getDefaultMobileSettingsSections,
  getPrimarySettingsRecoveryAction,
  getSettingsMobileGroup,
  getSettingsSchemaReport,
  getSettingsSearchSummary,
  getSettingsSectionForValidation,
  getSettingsValidationStates,
  searchSettingsSections,
  validateSettingsImportPayload,
} from './-settings-utils'
import { defaultStudioSettings } from '@/hooks/use-settings'

describe('settings route helpers', () => {
  it('searches sections by label, id, and keywords', () => {
    expect(searchSettingsSections('voice')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'voice', label: 'Voice' }),
      ]),
    )
    expect(searchSettingsSections('fallback')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'routing', label: 'Smart Routing' }),
      ]),
    )
    expect(searchSettingsSections('not-a-section')).toHaveLength(0)
  })

  it('reports validation states for auth, provider, model, display, and alerts', () => {
    const warningState = getSettingsValidationStates(defaultStudioSettings)
    expect(warningState).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'provider', status: 'missing' }),
        expect.objectContaining({ id: 'model', status: 'warning' }),
        expect.objectContaining({ id: 'display', status: 'warning' }),
      ]),
    )

    const healthyState = getSettingsValidationStates({
      claudeUrl: 'http://127.0.0.1:8645',
      claudeToken: 'secret-token',
      preferredBudgetModel: 'local/qwen',
      theme: 'dark',
    })
    expect(healthyState).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'auth', status: 'ok' }),
        expect.objectContaining({ id: 'provider', status: 'ok' }),
        expect.objectContaining({ id: 'model', status: 'ok' }),
        expect.objectContaining({ id: 'display', status: 'ok' }),
      ]),
    )
  })

  it('builds a non-secret diagnostic settings bundle', () => {
    const bundle = buildSettingsDiagnosticBundle({
      ...defaultStudioSettings,
      claudeToken: 'do-not-export',
      claudeUrl: 'http://127.0.0.1:8645',
    })

    expect(bundle.secretsIncluded).toBe(false)
    expect(bundle.schema.status).toBe('current')
    expect(bundle.primaryRecovery.section).toBe('routing')
    expect(bundle.persistenceTarget).toContain('localStorage')
    expect(bundle.values.claudeToken).toBe('[set]')
    expect(JSON.stringify(bundle)).not.toContain('do-not-export')
  })

  it('summarizes search results and links validation chips to owning sections', () => {
    expect(getSettingsSearchSummary('', searchSettingsSections(''))).toBe(
      '10 sections',
    )
    expect(getSettingsSearchSummary('voice')).toBe('1 match for "voice"')
    expect(getSettingsSearchSummary('missing-section')).toBe(
      'No matches for "missing-section"',
    )
    expect(getSettingsSectionForValidation('provider')).toBe('claude')
    expect(getSettingsSectionForValidation('display')).toBe('appearance')
  })

  it('prioritizes provider recovery when the provider endpoint is missing', () => {
    expect(getPrimarySettingsRecoveryAction(defaultStudioSettings)).toEqual(
      expect.objectContaining({
        id: 'provider',
        section: 'claude',
        severity: 'critical',
      }),
    )
  })

  it('defines mobile settings glance groups', () => {
    expect(getDefaultMobileSettingsSections()).toEqual([
      'connection',
      'claude',
      'voice',
      'appearance',
      'notifications',
    ])
    expect(getSettingsMobileGroup('routing')).toBe('AI')
    expect(getSettingsMobileGroup('notifications')).toBe('Alerts')
  })

  it('validates settings imports before writing values', () => {
    expect(
      validateSettingsImportPayload({
        secretsIncluded: false,
        values: {
          claudeToken: '[set]',
          theme: 'dark',
          notificationsEnabled: true,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        settings: expect.objectContaining({ theme: 'dark' }),
      }),
    )

    expect(
      validateSettingsImportPayload({
        values: {
          claudeToken: 'real-secret-token',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.arrayContaining([
          'Import payload contains an unredacted Claude token.',
        ]),
      }),
    )
  })

  it('reports schema status and unknown settings keys', () => {
    expect(getSettingsSchemaReport(defaultStudioSettings)).toEqual(
      expect.objectContaining({ schemaVersion: 1, status: 'current' }),
    )
    expect(
      getSettingsSchemaReport({
        ...defaultStudioSettings,
        futureSetting: true,
      } as typeof defaultStudioSettings & { futureSetting: boolean }),
    ).toEqual(
      expect.objectContaining({
        status: 'review-required',
        unknownKeys: ['futureSetting'],
      }),
    )
  })
})
