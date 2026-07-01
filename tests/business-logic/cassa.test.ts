import { describe, expect, it } from 'vitest'
import { computeSplitBreakdown } from '../../backend/src/lib/orderPayment'
import {
  applyGuestSplitPayment,
  assertSplitSharesSumToTotal,
  createSplitLedger,
  getRemainingTotal,
  isSplitFullyCollected,
  SPLIT_AMOUNT_MISMATCH,
} from '../../backend/src/lib/splitSettlement'
import { ledgerFromOrderState } from '../../backend/src/lib/splitGuestPayment'

const ORDER_ITEMS = [
  { id: 'item-1', quantity: 1, unitPrice: 50, modifierTotal: 0 },
]

describe('Critical Business — Flusso cassa / split conto', () => {
  it('A.1 — comanda 50€ split 50/50: quote 25€ + 25€ sommano al totale', () => {
    const breakdown = computeSplitBreakdown(ORDER_ITEMS, 50, {
      mode: 'equal',
      guestCount: 2,
    })

    expect(breakdown.guests).toHaveLength(2)
    expect(breakdown.guests[0].share).toBe(25)
    expect(breakdown.guests[1].share).toBe(25)
    expect(() => assertSplitSharesSumToTotal(breakdown, 50)).not.toThrow()
  })

  it('A.2 — incasso parziale 25€: residuo 25€ e ordine non ancora saldato', () => {
    const breakdown = computeSplitBreakdown(ORDER_ITEMS, 50, {
      mode: 'equal',
      guestCount: 2,
    })
    let ledger = createSplitLedger(breakdown, 50)

    ledger = applyGuestSplitPayment(ledger, 0, 25)

    expect(getRemainingTotal(ledger)).toBe(25)
    expect(isSplitFullyCollected(ledger)).toBe(false)
    expect(ledger.collectedByGuest[0]).toBe(25)
    expect(ledger.collectedByGuest[1]).toBe(0)
  })

  it('A.3 — secondo incasso 25€ chiude il conto senza corrompere il totale', () => {
    const breakdown = computeSplitBreakdown(ORDER_ITEMS, 50, {
      mode: 'equal',
      guestCount: 2,
    })
    let ledger = createSplitLedger(breakdown, 50)
    ledger = applyGuestSplitPayment(ledger, 0, 25)
    ledger = applyGuestSplitPayment(ledger, 1, 25)

    expect(getRemainingTotal(ledger)).toBe(0)
    expect(isSplitFullyCollected(ledger)).toBe(true)
    expect(ledger.collectedByGuest.reduce((a, b) => a + b, 0)).toBe(50)
  })

  it('A.4 — rifiuta importo diverso dalla quota (protezione matematica)', () => {
    const breakdown = computeSplitBreakdown(ORDER_ITEMS, 50, {
      mode: 'equal',
      guestCount: 2,
    })
    const ledger = createSplitLedger(breakdown, 50)

    expect(() => applyGuestSplitPayment(ledger, 0, 24.99)).toThrow()
    try {
      applyGuestSplitPayment(ledger, 0, 24.99)
    } catch (err) {
      expect((err as { code?: string }).code).toBe(SPLIT_AMOUNT_MISMATCH)
    }
  })

  it('A.5 — ripristino ledger da stato ordine (splitPaidGuestIndexes)', () => {
    const breakdown = computeSplitBreakdown(ORDER_ITEMS, 50, {
      mode: 'equal',
      guestCount: 2,
    })
    const ledger = ledgerFromOrderState(breakdown, 50, [0])

    expect(getRemainingTotal(ledger)).toBe(25)
    expect(isSplitFullyCollected(ledger)).toBe(false)
  })
})
