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
import { stripe } from './stripe'
import { moneyNumber } from './money'
import { schedulePaymentSideEffects } from './paymentSideEffects'

function paymentLockKey(orderId: string): string {
  return `payment:finalize:${orderId}`
}

function paymentFailureKey(orderId: string): string {
  return `payment:failure:${orderId}`
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

  try {
    if (input.finalize.paymentMethod === 'CARD') {
      const posAmounts = computePosPaymentAmounts(fiscal, orderAmounts, input.finalize.tipAmount)
      chargedAmount = posAmounts.totalCustomerAmount
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

        posResult = await chargePosCard(
          {
            taxableAmount: posAmounts.taxableChargeAmount,
            tipAmount: posAmounts.tipChargeAmount,
            totalCustomerAmount: posAmounts.totalCustomerAmount,
            taxRegion: fiscal.taxRegion,
          },
          { orderId: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
          input.stripePaymentIntentId,
        )

        if (result.updatedTable) {
          io.to(input.finalize.restaurantId).emit('table:updated', result.updatedTable)
        }
        io.to(input.finalize.restaurantId).emit('order:updated', updatedOrder)

        schedulePaymentSideEffects({
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

        await saveIdempotentResponse(
          input.finalize.restaurantId,
          lockKey,
          'PAYMENT_FINALIZE',
          200,
          { orderId: input.finalize.orderId, completed: true },
        )

        return {
          result,
          updatedOrder,
          posResult,
          emailSent: Boolean(input.receiptEmail),
        }
      }

      posResult = await chargePosCard(
        {
          taxableAmount: posAmounts.taxableChargeAmount,
          tipAmount: posAmounts.tipChargeAmount,
          totalCustomerAmount: posAmounts.totalCustomerAmount,
          taxRegion: fiscal.taxRegion,
        },
        { orderId: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
        input.stripePaymentIntentId,
      )
    }

    const result = await finalizeOrderPayment(input.finalize, {
      splitBreakdown: input.splitBreakdown,
      serveItemsOnPayment: input.serveItemsOnPayment,
      precomputedTotals,
      fiscalConfig: fiscal,
    })

    const { updatedOrder } = result

    if (result.updatedTable) {
      io.to(input.finalize.restaurantId).emit('table:updated', result.updatedTable)
    }
    io.to(input.finalize.restaurantId).emit('order:updated', updatedOrder)

    schedulePaymentSideEffects({
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

    await saveIdempotentResponse(
      input.finalize.restaurantId,
      lockKey,
      'PAYMENT_FINALIZE',
      200,
      { orderId: input.finalize.orderId, completed: true },
    )

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
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status === 'PAID' || order.status === 'CANCELLED') return null

  if (stripeAmountTotalCents != null) {
    const expectedCents = Math.round(Math.round(moneyNumber(order.total) * 100) / 100 * 100)
    if (stripeAmountTotalCents < expectedCents) {
      throw new Error('STRIPE_AMOUNT_MISMATCH')
    }
    if (stripeAmountTotalCents > expectedCents + 1) {
      throw new Error('STRIPE_AMOUNT_OVERPAY')
    }
  }

  return completeOrderPayment({
    finalize: {
      orderId,
      restaurantId: order.restaurantId,
      paymentMethod: 'STRIPE',
      tipAmount: moneyNumber(order.tipAmount),
    },
    serveItemsOnPayment: false,
    stripePaymentIntentId: paymentIntentId ?? undefined,
  })
}
