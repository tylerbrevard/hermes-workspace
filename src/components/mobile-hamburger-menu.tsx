import { useNavigate, useRouterState } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Apple01Icon,
  BrainIcon,
  Building01Icon,
  Calendar01Icon,
  Cancel01Icon,
  Castle02Icon,
  Chat01Icon,
  Clock01Icon,
  CommandLineIcon,
  DashboardSquare01Icon,
  File01Icon,
  McpServerIcon,
  Menu01Icon,
  MessageMultiple01Icon,
  PuzzleIcon,
  Rocket01Icon,
  Search01Icon,
  Settings01Icon,
  Task01Icon,
  UserGroupIcon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { hapticTap } from '@/lib/haptics'
import { withBasePath } from '@/lib/base-path'
import { getTheme, getThemeVariant, isDarkTheme, setTheme } from '@/lib/theme'
import {
  selectChatProfileDisplayName,
  useChatSettingsStore,
} from '@/hooks/use-chat-settings'

const HERMESWORLD_ENABLED =
  (import.meta as any).env?.VITE_HERMESWORLD_ENABLED !== '0'

type MobileHamburgerNavItem = {
  id: string
  label: string
  icon: typeof Chat01Icon
  to: string
  match: (path: string) => boolean
  external?: boolean
}

type MobileNavGroupLabel = 'Core' | 'Work' | 'Run' | 'Know' | 'System' | 'Setup'

export const MOBILE_PINNED_NAV_IDS = [
  'phone',
  'chat',
  'lily',
  'dashboard',
] as const

export const MOBILE_NAV_GROUP_ORDER: Array<MobileNavGroupLabel> = [
  'Core',
  'Work',
  'Run',
  'Know',
  'System',
  'Setup',
]

const MOBILE_NAV_GROUP_BY_ID: Record<string, MobileNavGroupLabel> = {
  dashboard: 'Core',
  chat: 'Core',
  lily: 'Core',
  phone: 'Core',
  tasks: 'Work',
  meetings: 'Work',
  'pto-tracker': 'Work',
  'chief-of-staff-mailbox': 'Work',
  barry: 'Work',
  'apple-health': 'Work',
  'it-ops': 'Work',
  conductor: 'Run',
  operations: 'Run',
  'ops-intelligence': 'Run',
  swarm: 'Run',
  jobs: 'Run',
  presence: 'Run',
  files: 'Know',
  memory: 'Know',
  skills: 'Know',
  mcp: 'Know',
  profiles: 'Know',
  terminal: 'System',
  playground: 'System',
  settings: 'Setup',
}

export function groupMobileNavItems(items: Array<MobileHamburgerNavItem>) {
  const mainIds = new Set<string>(MOBILE_PINNED_NAV_IDS)
  const mainOrder = new Map<string, number>(
    MOBILE_PINNED_NAV_IDS.map((id, index) => [id, index]),
  )
  return MOBILE_NAV_GROUP_ORDER.map((label) => ({
    label,
    items: items
      .filter((item) =>
        label === 'Core'
          ? mainIds.has(item.id)
          : !mainIds.has(item.id) && MOBILE_NAV_GROUP_BY_ID[item.id] === label,
      )
      .sort((a, b) => {
        if (label !== 'Core') return 0
        return (mainOrder.get(a.id) ?? 99) - (mainOrder.get(b.id) ?? 99)
      }),
  })).filter((group) => group.items.length > 0)
}

export const MOBILE_HAMBURGER_NAV_ITEMS: Array<MobileHamburgerNavItem> = [
  {
    id: 'chat',
    label: 'Chat',
    icon: Chat01Icon,
    to: '/chat/main',
    match: (p: string) => p.startsWith('/chat') || p === '/new' || p === '/',
  },
  {
    id: 'lily',
    label: 'LILY',
    icon: Chat01Icon,
    to: '/lily',
    match: (p: string) => p.startsWith('/lily'),
  },
  {
    id: 'dashboard',
    label: 'Home',
    icon: DashboardSquare01Icon,
    to: '/dashboard',
    match: (p: string) => p.startsWith('/dashboard'),
  },
  {
    id: 'phone',
    label: 'Phone',
    icon: DashboardSquare01Icon,
    to: '/phone',
    match: (p: string) => p.startsWith('/phone'),
  },
  ...(HERMESWORLD_ENABLED
    ? [
        {
          id: 'playground',
          label: 'HermesWorld',
          icon: Castle02Icon,
          to: '/playground',
          match: (p: string) => p.startsWith('/playground'),
        },
      ]
    : []),
  {
    id: 'files',
    label: 'Files',
    icon: File01Icon,
    to: '/files',
    match: (p: string) => p.startsWith('/files'),
  },
  {
    id: 'terminal',
    label: 'Shell',
    icon: CommandLineIcon,
    to: '/terminal',
    match: (p: string) => p.startsWith('/terminal'),
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: Clock01Icon,
    to: '/jobs',
    match: (p: string) => p.startsWith('/jobs'),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: Task01Icon,
    to: '/tasks',
    match: (p: string) => p.startsWith('/tasks'),
  },
  {
    id: 'pto-tracker',
    label: 'PTO',
    icon: Calendar01Icon,
    to: '/pto-tracker',
    match: (p: string) => p.startsWith('/pto-tracker'),
  },
  {
    id: 'chief-of-staff-mailbox',
    label: 'Mailbox',
    icon: MessageMultiple01Icon,
    to: '/chief-of-staff-mailbox',
    match: (p: string) => p.startsWith('/chief-of-staff-mailbox'),
  },
  {
    id: 'apple-health',
    label: 'Health',
    icon: Apple01Icon,
    to: '/apple-health',
    match: (p: string) => p.startsWith('/apple-health'),
  },
  {
    id: 'conductor',
    label: 'Conductor',
    icon: Rocket01Icon,
    to: '/conductor',
    match: (p: string) => p.startsWith('/conductor'),
  },
  {
    id: 'operations',
    label: 'Ops',
    icon: UserMultipleIcon,
    to: '/operations',
    match: (p: string) => p.startsWith('/operations'),
  },
  {
    id: 'ops-intelligence',
    label: 'Intel',
    icon: DashboardSquare01Icon,
    to: '/ops-intelligence',
    match: (p: string) => p.startsWith('/ops-intelligence'),
  },
  {
    id: 'swarm',
    label: 'Swarm',
    icon: UserGroupIcon,
    to: '/swarm',
    match: (p: string) => p === '/swarm' || p.startsWith('/swarm2'),
  },

  {
    id: 'memory',
    label: 'Memory',
    icon: BrainIcon,
    to: '/memory',
    match: (p: string) => p.startsWith('/memory'),
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: PuzzleIcon,
    to: '/skills',
    match: (p: string) => p.startsWith('/skills'),
  },
  {
    id: 'mcp',
    label: 'MCP',
    icon: McpServerIcon,
    to: '/mcp',
    match: (p: string) => p.startsWith('/mcp'),
  },
  {
    id: 'profiles',
    label: 'Profiles',
    icon: UserGroupIcon,
    to: '/profiles',
    match: (p: string) => p.startsWith('/profiles'),
  },
  {
    id: 'meetings',
    label: 'Meetings',
    icon: Clock01Icon,
    to: '/meetings',
    match: (p: string) => p.startsWith('/meetings'),
  },
  {
    id: 'presence',
    label: 'Presence',
    icon: UserMultipleIcon,
    to: '/presence',
    match: (p: string) => p.startsWith('/presence'),
  },
  {
    id: 'it-ops',
    label: 'CW',
    icon: Building01Icon,
    to: '/it-ops',
    match: (p: string) => p.startsWith('/it-ops'),
  },
  {
    id: 'barry',
    label: 'Barry',
    icon: Chat01Icon,
    to: '/barry',
    match: (p: string) => p.startsWith('/barry'),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings01Icon,
    to: '/settings',
    match: (p: string) => p.startsWith('/settings'),
  },
]

/** Shared drawer state — used by both the trigger button and the drawer itself */
let _setOpen: ((v: boolean) => void) | null = null

/** Call this from anywhere (e.g. chat header) to open the nav drawer */
export function openHamburgerMenu() {
  hapticTap()
  _setOpen?.(true)
}

/** The hamburger trigger button — inline, no fixed positioning */
export function HamburgerTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Open navigation menu"
      onClick={openHamburgerMenu}
      className={cn(
        'flex items-center justify-center size-9 rounded-xl',
        'text-primary-400 hover:text-primary-200 active:scale-90 transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] duration-150',
        'touch-manipulation select-none',
        className,
      )}
    >
      <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={1.8} />
    </button>
  )
}

/** Mount once in WorkspaceShell — renders the drawer + backdrop */
export function MobileHamburgerMenu() {
  const [open, setOpen] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  _setOpen = setOpen

  // Add/remove body class to push main content
  useEffect(() => {
    document.body.classList.toggle('nav-drawer-open', open)
    return () => {
      document.body.classList.remove('nav-drawer-open')
    }
  }, [open])

  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const profileDisplayName = useChatSettingsStore(selectChatProfileDisplayName)
  const filteredNavItems = useMemo(() => {
    const q = navQuery.trim().toLowerCase()
    if (!q) return MOBILE_HAMBURGER_NAV_ITEMS
    return MOBILE_HAMBURGER_NAV_ITEMS.filter((item) =>
      [item.id, item.label, item.to].join(' ').toLowerCase().includes(q),
    )
  }, [navQuery])
  const groupedNavItems = useMemo(
    () => groupMobileNavItems(filteredNavItems),
    [filteredNavItems],
  )

  function handleNav(to: string, external?: boolean) {
    hapticTap()
    if (external) {
      window.location.assign(withBasePath(to))
    } else {
      void navigate({ to })
    }
    setNavQuery('')
    setOpen(false)
  }

  return (
    <>
      {/* No floating button — each page has MobilePageHeader with HamburgerTrigger inline */}

      {/* Push-style layout wrapper — sidebar pushes content right */}
      <div
        className={cn(
          'fixed inset-0 z-[95] md:hidden',
          'transition-transform duration-300 ease-in-out',
          open ? 'visible translate-x-0' : 'invisible pointer-events-none',
        )}
        aria-hidden={!open}
      >
        {/* Main content overlay — dims and shifts right when sidebar is open */}
        <div
          className={cn(
            'absolute inset-0 transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] duration-300 ease-in-out',
            open
              ? 'translate-x-72 opacity-40 scale-[0.92] rounded-2xl overflow-hidden'
              : 'translate-x-0 opacity-100 scale-100',
          )}
          onClick={() => open && setOpen(false)}
          style={open ? { transformOrigin: 'left center' } : undefined}
        />
      </div>

      {/* Slide-over drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 z-[96] w-72 md:hidden',
          'shadow-2xl',
          'flex max-h-[100dvh] flex-col pt-[max(env(safe-area-inset-top,20px),20px)] pb-[max(env(safe-area-inset-bottom,20px),20px)]',
          'transition-transform duration-300 ease-in-out',
          open ? 'visible translate-x-0' : 'invisible -translate-x-full',
        )}
        aria-hidden={!open}
        style={{
          background: 'var(--color-surface, #fff)',
          borderColor: 'var(--color-border, #e5e7eb)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pb-4"
          style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/claude-avatar.webp"
              alt="Hermes Agent"
              className="size-8 rounded-xl shrink-0"
            />
            <div className="flex flex-col leading-tight">
              <span
                className="font-bold text-[15px]"
                style={{ color: 'var(--color-ink, #111)' }}
              >
                Hermes
              </span>
              <span
                className="text-[11px]"
                style={{ color: 'var(--color-muted, #888)' }}
              >
                Workspace
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center size-8 rounded-full active:scale-90 transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height]"
            style={{ color: 'var(--color-muted, #888)' }}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="px-3 pt-3">
          <label className="relative block">
            <span className="sr-only">Search workspace pages</span>
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              strokeWidth={1.6}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-muted, #888)' }}
            />
            <input
              value={navQuery}
              onChange={(event) => setNavQuery(event.target.value)}
              placeholder="Find"
              className="h-10 w-full rounded-full border bg-transparent pl-9 pr-3 text-[14px] outline-none"
              style={{
                borderColor: 'var(--color-border, #e5e7eb)',
                color: 'var(--color-ink, #111)',
              }}
            />
          </label>
        </div>

        {/* Nav items */}
        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-3">
          {groupedNavItems.map((group) => (
            <div key={group.label} className="space-y-2">
              <div
                className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--color-muted, #888)' }}
              >
                {group.label}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const isActive = item.match(pathname)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.to, item.external)}
                      className={cn(
                        'flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-[18px] border text-center',
                        'transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] duration-150 active:scale-[0.97]',
                      )}
                      style={
                        isActive
                          ? {
                              background:
                                'var(--theme-accent-subtle, color-mix(in srgb, var(--theme-accent, #6366f1) 14%, transparent))',
                              borderColor:
                                'var(--theme-accent, var(--color-accent, #6366f1))',
                              color:
                                'var(--theme-accent, var(--color-accent, #6366f1))',
                            }
                          : {
                              borderColor: 'var(--color-border, #e5e7eb)',
                              color:
                                'var(--theme-muted, var(--color-ink-muted, #555))',
                            }
                      }
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        size={21}
                        strokeWidth={isActive ? 2 : 1.6}
                      />
                      <span className="max-w-full truncate px-1 text-[12px] font-semibold leading-none">
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {groupedNavItems.length === 0 ? (
            <div
              className="rounded-xl border px-3 py-4 text-center text-[13px]"
              style={{
                borderColor: 'var(--color-border, #e5e7eb)',
                color: 'var(--color-muted, #888)',
              }}
            >
              No pages found
            </div>
          ) : null}
        </nav>

        {/* Bottom — user profile + settings + theme toggle */}
        <div
          className="px-3 pb-2 pt-3"
          style={{ borderTop: '1px solid var(--color-border, #e5e7eb)' }}
        >
          <div className="flex items-center gap-3 px-2">
            {/* User avatar + name + status dot */}
            <div
              className="size-9 rounded-xl shrink-0 flex items-center justify-center"
              style={{
                background:
                  'var(--theme-accent-subtle, color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent))',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: 'var(--theme-accent, var(--color-accent, #6366f1))',
                }}
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span
              className="text-[15px] font-semibold truncate"
              style={{ color: 'var(--color-ink, #111)' }}
            >
              {profileDisplayName}
            </span>
            <span className="size-2.5 rounded-full bg-green-500 shrink-0" />

            <div className="flex-1" />

            {/* Settings cog */}
            <button
              type="button"
              onClick={() => handleNav('/settings')}
              className="flex items-center justify-center size-9 rounded-xl active:bg-white/10 transition-colors"
              aria-label="Settings"
              style={{ color: 'var(--color-ink-muted, #888)' }}
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={20}
                strokeWidth={1.5}
              />
            </button>

            {/* Theme toggle — sun/moon */}
            <button
              type="button"
              onClick={() => {
                const current = getTheme()
                const dark = isDarkTheme(current)
                const next = getThemeVariant(current, dark ? 'light' : 'dark')
                setTheme(next)
              }}
              className="flex items-center justify-center size-9 rounded-xl active:bg-white/10 transition-colors"
              aria-label="Toggle theme"
              style={{ color: 'var(--color-ink-muted, #888)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
