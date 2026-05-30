import type { PhoneCockpitSnapshot } from './phone-cockpit'

export type PhoneWidgetSummary = {
  ok: true
  checkedAt: string
  headline: string
  counters: {
    unread: number | null
    urgent: number
    overdue: number
    attention: number
  }
  nextMeeting: {
    title: string
    date: string
    minutesUntil: number
    joinAvailable: boolean
  } | null
  needsTyler: Array<{
    title: string
    severity: string
    actionLabel?: string
  }>
  degradedSources: Array<string>
}

function relativeMinutes(minutes: number) {
  if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))}h ago`
  if (minutes < 0) return `${Math.abs(minutes)}m ago`
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}

export function buildPhoneWidgetSummary(
  snapshot: PhoneCockpitSnapshot,
): PhoneWidgetSummary {
  const nextMeeting = snapshot.schedule.nextMeeting
  const headline =
    snapshot.attention[0]?.title ||
    (nextMeeting
      ? `${nextMeeting.title} in ${relativeMinutes(nextMeeting.minutesUntil)}`
      : snapshot.inbox.unread !== null
        ? `${snapshot.inbox.unread} unread mail`
        : snapshot.presence.activity || 'Clear')

  return {
    ok: true,
    checkedAt: snapshot.checkedAt,
    headline,
    counters: {
      unread: snapshot.inbox.unread,
      urgent: snapshot.tasks.urgent,
      overdue: snapshot.tasks.overdue,
      attention: snapshot.attention.length,
    },
    nextMeeting: nextMeeting
      ? {
          title: nextMeeting.title,
          date: nextMeeting.date,
          minutesUntil: nextMeeting.minutesUntil,
          joinAvailable: Boolean(nextMeeting.joinUrl),
        }
      : null,
    needsTyler: snapshot.attention.slice(0, 3).map((item) => ({
      title: item.title,
      severity: item.severity,
      actionLabel: item.actionLabel,
    })),
    degradedSources: Object.values(snapshot.sources)
      .filter((source) => !source.ok)
      .map((source) => source.label),
  }
}
