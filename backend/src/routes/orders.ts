import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { io } from '../index'

export const ordersRouter = Router()

// Ordine pubblico dal menu QR (senza auth)
ordersRouter.post('/public', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
    tableNumber: z.number().int().positive().optional(),
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

  const { items, tableNumber, ...orderData } = result.data
  const firstItem = items[0]
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: firstItem.menuItemId },
    include: { restaurant: true },
  })
  if (!menuItem) {
    res.status(404).json({ error: 'Piatto non trovato' })
    return
  }

  const restaurantId = menuItem.restaurantId

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (table) tableId = table.id
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map(i => i.menuItemId) } },
  })

  const itemsWithPrice = items.map(item => {
    const mi = menuItems.find((m: { id: string; price: number }) => m.id === item.menuItemId)
    if (!mi) throw new Error(`Piatto non trovato: ${item.menuItemId}`)
    return { ...item, unitPrice: mi.price }
  })

  const subtotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableId,
      subtotal,
      tax,
      total,
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

  io.to(restaurantId).emit('order:created', order)
  io.to(restaurantId).emit('notification', {
    type: 'new_order',
    message: `Nuovo ordine dal tavolo ${tableNumber || 'asporto'} — ${formatCurrency(total)}`,
    orderId: order.id,
  })

  res.status(201).json({ success: true, orderId: order.id })
})

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

const orderInclude = {
  table: true,
  waiter: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  items: {
    include: { menuItem: { include: { category: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
}

ordersRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, date } = req.query
  const where: Record<string, unknown> = { restaurantId: req.restaurantId! }

  if (status) where.status = status
  if (date) {
    const d = new Date(date as string)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    where.createdAt = { gte: d, lt: next }
  }

  const orders = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
  res.json(orders)
})

ordersRouter.get('/active', async (req: AuthRequest, res: Response): Promise<void> => {
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

ordersRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
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

ordersRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map(i => i.menuItemId) } },
  })

  const itemsWithPrice = items.map(item => {
    const menuItem = menuItems.find((m: { id: string; price: number }) => m.id === item.menuItemId)
    if (!menuItem) throw new Error(`Piatto ${item.menuItemId} non trovato`)
    return { ...item, unitPrice: menuItem.price }
  })

  const subtotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const order = await prisma.order.create({
    data: {
      restaurantId: req.restaurantId!,
      waiterId: req.userId,
      subtotal,
      tax,
      total,
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
    await prisma.table.update({
      where: { id: orderData.tableId },
      data: { status: 'OCCUPIED' },
    })
  }

  io.to(req.restaurantId!).emit('order:created', order)
  res.status(201).json(order)
})

ordersRouter.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status,
      ...(status === 'PAID' ? { paidAt: new Date(), paymentMethod: req.body.paymentMethod } : {}),
    },
    include: orderInclude,
  })

  if (status === 'PAID' || status === 'CANCELLED') {
    const activeOrders = await prisma.order.count({
      where: {
        tableId: order.tableId ?? undefined,
        status: { notIn: ['PAID', 'CANCELLED'] },
      },
    })
    if (order.tableId && activeOrders === 0) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'CLEANING' },
      })
    }
  }

  io.to(req.restaurantId!).emit('order:updated', order)
  res.json(order)
})

ordersRouter.post('/:id/items', async (req: AuthRequest, res: Response): Promise<void> => {
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

  const menuItem = await prisma.menuItem.findUnique({ where: { id: result.data.menuItemId } })
  if (!menuItem) {
    res.status(404).json({ error: 'Piatto non trovato' })
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

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  })
  if (order) {
    const subtotal = order.items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity, 0)
    await prisma.order.update({
      where: { id: req.params.id },
      data: { subtotal, tax: subtotal * 0.1, total: subtotal * 1.1 },
    })
  }

  const updatedOrder = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: orderInclude,
  })
  io.to(req.restaurantId!).emit('order:updated', updatedOrder)
  res.status(201).json(orderItem)
})

ordersRouter.patch('/:orderId/items/:itemId/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const item = await prisma.orderItem.update({
    where: { id: req.params.itemId },
    data: { status: req.body.status },
  })
  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: orderInclude,
  })
  io.to(req.restaurantId!).emit('order:updated', order)
  res.json(item)
})
