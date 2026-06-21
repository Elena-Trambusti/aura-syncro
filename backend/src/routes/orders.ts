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

  const allReady = active.every(i => ['READY', 'SERVED'].includes(i.status))
  const anyInProgress = active.some(i => ['PREPARING', 'READY', 'SERVED'].includes(i.status))

  const status = allReady ? 'READY' : anyInProgress ? 'PREPARING' : 'PENDING'
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
      status: { notIn: ['PAID', 'CANCELLED'] },
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

  const { items, ...orderData } = result.data

  let itemsWithPrice
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map(i => i.menuItemId) }, restaurantId: tenantId(req) },
    })
    itemsWithPrice = items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)
      if (!menuItem) throw Object.assign(new Error('not found'), { code: 'MENU_ITEM_NOT_FOUND' })
      if (!menuItem.available) throw Object.assign(new Error('unavailable'), { code: 'MENU_ITEM_UNAVAILABLE' })
      return { ...item, unitPrice: menuItem.price }
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'MENU_ITEM_NOT_FOUND') {
      res.status(400).json({ error: 'Piatto non trovato nel menu' })
      return
    }
    if (code === 'MENU_ITEM_UNAVAILABLE') {
      res.status(400).json({ error: 'Piatto non disponibile' })
      return
    }
    throw e
  }

  const subtotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const { tax, total, taxRateApplied } = await computeTaxForRestaurant(req.restaurantId!, subtotal)

  const order = await prisma.order.create({
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

  io.to(req.restaurantId!).emit('order:created', order)

  const tableLabel = order.table ? `tavolo ${order.table.number}` : order.type.toLowerCase()
  void broadcastNewOrderNotification(
    req.restaurantId!,
    order.id,
    `Nuovo ordine da ${tableLabel} — ${formatOrderCurrency(order.total)}`,
  )

  res.status(201).json(order)
})

ordersRouter.patch('/:orderId/items/:itemId/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canUpdateOrderItemStatus(req.userRole)) {
    res.status(403).json({ error: 'Permessi insufficienti', code: 'FORBIDDEN' })
    return
  }

  const parsed = itemStatusSchema.safeParse(req.body.status)
  if (!parsed.success) {
    res.status(400).json({ error: 'Stato non valido' })
    return
  }

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

  await prisma.orderItem.update({
    where: { id: req.params.itemId },
    data: { status: parsed.data },
  })

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
  })
  if (!menuItem) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  if (!menuItem.available) {
    res.status(400).json({ error: 'Piatto non disponibile' })
    return
  }

  const orderItem = await prisma.orderItem.create({
    data: {
      orderId: req.params.id,
      menuItemId: result.data.menuItemId,
      quantity: result.data.quantity,
      unitPrice: menuItem.price,
      notes: result.data.notes,
    },
    include: { menuItem: true },
  })

  const orderWithItems = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { items: true },
  })
  if (orderWithItems) {
    const subtotal = orderWithItems.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const { tax, total, taxRateApplied } = await computeTaxForExistingOrder(orderWithItems, subtotal)
    await prisma.order.updateMany({
      where: scopedWhere(req, req.params.id),
      data: { subtotal, tax, total, taxRateApplied, revenueAmount: total },
    })
  }

  const updatedOrder = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
    include: orderInclude,
  })
  io.to(tenantId(req)).emit('order:updated', updatedOrder)
  res.status(201).json(orderItem)
})
