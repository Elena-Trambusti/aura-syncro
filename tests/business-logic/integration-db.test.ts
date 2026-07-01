import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertTableCanBeSetFree } from '../../backend/src/lib/tableReleaseGuard'
import { countActiveTableOrders } from '../../backend/src/lib/orderSession'

/**
 * Test di integrazione PostgreSQL — opzionale.
 * Richiede DATABASE_URL nel backend/.env e `npx prisma generate` in backend/.
 * Senza DATABASE_URL la suite viene saltata automaticamente.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('Integration DB — tavolo con ordine aperto', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any

  beforeAll(async () => {
    const mod = await import('../../backend/node_modules/@prisma/client/index.js')
    prisma = new mod.PrismaClient()
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('impedisce liberazione tavolo con ordine PENDING attivo', async () => {
    const restaurant = await prisma.restaurant.findFirst({ select: { id: true } })
    if (!restaurant) return

    const table = await prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        number: 9_901,
        seats: 4,
        status: 'OCCUPIED',
      },
    })

    const menuItem = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, available: true },
      select: { id: true },
    })
    if (!menuItem) {
      await prisma.table.delete({ where: { id: table.id } })
      return
    }

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        status: 'PENDING',
        type: 'DINE_IN',
        subtotal: 50,
        tax: 5,
        total: 55,
        revenueAmount: 50,
        items: {
          create: {
            menuItemId: menuItem.id,
            quantity: 1,
            unitPrice: 50,
            status: 'PENDING',
          },
        },
      },
    })

    const activeCount = await countActiveTableOrders(table.id, restaurant.id)
    expect(activeCount).toBeGreaterThan(0)
    expect(() => assertTableCanBeSetFree(activeCount)).toThrow()

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.table.delete({ where: { id: table.id } })
  })
})
