import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyGuestSplitPayment,
  createSplitLedger,
  getRemainingTotal,
  SPLIT_AMOUNT_MISMATCH,
} from './splitSettlement'
import { computeSplitBreakdown } from './orderPayment'

describe('splitSettlement', () => {
  it('rejects wrong partial amount', () => {
    const breakdown = computeSplitBreakdown(
      [{ id: 'i1', quantity: 1, unitPrice: 50 }],
      50,
      { mode: 'equal', guestCount: 2 },
    )
    const ledger = createSplitLedger(breakdown, 50)
    assert.throws(
      () => applyGuestSplitPayment(ledger, 0, 20),
      (err: unknown) => (err as { code?: string }).code === SPLIT_AMOUNT_MISMATCH,
    )
  })

  it('tracks remaining after one guest pays', () => {
    const breakdown = computeSplitBreakdown(
      [{ id: 'i1', quantity: 1, unitPrice: 50 }],
      50,
      { mode: 'equal', guestCount: 2 },
    )
    const afterFirst = applyGuestSplitPayment(createSplitLedger(breakdown, 50), 0, 25)
    assert.equal(getRemainingTotal(afterFirst), 25)
  })
})
