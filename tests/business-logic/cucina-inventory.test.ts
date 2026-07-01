import { describe, expect, it } from 'vitest'
import { assertMenuItemOrderable, canFulfillQuantity } from '../../backend/src/lib/menuStock'
import { kitchenTicketsAfterOrderAttempt } from '../../backend/src/lib/kitchenEmitGuard'
import { kitchenActiveOrdersWhere } from '../../backend/src/lib/orderSession'

const DEPLETED_LINKS = [
  { quantity: 2, inventoryItem: { quantity: 0 } },
]

const AVAILABLE_LINKS = [
  { quantity: 1, inventoryItem: { quantity: 10 } },
]

describe('Critical Business — Cucina e inventory', () => {
  it('C.1 — piatto esaurito: assertMenuItemOrderable blocca la transazione', () => {
    expect(() =>
      assertMenuItemOrderable(
        { available: true, inventoryLinks: DEPLETED_LINKS },
        1,
      ),
    ).toThrow()

    try {
      assertMenuItemOrderable({ available: true, inventoryLinks: DEPLETED_LINKS }, 1)
    } catch (err) {
      expect((err as { code?: string }).code).toBe('MENU_ITEM_SOLD_OUT')
    }
  })

  it('C.2 — nessun ticket cucina se ordine non creato (tentativo fallito)', () => {
    const tickets = kitchenTicketsAfterOrderAttempt(null)
    expect(tickets).toHaveLength(0)
  })

  it('C.3 — ticket cucina solo dopo ordine valido', () => {
    const order = { id: 'ord-1' }
    const tickets = kitchenTicketsAfterOrderAttempt(order)
    expect(tickets).toHaveLength(1)
    expect(tickets[0].id).toBe('ord-1')
  })

  it('C.4 — stock insufficiente per quantità richiesta', () => {
    expect(canFulfillQuantity(DEPLETED_LINKS, 1)).toBe(false)
    expect(canFulfillQuantity(AVAILABLE_LINKS, 3)).toBe(true)
  })

  it('C.5 — filtro cucina esclude checkout Stripe non pagato (no code fantasma)', () => {
    const where = kitchenActiveOrdersWhere('restaurant-1')
    expect(JSON.stringify(where)).toContain('stripeSessionId')
    expect(JSON.stringify(where)).toContain('PENDING')
  })
})
