import { io } from '../index'
import { prisma } from './prisma'
import {
  finalizeOrderPayment,
  releaseTableIfEmpty,
  type FinalizePaymentInput,
  type SplitBreakdown,
} from './orderPayment'
import { occupyTableForSessionOrder } from './orderSession'
import { chargePosCard } from './posCharge'
import { sendEmail } from './email'
import { loadRestaurantFiscalConfig } from './taxEngine'
import { computePosPaymentAmounts } from './tipFiscal'
import { applyDiscountToOrder, resolveDiscountForOrder } from './orderDiscount'
import { acquireIdempotencyLock, releaseIdempotencyLock, saveIdempotentResponse } from './apiIdempotency'

const posOrderInclude = {
  table: true,
  items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' as const } },
}

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
  /** false per ordini guest prepagati Stripe: la cucina deve ancora preparare i piatti */
  serveItemsOnPayment?: boolean
  /** Applicato solo dopo incasso riuscito (evita sconto su pagamento fallito) */
  discountOptions?: { applyLoyalty?: boolean; discountCode?: string }
}) {
  const [orderPreview, fiscal] = await Promise.all([
    prisma.order.findFirst({
      where: { id: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
      include: { items: true },
    }),
    loadRestaurantFiscalConfig(input.finalize.restaurantId),
  ])

  if (!orderPreview) {
    throw new Error('ORDER_NOT_FOUND')
  }
  if (orderPreview.status === 'PAID') {
    throw new Error('ORDER_ALREADY_PAID')
  }
  if (orderPreview.status === 'CANCELLED') {
    throw new Error('ORDER_CANCELLED')
  }

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

  let chargeOrder = orderPreview
  if (input.discountOptions) {
    const { totals } = await resolveDiscountForOrder(
      input.finalize.restaurantId,
      orderPreview,
      input.discountOptions,
    )
    chargeOrder = { ...orderPreview, ...totals }
  }

  let posResult: Awaited<ReturnType<typeof chargePosCard>> | null = null
  let chargedAmount = 0

  try {
    if (input.discountOptions) {
      await applyDiscountToOrder(
        input.finalize.orderId,
        input.finalize.restaurantId,
        input.discountOptions,
      )
      const refreshed = await prisma.order.findFirst({
        where: { id: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
        include: { items: true },
      })
      if (refreshed) chargeOrder = refreshed
    }

    if (input.finalize.paymentMethod === 'CARD') {
      const posAmounts = computePosPaymentAmounts(fiscal, chargeOrder, input.finalize.tipAmount)
      chargedAmount = posAmounts.totalCustomerAmount

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
    })

    if (posResult?.stripePaymentIntentId) {
      await prisma.order.update({
        where: { id: input.finalize.orderId },
        data: { stripePaymentIntent: posResult.stripePaymentIntentId },
      })
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: input.finalize.orderId },
      include: posOrderInclude,
    })

    let occupiedTable: Awaited<ReturnType<typeof occupyTableForSessionOrder>> = null
    if (updatedOrder?.tableId && input.serveItemsOnPayment === false) {
      occupiedTable = await prisma.$transaction(async tx =>
        occupyTableForSessionOrder(tx, updatedOrder.tableId!, input.finalize.restaurantId, updatedOrder.id),
      )
    }

    const releasedTable = await releaseTableIfEmpty(updatedOrder?.tableId)
    if (occupiedTable) {
      io.to(input.finalize.restaurantId).emit('table:updated', occupiedTable)
    } else if (releasedTable) {
      io.to(input.finalize.restaurantId).emit('table:updated', releasedTable)
    }

    if (updatedOrder) {
      io.to(input.finalize.restaurantId).emit('order:updated', updatedOrder)
      if (input.serveItemsOnPayment === false) {
        io.to(input.finalize.restaurantId).emit('order:created', updatedOrder)
        io.to(input.finalize.restaurantId).emit('print:kitchen', { type: 'kitchen', order: updatedOrder })
      }
      io.to(input.finalize.restaurantId).emit('print:receipt', { type: 'receipt', order: updatedOrder })
    }

    let emailSent = false
    if (input.receiptEmail) {
      sendEmail({
        to: input.receiptEmail,
        subject: `Ricevuta — ${input.restaurantName ?? 'Aura Syncro'}`,
        text: `Grazie per la visita!\nTotale: €${result.total.toFixed(2)}\nTransazione: ${result.transactionId}`,
      }).catch(err => console.error('Failed to send async receipt:', err))
      emailSent = true
    }

    await saveIdempotentResponse(
      input.finalize.restaurantId,
      lockKey,
      'PAYMENT_FINALIZE',
      200,
      { orderId: input.finalize.orderId, completed: true },
    )

    return { result, updatedOrder, posResult, emailSent }
  } catch (err) {
    if (posResult?.stripePaymentIntentId) {
      const message = err instanceof Error ? err.message : 'UNKNOWN'
      await saveIdempotentResponse(
        input.finalize.restaurantId,
        paymentFailureKey(input.finalize.orderId),
        'PAYMENT_CHARGE_ORPHAN',
        402,
        {
          orderId: input.finalize.orderId,
          stripePaymentIntentId: posResult.stripePaymentIntentId,
          amount: chargedAmount,
          error: message,
        },
      ).catch(logErr => console.error('[payment] Failed to persist charge orphan log', logErr))
      console.error('[payment] Charge succeeded but finalize failed', {
        orderId: input.finalize.orderId,
        stripePaymentIntentId: posResult.stripePaymentIntentId,
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
    const expectedCents = Math.round(order.total * 100)
    if (stripeAmountTotalCents < expectedCents) {
      throw new Error('STRIPE_AMOUNT_MISMATCH')
    }
    if (stripeAmountTotalCents > expectedCents + 1) {
      throw new Error('STRIPE_AMOUNT_OVERPAY')
    }
  }

  if (paymentIntentId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentIntent: paymentIntentId },
    })
  }

  return completeOrderPayment({
    finalize: {
      orderId,
      restaurantId: order.restaurantId,
      paymentMethod: 'STRIPE',
      tipAmount: order.tipAmount ?? 0,
    },
    serveItemsOnPayment: false,
    stripePaymentIntentId: paymentIntentId ?? undefined,
  })
}
