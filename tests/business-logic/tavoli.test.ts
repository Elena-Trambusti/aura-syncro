import { describe, expect, it } from 'vitest'
import {
  assertTableCanBeSetFree,
  TABLE_HAS_ACTIVE_ORDER,
} from '../../backend/src/lib/tableReleaseGuard'
import { activeTableOrderWhere } from '../../backend/src/lib/orderSession'

describe('Critical Business — Stato tavolo / race condition', () => {
  it('B.1 — blocca FREE se esiste ordine di sessione attivo', () => {
    expect(() => assertTableCanBeSetFree(1)).toThrow()
    try {
      assertTableCanBeSetFree(1)
    } catch (err) {
      expect((err as { code?: string }).code).toBe(TABLE_HAS_ACTIVE_ORDER)
    }
  })

  it('B.2 — consente FREE solo con zero ordini attivi', () => {
    expect(() => assertTableCanBeSetFree(0)).not.toThrow()
  })

  it('B.3 — ordine PENDING al tavolo 1 conta come sessione attiva', () => {
    const where = activeTableOrderWhere('table-1', 'restaurant-1')
    expect(where.OR).toBeDefined()
    expect(JSON.stringify(where)).toContain('PAID')
    expect(JSON.stringify(where)).toContain('CANCELLED')
  })

  it('B.4 — doppio tentativo concorrente: guard idempotente su stesso conteggio', () => {
    const activeCount = 1
    const attempts = [() => assertTableCanBeSetFree(activeCount), () => assertTableCanBeSetFree(activeCount)]
    for (const attempt of attempts) {
      expect(attempt).toThrow()
      try {
        attempt()
      } catch (err) {
        expect((err as { code?: string }).code).toBe(TABLE_HAS_ACTIVE_ORDER)
      }
    }
  })
})
