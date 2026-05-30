/**
 * Workspace connection settings — read/write the gateway + dashboard URLs the
 * workspace uses. Writes to ~/.hermes/workspace-overrides.json and updates
 * the in-process CLAUDE_API / CLAUDE_DASHBOARD_URL live, so users can
 * relocate to a Tailscale/LAN address without restarting the workspace.
 *
 * See #101.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  ensureGatewayProbed,
  getResolvedUrls,
  setDashboardUrl,
  setGatewayUrl,
} from '../../server/gateway-capabilities'
import { requireJsonContentType } from '../../server/rate-limit'
import { assertAllowedHermesServiceUrl } from '../../server/service-url-guard'

export const Route = createFileRoute('/api/connection-settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        return json(getResolvedUrls())
      },
      PUT: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json().catch(() => ({}))) as {
            gateway?: unknown
            dashboard?: unknown
          }
          if (body.gateway !== undefined) {
            const value = typeof body.gateway === 'string' ? body.gateway : ''
            setGatewayUrl(
              value
                ? await assertAllowedHermesServiceUrl(value, 'gateway')
                : value,
            )
          }
          if (body.dashboard !== undefined) {
            const value =
              typeof body.dashboard === 'string' ? body.dashboard : ''
            setDashboardUrl(
              value
                ? await assertAllowedHermesServiceUrl(value, 'dashboard')
                : value,
            )
          }
          // Reprobe so the UI can immediately reflect the new state.
          await ensureGatewayProbed()
          return json({ ok: true, ...getResolvedUrls() })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to update connection settings'
          const status = /must|could not be resolved/.test(message) ? 400 : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
