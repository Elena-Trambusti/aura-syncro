import { Router, Request, Response } from 'express'
import { OrderStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { canSetOrderStatus, canUpdateOrderItemStatus } from '../lib/permissions'
import { io } from '../index'
import { parseLocalDate } from '../lib/dates'
import { completeOrderPayment } from '../lib/completePayment'
import { releaseTableIfEmpty } from '../lib/orderPayment'
import { computeTaxForExistingOrder, computeTaxForRestaurant } from '../lib/orderTax'
import { broadcastNewOrderNotification, formatOrderCurrency } from '../lib/orderNotifications'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { restoreInventoryForOrderItem } from '../lib/inventoryDeduction'
import { resolveOrCreateCustomer } from '../lib/customerResolver'
import { assertMenuItemOrderable } from '../lib/menuStock'
import { applyDiscountToOrder } from '../lib/orderDiscount'

export const ordersRouter = Router()

const orderInclude = {
  table: true,
  waiter: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  items: {
    include: { menuItem: { include: { category: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
}

const itemStatusSchema = z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'])

async function syncOrderStatusFromItems(orderId: string): Promise<void> {
  const items = await prisma.orderItem.findMany({ where: { orderId } })
  const active = items.filter(i => i.status !== 'CANCELLED')
  if (active.length === 0) return

  const allServed = active.every(i => i.status === 'SERVED')
  const allReady = active.every(i => ['READY', 'SERVED'].includes(i.status))
  const anyInProgress = active.some(i => ['PREPARING', 'READY', 'SERVED'].includes(i.status))

  const status = allServed ? 'SERVED' : allReady ? 'READY' : anyInProgress ? 'PREPARING' : 'PENDING'
  await prisma.order.update({ where: { id: orderId }, data: { status } })
}

ordersRouter.get('/', requirePermission('orders.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, date } = req.query
  const where: Record<string, unknown> = { restaurantId: req.restaurantId! }

  if (status) where.status = status
  if (date) {
    const d = parseLocalDate(date as string)
    if (d) {
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.createdAt = { gte: d, lt: next }
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
  res.json(orders)
})

ordersRouter.get('/active', requirePermission('orders.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const orders = await prisma.order.findMany({
    where: {
      restaurantId: req.restaurantId!,
      status: { notIn: ['PAID', 'CANCELLED', 'SERVED'] },
    },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
  res.json(orders)
})

ordersRouter.get('/:id', requirePermission('orders.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    include: orderInclude,
  })
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }
  res.json(order)
})

ordersRouter.post('/', requirePermission('orders.create'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    tableId: z.string().optional(),
    customerId: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().min(6).optional(),
    customerName: z.string().min(2).optional(),
    type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('DINE_IN'),
    notes: z.string().optional(),
    items: z.array(z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })).min(1),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const { items, customerEmail, customerPhone, customerName, ...orderData } = result.data

  let resolvedCustomerId = orderData.customerId
  if (!resolvedCustomerId && (customerEmail || customerPhone)) {
    resolvedCustomerId = await resolveOrCreateCustomer(req.restaurantId!, {
      email: customerEmail,
      phone: customerPhone,
      name: customerName,
    })
  }

  let itemsWithPrice
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map(i => i.menuItemId) }, restaurantId: tenantId(req) },
      include: {
        inventoryLinks: { include: { inventoryItem: { select: { quantity: true } } } },
      },
    })
    itemsWithPrice = items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)
      if (!menuItem) throw Object.assign(new Error('not found'), { code: 'MENU_ITEM_NOT_FOUND' })
      void assertMenuItemOrderable(menuItem, item.quantity)
      return { ...item, unitPrice: menuItem.price }
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'MENU_ITEM_NOT_FOUND') {
      res.status(400).json({ error: 'Piatto non trovato nel menu' })
      return
    }
    if (code === 'MENU_ITEM_UNAVAILABLE') {
      res.status(400).json({ error: 'Piatto non disponibile', code })
      return
    }
    if (code === 'MENU_ITEM_SOLD_OUT') {
      res.status(400).json({ error: 'Piatto esaurito — ingredienti insufficienti', code })
      return
    }
    throw e
  }

  const grossTotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const { subtotal, tax, total, taxRateApplied } = await computeTaxForRestaurant(req.restaurantId!, grossTotal)

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        restaurantId: req.restaurantId!,
        waiterId: req.userId,
        subtotal,
        tax,
        total,
        taxRateApplied,
        revenueAmount: total,
        tipAmount: 0,
        ...orderData,
        customerId: resolvedCustomerId,
        items: {
          create: itemsWithPrice.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
          })),
        },
      },
      include: orderInclude,
    })
    return created
  })

  let finalOrder = order
  if (resolvedCustomerId) {
    await applyDiscountToOrder(order.id, req.restaurantId!, { applyLoyalty: true })
    finalOrder = await prisma.order.findFirst({
      where: { id: order.id, restaurantId: req.restaurantId! },
      include: orderInclude,
    }) ?? order
  }

  if (orderData.tableId) {
    const tableUpdated = await prisma.table.updateMany({
      where: { id: orderData.tableId, restaurantId: tenantId(req) },
      data: { status: 'OCCUPIED' },
    })
    if (tableUpdated.count === 0) {
      tenantNotFound(res, 'Tavolo non trovato')
      return
    }
    const table = await prisma.table.findFirst({ where: { id: orderData.tableId, restaurantId: tenantId(req) } })
    if (table) io.to(req.restaurantId!).emit('table:updated', table)
  }

  io.to(req.restaurantId!).emit('order:created', finalOrder)

  const tableLabel = finalOrder.table ? `tavolo ${finalOrder.table.number}` : finalOrder.type.toLowerCase()
  void broadcastNewOrderNotification(
    req.restaurantId!,
    finalOrder.id,
    `Nuovo ordine da ${tableLabel} — ${formatOrderCurrency(finalOrder.total)}`,
  )

  res.status(201).json(finalOrder)
})

ordersRouter.patch('/:orderId/items/:itemId/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canUpdateOrderItemStatus(req.userRole)) {
    res.status(403).json({ error: 'Permessi insufficienti', code: 'FORBIDDEN' })
    return
  }

  const parsed = z.object({
    status: itemStatusSchema,
    /** Cucina: segna pronte solo N unità (split riga se quantity > 1). */
    units: z.number().int().positive().optional(),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Stato non valido' })
    return
  }

  const targetStatus = parsed.data.status
  const readyUnits = parsed.data.units

  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, restaurantId: req.restaurantId! },
    include: { items: { select: { id: true } } },
  })
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }
  if (['PAID', 'CANCELLED'].includes(order.status)) {
    res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
    return
  }
  if (!order.items.some(i => i.id === req.params.itemId)) {
    res.status(404).json({ error: 'Piatto non trovato nell\'ordine' })
    return
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: { id: req.params.itemId, orderId: req.params.orderId },
  })
  if (!orderItem) {
    res.status(404).json({ error: 'Piatto non trovato nell\'ordine' })
    return
  }

  const splitReady =
    targetStatus === 'READY'
    && orderItem.quantity > 1
    && (readyUnits ?? 1) < orderItem.quantity

  if (splitReady) {
    const units = readyUnits ?? 1
    await prisma.$transaction(async tx => {
      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { quantity: orderItem.quantity - units },
      })
      await tx.orderItem.create({
        data: {
          orderId: orderItem.orderId,
          menuItemId: orderItem.menuItemId,
          quantity: units,
          unitPrice: orderItem.unitPrice,
          notes: orderItem.notes,
          status: 'READY',
        },
      })
    })
  } else {
    await prisma.orderItem.update({
      where: { id: req.params.itemId },
      data: { status: targetStatus },
    })
  }

  if (targetStatus === 'CANCELLED') {
    await prisma.$transaction(async tx => {
      await restoreInventoryForOrderItem(tx, req.params.itemId, req.restaurantId!)
    })
  }

  await syncOrderStatusFromItems(req.params.orderId)

  const updatedOrder = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: orderInclude,
  })

  io.to(req.restaurantId!).emit('order:updated', updatedOrder)
  res.json(updatedOrder)
})

ordersRouter.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body

  if (!status || typeof status !== 'string' || !canSetOrderStatus(req.userRole, status)) {
    res.status(403).json({ error: 'Permessi insufficienti per questo stato ordine', code: 'FORBIDDEN' })
    return
  }

  const existingOrder = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
  })
  if (!existingOrder) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }
  if (['PAID', 'CANCELLED'].includes(existingOrder.status) && status !== existingOrder.status) {
    res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
    return
  }

  if (status === 'PAID') {
    const paymentMethod = req.body.paymentMethod === 'CASH' ? 'CASH' : 'CARD'
    try {
      const { updatedOrder } = await completeOrderPayment({
        finalize: {
          orderId: req.params.id,
          restaurantId: req.restaurantId!,
          tipAmount: Number(req.body.tipAmount) || 0,
          paymentMethod,
        },
      })
      res.json(updatedOrder)
      return
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN'
      if (code === 'ORDER_ALREADY_PAID') {
        res.status(400).json({ error: 'Ordine già pagato' })
        return
      }
      throw err
    }
  }

  if (status === 'READY') {
    await prisma.orderItem.updateMany({
      where: { orderId: req.params.id, status: { in: ['PENDING', 'PREPARING'] } },
      data: { status: 'READY' },
    })
  }

  if (status === 'SERVED') {
    await prisma.orderItem.updateMany({
      where: { orderId: req.params.id, status: { not: 'CANCELLED' } },
      data: { status: 'SERVED' },
    })
  }

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: status as OrderStatus },
    include: orderInclude,
  })

  if (status === 'PAID' || status === 'CANCELLED') {
    const releasedTable = await releaseTableIfEmpty(order.tableId)
    if (releasedTable) io.to(req.restaurantId!).emit('table:updated', releasedTable)
  }

  io.to(req.restaurantId!).emit('order:updated', order)
  res.json(order)
})

ordersRouter.post('/:id/items', requirePermission('orders.items'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const order = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
  })
  if (!order) {
    tenantNotFound(res, 'Ordine non trovato')
    return
  }
  if (['PAID', 'CANCELLED'].includes(order.status)) {
    res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
    return
  }

  const menuItem = await prisma.menuItem.findFirst({
    where: { id: result.data.menuItemId, restaurantId: tenantId(req) },
    include: {
      inventoryLinks: { include: { inventoryItem: { select: { quantity: true } } } },
    },
  })
  if (!menuItem) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  try {
    await assertMenuItemOrderable(menuItem, result.data.quantity)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'MENU_ITEM_UNAVAILABLE') {
      res.status(400).json({ error: 'Piatto non disponibile', code })
      return
    }
    if (code === 'MENU_ITEM_SOLD_OUT') {
      res.status(400).json({ error: 'Piatto esaurito — ingredienti insufficienti', code })
      return
    }
    throw e
  }

  const createdItem = await prisma.$transaction(async tx => {
    return tx.orderItem.create({
      data: {
        orderId: req.params.id,
        menuItemId: result.data.menuItemId,
        quantity: result.data.quantity,
        unitPrice: menuItem.price,
        notes: result.data.notes,
      },
      include: { menuItem: true },
    })
  })

  const orderWithItems = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { items: true },
  })
  if (orderWithItems) {
    const grossTotal = orderWithItems.items
      .filter(i => i.status !== 'CANCELLED')
      .reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const { subtotal, tax, total, taxRateApplied } = await computeTaxForExistingOrder(orderWithItems, grossTotal)
    await prisma.order.updateMany({
      where: scopedWhere(req, req.params.id),
      data: { subtotal, tax, total, taxRateApplied, revenueAmount: total },
    })
    if (orderWithItems.customerId || orderWithItems.discount > 0) {
      await applyDiscountToOrder(req.params.id, tenantId(req), { applyLoyalty: true })
    }
  }

  const updatedOrder = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
    include: orderInclude,
  })
  io.to(tenantId(req)).emit('order:updated', updatedOrder)
  res.status(201).json(createdItem)
})

ordersRouter.patch('/:id/customer', requirePermission('orders.create'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    customerId: z.string().nullable().optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().min(6).optional(),
    customerName: z.string().min(2).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const order = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
  })
  if (!order) {
    tenantNotFound(res, 'Ordine non trovato')
    return
  }
  if (['PAID', 'CANCELLED'].includes(order.status)) {
    res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
    return
  }

  let customerId = result.data.customerId
  if (!customerId && (result.data.customerEmail || result.data.customerPhone)) {
    customerId = await resolveOrCreateCustomer(tenantId(req), {
      email: result.data.customerEmail,
      phone: result.data.customerPhone,
      name: result.data.customerName,
    })
  }

  await prisma.order.updateMany({
    where: scopedWhere(req, req.params.id),
    data: { customerId: customerId ?? null },
  })

  const updated = await applyDiscountToOrder(req.params.id, tenantId(req), { applyLoyalty: true })
  io.to(tenantId(req)).emit('order:updated', updated)
  res.json(updated)
})
