// @vitest-environment jsdom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceImprovementDrawer } from './workspace-improvement-drawer'
import { WORKSPACE_IMPROVEMENT_OPEN_EVENT } from '@/lib/workspace-improvement-progress'

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean
}
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true

function installLocalStorage() {
  const store = new Map<string, string>()
  const storage = {
    get length() {
      return store.size
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

async function renderDrawer(pathname = '/dashboard') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await React.act(() => {
    root.render(<WorkspaceImprovementDrawer pathname={pathname} />)
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

async function waitForDeferredFocus() {
  await React.act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  installLocalStorage()
  document.body.style.overflow = ''
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('WorkspaceImprovementDrawer', () => {
  it('opens from the global event, locks body scroll, and closes on Escape', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open improvements'
    document.body.appendChild(opener)
    opener.focus()
    const { container, unmount } = await renderDrawer()

    await React.act(() => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_IMPROVEMENT_OPEN_EVENT))
    })
    await waitForDeferredFocus()

    expect(container.textContent).toContain('Dashboard Improvements')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(
      container.querySelector(
        'input[placeholder="Search all page recommendations"]',
      ),
    )

    await React.act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(container.textContent).not.toContain('Dashboard Improvements')
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(opener)

    await unmount()
    opener.remove()
  })

  it('keeps keyboard tabbing inside the open drawer', async () => {
    const { container, unmount } = await renderDrawer()

    await React.act(() => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_IMPROVEMENT_OPEN_EVENT))
    })
    await waitForDeferredFocus()

    const panel = container.querySelector('section')
    const focusable = Array.from(
      panel?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]):not([tabindex="-1"])',
      ) ?? [],
    )
    expect(focusable.length).toBeGreaterThan(1)

    focusable[focusable.length - 1].focus()
    await React.act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    })
    expect(document.activeElement).toBe(focusable[0])

    focusable[0].focus()
    await React.act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }),
      )
    })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])

    await unmount()
  })

  it('shows a clipboard failure state instead of throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard blocked')),
      },
    })
    const { container, unmount } = await renderDrawer()

    await React.act(() => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_IMPROVEMENT_OPEN_EVENT))
    })

    const copyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Copy MD',
    )
    expect(copyButton).toBeTruthy()

    await React.act(async () => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Failed')

    await unmount()
  })
})
