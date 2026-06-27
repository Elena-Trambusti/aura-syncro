import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest, authenticate } from '../middleware/auth'
import { requireDashboardAccess } from '../middleware/dashboardAccess'
import { requirePermission } from '../middleware/permissions'
import { requireProPlan } from '../middleware/planTier'
import {
  computeSplitBreakdown,
  type SplitBreakdown,
} from '../lib/orderPayment'
import { completeOrderPayment } from '../lib/completePayment'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { getFiscalStrategyFromConfig } from '../lib/fiscal/strategies'
import { createDepositCheckoutSession } from '../lib/depositCheckout'
import { depositLimiter, publicCheckoutLimiter } from '../middleware/rateLimit'
import { GUEST_ORDERING_DISABLED, isGuestOrderingEnabled } from '../lib/guestOrderingPolicy'
import { applyDiscountToOrder, resolveCampaignDiscount, resolveLoyaltyDiscount } from '../lib/orderDiscount'
import { loadRestaurantPosConfig, serializePosStatusForCheckout } from '../lib/posIntegration'

export const paymentsRouter = Router()

const posOrderInclude = {
  table: true,
  items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' as const } },
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
  tipWaiterId: z.string().optional(),
  /** CARD | CASH per incasso; SPLIT usa splitSettlement */
  paymentMethod: z.enum(['CARD', 'CASH', 'SPLIT']).default('CARD'),
  /** Quando paymentMethod=SPLIT, metodo di registro fiscale effettivo */
  splitSettlement: z.enum(['CARD', 'CASH']).optional(),
  split: splitSchema,
  simulateEmail: z.string().email().optional(),
  stripePaymentIntentId: z.string().optional(),
  discountCode: z.string().optional(),
  applyLoyaltyDiscount: z.boolean().optional().default(true),
})

async function loadOrderForCheckout(orderId: string, restaurantId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      table: true,
      customer: { include: { loyaltyTier: true } },
      items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' } },
    },
  })
}

// ── Anteprima checkout (riepilogo pre-pagamento) ─────────────────────────────
paymentsRouter.get('/checkout/:orderId', authenticate, requireDashboardAccess, requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
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
  const strategy = getFiscalStrategyFromConfig(fiscal)
  const tipPolicy = strategy.getCheckoutTipPolicy()

  const loyaltyDiscount = order.customerId
    ? await resolveLoyaltyDiscount(req.restaurantId!, order.customerId)
    : { source: 'NONE' as const, discountPct: 0, discountAmount: 0 }

  const posConfig = await loadRestaurantPosConfig(req.restaurantId!)
  const posStatus = serializePosStatusForCheckout(posConfig)

  res.json({
    order,
    fiscalRegime: fiscalConfigPayload(fiscal, restaurant?.settings?.taxId),
    tipPolicy: {
      treatment: tipPolicy.treatment,
      messageKey: tipPolicy.messageKey,
      taxName: fiscal.taxName,
      message: tipPolicy.message,
    },
    restaurant: {
      name: restaurant?.name,
      taxId: restaurant?.settings?.taxId ?? null,
    },
    loyaltyDiscount: loyaltyDiscount.discountPct > 0 ? {
      pct: loyaltyDiscount.discountPct,
      tierName: loyaltyDiscount.tierName,
    } : null,
    posStatus,
    /** @deprecated use posStatus.isCardChargeSimulated */
    posSimulation: posStatus.isCardChargeSimulated,
  })
})

// ── Finalizza pagamento e chiusura conto ─────────────────────────────────────
paymentsRouter.post('/finalize', authenticate, requireDashboardAccess, requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = finalizeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const { orderId, tipAmount, tipWaiterId, paymentMethod, splitSettlement, split, simulateEmail, stripePaymentIntentId, discountCode, applyLoyaltyDiscount } = parsed.data

  const order = await loadOrderForCheckout(orderId, req.restaurantId!)
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }

  try {
    if (discountCode) {
      await applyDiscountToOrder(orderId, req.restaurantId!, { discountCode })
    } else if (applyLoyaltyDiscount && order.customerId) {
      await applyDiscountToOrder(orderId, req.restaurantId!, { applyLoyalty: true })
    }
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'INVALID_DISCOUNT_CODE') {
      res.status(400).json({ error: 'Codice sconto non valido', code })
      return
    }
    if (code === 'ORDER_CLOSED') {
      res.status(400).json({ error: 'Ordine chiuso' })
      return
    }
    throw err
  }

  const refreshedOrder = await loadOrderForCheckout(orderId, req.restaurantId!)
  if (!refreshedOrder) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }

  const settlementMethod = paymentMethod === 'SPLIT'
    ? (splitSettlement ?? 'CARD')
    : paymentMethod

  let splitBreakdown
  if (paymentMethod === 'SPLIT' && split) {
    const totalWithTip = refreshedOrder.total + Math.max(0, tipAmount)
    splitBreakdown = computeSplitBreakdown(
      refreshedOrder.items.filter((i: any) => i.status !== 'CANCELLED'),
      totalWithTip,
      split,
    )
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId! },
      include: { settings: true },
    })
    const fiscal = buildFiscalConfig(restaurant?.settings)

    const { result, updatedOrder, posResult, emailSent } = await completeOrderPayment({
      finalize: {
        orderId,
        restaurantId: req.restaurantId!,
        tipAmount,
        tipWaiterId,
        paymentMethod: settlementMethod,
      },
      splitBreakdown,
      stripePaymentIntentId,
      receiptEmail: simulateEmail,
      restaurantName: restaurant?.name,
    })

    // Return only the fields required by the frontend CheckoutFinalizeResult
    res.json({
      transactionId: result.transactionId,
      order: updatedOrder,
      fiscal: {
        row: result.fiscalRow,
      },
      splitBreakdown: result.splitBreakdown,
      receipt: {
        emailSent,
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
    if (code === 'STRIPE_PAYMENT_FAILED' || code === 'STRIPE_PAYMENT_INTENT_REQUIRED') {
      res.status(402).json({ error: 'Pagamento carta non riuscito', code })
      return
    }
    throw err
  }
})

// ── Checkout POS fisico (compat — delega a finalize) ─────────────────────────
paymentsRouter.post('/pos-checkout', authenticate, requireDashboardAccess, requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    orderId: z.string(),
    tipAmount: z.number().min(0).optional().default(0),
    tipWaiterId: z.string().optional(),
    paymentMethod: z.enum(['CARD', 'CASH']).default('CARD'),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const { orderId, tipAmount, tipWaiterId, paymentMethod } = result.data

  try {
    const { result: payResult, updatedOrder, posResult } = await completeOrderPayment({
      finalize: {
        orderId,
        restaurantId: req.restaurantId!,
        tipAmount,
        tipWaiterId,
        paymentMethod,
      },
    })

    res.json({
      success: true,
      message: 'Pagamento POS completato',
      order: updatedOrder,
      pos: {
        transactionId: payResult.transactionId,
        terminalId: posResult?.terminalId ?? 'POS',
        provider: posResult?.provider ?? 'simulated',
        amountCharged: payResult.total,
        revenueAmount: payResult.revenueAmount,
        tipAmount: payResult.tipAmount,
      },
      fiscal: { row: payResult.fiscalRow },
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

// ── Applica sconto fedeltà o codice promo prima del pagamento ────────────────
paymentsRouter.post('/apply-discount', authenticate, requireDashboardAccess, requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    orderId: z.string(),
    discountCode: z.string().optional(),
    applyLoyalty: z.boolean().optional().default(true),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  try {
    const order = await applyDiscountToOrder(parsed.data.orderId, req.restaurantId!, {
      discountCode: parsed.data.discountCode,
      applyLoyalty: parsed.data.applyLoyalty,
    })
    res.json({ order })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'INVALID_DISCOUNT_CODE') {
      res.status(400).json({ error: 'Codice sconto non valido', code })
      return
    }
    if (code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Ordine non trovato' })
      return
    }
    if (code === 'ORDER_CLOSED') {
      res.status(400).json({ error: 'Ordine chiuso' })
      return
    }
    throw err
  }
})

// ── Valida codice promo (anteprima) ──────────────────────────────────────────
paymentsRouter.post('/validate-promo', authenticate, requireDashboardAccess, requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ code: z.string().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Codice richiesto' })
    return
  }

  const discount = await resolveCampaignDiscount(req.restaurantId!, parsed.data.code)
  if (discount.discountPct <= 0) {
    res.status(404).json({ error: 'Codice non valido o scaduto', code: 'INVALID_DISCOUNT_CODE' })
    return
  }
  res.json({ valid: true, discountPct: discount.discountPct })
})

// ── Checkout pubblico guest: disabilitato se policy off ───────────────────────
paymentsRouter.post('/checkout', publicCheckoutLimiter, async (_req: Request, res: Response): Promise<void> => {
  if (!isGuestOrderingEnabled()) {
    res.status(403).json(GUEST_ORDERING_DISABLED)
    return
  }
  res.status(400).json({ error: 'Usa POST /api/public/checkout per ordini guest' })
})

// ── Verifica stato sessione (dalla pagina di successo) ────────────────────────
paymentsRouter.get('/session/:sessionId', async (req: Request, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Stripe non configurato' })
    return
  }

  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : null
  if (!orderId) {
    res.status(400).json({ error: 'orderId richiesto' })
    return
  }

  try {
    const sessionId = String(req.params.sessionId)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.metadata?.orderId !== orderId) {
      res.status(403).json({ error: 'Sessione non valida per questo ordine' })
      return
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, stripeSessionId: sessionId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    if (!order) {
      res.status(404).json({ error: 'Ordine non trovato' })
      return
    }

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

/** Verifica caparra prenotazione dopo redirect Stripe (pagina pubblica) */
paymentsRouter.get('/deposit-session/:sessionId', async (req: Request, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Stripe non configurato' })
    return
  }

  try {
    const sessionId = String(req.params.sessionId)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const reservationId = session.metadata?.reservationId

    if (!reservationId) {
      res.status(400).json({ error: 'Sessione non valida per caparra prenotazione' })
      return
    }

    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, depositStripeSessionId: sessionId },
      select: {
        guestName: true,
        covers: true,
        date: true,
        depositPaid: true,
        restaurant: { select: { name: true, slug: true } },
      },
    })

    if (!reservation) {
      res.status(404).json({ error: 'Prenotazione non trovata' })
      return
    }

    res.json({
      status: session.payment_status,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      customerEmail: session.customer_details?.email,
      reservation: {
        guestName: reservation.guestName,
        covers: reservation.covers,
        date: reservation.date.toISOString(),
        restaurantName: reservation.restaurant.name,
        restaurantSlug: reservation.restaurant.slug,
      },
    })
  } catch {
    res.status(404).json({ error: 'Sessione non trovata' })
  }
})

// ── Deposito caparra (legacy pubblico — preferire POST /api/reservations/:id/deposit-checkout) ──
paymentsRouter.post('/deposit', depositLimiter, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    reservationId: z.string(),
    slug: z.string(),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  try {
    const session = await createDepositCheckoutSession(result.data.reservationId, result.data.slug)
    res.json(session)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Prenotazione non trovata' })
      return
    }
    if (code === 'ALREADY_PAID') {
      res.status(400).json({ error: 'Caparra già pagata' })
      return
    }
    if (code === 'PAYMENTS_DISABLED') {
      res.status(503).json({ error: 'Pagamenti online non configurati' })
      return
    }
    res.status(500).json({ error: 'Errore creazione checkout caparra' })
  }
})

// ── Dashboard pagamenti digitali (protetta) ───────────────────────────────────
paymentsRouter.get('/overview', authenticate, requirePermission('payments.overview'), requireDashboardAccess, requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  if (!restaurantId) {
    res.status(401).json({ error: 'Tenant non autenticato' })
    return
  }
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const [stripeOrders, monthStats, yearOrders, recentPayments, restaurantSettings] = await Promise.all([
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
    prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { stripeConnectAccountId: true },
    })
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
    recentPayments: recentPayments.map((order: any) => ({
      id: order.id,
      total: order.total,
      paidAt: order.paidAt,
      type: order.type,
      table: order.table,
      items: order.items.map((item: any) => ({
        quantity: item.quantity,
        menuItem: item.menuItem
          ? { name: item.menuItem.name }
          : { name: 'Piatto rimosso' },
      })),
    })),
    stripeEnabled: STRIPE_ENABLED,
    stripeConnectAccountId: restaurantSettings?.stripeConnectAccountId ?? null,
  })
})

paymentsRouter.post('/connect-onboarding', authenticate, requireDashboardAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Stripe non configurato sulla piattaforma' })
    return
  }
  
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId! },
    include: { settings: true }
  })
  if (!restaurant || !restaurant.settings) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  try {
    let accountId = restaurant.settings.stripeConnectAccountId
    if (!accountId) {
      // Crea nuovo account Express
      const account = await stripe.accounts.create({
        type: 'express',
        country: restaurant.settings.countryCode || 'IT',
        email: restaurant.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'company',
        business_profile: {
          name: restaurant.name,
          url: `https://aurasyncro.it/${restaurant.slug}`,
        }
      })
      accountId = account.id
      await prisma.restaurantSettings.update({
        where: { restaurantId: req.restaurantId! },
        data: { stripeConnectAccountId: accountId }
      })
    }

    // Crea Account Link per Onboarding
    const rawOrigin = req.headers.origin
    let originStr = typeof rawOrigin === 'string' ? rawOrigin : (Array.isArray(rawOrigin) ? rawOrigin[0] : 'http://localhost:5173')
    
    // TRUCCO: Stripe in modalità Live (chiavi sk_live_) rifiuta "http://localhost".
    // Se siamo in Live Mode dal PC locale, forziamo il reindirizzamento al sito vero per evitare l'errore 500.
    const stripeKey = process.env.STRIPE_SECRET_KEY || ''
    if (originStr.startsWith('http://localhost') && stripeKey.startsWith('sk_live_')) {
      originStr = 'https://aurasyncro.com' 
    }
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${originStr}/dashboard/pagamenti?connect=refresh`,
      return_url: `${originStr}/dashboard/pagamenti?connect=success`,
      type: 'account_onboarding',
    })

    res.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect Onboarding Error:', err)
    res.status(500).json({ error: 'Errore creazione onboarding Stripe' })
  }
})
