import { describe, expect, it } from 'vitest'
import {
  isSplitGuestPaid,
  nextUnpaidSplitGuest,
  splitProgressLabel,
} from '../../frontend/src/lib/splitCheckout'

describe('splitCheckout (frontend)', () => {
  it('tracks paid guests', () => {
    expect(isSplitGuestPaid(0, [0])).toBe(true)
    expect(isSplitGuestPaid(1, [0])).toBe(false)
  })

  it('finds next unpaid guest', () => {
    expect(nextUnpaidSplitGuest(2, [0])).toBe(1)
    expect(nextUnpaidSplitGuest(2, [0, 1])).toBeNull()
  })

  it('computes remaining after partial 25€ on 50€', () => {
    const p = splitProgressLabel(25, 50)
    expect(p.remaining).toBe(25)
    expect(p.collected).toBe(25)
  })
})
