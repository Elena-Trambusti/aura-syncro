import { io } from '../index'
import { prisma } from './prisma'
import {
  finalizeOrderPayment,
  type FinalizePaymentInput,
  type SplitBreakdown,
  type PrecomputedOrderTotals,
} from './orderPayment'
import { chargePosCard } from './posCharge'
import { loadRestaurantFiscalConfig } from './taxEngine'
import { loadRestaurantPosConfig } from './posIntegration'
import { computePosPaymentAmounts, type OrderAmounts } from './tipFiscal'
import { resolveDiscountForOrder } from './orderDiscount'
import { acquireIdempotencyLock, releaseIdempotencyLock, saveIdempotentResponse } from './apiIdempotency'
import { stripe, STRIPE_ENABLED } from './stripe'
import { moneyNumber } from './money'
import { runPaymentSideEffects, schedulePaymentSideEffects } from './paymentSideEffects'
import { cancelAbandonedGuestOrder } from './abandonedGuestCheckout'

function paymentLockKey(orderId: string): string {
  return `payment:finalize:${orderId}`
}

function paymentFailureKey(orderId: string): string {
  return `payment:failure:${orderId}`
}

/** Side-effects dopo PAID: non far fallire l'HTTP se magazzino/fattura falliscono — ritenta in background. */
async function runSideEffectsSafe(
  input: Parameters<typeof runPaymentSideEffects>[0],
): Promise<void> {
  try {
    await runPaymentSideEffects(input)
  } catch (err) {
    console.error('[payment] Side-effects falliti dopo PAID — retry in background', {
      orderId: input.orderId,
      error: err instanceof Error ? err.message : err,
    })
    schedulePaymentSideEffects(input)
  }
}

/** Socket post-incasso — non blocca la risposta HTTP. */
function schedulePaymentRealtimeEmit(
  restaurantId: string,
  updatedTable: { id: string; number: number; status: string } | null | undefined,
  updatedOrder: unknown,
): void {
  setImmediate(() => {
    if (updatedTable) {
      io.to(restaurantId).emit('table:updated', updatedTable)
    }
    io.to(restaurantId).emit('order:updated', updatedOrder)
  })
}

export async function completeOrderPayment(input: {
  finalize: FinalizePaymentInput
  splitBreakdown?: SplitBreakdown
  stripePaymentIntentId?: string
  receiptEmail?: string
  restaurantName?: string
  serveItemsOnPayment?: boolean
  discountOptions?: { applyLoyalty?: boolean; discountCode?: string }
}) {
  const orderPreview = await prisma.order.findFirst({
    where: { id: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
    include: { items: true },
  })

  if (!orderPreview) throw new Error('ORDER_NOT_FOUND')
  if (orderPreview.status === 'PAID') throw new Error('ORDER_ALREADY_PAID')
  if (orderPreview.status === 'CANCELLED') throw new Error('ORDER_CANCELLED')

  const lockKey = paymentLockKey(input.finalize.orderId)
  const lockAcquired = await acquireIdempotencyLock(
    input.finalize.restaurantId,
    lockKey,
    'PAYMENT_FINALIZE',
  )
  if (!lockAcquired) {
    const current = await prisma.order.findFirst({
      where: { id: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
      select: { status: true },
    })
    if (current?.status === 'PAID') throw new Error('ORDER_ALREADY_PAID')
    throw new Error('PAYMENT_IN_PROGRESS')
  }

  const fiscal = await loadRestaurantFiscalConfig(input.finalize.restaurantId)

  let orderAmounts: OrderAmounts = orderPreview
  let precomputedTotals: PrecomputedOrderTotals | undefined

  if (input.discountOptions) {
    const { totals } = await resolveDiscountForOrder(
      input.finalize.restaurantId,
      orderPreview,
      input.discountOptions,
    )
    orderAmounts = {
      revenueAmount: totals.revenueAmount,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      tipAmount: orderPreview.tipAmount,
    }
    precomputedTotals = {
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      discountAmount: totals.discountAmount,
      revenueAmount: totals.revenueAmount,
      taxRateApplied: totals.taxRateApplied,
    }
  }

  let posResult: Awaited<ReturnType<typeof chargePosCard>> | null = null
  let chargedAmount = 0

  /** After split cash, CARD/EXTERNAL must charge only the remaining balance. */
  const priorCollected = moneyNumber(orderPreview.collectedAmount)
  const fullPosAmounts = computePosPaymentAmounts(fiscal, orderAmounts, input.finalize.tipAmount)
  const remainingDue = Math.max(
    0,
    Math.round((fullPosAmounts.totalCustomerAmount - priorCollected) * 100) / 100,
  )
  const tipPortion = Math.min(fullPosAmounts.tipChargeAmount, remainingDue)
  const taxablePortion = Math.max(0, Math.round((remainingDue - tipPortion) * 100) / 100)
  const chargeAmounts = {
    taxableAmount: taxablePortion,
    tipAmount: tipPortion,
    totalCustomerAmount: remainingDue,
    taxRegion: fiscal.taxRegion,
  }

  try {
    if (input.finalize.paymentMethod === 'CARD') {
      chargedAmount = remainingDue
      const posConfig = await loadRestaurantPosConfig(input.finalize.restaurantId)

      // POS esterno: finalizza prima (incasso già avvenuto sul terminale fisico).
      if (posConfig.mode === 'EXTERNAL') {
        const result = await finalizeOrderPayment(input.finalize, {
          splitBreakdown: input.splitBreakdown,
          serveItemsOnPayment: input.serveItemsOnPayment,
          precomputedTotals,
          fiscalConfig: fiscal,
        })
        const { updatedOrder } = result

        if (remainingDue > 0.009) {
          posResult = await chargePosCard(
            chargeAmounts,
            { orderId: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
            input.stripePaymentIntentId,
          )
        }

        schedulePaymentRealtimeEmit(input.finalize.restaurantId, result.updatedTable, updatedOrder)

        await runSideEffectsSafe({
          orderId: input.finalize.orderId,
          restaurantId: input.finalize.restaurantId,
          paidAt: result.paidAt,
          serveItemsOnPayment: input.serveItemsOnPayment !== false,
          transactionId: result.transactionId,
          total: result.total,
          receiptEmail: input.receiptEmail,
          restaurantName: input.restaurantName,
          stripePaymentIntentId: posResult?.stripePaymentIntentId ?? input.stripePaymentIntentId,
        })

        void saveIdempotentResponse(
          input.finalize.restaurantId,
          lockKey,
          'PAYMENT_FINALIZE',
          200,
          { orderId: input.finalize.orderId, completed: true },
        ).catch(err => console.error('[payment] idempotency save failed', err))

        return {
          result,
          updatedOrder,
          posResult,
          emailSent: Boolean(input.receiptEmail),
        }
      }

      if (remainingDue > 0.009) {
        posResult = await chargePosCard(
          chargeAmounts,
          { orderId: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
          input.stripePaymentIntentId,
        )
      }
    }

    const result = await finalizeOrderPayment(input.finalize, {
      splitBreakdown: input.splitBreakdown,
      serveItemsOnPayment: input.serveItemsOnPayment,
      precomputedTotals,
      fiscalConfig: fiscal,
    })

    const { updatedOrder } = result

    schedulePaymentRealtimeEmit(input.finalize.restaurantId, result.updatedTable, updatedOrder)

    await runSideEffectsSafe({
      orderId: input.finalize.orderId,
      restaurantId: input.finalize.restaurantId,
      paidAt: result.paidAt,
      serveItemsOnPayment: input.serveItemsOnPayment !== false,
      transactionId: result.transactionId,
      total: result.total,
      receiptEmail: input.receiptEmail,
      restaurantName: input.restaurantName,
      stripePaymentIntentId: posResult?.stripePaymentIntentId ?? input.stripePaymentIntentId,
    })

    const emailSent = Boolean(input.receiptEmail)

    void saveIdempotentResponse(
      input.finalize.restaurantId,
      lockKey,
      'PAYMENT_FINALIZE',
      200,
      { orderId: input.finalize.orderId, completed: true },
    ).catch(err => console.error('[payment] idempotency save failed', err))

    return { result, updatedOrder, posResult, emailSent }
  } catch (err) {
    const stripeIntentToRefund =
      posResult?.stripePaymentIntentId
      ?? (input.finalize.paymentMethod === 'STRIPE' ? input.stripePaymentIntentId : undefined)
    if (stripeIntentToRefund) {
      const message = err instanceof Error ? err.message : 'UNKNOWN'
      if (posResult?.provider === 'stripe' || input.finalize.paymentMethod === 'STRIPE') {
        await stripe.refunds.create({
          payment_intent: stripeIntentToRefund,
          reason: 'requested_by_customer',
          metadata: {
            orderId: input.finalize.orderId,
            restaurantId: input.finalize.restaurantId,
            reason: 'finalize_failed_auto_refund',
          },
        }).catch(refundErr => {
          console.error('[payment] Failed to auto-refund orphan charge', {
            orderId: input.finalize.orderId,
            stripePaymentIntentId: stripeIntentToRefund,
            error: refundErr instanceof Error ? refundErr.message : refundErr,
          })
        })
      }
      await saveIdempotentResponse(
        input.finalize.restaurantId,
        paymentFailureKey(input.finalize.orderId),
        'PAYMENT_CHARGE_ORPHAN',
        402,
        {
          orderId: input.finalize.orderId,
          stripePaymentIntentId: stripeIntentToRefund,
          amount: chargedAmount,
          error: message,
        },
      ).catch(logErr => console.error('[payment] Failed to persist charge orphan log', logErr))
      console.error('[payment] Charge succeeded but finalize failed', {
        orderId: input.finalize.orderId,
        stripePaymentIntentId: stripeIntentToRefund,
        amount: chargedAmount,
        error: message,
      })

      // Se l'ordine è già PAID (side-effects falliti dopo finalize), allinea lo storno fiscale/CRM.
      const paidOrphan = await prisma.order.findFirst({
        where: {
          id: input.finalize.orderId,
          restaurantId: input.finalize.restaurantId,
          status: 'PAID',
          refundedAt: null,
        },
        select: { id: true, total: true },
      })
      if (paidOrphan) {
        try {
          const { markOrderRefunded } = await import('./orderRefund')
          await prisma.$transaction(async tx =>
            markOrderRefunded(
              paidOrphan.id,
              input.finalize.restaurantId,
              chargedAmount > 0 ? chargedAmount : moneyNumber(paidOrphan.total),
              tx,
            ),
          )
        } catch (markErr) {
          console.error('[payment] Failed to mark orphan PAID order as refunded', {
            orderId: input.finalize.orderId,
            error: markErr instanceof Error ? markErr.message : markErr,
          })
        }
      }
    }
    await releaseIdempotencyLock(input.finalize.restaurantId, lockKey)
    throw err
  }
}

/** Webhook guest Stripe → stesso flusso di finalize. */
export async function completeGuestStripePayment(
  orderId: string,
  paymentIntentId?: string | null,
  stripeAmountTotalCents?: number | null,
  checkoutSessionId?: string | null,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return null

  if (order.status === 'PAID') return null

  if (checkoutSessionId) {
    const expected = order.stripeSessionId
    const isPendingClaim = typeof expected === 'string' && expected.startsWith('pending_')
    if (expected && expected !== checkoutSessionId && !isPendingClaim) {
      console.warn('[guest-stripe] Session ID mismatch — ignore', {
        orderId,
        expected,
        got: checkoutSessionId,
      })
      return null
    }
    // Claim session id (covers race: webhook before publicCheckout persisted session.id).
    await prisma.order.updateMany({
      where: {
        id: orderId,
        OR: [
          { stripeSessionId: null },
          { stripeSessionId: { startsWith: 'pending_' } },
          { stripeSessionId: checkoutSessionId },
        ],
      },
      data: { stripeSessionId: checkoutSessionId },
    })
  }

  if (order.status === 'CANCELLED') {
    if (paymentIntentId && STRIPE_ENABLED) {
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          orderId,
          restaurantId: order.restaurantId,
          reason: 'guest_paid_after_order_cancelled',
        },
      }).catch(refundErr => {
        console.error('[guest-stripe] Auto-refund su ordine CANCELLED fallito', {
          orderId,
          paymentIntentId,
          error: refundErr instanceof Error ? refundErr.message : refundErr,
        })
      })
    }
    return null
  }

  const autoRefund = async (reason: string) => {
    if (!paymentIntentId || !STRIPE_ENABLED) return
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: { orderId, restaurantId: order.restaurantId, reason },
    }).catch(refundErr => {
      console.error('[guest-stripe] Auto-refund fallito', {
        orderId,
        paymentIntentId,
        reason,
        error: refundErr instanceof Error ? refundErr.message : refundErr,
      })
    })
  }

  let amountCents = stripeAmountTotalCents ?? null
  if (amountCents == null && paymentIntentId && STRIPE_ENABLED) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      amountCents = typeof pi.amount_received === 'number' && pi.amount_received > 0
        ? pi.amount_received
        : pi.amount
    } catch (err) {
      console.error('[guest-stripe] Impossibile leggere importo PaymentIntent', paymentIntentId, err)
      await autoRefund('guest_pi_amount_unreadable')
      await cancelAbandonedGuestOrder(orderId).catch(() => {})
      throw new Error('STRIPE_AMOUNT_MISMATCH')
    }
  }
  if (amountCents == null) {
    await autoRefund('guest_pi_amount_missing')
    await cancelAbandonedGuestOrder(orderId).catch(() => {})
    throw new Error('STRIPE_AMOUNT_MISMATCH')
  }

  const expectedCents = Math.round(moneyNumber(order.total) * 100)
  if (amountCents < expectedCents || amountCents > expectedCents + 1) {
    const code = amountCents < expectedCents ? 'STRIPE_AMOUNT_MISMATCH' : 'STRIPE_AMOUNT_OVERPAY'
    await autoRefund(`guest_${code.toLowerCase()}`)
    await cancelAbandonedGuestOrder(orderId).catch(() => {})
    throw new Error(code)
  }

  try {
    return await completeOrderPayment({
      finalize: {
        orderId,
        restaurantId: order.restaurantId,
        paymentMethod: 'STRIPE',
        tipAmount: moneyNumber(order.tipAmount),
      },
      serveItemsOnPayment: false,
      stripePaymentIntentId: paymentIntentId ?? undefined,
    })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    // Non rimborsare se l'ordine è già chiuso o un altro worker sta finalizzando.
    if (code === 'ORDER_ALREADY_PAID' || code === 'PAYMENT_IN_PROGRESS') {
      return null
    }
    await autoRefund('guest_finalize_failed_auto_refund')
    await cancelAbandonedGuestOrder(orderId).catch(cancelErr => {
      console.error('[guest-stripe] Cancellazione ordine guest fallita', {
        orderId,
        error: cancelErr instanceof Error ? cancelErr.message : cancelErr,
      })
    })
    throw err
  }
}
