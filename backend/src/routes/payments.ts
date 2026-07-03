import { Router, Request, Response } from 'express'
import { z } from 'zod'
import type { PaymentMethod } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest, authenticate } from '../middleware/auth'
import { requireDashboardAccess } from '../middleware/dashboardAccess'
import { requirePermission } from '../middleware/permissions'
import { requireProPlan } from '../middleware/planTier'
import {
  computeSplitBreakdown,
  type SplitBreakdown,
  resolveTipWaiterId,
} from '../lib/orderPayment'
import { completeOrderPayment } from '../lib/completePayment'
import { readIdempotencyKey, getIdempotentResponse, saveIdempotentResponse } from '../lib/apiIdempotency'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { getFiscalStrategyFromConfig } from '../lib/fiscal/strategies'
import { depositLimiter, publicCheckoutLimiter } from '../middleware/rateLimit'
import { GUEST_ORDERING_DISABLED, isGuestOrderingEnabled } from '../lib/guestOrderingPolicy'
import { applyDiscountToOrder, resolveCampaignDiscount, resolveLoyaltyDiscount, resolveDiscountForOrder, validateOrderDiscountOptions } from '../lib/orderDiscount'
import { loadRestaurantPosConfig, serializePosStatusForCheckout } from '../lib/posIntegration'
import { resolveFrontendOrigin } from '../lib/frontendOrigin'
import { verifyDepositReceiptToken, verifyOrderReceiptToken } from '../lib/paymentReceiptToken'
import { moneyNumber, sumFoodFromMoneyAgg } from '../lib/money'
import { paidRevenueOrderWhere } from '../lib/analyticsFilters'
import { loadTenantTimeRanges } from '../lib/analyticsSummary'
import { buildMonthRangeInTimezone, calendarDateInTimezone } from '../lib/dates'
import { resolveRevenueAmount } from '../lib/fiscalAmounts'

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
  /** Quota split da incassare in questo step (0-based). Omesso = chiusura intero conto. */
  splitGuestIndex: z.number().int().min(0).optional(),
})

async function loadOrderForCheckout(orderId: string, restaurantId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      table: true,
      customer: { include: { loyaltyTier: true } },
      items: { include: { menuItem: true, modifiers: true }, orderBy: { createdAt: 'asc' } },
    },
  })
}

// ── Anteprima checkout (riepilogo pre-pagamento) ─────────────────────────────
paymentsRouter.get('/checkout/:orderId', authenticate, requireDashboardAccess, requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const [order, restaurant, posConfig] = await Promise.all([
    loadOrderForCheckout(req.params.orderId, req.restaurantId!),
    prisma.restaurant.findUnique({
      where: { id: req.restaurantId! },
      include: { settings: true },
    }),
    loadRestaurantPosConfig(req.restaurantId!),
  ])

  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato' })
    return
  }

  const fiscal = buildFiscalConfig(restaurant?.settings)
  const strategy = getFiscalStrategyFromConfig(fiscal)
  const tipPolicy = strategy.getCheckoutTipPolicy()

  const loyaltyDiscount = order.customerId
    ? await resolveLoyaltyDiscount(req.restaurantId!, order.customerId)
    : { source: 'NONE' as const, discountPct: 0, discountAmount: 0 }

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

  const { orderId, tipAmount, tipWaiterId, paymentMethod, splitSettlement, split, simulateEmail, stripePaymentIntentId, discountCode, applyLoyaltyDiscount, splitGuestIndex } = parsed.data
  const idempotencyKey = readIdempotencyKey(req)
  if (idempotencyKey && req.restaurantId) {
    const cached = await getIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /payments/finalize')
    if (cached && cached.statusCode !== 202) {
      res.status(cached.statusCode).json(cached.responseBody)
      return
    }
  }

  const receiptEmail = process.env.NODE_ENV !== 'production' ? simulateEmail : undefined

  const order = await loadOrderForCheckout(orderId, req.restaurantId!)
  if (!order) {
    res.status(404).json({ error: 'Ordine non trovato', code: 'ORDER_NOT_FOUND' })
    return
  }

  const loyaltyPreview = applyLoyaltyDiscount && order.customerId
    ? await resolveLoyaltyDiscount(req.restaurantId!, order.customerId)
    : null

  const discountOptions = discountCode
    ? { discountCode }
    : loyaltyPreview && loyaltyPreview.discountPct > 0
      ? { applyLoyalty: true as const }
      : undefined

  try {
    if (discountOptions) {
      await validateOrderDiscountOptions(orderId, req.restaurantId!, discountOptions)
    }
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'INVALID_DISCOUNT_CODE') {
      res.status(400).json({ error: 'Codice sconto non valido', code })
      return
    }
    if (code === 'NO_LOYALTY_DISCOUNT') {
      res.status(400).json({ error: 'Nessuno sconto fedeltà disponibile per questo cliente', code })
      return
    }
    if (code === 'ORDER_CLOSED') {
      res.status(400).json({ error: 'Ordine chiuso' })
      return
    }
    throw err
  }

  const refreshedOrder = discountOptions
    ? await loadOrderForCheckout(orderId, req.restaurantId!)
    : order
  if (!refreshedOrder) {
    res.status(404).json({ error: 'Ordine non trovato', code: 'ORDER_NOT_FOUND' })
    return
  }

  if (refreshedOrder.status === 'PAID') {
    const alreadyPaidBody = {
      transactionId: null,
      order: refreshedOrder,
      fiscal: { row: null },
      splitBreakdown: null,
      receipt: { emailSent: false, emailTo: null },
      alreadyPaid: true,
    }
    if (idempotencyKey && req.restaurantId) {
      await saveIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /payments/finalize', 200, alreadyPaidBody)
    }
    res.json(alreadyPaidBody)
    return
  }

  const settlementMethod = paymentMethod === 'SPLIT'
    ? (splitSettlement ?? 'CARD')
    : paymentMethod

  let validatedTipWaiterId: string | undefined
  try {
    validatedTipWaiterId = await resolveTipWaiterId(req.restaurantId!, tipWaiterId, req.userId, req.userRole, refreshedOrder.waiterId)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'UNAUTHORIZED_TIP_ASSIGNMENT') {
      res.status(403).json({ error: 'Non sei autorizzato ad assegnare mance ad altri colleghi', code })
      return
    }
    if (code === 'INVALID_TIP_WAITER') {
      res.status(400).json({ error: 'Cameriere non valido', code })
      return
    }
    throw err
  }

  let orderTotalForCheckout = moneyNumber(refreshedOrder.total)
  if (discountOptions) {
    const { totals } = await resolveDiscountForOrder(req.restaurantId!, refreshedOrder, discountOptions)
    orderTotalForCheckout = totals.total
  }

  let splitBreakdown
  if (paymentMethod === 'SPLIT' && split) {
    const totalWithTip = orderTotalForCheckout + Math.max(0, tipAmount)
    splitBreakdown = computeSplitBreakdown(
      refreshedOrder.items
        .filter(i => i.status !== 'CANCELLED')
        .map(i => ({
          id: i.id,
          quantity: i.quantity,
          unitPrice: moneyNumber(i.unitPrice),
          modifierTotal: i.modifiers?.reduce((s, m) => s + moneyNumber(m.price), 0) ?? 0,
        })),
      totalWithTip,
      split,
    )
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId! },
      include: { settings: true },
    })

    if (paymentMethod === 'SPLIT' && split && splitBreakdown && splitGuestIndex != null) {
      const { recordSplitGuestPayment } = await import('../lib/splitGuestPayment')
      const guestShare = splitBreakdown.guests[splitGuestIndex]?.share
      if (guestShare == null) {
        res.status(400).json({ error: 'Indice ospite split non valido', code: 'SPLIT_GUEST_INDEX_INVALID' })
        return
      }

      const checkoutTotal = orderTotalForCheckout + Math.max(0, tipAmount)
      const partial = await recordSplitGuestPayment({
        orderId,
        restaurantId: req.restaurantId!,
        breakdown: splitBreakdown,
        guestIndex: splitGuestIndex,
        amount: guestShare,
        checkoutTotal,
        executorUserId: req.userId,
        settlementMethod: splitSettlement ?? 'CASH',
      })

      if (!partial.fullyCollected) {
        const partialOrder = await loadOrderForCheckout(orderId, req.restaurantId!)
        const partialBody = {
          partial: true,
          remaining: partial.remaining,
          collectedAmount: partial.collectedAmount,
          splitBreakdown,
          order: partialOrder,
          fiscal: { row: null },
          receipt: { emailSent: false, emailTo: null },
        }
        if (idempotencyKey && req.restaurantId) {
          await saveIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /payments/finalize', 200, partialBody)
        }
        res.json(partialBody)
        return
      }
    }

    const { result, updatedOrder, posResult, emailSent } = await completeOrderPayment({
      finalize: {
        orderId,
        restaurantId: req.restaurantId!,
        tipAmount,
        tipWaiterId: validatedTipWaiterId,
        paymentMethod: settlementMethod,
        executorUserId: req.userId,
      },
      splitBreakdown,
      stripePaymentIntentId,
      receiptEmail: receiptEmail,
      restaurantName: restaurant?.name,
      serveItemsOnPayment: true,
      discountOptions,
    })

    // Return only the fields required by the frontend CheckoutFinalizeResult
    const responseBody = {
      transactionId: result.transactionId,
      order: updatedOrder,
      table: result.updatedTable,
      fiscal: {
        row: result.fiscalRow,
      },
      splitBreakdown: result.splitBreakdown,
      receipt: {
        emailSent,
        emailTo: receiptEmail ?? null,
      },
    }
    if (idempotencyKey && req.restaurantId) {
      void saveIdempotentResponse(req.restaurantId, idempotencyKey, 'POST /payments/finalize', 200, responseBody)
        .catch(err => console.error('[payments] idempotency save failed', err))
    }
    res.json(responseBody)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Ordine non trovato', code })
      return
    }
    if (code === 'ORDER_ALREADY_PAID') {
      res.status(400).json({ error: 'Ordine già pagato', code })
      return
    }
    if (code === 'ORDER_CANCELLED') {
      res.status(400).json({ error: 'Ordine annullato', code })
      return
    }
    if (code === 'STRIPE_PAYMENT_FAILED' || code === 'STRIPE_PAYMENT_INTENT_REQUIRED') {
      res.status(402).json({ error: 'Pagamento carta non riuscito', code })
      return
    }
    if (code === 'POS_SIMULATION_NOT_ALLOWED') {
      res.status(402).json({
        error: 'POS carta non configurato. Imposta POS_ALLOW_SIMULATION o collega Stripe Terminal.',
        code,
      })
      return
    }
    if (
      code === 'STRIPE_AMOUNT_MISMATCH'
      || code === 'STRIPE_AMOUNT_OVERPAY'
      || code === 'STRIPE_PI_ORDER_MISMATCH'
      || code === 'STRIPE_PI_TENANT_MISMATCH'
      || code === 'STRIPE_PI_ALREADY_USED'
    ) {
      res.status(402).json({ error: 'PaymentIntent non valido per questo ordine', code })
      return
    }
    if (code === 'CASH_SESSION_REQUIRED') {
      res.status(409).json({ error: 'Apri la cassa prima di incassare contanti.', code })
      return
    }
    if (code === 'CASH_USER_REQUIRED') {
      res.status(400).json({ error: 'Utente cassa non identificato.', code })
      return
    }
    if (code === 'PAYMENT_IN_PROGRESS') {
      res.status(409).json({ error: 'Pagamento già in elaborazione. Attendi qualche secondo e riprova.', code })
      return
    }
    throw err
  }
})

// ── Rimborso ordine pagato (Stripe o contanti) ───────────────────────────────
paymentsRouter.post(
  '/orders/:orderId/refund',
  authenticate,
  requireDashboardAccess,
  requirePermission('orders.pay'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const schema = z.object({
      amount: z.number().positive().optional(),
      reason: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body ?? {})
    if (!parsed.success) {
      res.status(400).json({ error: 'Dati non validi', code: 'VALIDATION_ERROR' })
      return
    }

    const restaurantId = req.restaurantId!
    const orderId = req.params.orderId

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId, status: 'PAID' },
      select: { paymentMethod: true },
    })
    if (!order) {
      res.status(404).json({ error: 'Ordine non trovato o non rimborsabile', code: 'ORDER_NOT_REFUNDABLE' })
      return
    }

    let cashSessionId: string | undefined
    if (order.paymentMethod === 'CASH') {
      const session = await prisma.cashRegisterSession.findFirst({
        where: { restaurantId, status: 'OPEN' },
        select: { id: true },
      })
      if (!session) {
        res.status(400).json({
          error: 'Apri un turno cassa per registrare il rimborso.',
          code: 'CASH_SESSION_REQUIRED',
        })
        return
      }
      cashSessionId = session.id
    }

    try {
      const { executeOrderRefund } = await import('../lib/orderRefund')
      const { refundAmount } = await executeOrderRefund({
        orderId,
        restaurantId,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        userId: req.userId,
        cashSessionId,
      })
      res.json({ success: true, refundAmount })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'ORDER_ALREADY_REFUNDED') {
        res.status(409).json({ error: 'Ordine già rimborsato', code })
        return
      }
      if (code === 'ORDER_NOT_REFUNDABLE') {
        res.status(404).json({ error: 'Ordine non rimborsabile', code })
        return
      }
      if (code === 'CASH_SESSION_REQUIRED') {
        res.status(400).json({ error: 'Apri un turno cassa per registrare il rimborso.', code })
        return
      }
      if (code === 'STRIPE_REFUND_UNAVAILABLE' || code === 'STRIPE_NOT_CONFIGURED') {
        res.status(400).json({ error: 'Rimborso carta non disponibile per questo ordine', code })
        return
      }
      if (code === 'STRIPE_REFUND_FAILED') {
        res.status(502).json({ error: 'Rimborso Stripe non riuscito', code })
        return
      }
      throw err
    }
  },
)

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

  let validatedTipWaiterId: string | undefined
  try {
    // Per pos-checkout, proviamo a ricaricare l'ordine per ottenere l'order.waiterId originale
    const posOrder = await prisma.order.findFirst({ where: { id: orderId, restaurantId: req.restaurantId! }, select: { waiterId: true } })
    validatedTipWaiterId = await resolveTipWaiterId(req.restaurantId!, tipWaiterId, req.userId, req.userRole, posOrder?.waiterId)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'UNAUTHORIZED_TIP_ASSIGNMENT') {
      res.status(403).json({ error: 'Non sei autorizzato ad assegnare mance ad altri colleghi', code })
      return
    }
    if (code === 'INVALID_TIP_WAITER') {
      res.status(400).json({ error: 'Cameriere non valido', code })
      return
    }
    throw err
  }

  try {
    const { result: payResult, updatedOrder, posResult } = await completeOrderPayment({
      finalize: {
        orderId,
        restaurantId: req.restaurantId!,
        tipAmount,
        tipWaiterId: validatedTipWaiterId,
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
      res.status(400).json({ error: 'Ordine già pagato', code })
      return
    }
    if (code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Ordine non trovato', code })
      return
    }
    if (code === 'ORDER_CANCELLED') {
      res.status(400).json({ error: 'Ordine annullato', code })
      return
    }
    if (code === 'PAYMENT_IN_PROGRESS') {
      res.status(409).json({ error: 'Pagamento già in elaborazione. Attendi qualche secondo e riprova.', code })
      return
    }
    if (code === 'STRIPE_PAYMENT_FAILED' || code === 'STRIPE_PAYMENT_INTENT_REQUIRED') {
      res.status(402).json({ error: 'Pagamento carta non riuscito', code })
      return
    }
    if (code === 'POS_SIMULATION_NOT_ALLOWED') {
      res.status(402).json({
        error: 'POS carta non configurato. Imposta POS_ALLOW_SIMULATION o collega Stripe Terminal.',
        code,
      })
      return
    }
    if (
      code === 'STRIPE_AMOUNT_MISMATCH'
      || code === 'STRIPE_AMOUNT_OVERPAY'
      || code === 'STRIPE_PI_ORDER_MISMATCH'
      || code === 'STRIPE_PI_TENANT_MISMATCH'
      || code === 'STRIPE_PI_ALREADY_USED'
    ) {
      res.status(402).json({ error: 'PaymentIntent non valido per questo ordine', code })
      return
    }
    if (code === 'CASH_SESSION_REQUIRED') {
      res.status(409).json({ error: 'Apri la cassa prima di incassare contanti.', code })
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

  const receiptToken = typeof req.query.receipt_token === 'string' ? req.query.receipt_token : null
  if (!receiptToken || !verifyOrderReceiptToken(receiptToken, orderId)) {
    res.status(403).json({ error: 'Token ricevuta richiesto o non valido' })
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
      order: {
        id: order.id,
        total: order.total,
        type: order.type,
        status: order.status,
        table: order.table ? { number: order.table.number } : null,
        items: order.items.map(i => ({
          id: i.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          menuItem: { name: i.menuItem.name },
        })),
      },
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

  const receiptToken = typeof req.query.receipt_token === 'string' ? req.query.receipt_token : null
  if (!receiptToken) {
    res.status(400).json({ error: 'receipt_token richiesto' })
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
    if (!verifyDepositReceiptToken(receiptToken, reservationId)) {
      res.status(403).json({ error: 'Token ricevuta non valido o scaduto' })
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
      fundsCaptured: reservation.depositPaid === true,
      guaranteeAmount: session.metadata?.depositAmount
        ? parseFloat(session.metadata.depositAmount)
        : undefined,
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

// ── Deposito caparra (legacy — disabilitato, usare flusso pubblico con checkoutUrl) ──
paymentsRouter.post('/deposit', depositLimiter, async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    error: 'Endpoint deprecato. Usa checkoutUrl dalla risposta POST /api/public/reservations.',
    code: 'DEPOSIT_ENDPOINT_DEPRECATED',
  })
})

// ── Dashboard pagamenti digitali (protetta) ───────────────────────────────────
paymentsRouter.get('/overview', authenticate, requirePermission('payments.overview'), requireDashboardAccess, requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  if (!restaurantId) {
    res.status(401).json({ error: 'Tenant non autenticato' })
    return
  }

  const [ranges, restaurant] = await Promise.all([
    loadTenantTimeRanges(restaurantId),
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, settings: { select: { stripeConnectAccountId: true, defaultLocale: true } } },
    }),
  ])
  const timeZone = restaurant?.timezone ?? ranges.timeZone
  const locale = restaurant?.settings?.defaultLocale ?? 'it-IT'
  const todayStr = calendarDateInTimezone(timeZone)
  const year = Number(todayStr.slice(0, 4))
  const month = Number(todayStr.slice(5, 7))
  const { start: monthStart } = buildMonthRangeInTimezone(year, month, timeZone)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const { start: monthEndExclusive } = buildMonthRangeInTimezone(nextYear, nextMonth, timeZone)
  const { start: yearStart } = buildMonthRangeInTimezone(year, 1, timeZone)
  const { start: yearEndExclusive } = buildMonthRangeInTimezone(year + 1, 1, timeZone)

  const digitalMethods: PaymentMethod[] = ['STRIPE', 'CARD', 'DIGITAL']
  const digitalBase = {
    restaurantId,
    status: 'PAID' as const,
    refundedAt: null,
    paymentMethod: { in: digitalMethods },
  }

  const [digitalOrders, monthStats, yearOrders, recentPayments] = await Promise.all([
    prisma.order.aggregate({
      where: digitalBase,
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: {
        ...paidRevenueOrderWhere(restaurantId, monthStart, monthEndExclusive),
        paymentMethod: { in: digitalMethods },
      },
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: {
        ...paidRevenueOrderWhere(restaurantId, yearStart, yearEndExclusive),
        paymentMethod: { in: digitalMethods },
      },
      select: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true, paidAt: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: digitalBase,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      include: { table: true, items: { include: { menuItem: true } } },
    }),
  ])

  const monthlyData: Record<string, { month: string; amount: number; count: number }> = {}
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const label = new Date(year, m - 1, 1).toLocaleString(locale, { month: 'short', timeZone })
    monthlyData[key] = { month: label, amount: 0, count: 0 }
  }
  for (const order of yearOrders) {
    const paid = order.paidAt ?? order.createdAt
    const key = calendarDateInTimezone(timeZone, paid).slice(0, 7)
    if (monthlyData[key]) {
      monthlyData[key].amount += resolveRevenueAmount(order)
      monthlyData[key].count += 1
    }
  }

  res.json({
    totale: { amount: sumFoodFromMoneyAgg(digitalOrders), count: digitalOrders._count?._all ?? 0 },
    mese: { amount: sumFoodFromMoneyAgg(monthStats), count: monthStats._count?._all ?? 0 },
    mensile: Object.values(monthlyData),
    recentPayments: recentPayments.map(order => ({
      id: order.id,
      total: order.total,
      paidAt: order.paidAt,
      type: order.type,
      table: order.table,
      items: order.items.map(item => ({
        quantity: item.quantity,
        menuItem: item.menuItem
          ? { name: item.menuItem.name }
          : { name: 'Piatto rimosso' },
      })),
    })),
    stripeEnabled: STRIPE_ENABLED,
    stripeConnectAccountId: restaurant?.settings?.stripeConnectAccountId ?? null,
  })
})

paymentsRouter.post('/connect-onboarding', authenticate, requireDashboardAccess, requirePermission('payments.overview'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
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
    const originStr = resolveFrontendOrigin(req.headers.origin)

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${originStr}/pagamenti?connect=refresh`,
      return_url: `${originStr}/pagamenti?connect=success`,
      type: 'account_onboarding',
    })

    res.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect Onboarding Error:', err)
    res.status(500).json({ error: 'Errore creazione onboarding Stripe' })
  }
})
