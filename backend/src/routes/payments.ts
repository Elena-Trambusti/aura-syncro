import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest, authenticate, requireRole } from '../middleware/auth'
import { io } from '../index'
import {
  computeSplitBreakdown,
  finalizeOrderPayment,
  releaseTableIfEmpty,
} from '../lib/orderPayment'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { computeTaxForRestaurant } from '../lib/orderTax'

export const paymentsRouter = Router()

const posOrderInclude = {
  table: true,
  items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' as const } },
}

/** Simula l'invio del pagamento a un terminale POS fisico (Stripe Terminal / SumUp). */
async function simulatePosTerminal(amount: number): Promise<{
  success: boolean
  transactionId: string
  terminalId: string
  provider: string
}> {
  const delayMs = Number(process.env.POS_SIMULATE_DELAY_MS) || 800
  await new Promise(resolve => setTimeout(resolve, delayMs))

  const transactionId = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return {
    success: true,
    transactionId,
    terminalId: process.env.POS_TERMINAL_ID || 'SIM-TPV-001',
    provider: process.env.POS_PROVIDER || 'simulated',
  }
}

const splitSchema = z.object({
  mode: z.enum(['equal', 'by_items']),
  guestCount: z.number().int().min(2).max(20),
  assignments: z.array(z.object({
    itemId: z.string(),
    guestIndex: z.number().int().min(0),
  })).optional(),
}).optional()

const finalizeSchema = z.object({
  orderId: z.string(),
  tipAmount: z.number().min(0).optional().default(0),
  /** CARD | CASH per incasso; SPLIT usa splitSettlement */
  paymentMethod: z.enum(['CARD', 'CASH', 'SPLIT']).default('CARD'),
  /** Quando paymentMethod=SPLIT, metodo di registro fiscale effettivo */
  splitSettlement: z.enum(['CARD', 'CASH']).optional(),
  split: splitSchema,
  simulateEmail: z.string().email().optional(),
})

async function loadOrderForCheckout(orderId: string, restaurantId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      table: true,
      items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' } },
    },
  })
}

// ── Anteprima checkout (riepilogo pre-pagamento) ─────────────────────────────
paymentsRouter.get('/checkout/:orderId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const order = await loadOrderForCheckout(req.params.orderId, req.restaurantId!)
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId! },
    include: { settings: true },
  })

  const fiscal = buildFiscalConfig(restaurant?.settings)

  res.json({
    order,
    fiscalRegime: fiscalConfigPayload(fiscal, restaurant?.settings?.taxId),
    restaurant: {
      name: restaurant?.name,
      taxId: restaurant?.settings?.taxId ?? null,
    },
  })
})

// ── Finalizza pagamento e chiusura conto ─────────────────────────────────────
paymentsRouter.post('/finalize', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = finalizeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const { orderId, tipAmount, paymentMethod, splitSettlement, split, simulateEmail } = parsed.data

  const order = await loadOrderForCheckout(orderId, req.restaurantId!)
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }

  const settlementMethod = paymentMethod === 'SPLIT'
    ? (splitSettlement ?? 'CARD')
    : paymentMethod

  let splitBreakdown
  if (paymentMethod === 'SPLIT' && split) {
    const totalWithTip = order.total + Math.max(0, tipAmount)
    splitBreakdown = computeSplitBreakdown(
      order.items.filter(i => i.status !== 'CANCELLED'),
      totalWithTip,
      split,
    )
  }

  try {
    const terminalResponse = await simulatePosTerminal(order.total + tipAmount)

    const result = await finalizeOrderPayment(
      {
        orderId,
        restaurantId: req.restaurantId!,
        tipAmount,
        paymentMethod: settlementMethod,
      },
      { splitBreakdown },
    )

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: posOrderInclude,
    })

    await releaseTableIfEmpty(order.tableId)

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId! },
      include: { settings: true },
    })
    const fiscal = buildFiscalConfig(restaurant?.settings)

    io.to(req.restaurantId!).emit('order:updated', updatedOrder)

    res.json({
      success: true,
      message: 'Pagamento finalizzato',
      transactionId: result.transactionId,
      order: updatedOrder,
      fiscal: {
        regime: fiscalConfigPayload(fiscal, restaurant?.settings?.taxId),
        row: result.fiscalRow,
      },
      splitBreakdown: result.splitBreakdown,
      pos: terminalResponse,
      receipt: {
        simulatedEmailSent: Boolean(simulateEmail),
        emailTo: simulateEmail ?? null,
      },
    })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Ordine non trovato' })
      return
    }
    if (code === 'ORDER_ALREADY_PAID') {
      res.status(400).json({ error: 'Ordine già pagato' })
      return
    }
    if (code === 'ORDER_CANCELLED') {
      res.status(400).json({ error: 'Ordine annullato' })
      return
    }
    throw err
  }
})

// ── Checkout POS fisico (compat — delega a finalize) ─────────────────────────
paymentsRouter.post('/pos-checkout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    orderId: z.string(),
    tipAmount: z.number().min(0).optional().default(0),
    paymentMethod: z.enum(['CARD', 'CASH']).default('CARD'),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const { orderId, tipAmount, paymentMethod } = result.data

  try {
    const terminalResponse = await simulatePosTerminal(0)
    const finalized = await finalizeOrderPayment({
      orderId,
      restaurantId: req.restaurantId!,
      tipAmount,
      paymentMethod,
    })

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: posOrderInclude,
    })

    await releaseTableIfEmpty(updatedOrder?.tableId)

    io.to(req.restaurantId!).emit('order:updated', updatedOrder)

    res.json({
      success: true,
      message: 'Pagamento POS completato',
      order: updatedOrder,
      pos: {
        transactionId: finalized.transactionId,
        terminalId: terminalResponse.terminalId,
        provider: terminalResponse.provider,
        amountCharged: finalized.total,
        revenueAmount: finalized.revenueAmount,
        tipAmount: finalized.tipAmount,
      },
      fiscal: { row: finalized.fiscalRow },
    })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'ORDER_ALREADY_PAID') {
      res.status(400).json({ error: 'Ordine già pagato' })
      return
    }
    if (code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Ordine non trovato' })
      return
    }
    throw err
  }
})

// ── Checkout pubblico: crea ordine + sessione Stripe ─────────────────────────
paymentsRouter.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Pagamenti online non configurati. Inserisci le chiavi Stripe nel file .env del backend.' })
    return
  }

  const schema = z.object({
    slug: z.string(),
    type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
    tableNumber: z.number().int().positive().optional(),
    notes: z.string().optional(),
    customerName: z.string().optional(),
    customerEmail: z.string().email().optional(),
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

  const { items, tableNumber, slug, customerName, customerEmail, ...orderData } = result.data

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } })
  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const restaurantId = restaurant.id

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (table) tableId = table.id
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map(i => i.menuItemId) }, restaurantId },
  })

  if (menuItems.length !== items.length) {
    res.status(400).json({ error: 'Alcuni piatti non sono disponibili' })
    return
  }

  const itemsWithPrice = items.map(item => {
    const mi = menuItems.find((m: { id: string }) => m.id === item.menuItemId)!
    return { ...item, unitPrice: mi.price, name: mi.name }
  })

  const subtotal = itemsWithPrice.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const { tax, total, taxRateApplied } = await computeTaxForRestaurant(restaurantId, subtotal)

  // Crea l'ordine nel DB con status PENDING_PAYMENT
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
  })

  if (tableId) {
    await prisma.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } })
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  // Crea la sessione Stripe Checkout
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    metadata: {
      orderId: order.id,
      restaurantId,
      tableNumber: tableNumber?.toString() || '',
      customerName: customerName || '',
    },
    line_items: itemsWithPrice.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          ...(item.notes ? { description: item.notes } : {}),
        },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.quantity,
    })),
    // Riga IVA
    ...(tax > 0 ? {
      invoice_creation: { enabled: false },
    } : {}),
    success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
    cancel_url: `${frontendUrl}/menu/${slug}?payment=cancelled`,
  })

  // Salva il session ID sull'ordine
  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  })

  res.json({
    checkoutUrl: session.url,
    sessionId: session.id,
    orderId: order.id,
  })
})

// ── Verifica stato sessione (dalla pagina di successo) ────────────────────────
paymentsRouter.get('/session/:sessionId', async (req: Request, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Stripe non configurato' })
    return
  }

  try {
    const sessionId = String(req.params.sessionId)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const order = await prisma.order.findFirst({
      where: { stripeSessionId: sessionId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    res.json({
      status: session.payment_status,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      customerEmail: session.customer_details?.email,
      order,
    })
  } catch {
    res.status(404).json({ error: 'Sessione non trovata' })
  }
})

// ── Webhook Stripe (richiede raw body — gestito in index.ts) ──────────────────
paymentsRouter.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    if (webhookSecret && sig && !webhookSecret.includes('inserisci')) {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret)
    } else {
      // Modalità dev senza firma
      event = JSON.parse((req.body as Buffer).toString())
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook error'
    res.status(400).json({ error: msg })
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { id: string; metadata?: { orderId?: string }; payment_intent?: string }
    const orderId = session.metadata?.orderId

    if (orderId) {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentMethod: 'STRIPE',
          stripePaymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          paidAt: new Date(),
        },
        include: { items: { include: { menuItem: true } }, table: true },
      })

      io.to(updatedOrder.restaurantId).emit('order:updated', updatedOrder)
      io.to(updatedOrder.restaurantId).emit('order:new', updatedOrder)
    }
  }

  res.json({ received: true })
})

// ── Deposito caparra prenotazione ─────────────────────────────────────────────
paymentsRouter.post('/deposit', async (req: Request, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Pagamenti online non configurati' })
    return
  }

  const schema = z.object({
    reservationId: z.string(),
    slug: z.string(),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: result.data.reservationId },
    include: { restaurant: true },
  })

  if (!reservation || reservation.restaurant.slug !== result.data.slug) {
    res.status(404).json({ error: 'Prenotazione non trovata' })
    return
  }

  if (reservation.depositPaid) {
    res.status(400).json({ error: 'Caparra già pagata' })
    return
  }

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: reservation.restaurantId },
  })

  const depositAmount = settings?.depositAmount || 10
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: reservation.guestEmail || undefined,
    metadata: {
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
    },
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Caparra prenotazione — ${reservation.restaurant.name}`,
          description: `${reservation.covers} persone · ${new Date(reservation.date).toLocaleDateString('it-IT')}`,
        },
        unit_amount: Math.round(depositAmount * 100),
      },
      quantity: 1,
    }],
    success_url: `${frontendUrl}/payment/deposit-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/reservations?payment=cancelled`,
  })

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { depositStripeSessionId: session.id },
  })

  res.json({ checkoutUrl: session.url, sessionId: session.id })
})

// ── Dashboard pagamenti digitali (protetta) ───────────────────────────────────
paymentsRouter.get('/overview', authenticate, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  if (!restaurantId) {
    res.status(401).json({ error: 'Tenant non autenticato' })
    return
  }
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const [stripeOrders, monthStats, yearOrders, recentPayments] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, paymentMethod: 'STRIPE' },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, paymentMethod: 'STRIPE', paidAt: { gte: startOfMonth } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { restaurantId, paymentMethod: 'STRIPE', paidAt: { gte: startOfYear } },
      select: { total: true, paidAt: true },
    }),
    prisma.order.findMany({
      where: { restaurantId, paymentMethod: 'STRIPE' },
      orderBy: { paidAt: 'desc' },
      take: 20,
      include: { table: true, items: { include: { menuItem: true } } },
    }),
  ])

  // Raggruppa per mese in JS
  const monthlyData: Record<string, { month: string; amount: number; count: number }> = {}
  for (let m = 0; m < 12; m++) {
    const key = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`
    const label = new Date(now.getFullYear(), m, 1).toLocaleString('it-IT', { month: 'short' })
    monthlyData[key] = { month: label, amount: 0, count: 0 }
  }
  for (const order of yearOrders) {
    if (!order.paidAt) continue
    const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, '0')}`
    if (monthlyData[key]) {
      monthlyData[key].amount += order.total
      monthlyData[key].count += 1
    }
  }

  res.json({
    totale: { amount: stripeOrders._sum?.total ?? 0, count: stripeOrders._count._all },
    mese: { amount: monthStats._sum?.total ?? 0, count: monthStats._count._all },
    mensile: Object.values(monthlyData),
    recentPayments,
    stripeEnabled: STRIPE_ENABLED,
  })
})
