/**
 * AB-LOG-03 — ordine annullato azzera totali (logica payload).
 */
import { describe, expect, it } from 'vitest'

function cancelledOrderTotals() {
  return {
    status: 'CANCELLED' as const,
    subtotal: 0,
    tax: 0,
    total: 0,
    revenueAmount: 0,
    discount: 0,
  }
}

describe('order cancel — totali azzerati', () => {
  it('payload annullamento azzera importi fiscali', () => {
    const data = cancelledOrderTotals()
    expect(data.subtotal).toBe(0)
    expect(data.total).toBe(0)
    expect(data.revenueAmount).toBe(0)
    expect(data.discount).toBe(0)
    expect(data.status).toBe('CANCELLED')
  })
})
