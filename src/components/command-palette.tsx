'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Apple01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  BrainIcon,
  Building01Icon,
  Calendar01Icon,
  Castle02Icon,
  Chat01Icon,
  CheckListIcon,
  Clock01Icon,
  CommandLineIcon,
  DashboardSquare01Icon,
  Dumbbell01Icon,
  File01Icon,
  InjectionIcon,
  McpServerIcon,
  MessageMultiple01Icon,
  PuzzleIcon,
  Rocket01Icon,
  Settings01Icon,
  Target02Icon,
  UserGroupIcon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import type React from 'react'
import type { SessionMeta } from '@/screens/chat/types'
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from '@/components/ui/command'
import {
  CHAT_OPEN_SETTINGS_EVENT,
  CHAT_PENDING_COMMAND_STORAGE_KEY,
  CHAT_RUN_COMMAND_EVENT,
} from '@/screens/chat/chat-events'
import { cn } from '@/lib/utils'
import { WORKSPACE_IMPROVEMENT_OPEN_EVENT } from '@/lib/workspace-improvement-progress'

type CommandPaletteProps = {
  pathname: string
  sessions: Array<SessionMeta>
}

type CommandAction = {
  id: string
  group: 'Actions' | 'Screens' | 'Recent Sessions' | 'Slash Commands'
  label: string
  keywords: string
  shortcut?: string
  icon: typeof Chat01Icon
  onSelect: () => void
}

type ScoredAction = CommandAction & {
  score: number
}

const SCREEN_GROUP_ORDER = [
  'Actions',
  'Screens',
  'Recent Sessions',
  'Slash Commands',
] as const

function getSessionLabel(session: SessionMeta) {
  return (
    session.label ||
    session.title ||
    session.derivedTitle ||
    session.friendlyId ||
    session.key
  )
}

function scoreCommandAction(action: CommandAction, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 1

  const haystack = `${action.label} ${action.keywords}`.toLowerCase()
  const directIndex = haystack.indexOf(normalizedQuery)
  if (directIndex >= 0) {
    return (
      400 - directIndex - Math.max(0, haystack.length - normalizedQuery.length)
    )
  }

  let queryIndex = 0
  let gaps = 0
  let lastMatch = -1

  for (
    let i = 0;
    i < haystack.length && queryIndex < normalizedQuery.length;
    i += 1
  ) {
    if (haystack[i] !== normalizedQuery[queryIndex]) continue
    if (lastMatch >= 0) gaps += Math.max(0, i - lastMatch - 1)
    lastMatch = i
    queryIndex += 1
  }

  if (queryIndex !== normalizedQuery.length) return 0
  return 180 - gaps - Math.max(0, haystack.length - normalizedQuery.length)
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  )
}

export function CommandPalette({ pathname, sessions }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 768px)').matches
  })
  const isMacPlatform = useMemo(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.platform.toLowerCase().includes('mac')
  }, [])

  const runSlashCommand = (command: string) => {
    if (command === '/new') {
      // /chat index redirects to last session via localStorage — use the
      // explicit 'new' sentinel so /new actually opens a fresh chat. See #300.
      void navigate({ to: '/chat/$sessionKey', params: { sessionKey: 'new' } })
      return
    }

    if (command === '/skills') {
      void navigate({ to: '/skills' })
      return
    }

    if (command === '/mcp') {
      void navigate({ to: '/mcp' })
      return
    }

    if (command === '/model' || command === '/skin') {
      const section = command === '/skin' ? 'appearance' : 'claude'
      if (pathname.startsWith('/chat') || pathname === '/') {
        window.dispatchEvent(
          new CustomEvent(CHAT_OPEN_SETTINGS_EVENT, {
            detail: { section },
          }),
        )
        return
      }

      window.sessionStorage.setItem(CHAT_PENDING_COMMAND_STORAGE_KEY, command)
      void navigate({ to: '/chat' })
      return
    }

    if (pathname.startsWith('/chat') || pathname === '/') {
      window.dispatchEvent(
        new CustomEvent(CHAT_RUN_COMMAND_EVENT, {
          detail: { command },
        }),
      )
      return
    }

    window.sessionStorage.setItem(CHAT_PENDING_COMMAND_STORAGE_KEY, command)
    void navigate({ to: '/chat' })
  }

  const screenActions = useMemo<Array<CommandAction>>(
    () => [
      {
        id: 'screen-dashboard',
        group: 'Screens',
        label: 'Dashboard',
        keywords: 'home metrics overview freshness usage status',
        shortcut: 'Go',
        icon: DashboardSquare01Icon,
        onSelect: () => void navigate({ to: '/dashboard' }),
      },
      {
        id: 'screen-chat',
        group: 'Screens',
        label: 'Chat',
        keywords: 'conversation new session home',
        shortcut: 'Go',
        icon: Chat01Icon,
        onSelect: () => void navigate({ to: '/chat' }),
      },
      {
        id: 'screen-lily',
        group: 'Screens',
        label: 'LILY',
        keywords: 'voice livekit assistant orb conversation',
        shortcut: 'Go',
        icon: Chat01Icon,
        onSelect: () => void navigate({ to: '/lily' }),
      },
      {
        id: 'screen-phone',
        group: 'Screens',
        label: 'Phone Cockpit',
        keywords: 'home capture mobile voice inbox meeting prep',
        shortcut: 'Go',
        icon: DashboardSquare01Icon,
        onSelect: () => void navigate({ to: '/phone' }),
      },
      {
        id: 'screen-playground',
        group: 'Screens',
        label: 'HermesWorld',
        keywords: 'playground world game scene',
        shortcut: 'Go',
        icon: Castle02Icon,
        onSelect: () => void navigate({ to: '/playground' }),
      },
      {
        id: 'screen-files',
        group: 'Screens',
        label: 'Files',
        keywords: 'workspace editor browser',
        shortcut: 'Go',
        icon: File01Icon,
        onSelect: () => void navigate({ to: '/files' }),
      },
      {
        id: 'screen-terminal',
        group: 'Screens',
        label: 'Terminal',
        keywords: 'console shell command line',
        shortcut: 'Go',
        icon: CommandLineIcon,
        onSelect: () => void navigate({ to: '/terminal' }),
      },
      {
        id: 'screen-jobs',
        group: 'Screens',
        label: 'Jobs',
        keywords: 'automation cron heartbeat schedule runs',
        shortcut: 'Go',
        icon: Clock01Icon,
        onSelect: () => void navigate({ to: '/jobs' }),
      },
      {
        id: 'screen-tasks',
        group: 'Screens',
        label: 'Tasks',
        keywords: 'todo backlog action items work',
        shortcut: 'Go',
        icon: CheckListIcon,
        onSelect: () => void navigate({ to: '/tasks' }),
      },
      {
        id: 'screen-75-tracker',
        group: 'Screens',
        label: '75 Hard/Soft',
        keywords:
          '75 hard soft challenge habit tracker workout water reading diet progress',
        shortcut: 'Go',
        icon: Dumbbell01Icon,
        onSelect: () => void navigate({ to: '/75-tracker' }),
      },
      {
        id: 'screen-pto-tracker',
        group: 'Screens',
        label: 'PTO Tracker',
        keywords:
          'pto time off flex sick calendar direct reports attendance presence inactivity',
        shortcut: 'Go',
        icon: Calendar01Icon,
        onSelect: () => void navigate({ to: '/pto-tracker' }),
      },
      {
        id: 'screen-wegovy',
        group: 'Screens',
        label: 'Wegovy Shots',
        keywords:
          'wegovy shot injection semaglutide dose weight side effects medication',
        shortcut: 'Go',
        icon: InjectionIcon,
        onSelect: () => void navigate({ to: '/wegovy' }),
      },
      {
        id: 'screen-zyn-tracker',
        group: 'Screens',
        label: 'Zyn Tracker',
        keywords:
          'zyn nicotine pouch pouches daily count strength craving trigger limit',
        shortcut: 'Go',
        icon: Target02Icon,
        onSelect: () => void navigate({ to: '/zyn-tracker' }),
      },
      {
        id: 'screen-food-log',
        group: 'Screens',
        label: 'Food Log',
        keywords:
          'food calorie calories macros protein carbs fat meal cal ai nutrition',
        shortcut: 'Go',
        icon: Apple01Icon,
        onSelect: () => void navigate({ to: '/food-log' }),
      },
      {
        id: 'screen-conductor',
        group: 'Screens',
        label: 'Conductor',
        keywords: 'missions orchestrator templates approvals outputs',
        shortcut: 'Go',
        icon: Rocket01Icon,
        onSelect: () => void navigate({ to: '/conductor' }),
      },
      {
        id: 'screen-operations',
        group: 'Screens',
        label: 'Operations',
        keywords: 'agents fleet workers outputs activity',
        shortcut: 'Go',
        icon: UserMultipleIcon,
        onSelect: () => void navigate({ to: '/operations' }),
      },
      {
        id: 'screen-ops-intelligence',
        group: 'Screens',
        label: 'Ops Intel',
        keywords: 'readiness incidents dependencies recommendations reports',
        shortcut: 'Go',
        icon: DashboardSquare01Icon,
        onSelect: () => void navigate({ to: '/ops-intelligence' }),
      },
      {
        id: 'screen-swarm',
        group: 'Screens',
        label: 'Swarm',
        keywords: 'workers mission dispatch runtime router',
        shortcut: 'Go',
        icon: UserGroupIcon,
        onSelect: () => void navigate({ to: '/swarm' }),
      },
      {
        id: 'screen-memory',
        group: 'Screens',
        label: 'Memory',
        keywords: 'knowledge durable memory notes',
        shortcut: 'Go',
        icon: BrainIcon,
        onSelect: () => void navigate({ to: '/memory' }),
      },
      {
        id: 'screen-skills',
        group: 'Screens',
        label: 'Skills',
        keywords: 'install tools capabilities',
        shortcut: 'Go',
        icon: PuzzleIcon,
        onSelect: () => void navigate({ to: '/skills' }),
      },
      {
        id: 'screen-mcp',
        group: 'Screens',
        label: 'MCP',
        keywords: 'mcp servers model context protocol presets',
        shortcut: 'Go',
        icon: McpServerIcon,
        onSelect: () => void navigate({ to: '/mcp' }),
      },
      {
        id: 'screen-profiles',
        group: 'Screens',
        label: 'Profiles',
        keywords: 'personas settings profile monitoring',
        shortcut: 'Go',
        icon: UserMultipleIcon,
        onSelect: () => void navigate({ to: '/profiles' }),
      },
      {
        id: 'screen-settings',
        group: 'Screens',
        label: 'Settings',
        keywords: 'preferences configuration',
        shortcut: 'Go',
        icon: Settings01Icon,
        onSelect: () => void navigate({ to: '/settings', search: {} }),
      },
      {
        id: 'screen-meetings',
        group: 'Screens',
        label: 'Meetings',
        keywords: 'ops review action items issues decisions calendar',
        shortcut: 'Go',
        icon: Clock01Icon,
        onSelect: () => void navigate({ to: '/meetings' }),
      },
      {
        id: 'screen-presence',
        group: 'Screens',
        label: 'Presence',
        keywords: 'teams m5 presence status device sync',
        shortcut: 'Go',
        icon: UserMultipleIcon,
        onSelect: () => void navigate({ to: '/presence' }),
      },
      {
        id: 'screen-it-ops',
        group: 'Screens',
        label: 'ConnectWise',
        keywords:
          'connectwise tickets standups analytics support service board sla',
        shortcut: 'Go',
        icon: Building01Icon,
        onSelect: () => void navigate({ to: '/it-ops' }),
      },
      {
        id: 'screen-barry',
        group: 'Screens',
        label: 'Barry',
        keywords: 'barry one on one manager meetings checkins notes followups',
        shortcut: 'Go',
        icon: Chat01Icon,
        onSelect: () => void navigate({ to: '/barry' }),
      },
      {
        id: 'screen-current-improvements',
        group: 'Screens',
        label: 'Current Page Improvements',
        keywords:
          'recommendations improvements backlog optimize current page checklist',
        shortcut: 'Open',
        icon: CheckListIcon,
        onSelect: () =>
          window.dispatchEvent(
            new CustomEvent(WORKSPACE_IMPROVEMENT_OPEN_EVENT),
          ),
      },
    ],
    [navigate],
  )

  const recentSessionActions = useMemo<Array<CommandAction>>(
    () =>
      [...sessions]
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .slice(0, 5)
        .map((session) => ({
          id: `session-${session.key}`,
          group: 'Recent Sessions',
          label: getSessionLabel(session),
          keywords: `${session.key} ${session.friendlyId} ${session.title ?? ''} ${session.derivedTitle ?? ''}`,
          shortcut: 'Open',
          icon: Chat01Icon,
          onSelect: () =>
            void navigate({
              to: '/chat/$sessionKey',
              params: { sessionKey: session.key },
            }),
        })),
    [navigate, sessions],
  )

  const slashCommandActions = useMemo<Array<CommandAction>>(
    () => [
      {
        id: 'slash-new',
        group: 'Slash Commands',
        label: '/new',
        keywords: 'start new session conversation',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/new'),
      },
      {
        id: 'slash-clear',
        group: 'Slash Commands',
        label: '/clear',
        keywords: 'clear current chat history conversation',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/clear'),
      },
      {
        id: 'slash-model',
        group: 'Slash Commands',
        label: '/model',
        keywords: 'open model picker settings claude provider',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/model'),
      },
      {
        id: 'slash-skills',
        group: 'Slash Commands',
        label: '/skills',
        keywords: 'browse manage skills page',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/skills'),
      },
      {
        id: 'slash-mcp',
        group: 'Slash Commands',
        label: '/mcp',
        keywords: 'mcp servers model context protocol page',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/mcp'),
      },
      {
        id: 'slash-skin',
        group: 'Slash Commands',
        label: '/skin',
        keywords: 'open appearance settings theme',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/skin'),
      },
      {
        id: 'slash-save',
        group: 'Slash Commands',
        label: '/save',
        keywords: 'export current conversation transcript',
        shortcut: 'Run',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/save'),
      },
    ],
    [pathname],
  )

  const quickActionActions = useMemo<Array<CommandAction>>(
    () => [
      {
        id: 'action-create-task',
        group: 'Actions',
        label: 'Create task',
        keywords: 'new task todo backlog capture action item keyboard',
        shortcut: isMacPlatform ? '⌘⇧T' : 'Ctrl ⇧T',
        icon: CheckListIcon,
        onSelect: () =>
          void navigate({
            to: '/tasks',
            search: { create: 'task', column: 'backlog', filter: 'active' },
          }),
      },
      {
        id: 'action-capture-note',
        group: 'Actions',
        label: 'Capture note',
        keywords: 'quick note mobile phone cockpit memory inbox capture',
        shortcut: isMacPlatform ? '⌘⇧N' : 'Ctrl ⇧N',
        icon: MessageMultiple01Icon,
        onSelect: () =>
          void navigate({
            to: '/phone',
            search: { capture: 'note' },
          }),
      },
      {
        id: 'action-draft-email',
        group: 'Actions',
        label: 'Draft email',
        keywords: 'reply later mail message draft phone cockpit',
        shortcut: isMacPlatform ? '⌘⇧D' : 'Ctrl ⇧D',
        icon: MessageMultiple01Icon,
        onSelect: () =>
          void navigate({
            to: '/phone',
            search: { capture: 'draft' },
          }),
      },
      {
        id: 'action-start-agent-job',
        group: 'Actions',
        label: 'Start agent job',
        keywords: 'conductor mission worker swarm automation job run',
        shortcut: isMacPlatform ? '⌘⇧J' : 'Ctrl ⇧J',
        icon: Rocket01Icon,
        onSelect: () => void navigate({ to: '/conductor' }),
      },
      {
        id: 'action-open-model-settings',
        group: 'Actions',
        label: 'Open model settings',
        keywords: 'settings model provider claude api key local openai',
        shortcut: 'Settings',
        icon: Settings01Icon,
        onSelect: () =>
          void navigate({ to: '/settings', search: { section: 'claude' } }),
      },
      {
        id: 'action-open-voice-settings',
        group: 'Actions',
        label: 'Open voice settings',
        keywords: 'settings lily voice microphone speaker livekit speech',
        shortcut: 'Settings',
        icon: Settings01Icon,
        onSelect: () =>
          void navigate({ to: '/settings', search: { section: 'voice' } }),
      },
      {
        id: 'action-open-appearance-settings',
        group: 'Actions',
        label: 'Open appearance settings',
        keywords: 'settings theme appearance skin palette dark light color',
        shortcut: 'Settings',
        icon: Settings01Icon,
        onSelect: () =>
          void navigate({
            to: '/settings',
            search: { section: 'appearance' },
          }),
      },
      {
        id: 'action-open-notification-settings',
        group: 'Actions',
        label: 'Open notification settings',
        keywords: 'settings notifications alerts threshold usage suggestions',
        shortcut: 'Settings',
        icon: Settings01Icon,
        onSelect: () =>
          void navigate({
            to: '/settings',
            search: { section: 'notifications' },
          }),
      },
    ],
    [isMacPlatform, navigate],
  )

  const actions = useMemo(
    () => [
      ...quickActionActions,
      ...screenActions,
      ...recentSessionActions,
      ...slashCommandActions,
    ],
    [
      quickActionActions,
      recentSessionActions,
      screenActions,
      slashCommandActions,
    ],
  )

  const filteredActions = useMemo<Array<ScoredAction>>(() => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      return actions.map((action) => ({ ...action, score: 1 }))
    }

    return actions
      .map((action) => ({
        ...action,
        score: scoreCommandAction(action, normalizedQuery),
      }))
      .filter((action) => action.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.label.localeCompare(right.label),
      )
  }, [actions, query])

  const groupedActions = useMemo(
    () =>
      SCREEN_GROUP_ORDER.map((group) => ({
        group,
        items: filteredActions.filter((action) => action.group === group),
      })).filter((group) => group.items.length > 0),
    [filteredActions],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 768px)')
    const updateDesktop = () => setIsDesktop(media.matches)
    updateDesktop()
    media.addEventListener('change', updateDesktop)
    return () => media.removeEventListener('change', updateDesktop)
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, open])

  useEffect(() => {
    if (selectedIndex < filteredActions.length) return
    setSelectedIndex(Math.max(0, filteredActions.length - 1))
  }, [filteredActions.length, selectedIndex])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !isDesktop) return
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) {
        return
      }
      if (event.key.toLowerCase() !== 'k') return

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [isDesktop])

  useEffect(() => {
    function handleQuickActionShortcut(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isDesktop ||
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        event.altKey ||
        isEditableEventTarget(event.target)
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const actionByKey: Record<string, string> = {
        t: 'action-create-task',
        n: 'action-capture-note',
        d: 'action-draft-email',
        j: 'action-start-agent-job',
      }
      const actionId = actionByKey[key]
      if (!actionId) return
      const action = quickActionActions.find((item) => item.id === actionId)
      if (!action) return

      event.preventDefault()
      action.onSelect()
      setOpen(false)
    }

    window.addEventListener('keydown', handleQuickActionShortcut, true)
    return () =>
      window.removeEventListener('keydown', handleQuickActionShortcut, true)
  }, [isDesktop, quickActionActions])

  useEffect(() => {
    if (!open) return

    function handleOpenKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (filteredActions.length === 0) return
        setSelectedIndex((current) => (current + 1) % filteredActions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (filteredActions.length === 0) return
        setSelectedIndex(
          (current) =>
            (current - 1 + filteredActions.length) % filteredActions.length,
        )
        return
      }

      if (event.key === 'Enter') {
        if (filteredActions.length === 0) return
        event.preventDefault()
        filteredActions[selectedIndex]?.onSelect()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleOpenKey, true)
    return () => window.removeEventListener('keydown', handleOpenKey, true)
  }, [filteredActions, open, selectedIndex])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
  }, [open])

  if (!isDesktop) return null

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandDialogPopup className="mx-auto self-start">
        <Command
          items={filteredActions}
          value={query}
          onValueChange={setQuery}
          mode="none"
        >
          <CommandInput placeholder="Search actions, screens, sessions, and commands" />
          <CommandPanel className="flex min-h-0 flex-1 flex-col">
            {groupedActions.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-primary-600">
                No results for “{query.trim()}”.
              </div>
            ) : (
              <CommandList className="h-72 min-h-0">
                {groupedActions.map((group, groupIndex) => (
                  <Fragment key={group.group}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.group}</CommandGroupLabel>
                      {group.items.map((action) => {
                        const actionIndex = filteredActions.findIndex(
                          (item) => item.id === action.id,
                        )
                        const isSelected = actionIndex === selectedIndex
                        return (
                          <CommandItem
                            key={action.id}
                            value={action.label}
                            onMouseMove={() => setSelectedIndex(actionIndex)}
                            onClick={() => {
                              action.onSelect()
                              setOpen(false)
                            }}
                            className={cn(
                              'gap-3 rounded-lg px-3 py-2',
                              isSelected && 'bg-primary-100 text-primary-900',
                            )}
                          >
                            <HugeiconsIcon
                              icon={action.icon}
                              size={18}
                              strokeWidth={1.6}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {action.label}
                              </div>
                            </div>
                            {action.shortcut ? (
                              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-500">
                                {action.shortcut}
                              </span>
                            ) : null}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                    {groupIndex < groupedActions.length - 1 ? (
                      <CommandSeparator />
                    ) : null}
                  </Fragment>
                ))}
              </CommandList>
            )}
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4 text-primary-700">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-surface px-2 py-1 text-[11px] font-medium text-primary-700">
                  <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                </span>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-primary-200 bg-surface px-2 py-1 text-[11px] font-medium text-primary-700">
                  Enter
                </span>
                <span>Select</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-primary-700">
              <span className="rounded-md border border-primary-200 bg-surface px-2 py-1 text-[11px] font-medium text-primary-700">
                {isMacPlatform ? '⌘K' : 'Ctrl K'}
              </span>
              <span>Toggle</span>
            </div>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  )
}
