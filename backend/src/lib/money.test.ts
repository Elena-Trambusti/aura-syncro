import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Prisma } from '@prisma/client'
import { moneyNumber, serializeDecimals } from './money'

describe('money', () => {
  it('serializeDecimals converte Decimal annidati in number (non stringhe)', () => {
    const payload = {
      price: new Prisma.Decimal('8.00'),
      order: {
        total: new Prisma.Decimal('48.50'),
        items: [{ unitPrice: new Prisma.Decimal('16.00'), quantity: 1 }],
      },
    }
    const out = serializeDecimals(payload)
    assert.equal(typeof out.price, 'number')
    assert.equal(out.price, 8)
    assert.equal(typeof out.order.total, 'number')
    assert.equal(out.order.total, 48.5)
    assert.equal(out.order.items[0].unitPrice, 16)
  })

  it('JSON.stringify con replacer NON basta: Decimal.toJSON produce stringhe', () => {
    const decimal = new Prisma.Decimal('8')
    const viaReplacer = JSON.parse(
      JSON.stringify({ price: decimal }, (_k, v) => (Prisma.Decimal.isDecimal(v) ? moneyNumber(v) : v)),
    ) as { price: unknown }
    assert.equal(typeof viaReplacer.price, 'string')
    assert.equal(viaReplacer.price, '8')
    assert.equal((viaReplacer.price as string) + 0, '80')
  })

  it('serializeDecimals evita concatenazione "8" + 0 → "80" sul client', () => {
    const out = serializeDecimals({ price: new Prisma.Decimal('8') })
    assert.equal(moneyNumber(out.price) + 0, 8)
  })
})
