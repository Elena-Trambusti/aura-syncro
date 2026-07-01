import type { SplitBreakdown, SplitBreakdownGuest } from './orderPayment'

export const SPLIT_AMOUNT_MISMATCH = 'SPLIT_AMOUNT_MISMATCH'
export const SPLIT_ALREADY_PAID = 'SPLIT_ALREADY_PAID'
export const SPLIT_GUEST_INDEX_INVALID = 'SPLIT_GUEST_INDEX_INVALID'

export interface SplitPaymentLedger {
  orderTotal: number
  guests: SplitBreakdownGuest[]
  /** Importi già incassati per indice ospite */
  collectedByGuest: number[]
}

export function createSplitLedger(breakdown: SplitBreakdown, orderTotal: number): SplitPaymentLedger {
  return {
    orderTotal: roundMoney(orderTotal),
    guests: breakdown.guests,
    collectedByGuest: breakdown.guests.map(() => 0),
  }
}

export function getGuestShare(ledger: SplitPaymentLedger, guestIndex: number): number {
  const guest = ledger.guests[guestIndex]
  if (!guest) {
    throw Object.assign(new Error('Invalid guest index'), { code: SPLIT_GUEST_INDEX_INVALID })
  }
  return roundMoney(guest.share)
}

export function getCollectedTotal(ledger: SplitPaymentLedger): number {
  return roundMoney(ledger.collectedByGuest.reduce((sum, n) => sum + n, 0))
}

export function getRemainingTotal(ledger: SplitPaymentLedger): number {
  return roundMoney(ledger.orderTotal - getCollectedTotal(ledger))
}

export function isSplitFullyCollected(ledger: SplitPaymentLedger): boolean {
  return getRemainingTotal(ledger) === 0
}

/**
 * Registra l'incasso di una quota split. L'importo deve corrispondere esattamente alla quota ospite.
 * Non modifica lo stato fiscale PAID — solo il ledger operativo.
 */
export function applyGuestSplitPayment(
  ledger: SplitPaymentLedger,
  guestIndex: number,
  amount: number,
): SplitPaymentLedger {
  if (isSplitFullyCollected(ledger)) {
    throw Object.assign(new Error('Split already fully paid'), { code: SPLIT_ALREADY_PAID })
  }

  const expectedShare = getGuestShare(ledger, guestIndex)
  const paid = roundMoney(amount)

  if (paid !== expectedShare) {
    throw Object.assign(new Error('Payment amount does not match guest share'), {
      code: SPLIT_AMOUNT_MISMATCH,
      expected: expectedShare,
      received: paid,
    })
  }

  if (ledger.collectedByGuest[guestIndex] > 0) {
    throw Object.assign(new Error('Guest share already paid'), { code: SPLIT_ALREADY_PAID })
  }

  const collectedByGuest = [...ledger.collectedByGuest]
  collectedByGuest[guestIndex] = paid

  return { ...ledger, collectedByGuest }
}

/** Verifica che le quote split sommino esattamente al totale ordine (±0.01 tolleranza arrotondamento). */
export function assertSplitSharesSumToTotal(breakdown: SplitBreakdown, orderTotal: number): void {
  const sum = roundMoney(breakdown.guests.reduce((acc, g) => acc + g.share, 0))
  const total = roundMoney(orderTotal)
  if (Math.abs(sum - total) > 0.01) {
    throw Object.assign(new Error('Split shares do not sum to order total'), {
      code: 'SPLIT_SUM_MISMATCH',
      sum,
      orderTotal: total,
    })
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
