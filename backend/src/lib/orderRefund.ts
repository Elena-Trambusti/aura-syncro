import type { PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { moneyNumber, toMoney } from './money'
import { reversePostPaymentEffects } from './postPayment'
import { stripe, STRIPE_ENABLED } from './stripe'

type DbClient = Prisma.TransactionClient | typeof prisma

const DIGITAL_METHODS: PaymentMethod[] = ['STRIPE', 'CARD', 'DIGITAL']

/** Rimborso Stripe se presente PaymentIntent (idempotente se già rimborsato). */
export async function refundStripePaymentIntent(
  stripePaymentIntent: string,
  metadata: Record<string, string>,
): Promise<void> {
  if (!STRIPE_ENABLED) {
    throw Object.assign(new Error('STRIPE_NOT_CONFIGURED'), { code: 'STRIPE_NOT_CONFIGURED' })
  }
  try {
    await stripe.refunds.create({
      payment_intent: stripePaymentIntent,
      reason: 'requested_by_customer',
      metadata,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/already been refunded|has already been refunded/i.test(message)) return
    throw Object.assign(new Error('STRIPE_REFUND_FAILED'), {
      code: 'STRIPE_REFUND_FAILED',
      cause: err,
    })
  }
}

/** Registra rimborso ordine — esclude dai KPI revenue. */
export async function markOrderRefunded(
  orderId: string,
  restaurantId: string,
  amount: number,
  db: DbClient = prisma,
): Promise<void> {
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId, status: 'PAID' },
    select: { id: true, total: true, refundedAt: true },
  })
  if (!order) {
    throw Object.assign(new Error('ORDER_NOT_REFUNDABLE'), { code: 'ORDER_NOT_REFUNDABLE' })
  }
  if (order.refundedAt) {
    throw Object.assign(new Error('ORDER_ALREADY_REFUNDED'), { code: 'ORDER_ALREADY_REFUNDED' })
  }

  const refundAmount = Math.min(amount, moneyNumber(order.total))
  await db.order.updateMany({
    where: { id: orderId, restaurantId },
    data: {
      refundedAt: new Date(),
      refundAmount: toMoney(refundAmount),
    },
  })
  await reversePostPaymentEffects(orderId, restaurantId, db)
}

export type ExecuteOrderRefundInput = {
  orderId: string
  restaurantId: string
  amount?: number
  reason?: string
  userId?: string
  cashSessionId?: string
}

/**
 * Rimborso unificato: Stripe (CARD/STRIPE/DIGITAL) o contanti (registra movimento cassa).
 * Stripe viene rimborsato prima della transazione DB; contanti tutto in transazione.
 */
export async function executeOrderRefund(input: ExecuteOrderRefundInput): Promise<{ refundAmount: number }> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId, status: 'PAID' },
    select: {
      id: true,
      total: true,
      refundedAt: true,
      paymentMethod: true,
      stripePaymentIntent: true,
    },
  })
  if (!order) {
    throw Object.assign(new Error('ORDER_NOT_REFUNDABLE'), { code: 'ORDER_NOT_REFUNDABLE' })
  }
  if (order.refundedAt) {
    throw Object.assign(new Error('ORDER_ALREADY_REFUNDED'), { code: 'ORDER_ALREADY_REFUNDED' })
  }

  const refundAmount = Math.min(input.amount ?? moneyNumber(order.total), moneyNumber(order.total))
  const isDigital =
    order.paymentMethod != null && DIGITAL_METHODS.includes(order.paymentMethod)

  if (isDigital) {
    if (!order.stripePaymentIntent) {
      throw Object.assign(new Error('STRIPE_REFUND_UNAVAILABLE'), { code: 'STRIPE_REFUND_UNAVAILABLE' })
    }
    await refundStripePaymentIntent(order.stripePaymentIntent, {
      orderId: order.id,
      restaurantId: input.restaurantId,
      reason: input.reason ?? 'staff_refund',
    })
    await prisma.$transaction(async tx => {
      await markOrderRefunded(order.id, input.restaurantId, refundAmount, tx)
    })
    return { refundAmount }
  }

  if (order.paymentMethod === 'CASH') {
    if (!input.cashSessionId || !input.userId) {
      throw Object.assign(new Error('CASH_SESSION_REQUIRED'), { code: 'CASH_SESSION_REQUIRED' })
    }
    const cashSessionId = input.cashSessionId
    const userId = input.userId
    await prisma.$transaction(async tx => {
      await markOrderRefunded(order.id, input.restaurantId, refundAmount, tx)
      await tx.cashTransaction.create({
        data: {
          sessionId: cashSessionId,
          userId,
          type: 'REFUND',
          amount: toMoney(refundAmount),
          reason: input.reason ?? `Rimborso ordine #${order.id.slice(-6).toUpperCase()}`,
          orderId: order.id,
        },
      })
    })
    return { refundAmount }
  }

  throw Object.assign(new Error('ORDER_NOT_REFUNDABLE'), { code: 'ORDER_NOT_REFUNDABLE' })
}
