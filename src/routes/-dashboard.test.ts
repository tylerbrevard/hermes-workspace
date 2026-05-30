import { describe, expect, it } from 'vitest'
import { shouldUsePhoneMobileHome } from './dashboard'

describe('dashboard mobile home routing', () => {
  it('keeps the redesigned dashboard as mobile and desktop home', () => {
    expect(shouldUsePhoneMobileHome(390)).toBe(false)
    expect(shouldUsePhoneMobileHome(767)).toBe(false)
    expect(shouldUsePhoneMobileHome(768)).toBe(false)
    expect(shouldUsePhoneMobileHome(1440)).toBe(false)
  })
})
