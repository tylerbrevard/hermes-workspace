import { describe, expect, it } from 'vitest'
import { shouldUsePhoneMobileHome } from './dashboard'

describe('dashboard mobile home routing', () => {
  it('uses /phone as the mobile home while preserving desktop dashboard', () => {
    expect(shouldUsePhoneMobileHome(390)).toBe(true)
    expect(shouldUsePhoneMobileHome(767)).toBe(true)
    expect(shouldUsePhoneMobileHome(768)).toBe(false)
    expect(shouldUsePhoneMobileHome(1440)).toBe(false)
  })
})
