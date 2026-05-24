import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Alert01Icon,
  Calendar01Icon,
  Chat01Icon,
  Clock01Icon,
  ComputerIcon,
  DashboardSquare01Icon,
  File01Icon,
  Mail01Icon,
  Note01Icon,
  Notification01Icon,
  PencilEdit01Icon,
  SentIcon,
  Task01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons'
import type { PhoneAttentionItem, PhoneCockpitSnapshot } from '@/server/phone-cockpit'
import { apiPath } from '@/lib/base-path'
import { hapticTap } from '@/lib/haptics'
import { toast } from '@/components/ui/toast'

type CaptureMode = 'note' | 'task' | 'draft'
type NotificationState = NotificationPermission | 'unsupported'
type HugeIcon = React.ComponentProps<typeof HugeiconsIcon>['icon']

const captureModeMeta: Record<CaptureMode, { label: string; icon: HugeIcon }> = {
  note: { label: 'Note', icon: Note01Icon },
  task: { label: 'Task', icon: Task01Icon },
  draft: { label: 'Draft', icon: PencilEdit01Icon },
}

function fmtTime(value?: string | null) {
  if (!value) return 'No time'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function fmtShortTime(value?: string | null) {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function relativeMinutes(minutes: number) {
  if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))}h ago`
  if (minutes < 0) return `${Math.abs(minutes)}m ago`
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}

function formatFreshness(value?: string | null) {
  if (!value) return 'Not synced'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sync unknown'
  return `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function toneClass(severity?: PhoneAttentionItem['severity']) {
  if (severity === 'critical') return 'border-[#ff9aa8]/40 bg-[#ff9aa8]/10 text-[#ffd6dc]'
  if (severity === 'warning') return 'border-[#f7b267]/35 bg-[#f7b267]/10 text-[#ffd39d]'
  return 'border-[#6ec6b8]/30 bg-[#6ec6b8]/10 text-[#b8fff3]'
}

function sourceTone(ok?: boolean) {
  return ok
    ? 'border-[#6ec6b8]/25 bg-[#6ec6b8]/10 text-[#b8fff3]'
    : 'border-[#f7b267]/35 bg-[#f7b267]/10 text-[#ffd39d]'
}

function Card({
  title,
  kicker,
  icon,
  children,
  className,
}: {
  title: string
  kicker?: string
  icon?: HugeIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cx('rounded-[10px] border border-white/10 bg-[#111820] p-3 shadow-[0_12px_30px_rgba(0,0,0,.22)]', className)}>
      <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-[#eef3f4]">
          {icon ? <HugeiconsIcon icon={icon} size={16} className="shrink-0 text-[#8ee7d5]" aria-hidden="true" /> : null}
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {kicker ? (
          <span className="shrink-0 rounded border border-[#6ec6b8]/30 bg-[#6ec6b8]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#b8fff3]">
            {kicker}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function ActionLink({
  to,
  label,
  children,
  className,
}: {
  to: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cx(
        'inline-flex min-h-11 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function ExternalAction({ item }: { item: PhoneAttentionItem }) {
  if (!item.href) return null
  const label = item.actionLabel || 'Open'
  if (item.href.startsWith('/')) {
    return (
      <ActionLink to={item.href} label={`${label}: ${item.title}`} className="shrink-0 px-3">
        {label}
      </ActionLink>
    )
  }
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.99]"
    >
      {label}
    </a>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[8px] border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-[#b7c6c9]">{children}</p>
}

function StatPill({ icon, label, value }: { icon: HugeIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] bg-white/[0.04] px-2.5 py-2">
      <HugeiconsIcon icon={icon} size={15} className="shrink-0 text-[#8ee7d5]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-[11px] leading-4 text-[#b7c6c9]">{label}</p>
        <p className="text-lg font-semibold leading-5 tabular-nums text-white">{value}</p>
      </div>
    </div>
  )
}

export function PhoneCockpitScreen() {
  const [snapshot, setSnapshot] = useState<PhoneCockpitSnapshot | null>(null)
  const [error, setError] = useState('')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('note')
  const [captureText, setCaptureText] = useState('')
  const [draftRecipient, setDraftRecipient] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [latestPrompt, setLatestPrompt] = useState<PhoneAttentionItem | null>(null)
  const [notifications, setNotifications] = useState<NotificationState>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  async function load() {
    try {
      const response = await fetch(apiPath('/api/phone-cockpit'), { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSnapshot((await response.json()) as PhoneCockpitSnapshot)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const sourceWarnings = useMemo(
    () => Object.values(snapshot?.sources || {}).filter((source) => !source.ok),
    [snapshot],
  )

  const topSignal = useMemo(() => {
    if (!snapshot) return 'Loading…'
    if (snapshot.attention[0]) return snapshot.attention[0].title
    if (snapshot.schedule.nextMeeting) return `${snapshot.schedule.nextMeeting.title} in ${relativeMinutes(snapshot.schedule.nextMeeting.minutesUntil)}`
    if (snapshot.tasks.today) return `${snapshot.tasks.today} due today`
    if (snapshot.inbox.unread !== null) return `${snapshot.inbox.unread} unread mail`
    return snapshot.presence.activity || 'Clear'
  }, [snapshot])

  useEffect(() => {
    if (!snapshot || notifications !== 'granted') return
    const nextPrompt = snapshot.attention.find((item) => item.severity !== 'info')
    if (!nextPrompt || latestPrompt?.id === nextPrompt.id) return
    setLatestPrompt(nextPrompt)
    new Notification(nextPrompt.title, {
      body: nextPrompt.body,
      tag: nextPrompt.id,
    })
  }, [latestPrompt?.id, notifications, snapshot])

  async function submitCapture() {
    const text = captureText.trim()
    if (!text) {
      toast('Add text first.', { type: 'warning' })
      return
    }
    setSaving(true)
    hapticTap()
    try {
      if (captureMode === 'draft') {
        const ok = window.confirm('Queue this draft for later review? Nothing will be sent.')
        if (!ok) return
      }
      const payload =
        captureMode === 'note'
          ? { kind: 'note', text, source: 'phone-pwa' }
          : captureMode === 'task'
            ? { kind: 'task', title: text, priority: 'medium' }
            : {
                kind: 'draft',
                recipient: draftRecipient.trim() || undefined,
                subject: draftSubject.trim() || undefined,
                body: text,
              }
      const response = await fetch(apiPath('/api/phone-cockpit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || `HTTP ${response.status}`)
      }
      setCaptureText('')
      setDraftRecipient('')
      setDraftSubject('')
      toast(captureMode === 'draft' ? 'Draft queued for review.' : 'Captured.', {
        type: 'success',
      })
      void load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Capture failed', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      setNotifications('unsupported')
      return
    }
    const result = await Notification.requestPermission()
    setNotifications(result)
    if (result === 'granted') {
      new Notification('Hermes phone alerts', {
        body: 'Only critical local alerts from this PWA will notify.',
      })
    }
  }

  const attention = snapshot?.attention || []
  const highValueMail = snapshot?.inbox.focused || []
  const taskItems = snapshot?.tasks.items || []
  const nextMeeting = snapshot?.schedule.nextMeeting
  const showMeetingPrep = Boolean(snapshot?.meetingPrep.openActionItems.length || snapshot?.meetingPrep.lastMeetingSummary?.summary)

  return (
    <div className="min-h-full bg-[#080c10] text-[#e8eeee]">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-3 pb-6 pt-[calc(10px+env(safe-area-inset-top))]">
        <header className="rounded-[10px] border border-[#6ec6b8]/25 bg-[#0d1419] p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#8ee7d5]">
            <HugeiconsIcon icon={DashboardSquare01Icon} size={16} aria-hidden="true" />
            Today
          </div>
          <h1 className="mt-2 line-clamp-2 text-[22px] font-semibold leading-7 tracking-[0] text-white [text-wrap:balance]">{topSignal}</h1>
          <p className="mt-1.5 text-sm leading-5 text-[#b7c6c9]">
            {formatFreshness(snapshot?.checkedAt)}
            {sourceWarnings.length ? ` · ${sourceWarnings.length} source${sourceWarnings.length === 1 ? '' : 's'} degraded` : ''}
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2" aria-label="Current counts">
            <StatPill icon={Mail01Icon} label="Unread" value={snapshot?.inbox.unread ?? '—'} />
            <StatPill icon={Alert01Icon} label="Urgent" value={snapshot?.tasks.urgent ?? '—'} />
            <StatPill icon={Task01Icon} label="Overdue" value={snapshot?.tasks.overdue ?? '—'} />
          </div>
          {error ? (
            <div role="alert" className="mt-3 rounded-[8px] border border-[#ff9aa8]/30 bg-[#ff9aa8]/10 p-3 text-sm text-[#ffb0bb]">
              <div className="font-medium text-white">Snapshot unavailable</div>
              <div className="mt-1 break-words">{error}</div>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 min-h-11 rounded-[8px] border border-[#ff9aa8]/30 px-3 text-xs font-medium text-[#ffd6dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9aa8]/70"
              >
                Retry
              </button>
            </div>
          ) : null}
        </header>

        <Card title="Capture" kicker={captureModeMeta[captureMode].label} icon={Add01Icon}>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Capture type">
            {(['note', 'task', 'draft'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCaptureMode(mode)}
                className={cx(
                  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[8px] border px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70',
                  captureMode === mode
                    ? 'border-[#8ee7d5] bg-[#8ee7d5]/15 text-[#b8fff3]'
                    : 'border-white/10 bg-white/[0.04] text-[#cbd8da]',
                )}
              >
                <HugeiconsIcon icon={captureModeMeta[mode].icon} size={15} aria-hidden="true" />
                <span>{captureModeMeta[mode].label}</span>
              </button>
            ))}
          </div>
          {captureMode === 'draft' ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-[#b7c6c9]">
                Recipient
                <input
                  name="draft-recipient"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={draftRecipient}
                  onChange={(event) => setDraftRecipient(event.target.value)}
                  placeholder="person@example.com…"
                  className="min-h-11 rounded-[8px] border border-white/10 bg-[#080c10] px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#b7c6c9]">
                Subject
                <input
                  name="draft-subject"
                  autoComplete="off"
                  value={draftSubject}
                  onChange={(event) => setDraftSubject(event.target.value)}
                  placeholder="Reply topic…"
                  className="min-h-11 rounded-[8px] border border-white/10 bg-[#080c10] px-3 text-sm text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
                />
              </label>
            </div>
          ) : null}
          <label className="mt-2.5 grid gap-1 text-xs font-medium text-[#b7c6c9]">
            {captureMode === 'task' ? 'Task' : captureMode === 'draft' ? 'Draft body' : 'Note'}
            <textarea
              name="phone-capture"
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              placeholder={captureMode === 'note' ? 'Remember this…' : captureMode === 'task' ? 'Add a task…' : 'Draft the reply…'}
              rows={3}
              className="w-full resize-none rounded-[8px] border border-white/10 bg-[#080c10] px-3 py-3 text-base leading-6 text-white outline-none placeholder:text-[#78888c] focus-visible:border-[#8ee7d5] focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/30"
            />
          </label>
          <button
            type="button"
            onClick={() => void submitCapture()}
            disabled={saving}
            className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#8ee7d5] px-4 text-sm font-semibold text-[#071111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 disabled:opacity-60"
          >
            <HugeiconsIcon icon={captureMode === 'draft' ? SentIcon : Add01Icon} size={16} aria-hidden="true" />
            {saving ? 'Saving…' : captureMode === 'task' ? 'Add task' : captureMode === 'draft' ? 'Queue draft' : 'Save note'}
          </button>
          {captureMode === 'draft' ? (
            <p className="mt-2 text-xs leading-5 text-[#b7c6c9]">Drafts become tasks for later review. Nothing is sent from this screen.</p>
          ) : null}
        </Card>

        <Card title="Needs attention" kicker={attention.length ? `${attention.length}` : 'Clear'} icon={Alert01Icon}>
          {attention.length ? (
            <ul className="space-y-2" aria-live="polite">
              {attention.map((item) => (
                <li key={item.id} className={cx('rounded-[8px] border px-3 py-2.5', toneClass(item.severity))}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{item.title}</p>
                      {item.body ? <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-current/90">{item.body}</p> : null}
                    </div>
                    <ExternalAction item={item} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No urgent meeting, task, mail, or source issues right now.</EmptyState>
          )}
        </Card>

        <div className="grid gap-2.5 md:grid-cols-2">
          <Card title="Next meeting" kicker={nextMeeting ? relativeMinutes(nextMeeting.minutesUntil) : 'None'} icon={Calendar01Icon}>
            {nextMeeting ? (
              <div className="space-y-2.5 text-sm">
                <div>
                  <p className="line-clamp-2 break-words text-base font-semibold text-white">{nextMeeting.title}</p>
                  <p className="mt-1 text-[#b7c6c9]">{fmtTime(nextMeeting.date)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ActionLink to="/meetings" label="Open meeting prep"><HugeiconsIcon icon={File01Icon} size={16} aria-hidden="true" /> Prep</ActionLink>
                  {nextMeeting.joinUrl ? (
                    <a
                      href={nextMeeting.joinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#dbe7e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
                    >
                      <HugeiconsIcon icon={Video01Icon} size={16} aria-hidden="true" />
                      Join
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="min-h-11 rounded-[8px] border border-white/10 bg-white/[0.02] px-3 text-sm font-medium text-[#78888c]"
                    >
                      No join link
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState>No upcoming meeting in the current Hermes window.</EmptyState>
            )}
          </Card>

          <Card title="Tasks" kicker={`${snapshot?.tasks.total ?? 0} open`} icon={Task01Icon}>
            {taskItems.length ? (
              <ul className="space-y-2">
                {taskItems.slice(0, 3).map((task) => (
                  <li key={task.id} className="rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium text-white">{task.title}</span>
                      <span className="shrink-0 text-xs uppercase text-[#8ee7d5]">{task.priority}</span>
                    </div>
                    {task.dueDate ? <p className="mt-0.5 text-xs text-[#b7c6c9]">Due {task.dueDate}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No open Hermes tasks.</EmptyState>
            )}
          </Card>
        </div>

        {showMeetingPrep ? (
          <Card title="Meeting prep" kicker={`${snapshot?.meetingPrep.openActionItems.length ?? 0} actions`} icon={Clock01Icon}>
            <div className="space-y-2.5">
              <p className="line-clamp-2 break-words text-sm font-medium text-white">
                {snapshot?.meetingPrep.meetingTitle || snapshot?.meetingPrep.message || 'Prep available'}
              </p>
              {snapshot?.meetingPrep.openActionItems.length ? (
                <ul className="space-y-2">
                  {snapshot.meetingPrep.openActionItems.slice(0, 3).map((item) => (
                    <li key={item.id} className="line-clamp-2 rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm leading-5 text-[#d7e2e4]">
                      {item.text}
                      {item.assignee ? <span className="text-[#8ee7d5]"> — {item.assignee}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {snapshot?.meetingPrep.lastMeetingSummary?.summary ? (
                <p className="line-clamp-3 rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm leading-5 text-[#d7e2e4]">
                  {snapshot.meetingPrep.lastMeetingSummary.summary}
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div className="grid gap-2.5 md:grid-cols-2">
          <Card title="Important mail" kicker={snapshot?.inbox.warning ? 'Warning' : `${highValueMail.length}`} icon={Mail01Icon}>
            {highValueMail.length ? (
              <ul className="space-y-2">
                {highValueMail.slice(0, 3).map((message) => (
                  <li key={`${message.receivedDateTime}-${message.subject}`}>
                    <a
                      href={message.webLink || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[8px] bg-white/[0.04] px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70 motion-safe:active:scale-[0.99]"
                    >
                      <span className="block truncate font-medium text-white">{message.subject}</span>
                      <span className="mt-1 block truncate text-xs text-[#b7c6c9]">
                        {message.sender} · {message.isRead ? 'read' : 'unread'} · {message.importance || 'normal'}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : snapshot?.inbox.warning ? (
              <p role="alert" className="text-sm text-[#ffb0bb]">{snapshot.inbox.warning}</p>
            ) : (
              <EmptyState>No unread high-importance or recent actionable mail.</EmptyState>
            )}
          </Card>

          <Card title="System status" kicker={sourceWarnings.length ? `${sourceWarnings.length} warnings` : 'OK'} icon={ComputerIcon}>
            <div className="space-y-2 text-sm text-[#d7e2e4]">
              <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5">
                <p className="flex items-center gap-2 font-medium text-white"><HugeiconsIcon icon={Notification01Icon} size={15} aria-hidden="true" /> Teams</p>
                <p className="mt-0.5 line-clamp-1 text-[#b7c6c9]">{snapshot?.presence.activity || 'Unknown'} · {snapshot?.presence.displayName || 'Presence unavailable'}</p>
              </div>
              <div className="rounded-[8px] bg-white/[0.04] px-3 py-2.5">
                <p className="flex items-center gap-2 font-medium text-white"><HugeiconsIcon icon={ComputerIcon} size={15} aria-hidden="true" /> Office bridge</p>
                <p className="mt-0.5 text-[#b7c6c9]">
                  {snapshot?.devices.office.status || 'unknown'}
                  {snapshot?.devices.office.checkedAt ? ` · ${fmtShortTime(snapshot.devices.office.checkedAt)}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(snapshot?.sources || {}).map((source) => (
                  <div key={source.label} className={cx('rounded-[8px] border px-3 py-2 text-xs', sourceTone(source.ok))}>
                    {source.label}: {source.ok ? 'OK' : 'degraded'}
                  </div>
                ))}
              </div>
              {notifications !== 'granted' && notifications !== 'unsupported' ? (
                <button
                  type="button"
                  onClick={() => void enableNotifications()}
                  className="min-h-11 w-full rounded-[8px] border border-[#8ee7d5]/40 bg-[#8ee7d5]/10 px-3 text-sm font-medium text-[#b8fff3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ee7d5]/70"
                >
                  Enable critical local alerts
                </button>
              ) : null}
            </div>
          </Card>
        </div>

        <nav aria-label="Workspace shortcuts" className="grid grid-cols-4 gap-2 pb-[env(safe-area-inset-bottom)]">
          <ActionLink to="/phone" label="Open today"><HugeiconsIcon icon={DashboardSquare01Icon} size={18} aria-hidden="true" /></ActionLink>
          <ActionLink to="/chat/main" label="Open chat"><HugeiconsIcon icon={Chat01Icon} size={18} aria-hidden="true" /></ActionLink>
          <ActionLink to="/meetings" label="Open meetings"><HugeiconsIcon icon={Clock01Icon} size={18} aria-hidden="true" /></ActionLink>
          <ActionLink to="/tasks" label="Open tasks"><HugeiconsIcon icon={File01Icon} size={18} aria-hidden="true" /></ActionLink>
        </nav>
      </main>
    </div>
  )
}
