import { z } from 'zod'
import { prisma } from './prisma'
import { computeTaxForRestaurant } from './orderTax'

export const publicOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1),
})

export type PublicOrderInput = z.infer<typeof publicOrderSchema>

export class PublicOrderError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'PublicOrderError'
  }
}

/**
 * Crea un ordine guest dal menu QR.
 * Valida che tutti i piatti appartengano allo stesso ristorante.
 */
export async function createPublicOrder(input: PublicOrderInput) {
  const { items, tableNumber, ...orderData } = input

  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map(i => i.menuItemId) },
      available: true,
    },
  })

  if (menuItems.length !== items.length) {
    const found = new Set(menuItems.map(m => m.id))
    const missing = items.filter(i => !found.has(i.menuItemId)).map(i => i.menuItemId)
    throw new PublicOrderError(`Piatti non disponibili o non trovati: ${missing.join(', ')}`, 404)
  }

  const restaurantIds = new Set(menuItems.map(m => m.restaurantId))
  if (restaurantIds.size !== 1) {
    throw new PublicOrderError('Tutti i piatti devono appartenere allo stesso ristorante', 400)
  }

  const restaurantId = menuItems[0]!.restaurantId

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (table) tableId = table.id
  }

  const itemsWithPrice = items.map(item => {
    const mi = menuItems.find(m => m.id === item.menuItemId)!
    return { ...item, unitPrice: mi.price }
  })

  const subtotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const { tax, total, taxRateApplied } = await computeTaxForRestaurant(restaurantId, subtotal)

  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableId,
      subtotal,
      tax,
      total,
      taxRateApplied,
      revenueAmount: total,
      tipAmount: 0,
      type: orderData.type,
      notes: orderData.notes,
      status: 'PENDING',
      items: {
        create: itemsWithPrice.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      },
    },
    include: {
      table: true,
      items: { include: { menuItem: true } },
    },
  })

  if (tableId) {
    await prisma.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } })
  }

  return { order, restaurantId, tableNumber, total }
}
