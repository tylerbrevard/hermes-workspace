import { createFileRoute } from '@tanstack/react-router'
import {
  countReservations,
  createReservation,
  createSupabaseReservationStore,
  ReservationValidationError,
  sendReservationConfirmationEmail,
} from '@/server/name-reservations'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  requireJsonContentType,
  safeErrorMessage,
} from '@/server/rate-limit'

function requestBaseUrl(request: Request): string {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

function reservationErrorStatus(error: unknown): number {
  if (error instanceof ReservationValidationError) return error.status
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.toLowerCase().includes('not configured')) return 503
  return 500
}

function reservationErrorMessage(error: unknown): string {
  return reservationErrorStatus(error) === 503
    ? 'Reservations are not configured on this workspace.'
    : safeErrorMessage(error)
}

export const Route = createFileRoute('/api/hermesworld/reservations')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const store = createSupabaseReservationStore()
          const count = await countReservations(store)
          return Response.json({ ok: true, count })
        } catch (error) {
          return Response.json(
            { ok: false, error: reservationErrorMessage(error) },
            { status: reservationErrorStatus(error) },
          )
        }
      },
      POST: async ({ request }) => {
        const contentTypeError = requireJsonContentType(request)
        if (contentTypeError) return contentTypeError

        const ip = getClientIp(request)
        if (!rateLimit(`reserve:${ip}`, 5, 10 * 60 * 1000)) {
          return rateLimitResponse()
        }

        try {
          const body = await request.json()
          const store = createSupabaseReservationStore()
          const reservation = await createReservation(body, {
            store,
            sendConfirmationEmail: sendReservationConfirmationEmail,
            baseUrl: requestBaseUrl(request),
          })
          return Response.json({
            ok: true,
            reservation: {
              desiredName: reservation.desiredName,
              email: reservation.email,
              wallet: reservation.wallet,
              confirmedAt: reservation.confirmedAt,
              createdAt: reservation.createdAt,
            },
          })
        } catch (error) {
          if (error instanceof ReservationValidationError) {
            return Response.json(
              { ok: false, error: error.message },
              { status: error.status },
            )
          }
          return Response.json(
            { ok: false, error: reservationErrorMessage(error) },
            { status: reservationErrorStatus(error) },
          )
        }
      },
    },
  },
})
