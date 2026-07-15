import { Router, Request, Response } from 'express'
import { OrderStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { canSetOrderStatus, canUpdateOrderItemStatus, hasPermission } from '../lib/permissions'
import { io } from '../index'
import { dayBoundsInTimezone } from '../lib/romeDate'
import { releaseTableIfEmpty } from '../lib/orderPayment'
import { computeTaxForExistingOrder, computeTaxFromGrossLines, computeTaxForOrderItems } from '../lib/orderTax'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { deductInventoryForOrder, restoreInventoryForOrderItem } from '../lib/inventoryDeduction'
import { resolveOrCreateCustomer, assertCustomerInTenant } from '../lib/customerResolver'
import { assertMenuItemOrderable, assertOrderStockInTransaction } from '../lib/menuStock'
import { resolveMenuItemLine, ModifierValidationError } from '../lib/orderModifiers'
import { applyDiscountToOrder } from '../lib/orderDiscount'
import {
  acquireIdempotencyLock,
  getIdempotentResponse,
  readIdempotencyKey,
  releaseIdempotencyLock,
  saveIdempotentResponse,
} from '../lib/apiIdempotency'
import {
  occupyTableIfAvailable,
  restaurantActiveOrdersWhere,
  kitchenActiveOrdersWhere,
  syncOrderStatusFromItemsTx,
} from '../lib/orderSession'
import { moneyNumber, toMoney } from '../lib/money'
import { runOrderTransaction, isRetriableTransactionError } from '../lib/prismaTransactions'
import { scheduleOrderCommitEffects } from '../lib/orderSideEffects'

export const ordersRouter = Router()

const orderInclude = {
  table: true,
  waiter: { select: { id: true, name: true } },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      loyaltyTier: { select: { name: true, discountPct: true, color: true } },
    },
  },
  items: {
    include: { menuItem: { include: { category: true } }, modifiers: true },
    orderBy: { createdAt: 'asc' as const },
  },
}

const itemStatusSchema = z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'])

const orderLineInputSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().positive().max(99),
  course: z.number().int().positive().optional().default(1),
  modifiers: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

const orderListQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
})

ordersRouter.get('/', requirePermission('orders.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const query = orderListQuerySchema.safeParse(req.query)
  if (!query.success) {
    res.status(400).json({ error: 'Parametri query non validi' })
    return
  }
  const { status, date } = query.data
  const where: Record<string, unknown> = { restaurantId: req.restaurantId! }

  if (status) where.status = status
  if (date) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId! },
      select: { timezone: true },
    })
    const { gte, lt } = dayBoundsInTimezone(date, restaurant?.timezone ?? 'Europe/Rome')
    where.createdAt = { gte, lt }
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
    where: kitchenActiveOrdersWhere(req.restaurantId!),
    include: orderInclude,
    orderBy: { createdAt: 'asc' },
  })
  res.json(orders)
})

/** Ricerca rapida clienti per collegamento ordine (camerieri / cassa) */
ordersRouter.get('/customers/search', requirePermission('orders.create'), async (req: AuthRequest, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) {
    res.json([])
    return
  }

  const customers = await prisma.customer.findMany({
    where: {
      restaurantId: req.restaurantId!,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      loyaltyPoints: true,
      loyaltyTier: { select: { name: true, discountPct: true, color: true } },
    },
    orderBy: { totalVisits: 'desc' },
    take: 8,
  })
  res.json(customers)
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
  const idempotencyKey = readIdempotencyKey(req)
  let idempotencyLocked = false
  const releaseOrderLock = async () => {
    if (idempotencyKey && req.restaurantId && idempotencyLocked) {
      await releaseIdempotencyLock(req.restaurantId, idempotencyKey)
      idempotencyLocked = false
    }
  }
  if (idempotencyKey && req.restaurantId) {
    const cached = await getIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /orders')
    if (cached) {
      if (cached.statusCode === 202) {
        res.status(409).json({ error: 'Richiesta già in elaborazione (Idempotency Lock)' })
        return
      }
      res.status(cached.statusCode).json(cached.responseBody)
      return
    }
    const locked = await acquireIdempotencyLock(req.restaurantId, idempotencyKey, 'POST /orders')
    if (!locked) {
      res.status(409).json({ error: 'Richiesta duplicata bloccata dal sistema' })
      return
    }
    idempotencyLocked = true
  }

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
      quantity: z.number().int().positive().max(99),
      course: z.number().int().positive().optional().default(1),
      modifiers: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })).min(1).max(50),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    await releaseOrderLock()
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const { items, customerEmail, customerPhone, customerName, ...orderData } = result.data

  let resolvedCustomerId = orderData.customerId
  if (resolvedCustomerId) {
    try {
      await assertCustomerInTenant(resolvedCustomerId, req.restaurantId!)
    } catch {
      await releaseOrderLock()
      res.status(404).json({ error: 'Cliente non trovato', code: 'CUSTOMER_NOT_FOUND' })
      return
    }
  }
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
        modifierGroups: { include: { options: true } },
      },
    })
    itemsWithPrice = items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)
      if (!menuItem) throw Object.assign(new Error('not found'), { code: 'MENU_ITEM_NOT_FOUND' })
      assertMenuItemOrderable(menuItem, item.quantity)
      try {
        const resolved = resolveMenuItemLine(menuItem, item.modifiers)
        return {
          ...item,
          unitPrice: resolved.unitPrice,
          selectedOptions: resolved.selectedOptions,
          menuTaxRate: resolved.menuTaxRate ?? menuItem.taxRate,
        }
      } catch (modErr) {
        if (modErr instanceof ModifierValidationError) {
          throw Object.assign(new Error(modErr.message), { code: modErr.code })
        }
        throw modErr
      }
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'MENU_ITEM_NOT_FOUND') {
      await releaseOrderLock()
      res.status(400).json({ error: 'Piatto non trovato nel menu' })
      return
    }
    if (code === 'MENU_ITEM_UNAVAILABLE') {
      await releaseOrderLock()
      res.status(400).json({ error: 'Piatto non disponibile', code })
      return
    }
    if (code === 'MENU_ITEM_SOLD_OUT') {
      await releaseOrderLock()
      res.status(400).json({ error: 'Piatto esaurito — ingredienti insufficienti', code })
      return
    }
    if (code === 'MODIFIER_MIN_NOT_MET' || code === 'MODIFIER_MAX_EXCEEDED' || code === 'INVALID_MODIFIER') {
      await releaseOrderLock()
      res.status(400).json({ error: (e as Error).message, code })
      return
    }
    throw e
  }

  const grossTotal = itemsWithPrice.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const { subtotal, tax, total, taxRateApplied } = await computeTaxFromGrossLines(
    req.restaurantId!,
    itemsWithPrice.map(item => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.menuTaxRate,
    })),
  )

  let order;
  try {
    order = await runOrderTransaction(async tx => {
      if (orderData.tableId) {
        const occupied = await occupyTableIfAvailable(tx, orderData.tableId, req.restaurantId!)
        if (!occupied) {
          throw Object.assign(new Error('Tavolo già occupato o non trovato'), { code: 'TABLE_OCCUPIED' })
        }
      }

      await assertOrderStockInTransaction(
        tx,
        req.restaurantId!,
        itemsWithPrice.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      )

      const created = await tx.order.create({
        data: {
          restaurantId: req.restaurantId!,
          waiterId: req.userId,
          subtotal: toMoney(subtotal),
          tax: toMoney(tax),
          total: toMoney(total),
          taxRateApplied,
          revenueAmount: toMoney(total),
          tipAmount: toMoney(0),
          ...orderData,
          customerId: resolvedCustomerId,
          items: {
            create: itemsWithPrice.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              course: item.course,
              unitPrice: toMoney(item.unitPrice),
              notes: item.notes,
              modifiers: {
                create: item.selectedOptions.map(opt => ({
                   optionId: opt.optionId,
                   name: opt.name,
                   price: toMoney(opt.price)
                }))
              }
            })),
          },
        },
        select: {
          id: true,
          tableId: true,
          type: true,
          status: true,
          total: true,
        },
      })
      
      await deductInventoryForOrder(tx, created.id, req.restaurantId!)
      
      return created
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'TABLE_OCCUPIED') {
      await releaseOrderLock()
      res.status(409).json({ error: 'Il tavolo è stato appena occupato da un altro collega. Aggiorna la pagina.' })
      return
    }
    if ((e as { code?: string }).code === 'INSUFFICIENT_STOCK') {
      await releaseOrderLock()
      res.status(409).json({ error: 'Piatto esaurito — ingredienti insufficienti', code: 'MENU_ITEM_SOLD_OUT' })
      return
    }
    if (isRetriableTransactionError(e)) {
      await releaseOrderLock()
      res.status(503).json({
        error: 'Servizio temporaneamente occupato. Riprova tra qualche secondo.',
        code: 'TRANSACTION_TIMEOUT',
      })
      return
    }
    await releaseOrderLock()
    throw e
  }

  const responseBody = {
    id: order.id,
    tableId: order.tableId,
    status: order.status,
    type: order.type,
    total: moneyNumber(order.total),
  }

  if (idempotencyKey && req.restaurantId) {
    void saveIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /orders', 201, responseBody)
      .catch(err => console.error('[orders] idempotency save failed', err))
    idempotencyLocked = false
  }

  res.status(201).json(responseBody)

  scheduleOrderCommitEffects({
    kind: 'created',
    restaurantId: req.restaurantId!,
    orderId: order.id,
    tableId: order.tableId,
    applyDiscount: Boolean(resolvedCustomerId),
    orderType: order.type,
    orderTotal: moneyNumber(order.total),
  })
})

ordersRouter.patch('/:orderId/items/:itemId/status', requirePermission('orders.kitchen_status', 'orders.items'), async (req: AuthRequest, res: Response): Promise<void> => {
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

  if (targetStatus === 'CANCELLED' && !hasPermission(req.userRole, 'orders.cancel')) {
    res.status(403).json({ error: 'Permessi insufficienti per annullare piatti', code: 'FORBIDDEN' })
    return
  }

  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, restaurantId: req.restaurantId! },
    include: { items: { select: { id: true, status: true } } },
  })
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }
  if (order.status === 'CANCELLED') {
    res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
    return
  }
  if (order.stripeSessionId && targetStatus === 'CANCELLED') {
    res.status(409).json({
      error: 'Ordine con checkout Stripe in corso: non modificabile',
      code: 'STRIPE_CHECKOUT_LOCKED',
    })
    return
  }
  if (order.status === 'PAID') {
    if (targetStatus === 'CANCELLED') {
      res.status(400).json({ error: 'Non è possibile annullare piatti su ordine già pagato', code: 'ORDER_PAID' })
      return
    }
    const kitchenStillActive = order.items.some(
      i => !['SERVED', 'CANCELLED'].includes(i.status),
    )
    if (!kitchenStillActive) {
      res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
      return
    }
  }
  if (!order.items.some(i => i.id === req.params.itemId)) {
    res.status(404).json({ error: 'Piatto non trovato nell\'ordine' })
    return
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: { id: req.params.itemId, orderId: req.params.orderId },
    include: { modifiers: true },
  })
  if (!orderItem) {
    res.status(404).json({ error: 'Piatto non trovato nell\'ordine' })
    return
  }

  const splitReady =
    targetStatus === 'READY'
    && orderItem.quantity > 1
    && (readyUnits ?? 1) < orderItem.quantity

  let precomputedTotals: Awaited<ReturnType<typeof computeTaxForOrderItems>> | null = null
  if (targetStatus === 'CANCELLED' && order.status !== 'PAID') {
    const allLines = await prisma.orderItem.findMany({
      where: { orderId: req.params.orderId },
      select: { id: true, quantity: true, unitPrice: true, menuItemId: true, status: true },
    })
    precomputedTotals = await computeTaxForOrderItems(
      req.restaurantId!,
      allLines.map(i => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        menuItemId: i.menuItemId,
        status: i.id === req.params.itemId ? 'CANCELLED' : i.status,
      })),
    )
  }

  try {
    await runOrderTransaction(async tx => {
      if (targetStatus === 'CANCELLED' && order.status !== 'PAID') {
        const openClaim = await tx.order.updateMany({
          where: {
            id: req.params.orderId,
            restaurantId: req.restaurantId!,
            status: { notIn: ['PAID', 'CANCELLED'] },
          },
          data: { updatedAt: new Date() },
        })
        if (openClaim.count === 0) {
          throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
        }
      }

      if (splitReady) {
      const units = readyUnits ?? 1
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
          modifiers: {
            create: orderItem.modifiers.map(m => ({
              optionId: m.optionId,
              name: m.name,
              price: m.price,
            })),
          },
        },
      })
    } else {
      const claimed = await tx.orderItem.updateMany({
        where: { id: req.params.itemId, status: orderItem.status },
        data: { status: targetStatus },
      })
      if (claimed.count === 0) {
        throw Object.assign(new Error('ITEM_STATUS_CONFLICT'), { code: 'ITEM_STATUS_CONFLICT' })
      }
    }

    if (targetStatus === 'CANCELLED') {
      await restoreInventoryForOrderItem(tx, req.params.itemId, req.restaurantId!)
    }

    await syncOrderStatusFromItemsTx(tx, req.params.orderId, order.status)

    // Ricalcolo totali se annullamento (skip ordini PAID chiusi fiscalmente)
    if (targetStatus === 'CANCELLED' && order.status !== 'PAID' && precomputedTotals) {
      const foodRevenue = precomputedTotals.subtotal + precomputedTotals.tax
      const allCancelled = precomputedTotals.total === 0
      const totalsLock = await tx.order.updateMany({
        where: {
          id: req.params.orderId,
          restaurantId: req.restaurantId!,
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        data: {
          subtotal: toMoney(precomputedTotals.subtotal),
          tax: toMoney(precomputedTotals.tax),
          total: toMoney(precomputedTotals.total),
          taxRateApplied: precomputedTotals.taxRateApplied,
          revenueAmount: toMoney(foodRevenue),
          ...(allCancelled ? { discount: 0 } : {}),
        },
      })
      if (totalsLock.count === 0) {
        throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
      }
    }
  })
  } catch (err) {
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
    if (code === 'ORDER_CLOSED') {
      res.status(400).json({ error: 'Ordine chiuso, non modificabile', code: 'ORDER_CLOSED' })
      return
    }
    if (code === 'ITEM_STATUS_CONFLICT') {
      res.status(409).json({ error: 'Stato piatto modificato da un altro utente', code })
      return
    }
    if (isRetriableTransactionError(err)) {
      res.status(503).json({
        error: 'Servizio temporaneamente occupato. Riprova tra qualche secondo.',
        code: 'TRANSACTION_TIMEOUT',
      })
      return
    }
    throw err
  }

  // Apply discounts again if totals changed (never on fiscal-closed PAID orders)
  if (targetStatus === 'CANCELLED' && order.status !== 'PAID') {
    const orderToDiscount = await prisma.order.findFirst({
      where: { id: req.params.orderId, restaurantId: req.restaurantId! },
      include: { items: { select: { status: true } } },
    })
    const hasActiveItems = orderToDiscount?.items?.some(i => i.status !== 'CANCELLED')
    if (orderToDiscount && hasActiveItems && (orderToDiscount.customerId || moneyNumber(orderToDiscount.discount) > 0)) {
      await applyDiscountToOrder(req.params.orderId, req.restaurantId!, { applyLoyalty: true })
    }
  }

  const updatedOrder = await prisma.order.findFirst({
    where: { id: req.params.orderId, restaurantId: req.restaurantId! },
    include: orderInclude,
  })

  if (updatedOrder?.tableId) {
    const kitchenDone = !updatedOrder.items.some(
      i => !['SERVED', 'CANCELLED'].includes(i.status),
    )
    if (kitchenDone) {
      const releasedTable = await releaseTableIfEmpty(updatedOrder.tableId)
      if (releasedTable) io.to(req.restaurantId!).emit('table:updated', releasedTable)
    }
  }

  io.to(req.restaurantId!).emit('order:updated', updatedOrder)
  res.json(updatedOrder)
})

ordersRouter.patch('/:id/status', requirePermission('orders.status'), async (req: AuthRequest, res: Response): Promise<void> => {
  const statusSchema = z.object({
    status: z.nativeEnum(OrderStatus),
    paymentMethod: z.enum(['CARD', 'CASH']).optional(),
    tipAmount: z.number().min(0).optional(),
  })
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Stato ordine non valido' })
    return
  }
  const { status, paymentMethod: bodyPaymentMethod, tipAmount: bodyTipAmount } = parsed.data

  if (!canSetOrderStatus(req.userRole, status)) {
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
  if (
    ['PAID', 'CANCELLED'].includes(existingOrder.status)
    && status !== existingOrder.status
    && !(existingOrder.status === 'PAID' && status === 'SERVED')
  ) {
    res.status(400).json({ error: 'Ordine chiuso, non modificabile' })
    return
  }

  if (status === 'CANCELLED' && existingOrder.stripeSessionId) {
    res.status(409).json({
      error: 'Ordine con checkout Stripe in corso: non modificabile',
      code: 'STRIPE_CHECKOUT_LOCKED',
    })
    return
  }

  if (status === 'CANCELLED' && moneyNumber(existingOrder.collectedAmount) > 0) {
    res.status(409).json({
      error: 'Incasso split già iniziato: annulla prima i partial o completa il pagamento',
      code: 'SPLIT_PAYMENT_IN_PROGRESS',
    })
    return
  }

  if (status === 'PAID') {
    res.status(400).json({
      error: 'Usa POST /api/payments/finalize per incassare l\'ordine',
      code: 'USE_PAYMENTS_FINALIZE',
    })
    return
  }

  if (status === 'SERVED' && existingOrder.status === 'PAID') {
    await prisma.orderItem.updateMany({
      where: { orderId: req.params.id, status: { not: 'CANCELLED' } },
      data: { status: 'SERVED' },
    })
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.restaurantId! },
      include: orderInclude,
    })
    if (!order) {
      res.status(404).json({ error: 'Ordine non trovato' })
      return
    }
    const releasedTable = await releaseTableIfEmpty(order.tableId)
    if (releasedTable) io.to(req.restaurantId!).emit('table:updated', releasedTable)
    io.to(req.restaurantId!).emit('order:updated', order)
    res.json(order)
    return
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

  if (status === 'CANCELLED') {
    const items = await prisma.orderItem.findMany({
      where: { orderId: req.params.id, status: { not: 'CANCELLED' } },
      select: { id: true }
    })

    try {
      await runOrderTransaction(async tx => {
        const claim = await tx.order.updateMany({
          where: {
            id: req.params.id,
            restaurantId: req.restaurantId!,
            status: { notIn: ['PAID', 'CANCELLED'] },
          },
          data: {
            status: 'CANCELLED',
            subtotal: 0,
            tax: 0,
            total: 0,
            revenueAmount: 0,
            discount: 0,
          },
        })
        if (claim.count === 0) {
          throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
        }

        await tx.orderItem.updateMany({
          where: { orderId: req.params.id },
          data: { status: 'CANCELLED' },
        })
        for (const item of items) {
          await restoreInventoryForOrderItem(tx, item.id, req.restaurantId!)
        }
      })
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      if (code === 'ORDER_CLOSED') {
        res.status(400).json({ error: 'Ordine chiuso, non modificabile', code: 'ORDER_CLOSED' })
        return
      }
      throw err
    }
  }

  if (status !== 'CANCELLED') {
  const updated = await prisma.order.updateMany({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    data: { status: status as OrderStatus },
  })
  if (updated.count === 0) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }
  }

  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    include: orderInclude,
  })
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }

  if (status === 'CANCELLED') {
    const releasedTable = await releaseTableIfEmpty(order.tableId)
    if (releasedTable) io.to(req.restaurantId!).emit('table:updated', releasedTable)
  } else if (status === 'SERVED') {
    const releasedTable = await releaseTableIfEmpty(order.tableId)
    if (releasedTable) io.to(req.restaurantId!).emit('table:updated', releasedTable)
  }

  io.to(req.restaurantId!).emit('order:updated', order)
  res.json(order)
})

/** Aggiunge più righe in un'unica transazione (evita N round-trip sequenziali). */
ordersRouter.post('/:id/items/batch', requirePermission('orders.items'), async (req: AuthRequest, res: Response): Promise<void> => {
  const idempotencyKey = readIdempotencyKey(req)
  let idempotencyLocked = false
  const releaseBatchLock = async () => {
    if (idempotencyKey && req.restaurantId && idempotencyLocked) {
      await releaseIdempotencyLock(req.restaurantId, idempotencyKey)
      idempotencyLocked = false
    }
  }
  if (idempotencyKey && req.restaurantId) {
    const cached = await getIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /orders/:id/items/batch')
    if (cached) {
      if (cached.statusCode === 202) {
        res.status(409).json({ error: 'Richiesta già in elaborazione' })
        return
      }
      res.status(cached.statusCode).json(cached.responseBody)
      return
    }
    const locked = await acquireIdempotencyLock(req.restaurantId, idempotencyKey, 'POST /orders/:id/items/batch')
    if (!locked) {
      res.status(409).json({ error: 'Richiesta duplicata bloccata' })
      return
    }
    idempotencyLocked = true
  }

  const schema = z.object({
    items: z.array(orderLineInputSchema).min(1).max(50),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    await releaseBatchLock()
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }
  const { items } = parsed.data

  const order = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
  })
  if (!order) {
    await releaseBatchLock()
    tenantNotFound(res, 'Ordine non trovato')
    return
  }
  if (['PAID', 'CANCELLED'].includes(order.status)) {
    await releaseBatchLock()
    res.status(400).json({ error: 'Ordine chiuso, non modificabile', code: 'ORDER_CLOSED' })
    return
  }
  if (order.stripeSessionId) {
    await releaseBatchLock()
    res.status(409).json({
      error: 'Ordine con checkout Stripe in corso: non modificabile',
      code: 'STRIPE_CHECKOUT_LOCKED',
    })
    return
  }
  if (moneyNumber(order.collectedAmount) > 0) {
    await releaseBatchLock()
    res.status(409).json({
      error: 'Incasso split già iniziato: non è possibile modificare i piatti',
      code: 'SPLIT_PAYMENT_IN_PROGRESS',
    })
    return
  }

  let itemsWithPrice
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map(i => i.menuItemId) }, restaurantId: tenantId(req) },
      include: {
        inventoryLinks: { include: { inventoryItem: { select: { quantity: true } } } },
        modifierGroups: { include: { options: true } },
      },
    })
    itemsWithPrice = items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)
      if (!menuItem) throw Object.assign(new Error('not found'), { code: 'MENU_ITEM_NOT_FOUND' })
      assertMenuItemOrderable(menuItem, item.quantity)
      try {
        const resolved = resolveMenuItemLine(menuItem, item.modifiers)
        return {
          ...item,
          unitPrice: resolved.unitPrice,
          selectedOptions: resolved.selectedOptions,
          menuTaxRate: resolved.menuTaxRate ?? menuItem.taxRate,
        }
      } catch (modErr) {
        if (modErr instanceof ModifierValidationError) {
          throw Object.assign(new Error(modErr.message), { code: modErr.code })
        }
        throw modErr
      }
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'MENU_ITEM_NOT_FOUND') {
      await releaseBatchLock()
      res.status(400).json({ error: 'Piatto non trovato nel menu' })
      return
    }
    if (code === 'MENU_ITEM_UNAVAILABLE') {
      await releaseBatchLock()
      res.status(400).json({ error: 'Piatto non disponibile', code })
      return
    }
    if (code === 'MENU_ITEM_SOLD_OUT') {
      await releaseBatchLock()
      res.status(400).json({ error: 'Piatto esaurito — ingredienti insufficienti', code })
      return
    }
    if (code === 'INVALID_MODIFIER' || code === 'MODIFIER_MIN_NOT_MET' || code === 'MODIFIER_MAX_EXCEEDED') {
      await releaseBatchLock()
      res.status(400).json({ error: (e as Error).message || 'Modificatore non valido', code })
      return
    }
    throw e
  }

  const existingLines = await prisma.orderItem.findMany({
    where: { orderId: req.params.id, status: { not: 'CANCELLED' } },
    select: {
      quantity: true,
      unitPrice: true,
      menuItem: { select: { taxRate: true } },
    },
  })

  const totals = await computeTaxFromGrossLines(
    tenantId(req),
    [
      ...existingLines.map(line => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.menuItem.taxRate,
      })),
      ...itemsWithPrice.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.menuTaxRate,
      })),
    ],
  )

  let createdItems
  try {
    const txResult = await runOrderTransaction(async tx => {
      const openClaim = await tx.order.updateMany({
        where: {
          ...scopedWhere(req, req.params.id),
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        data: { updatedAt: new Date() },
      })
      if (openClaim.count === 0) {
        throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
      }

      await assertOrderStockInTransaction(
        tx,
        tenantId(req),
        itemsWithPrice.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      )

      const newItems = []
      for (const item of itemsWithPrice) {
        const newItem = await tx.orderItem.create({
          data: {
            orderId: req.params.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            course: item.course,
            unitPrice: toMoney(item.unitPrice),
            notes: item.notes,
            modifiers: {
              create: item.selectedOptions.map(opt => ({
                optionId: opt.optionId,
                name: opt.name,
                price: toMoney(opt.price),
              })),
            },
          },
          select: {
            id: true,
            orderId: true,
            menuItemId: true,
            quantity: true,
            course: true,
            status: true,
            unitPrice: true,
            notes: true,
          },
        })
        newItems.push(newItem)
      }

      const totalsLock = await tx.order.updateMany({
        where: {
          ...scopedWhere(req, req.params.id),
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        data: {
          subtotal: toMoney(totals.subtotal),
          tax: toMoney(totals.tax),
          total: toMoney(totals.total),
          taxRateApplied: totals.taxRateApplied,
          revenueAmount: toMoney(totals.total),
        },
      })
      if (totalsLock.count === 0) {
        throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
      }

      await deductInventoryForOrder(tx, req.params.id, tenantId(req))

      return { createdItems: newItems }
    })
    createdItems = txResult.createdItems
  } catch (e) {
    if ((e as { code?: string }).code === 'ORDER_CLOSED') {
      await releaseBatchLock()
      res.status(400).json({ error: 'Ordine chiuso, non modificabile', code: 'ORDER_CLOSED' })
      return
    }
    if ((e as { code?: string }).code === 'INSUFFICIENT_STOCK') {
      await releaseBatchLock()
      res.status(409).json({ error: 'Piatto esaurito — ingredienti insufficienti', code: 'MENU_ITEM_SOLD_OUT' })
      return
    }
    if (isRetriableTransactionError(e)) {
      await releaseBatchLock()
      res.status(503).json({
        error: 'Servizio temporaneamente occupato. Riprova tra qualche secondo.',
        code: 'TRANSACTION_TIMEOUT',
      })
      return
    }
    await releaseBatchLock()
    throw e
  }

  const responseBody = { orderId: req.params.id, items: createdItems }

  if (idempotencyKey && req.restaurantId) {
    void saveIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /orders/:id/items/batch', 201, responseBody)
      .catch(err => console.error('[orders] idempotency save failed', err))
    idempotencyLocked = false
  }

  res.status(201).json(responseBody)

  scheduleOrderCommitEffects({
    kind: 'updated',
    restaurantId: tenantId(req),
    orderId: req.params.id,
    applyDiscount: Boolean(order.customerId || moneyNumber(order.discount) > 0),
    newItems: createdItems,
  })
})

ordersRouter.post('/:id/items', requirePermission('orders.items'), async (req: AuthRequest, res: Response): Promise<void> => {
  const idempotencyKey = readIdempotencyKey(req)
  let idempotencyLocked = false
  const releaseItemsLock = async () => {
    if (idempotencyKey && req.restaurantId && idempotencyLocked) {
      await releaseIdempotencyLock(req.restaurantId, idempotencyKey)
      idempotencyLocked = false
    }
  }
  if (idempotencyKey && req.restaurantId) {
    const cached = await getIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /orders/:id/items')
    if (cached) {
      if (cached.statusCode === 202) {
        res.status(409).json({ error: 'Richiesta già in elaborazione' })
        return
      }
      res.status(cached.statusCode).json(cached.responseBody)
      return
    }
    const locked = await acquireIdempotencyLock(req.restaurantId, idempotencyKey, 'POST /orders/:id/items')
    if (!locked) {
      res.status(409).json({ error: 'Richiesta duplicata bloccata' })
      return
    }
    idempotencyLocked = true
  }

  const schema = z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive().max(99),
    course: z.number().int().positive().optional().default(1),
    modifiers: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    await releaseItemsLock()
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const order = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
  })
  if (!order) {
    await releaseItemsLock()
    tenantNotFound(res, 'Ordine non trovato')
    return
  }
  if (['PAID', 'CANCELLED'].includes(order.status)) {
    await releaseItemsLock()
    res.status(400).json({ error: 'Ordine chiuso, non modificabile', code: 'ORDER_CLOSED' })
    return
  }
  if (order.stripeSessionId) {
    await releaseItemsLock()
    res.status(409).json({
      error: 'Ordine con checkout Stripe in corso: non modificabile',
      code: 'STRIPE_CHECKOUT_LOCKED',
    })
    return
  }
  if (moneyNumber(order.collectedAmount) > 0) {
    await releaseItemsLock()
    res.status(409).json({
      error: 'Incasso split già iniziato: non è possibile modificare i piatti',
      code: 'SPLIT_PAYMENT_IN_PROGRESS',
    })
    return
  }

  const menuItem = await prisma.menuItem.findFirst({
    where: { id: result.data.menuItemId, restaurantId: tenantId(req) },
    include: {
      inventoryLinks: { include: { inventoryItem: { select: { quantity: true } } } },
      modifierGroups: { include: { options: true } },
    },
  })
  if (!menuItem) {
    await releaseItemsLock()
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  try {
    await assertMenuItemOrderable(menuItem, result.data.quantity)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'MENU_ITEM_UNAVAILABLE') {
      await releaseItemsLock()
      res.status(400).json({ error: 'Piatto non disponibile', code })
      return
    }
    if (code === 'MENU_ITEM_SOLD_OUT') {
      await releaseItemsLock()
      res.status(400).json({ error: 'Piatto esaurito — ingredienti insufficienti', code })
      return
    }
    throw e
  }

  let unitPrice: number
  let selectedOptions: Array<{ optionId: string, name: string, price: number }>
  let menuTaxRate: number | null
  try {
    const resolved = resolveMenuItemLine(menuItem, result.data.modifiers)
    unitPrice = resolved.unitPrice
    selectedOptions = resolved.selectedOptions
    menuTaxRate = resolved.menuTaxRate ?? menuItem.taxRate
  } catch (modErr) {
    await releaseItemsLock()
    if (modErr instanceof ModifierValidationError) {
      res.status(400).json({ error: modErr.message, code: modErr.code })
      return
    }
    res.status(400).json({ error: 'Modificatore non valido', code: 'INVALID_MODIFIER' })
    return
  }

  let createdItem
  try {
    const txResult = await runOrderTransaction(async tx => {
      const openClaim = await tx.order.updateMany({
        where: {
          ...scopedWhere(req, req.params.id),
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        data: { updatedAt: new Date() },
      })
      if (openClaim.count === 0) {
        throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
      }

      const newItem = await tx.orderItem.create({
        data: {
          orderId: req.params.id,
          menuItemId: result.data.menuItemId,
          quantity: result.data.quantity,
          course: result.data.course,
          unitPrice: toMoney(unitPrice),
          notes: result.data.notes,
          modifiers: {
            create: selectedOptions.map(opt => ({
               optionId: opt.optionId,
               name: opt.name,
               price: toMoney(opt.price)
            }))
          }
        },
        include: { menuItem: true },
      })

      const allLines = await tx.orderItem.findMany({
        where: { orderId: req.params.id },
        select: { quantity: true, unitPrice: true, menuItemId: true, status: true },
      })
      const totals = await computeTaxForOrderItems(tenantId(req), allLines)

      const totalsLock = await tx.order.updateMany({
        where: {
          ...scopedWhere(req, req.params.id),
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        data: {
          subtotal: toMoney(totals.subtotal),
          tax: toMoney(totals.tax),
          total: toMoney(totals.total),
          taxRateApplied: totals.taxRateApplied,
          revenueAmount: toMoney(totals.total),
        },
      })
      if (totalsLock.count === 0) {
        throw Object.assign(new Error('ORDER_CLOSED'), { code: 'ORDER_CLOSED' })
      }
      
      await deductInventoryForOrder(tx, req.params.id, tenantId(req))
      
      return { createdItem: newItem }
    })
    createdItem = txResult.createdItem
  } catch (e) {
    if ((e as { code?: string }).code === 'ORDER_CLOSED') {
      await releaseItemsLock()
      res.status(400).json({ error: 'Ordine chiuso, non modificabile', code: 'ORDER_CLOSED' })
      return
    }
    if ((e as { code?: string }).code === 'INSUFFICIENT_STOCK') {
      await releaseItemsLock()
      res.status(409).json({ error: 'Piatto esaurito — ingredienti insufficienti', code: 'MENU_ITEM_SOLD_OUT' })
      return
    }
    if (isRetriableTransactionError(e)) {
      await releaseItemsLock()
      res.status(503).json({
        error: 'Servizio temporaneamente occupato. Riprova tra qualche secondo.',
        code: 'TRANSACTION_TIMEOUT',
      })
      return
    }
    await releaseItemsLock()
    throw e
  }

  const orderWithItems = order

  if (orderWithItems && (orderWithItems.customerId || moneyNumber(orderWithItems.discount) > 0)) {
    await applyDiscountToOrder(req.params.id, tenantId(req), { applyLoyalty: true })
  }

  const updatedOrder = await prisma.order.findFirst({
    where: scopedWhere(req, req.params.id),
    include: orderInclude,
  })
  io.to(tenantId(req)).emit('order:updated', updatedOrder)
  io.to(tenantId(req)).emit('print:kitchen', { type: 'kitchen', order: updatedOrder, newItem: createdItem })

  if (idempotencyKey && req.restaurantId) {
    await saveIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /orders/:id/items', 201, createdItem)
    idempotencyLocked = false
  }

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
  if (customerId) {
    try {
      await assertCustomerInTenant(customerId, tenantId(req))
    } catch {
      res.status(404).json({ error: 'Cliente non trovato', code: 'CUSTOMER_NOT_FOUND' })
      return
    }
  }
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
