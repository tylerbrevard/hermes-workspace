/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolsActionDock, ToolsStatusRail } from './tools-action-dock'

describe('ToolsActionDock', () => {
  it('renders compact link and button actions with accessible labels', () => {
    const onClick = vi.fn()

    render(
      <ToolsActionDock
        label="Tool dock"
        items={[
          {
            id: 'task',
            label: 'Task',
            icon: 'task',
            href: '/tasks?create=task',
            meta: 'Follow-up',
          },
          {
            id: 'sync',
            label: 'Sync',
            icon: 'refresh',
            onClick,
            tone: 'primary',
            meta: 'Graph',
          },
        ]}
      />,
    )

    expect(screen.getByRole('navigation', { name: 'Tool dock' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Task/ }).getAttribute('href'),
    ).toBe('/tasks?create=task')

    screen.getByRole('button', { name: /Sync/ }).click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders visual status rail items with bounded progress', () => {
    render(
      <ToolsStatusRail
        label="Tool status"
        items={[
          {
            id: 'sla',
            label: 'SLA',
            value: '92%',
            tone: 'good',
            progress: 140,
          },
        ]}
      />,
    )

    expect(screen.getByRole('region', { name: 'Tool status' })).toBeTruthy()
    expect(screen.getByText('92%')).toBeTruthy()
  })
})
