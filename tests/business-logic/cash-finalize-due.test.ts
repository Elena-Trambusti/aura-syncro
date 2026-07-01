import { describe, expect, it } from 'vitest'
import { cashRegisterDueAtFinalize } from '../../backend/src/lib/orderPayment'

describe('Critical Business — incasso cassa post-split', () => {
  it('non registra doppio movimento se split già incassato per intero', () => {
    expect(cashRegisterDueAtFinalize(50, 50)).toBe(0)
    expect(cashRegisterDueAtFinalize(50, 25)).toBe(25)
    expect(cashRegisterDueAtFinalize(50, 0)).toBe(50)
  })
})
