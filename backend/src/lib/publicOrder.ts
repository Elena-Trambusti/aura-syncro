import { z } from 'zod'
import { prisma } from './prisma'
import { computeTaxForRestaurant } from './orderTax'
import { resolveOrCreateCustomer } from './customerResolver'
import { assertMenuItemOrderable } from './menuStock'
import { deductInventoryForOrder } from './inventoryDeduction'
import { acquireIdempotencyLock, getIdempotentResponse, saveIdempotentResponse } from './apiIdempotency'
import { occupyTableIfAvailable } from './orderSession'

export const publicOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(6).optional(),
  guestName: z.string().min(2).optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive().max(99),
    notes: z.string().optional(),
  })).min(1).max(50),
  clientRequestId: z.string().min(8).max(128).optional(),
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
 * `restaurantId` deve provenire dal tenant risolto via slug (route pubblica).
 */
export async function createPublicOrder(restaurantId: string, input: PublicOrderInput) {
  const { items, tableNumber, guestEmail, guestPhone, guestName, clientRequestId, ...orderData } = input

  if (!restaurantId) {
    throw new PublicOrderError('Ristorante non trovato', 404, 'RESTAURANT_NOT_FOUND')
  }

  if (clientRequestId) {
    const idemKey = `guest-order:${clientRequestId}`
    const cached = await getIdempotentResponse(restaurantId, idemKey)
    if (cached && cached.statusCode === 201) {
      const body = cached.responseBody as {
        order: Awaited<ReturnType<typeof prisma.order.findFirst>>
        restaurantId: string
        tableNumber?: number
        total: number
      }
      if (body?.order) {
        return { order: body.order, restaurantId: body.restaurantId, tableNumber: body.tableNumber, total: body.total }
      }
    }
    const locked = await acquireIdempotencyLock(restaurantId, idemKey, 'PUBLIC_GUEST_ORDER')
    if (!locked) {
      const retry = await getIdempotentResponse(restaurantId, idemKey)
      if (retry?.statusCode === 201) {
        const body = retry.responseBody as {
          order: Awaited<ReturnType<typeof prisma.order.findFirst>>
          restaurantId: string
          tableNumber?: number
          total: number
        }
        if (body?.order) {
          return { order: body.order, restaurantId: body.restaurantId, tableNumber: body.tableNumber, total: body.total }
        }
      }
      throw new PublicOrderError('Ordine già in elaborazione', 409, 'ORDER_IN_PROGRESS')
    }
  }

  const itemsWithPrice = await resolveGuestItemsWithStock(restaurantId, items)

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (!table) {
      throw new PublicOrderError('Tavolo non trovato', 404, 'TABLE_NOT_FOUND')
    }
    tableId = table.id
  }

  const grossTotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const { subtotal, tax, total, taxRateApplied } = await computeTaxForRestaurant(restaurantId, grossTotal)

  const customerId = await resolveOrCreateCustomer(restaurantId, {
    email: guestEmail,
    phone: guestPhone,
    name: guestName,
  })

  const order = await prisma.$transaction(async tx => {
    if (tableId) {
      const ok = await occupyTableIfAvailable(tx, tableId, restaurantId)
      if (!ok) {
        throw new PublicOrderError('Tavolo non disponibile', 409, 'TABLE_UNAVAILABLE')
      }
    }

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
    await deductInventoryForOrder(tx, created.id, restaurantId)
    return created
  })

  const result = { order, restaurantId, tableNumber, total }
  if (clientRequestId) {
    await saveIdempotentResponse(
      restaurantId,
      `guest-order:${clientRequestId}`,
      'PUBLIC_GUEST_ORDER',
      201,
      result,
    )
  }
  return result
}
