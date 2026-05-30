// @vitest-environment jsdom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './command-palette'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/components/ui/command', async () => {
  const React = await import('react')
  const passthrough =
    (tagName = 'div') =>
    ({
      children,
      className,
    }: {
      children?: React.ReactNode
      className?: string
    }) =>
      React.createElement(tagName, { className }, children)

  return {
    Command: passthrough(),
    CommandDialog: ({
      open,
      children,
    }: {
      open: boolean
      children?: React.ReactNode
    }) => (open ? React.createElement('div', {}, children) : null),
    CommandDialogPopup: passthrough(),
    CommandFooter: passthrough('footer'),
    CommandGroup: passthrough('section'),
    CommandGroupLabel: passthrough('h2'),
    CommandInput: ({ placeholder }: { placeholder?: string }) =>
      React.createElement('input', { placeholder }),
    CommandItem: ({
      children,
      onClick,
      onMouseMove,
      className,
    }: {
      children?: React.ReactNode
      onClick?: () => void
      onMouseMove?: () => void
      className?: string
    }) =>
      React.createElement(
        'button',
        { className, onClick, onMouseMove, type: 'button' },
        children,
      ),
    CommandList: passthrough(),
    CommandPanel: passthrough(),
    CommandSeparator: () => React.createElement('hr'),
  }
})

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean
}
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true

function installDesktopMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

async function renderPalette(pathname = '/dashboard') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await React.act(() => {
    root.render(<CommandPalette pathname={pathname} sessions={[]} />)
  })

  return {
    container,
    unmount: async () => {
      await React.act(() => {
        root.unmount()
      })
      document.body.removeChild(container)
    },
  }
}

beforeEach(() => {
  navigateMock.mockReset()
  installDesktopMedia()
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: 'MacIntel',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('CommandPalette', () => {
  it('opens with action commands before screen commands', async () => {
    const { unmount } = await renderPalette()

    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
      )
    })

    expect(document.body.textContent).toContain('Actions')
    expect(document.body.textContent).toContain('Create task')
    expect(document.body.textContent).toContain('Capture note')
    expect(document.body.textContent).toContain('Open meeting prep')
    expect(document.body.textContent).toContain('Open Barry check-ins')
    expect(document.body.textContent).toContain('Open swarm controls')
    expect(document.body.textContent).toContain('Open model settings')
    expect(document.body.textContent).toContain('Open voice settings')
    expect(document.body.textContent).toContain('Screens')
    expect((document.body.textContent ?? '').indexOf('Actions')).toBeLessThan(
      (document.body.textContent ?? '').indexOf('Screens'),
    )

    await unmount()
  })

  it('runs quick action shortcuts without opening the palette', async () => {
    const { unmount } = await renderPalette()

    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'n',
          metaKey: true,
          shiftKey: true,
        }),
      )
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/phone',
      search: { capture: 'note' },
    })

    await unmount()
  })

  it('routes common settings actions directly to their settings sections', async () => {
    const { unmount } = await renderPalette()

    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
      )
    })

    const voiceAction = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Open voice settings'),
    )
    expect(voiceAction).toBeTruthy()

    await React.act(() => {
      voiceAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/settings',
      search: { section: 'voice' },
    })

    await unmount()
  })

  it('routes workflow actions to their owning pages and filters', async () => {
    const { unmount } = await renderPalette()

    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
      )
    })

    const waitingTasksAction = Array.from(
      document.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Review waiting tasks'))
    expect(waitingTasksAction).toBeTruthy()

    await React.act(() => {
      waitingTasksAction?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/tasks',
      search: { filter: 'waiting' },
    })

    await unmount()
  })

  it('routes expanded operator shortcuts without opening the palette', async () => {
    const { unmount } = await renderPalette()

    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'm',
          metaKey: true,
          shiftKey: true,
        }),
      )
    })

    expect(navigateMock).toHaveBeenCalledWith({ to: '/meetings' })

    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 's',
          metaKey: true,
          shiftKey: true,
        }),
      )
    })

    expect(navigateMock).toHaveBeenCalledWith({ to: '/swarm2' })

    await unmount()
  })

  it('ignores quick action shortcuts while typing in editable fields', async () => {
    const { unmount } = await renderPalette()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    await React.act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 't',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      )
    })

    expect(navigateMock).not.toHaveBeenCalled()

    input.remove()
    await unmount()
  })
})
