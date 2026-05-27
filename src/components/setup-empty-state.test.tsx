/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SetupEmptyState } from './setup-empty-state'

describe('SetupEmptyState', () => {
  it('turns an empty page into a concrete next setup action', () => {
    render(
      <SetupEmptyState
        title="No records yet."
        description="This page is connected, but there is no data to show."
        nextAction="Confirm the upstream token, then refresh the page."
        detail=".config/hermes/tokens/example.json"
        action={<button type="button">Refresh</button>}
      />,
    )

    expect(screen.getByText('No records yet.')).toBeTruthy()
    expect(screen.getByText(/Next setup action:/)).toBeTruthy()
    expect(screen.getByText(/Confirm the upstream token/)).toBeTruthy()
    expect(screen.getByText('.config/hermes/tokens/example.json')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
  })
})
