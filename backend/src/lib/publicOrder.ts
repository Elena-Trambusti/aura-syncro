import { z } from 'zod'
import { prisma } from './prisma'
import { computeTaxForRestaurant } from './orderTax'
import { resolveOrCreateCustomer } from './customerResolver'
import { assertMenuItemOrderable } from './menuStock'

export const publicOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(6).optional(),
  guestName: z.string().min(2).optional(),
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
    readonly code?: string,
  ) {
    super(message)
    this.name = 'PublicOrderError'
  }
}

export async function resolveGuestItemsWithStock(
  restaurantId: string,
  items: PublicOrderInput['items'],
) {
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map(i => i.menuItemId) },
      restaurantId,
      available: true,
      archived: false,
    },
    include: {
      inventoryLinks: { include: { inventoryItem: { select: { quantity: true } } } },
    },
  })

  if (menuItems.length !== items.length) {
    const found = new Set(menuItems.map(m => m.id))
    const missing = items.filter(i => !found.has(i.menuItemId)).map(i => i.menuItemId)
    throw new PublicOrderError(`Piatti non disponibili o non trovati: ${missing.join(', ')}`, 404, 'MENU_ITEM_NOT_FOUND')
  }

  const itemsWithPrice = items.map(item => {
    const mi = menuItems.find(m => m.id === item.menuItemId)!
    try {
      assertMenuItemOrderable(mi, item.quantity)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'MENU_ITEM_UNAVAILABLE') {
        throw new PublicOrderError('Piatto non disponibile', 400, code)
      }
      if (code === 'MENU_ITEM_SOLD_OUT') {
        throw new PublicOrderError('Piatto esaurito — ingredienti insufficienti', 400, code)
      }
      throw e
    }
    return { ...item, unitPrice: mi.price }
  })

  return itemsWithPrice
}

/**
 * Crea un ordine guest dal menu QR.
 * Valida stock/disponibilità come il POS cameriere.
 */
export async function createPublicOrder(input: PublicOrderInput) {
  const { items, tableNumber, guestEmail, guestPhone, guestName, ...orderData } = input

  const probe = await prisma.menuItem.findFirst({
    where: { id: items[0]?.menuItemId },
    select: { restaurantId: true },
  })
  if (!probe) {
    throw new PublicOrderError('Piatto non trovato', 404, 'MENU_ITEM_NOT_FOUND')
  }

  const restaurantId = probe.restaurantId
  const itemsWithPrice = await resolveGuestItemsWithStock(restaurantId, items)

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (table) tableId = table.id
  }

  const grossTotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const { subtotal, tax, total, taxRateApplied } = await computeTaxForRestaurant(restaurantId, grossTotal)

  const customerId = await resolveOrCreateCustomer(restaurantId, {
    email: guestEmail,
    phone: guestPhone,
    name: guestName,
  })

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        restaurantId,
        tableId,
        customerId,
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
    return created
  })

  if (tableId) {
    await prisma.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } })
  }

  return { order, restaurantId, tableNumber, total }
}
