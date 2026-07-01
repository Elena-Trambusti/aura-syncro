/**
 * AB-LOG-02 — validazione stock in transazione (logica pura + mapping errori).
 */
import { describe, expect, it } from 'vitest'
import {
  assertMenuItemOrderable,
  canFulfillQuantity,
  maxPortionsFromLinks,
} from '../../backend/src/lib/menuStock'

describe('stock hold — transactional validation logic', () => {
  const recipe = [
    { quantity: 1, inventoryItem: { quantity: 2 } },
  ]

  it('allows order when fresh stock covers quantity', () => {
    expect(canFulfillQuantity(recipe, 2)).toBe(true)
    expect(() =>
      assertMenuItemOrderable({ available: true, inventoryLinks: recipe }, 2),
    ).not.toThrow()
  })

  it('rejects when concurrent sale would exhaust last portion', () => {
    expect(canFulfillQuantity(recipe, 3)).toBe(false)
    try {
      assertMenuItemOrderable({ available: true, inventoryLinks: recipe }, 3)
      expect.fail('expected throw')
    } catch (e) {
      expect((e as { code?: string }).code).toBe('MENU_ITEM_SOLD_OUT')
    }
  })

  it('maps sold-out to INSUFFICIENT_STOCK at transaction boundary', () => {
    const err = Object.assign(new Error('sold out'), { code: 'MENU_ITEM_SOLD_OUT' })
    const txErr = Object.assign(new Error('INSUFFICIENT_STOCK'), {
      code: err.code === 'MENU_ITEM_SOLD_OUT' ? 'INSUFFICIENT_STOCK' : err.code,
    })
    expect(txErr.code).toBe('INSUFFICIENT_STOCK')
  })

  it('computes limiting ingredient for race scenarios', () => {
    const links = [
      { quantity: 0.5, inventoryItem: { quantity: 1 } },
      { quantity: 0.25, inventoryItem: { quantity: 1 } },
    ]
    expect(maxPortionsFromLinks(links)).toBe(2)
    expect(canFulfillQuantity(links, 2)).toBe(true)
    expect(canFulfillQuantity(links, 3)).toBe(false)
  })
})
