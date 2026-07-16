import type { PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { moneyNumber, toMoney } from './money'
import { reversePostPaymentEffects } from './postPayment'
import { updateCustomerTier } from './loyaltyHelpers'
import { stripe, STRIPE_ENABLED } from './stripe'

type DbClient = Prisma.TransactionClient | typeof prisma

const DIGITAL_METHODS: PaymentMethod[] = ['STRIPE', 'CARD', 'DIGITAL']

/** Rimborso Stripe (importo in euro → cents). Idempotente se già rimborsato. */
export async function refundStripePaymentIntent(
  stripePaymentIntent: string,
  metadata: Record<string, string>,
  amountEuro?: number,
): Promise<void> {
  if (!STRIPE_ENABLED) {
    throw Object.assign(new Error('STRIPE_NOT_CONFIGURED'), { code: 'STRIPE_NOT_CONFIGURED' })
  }
  try {
    const payload: {
      payment_intent: string
      reason: 'requested_by_customer'
      metadata: Record<string, string>
      amount?: number
    } = {
      payment_intent: stripePaymentIntent,
      reason: 'requested_by_customer',
      metadata,
    }
    if (amountEuro != null && Number.isFinite(amountEuro)) {
      payload.amount = Math.round(amountEuro * 100)
    }
    await stripe.refunds.create(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/already been refunded|has already been refunded/i.test(message)) return
    throw Object.assign(new Error('STRIPE_REFUND_FAILED'), {
      code: 'STRIPE_REFUND_FAILED',
      cause: err,
    })
  }
}

/** Marca ordine rimborsato in modo atomico (dove refundedAt è ancora null). */
export async function markOrderRefunded(
  orderId: string,
  restaurantId: string,
  amount: number,
  db: DbClient = prisma,
): Promise<{ customerId: string; loyaltyPoints: number } | null> {
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
  const updated = await db.order.updateMany({
    where: { id: orderId, restaurantId, status: 'PAID', refundedAt: null },
    data: {
      refundedAt: new Date(),
      refundAmount: toMoney(refundAmount),
    },
  })
  if (updated.count === 0) {
    throw Object.assign(new Error('ORDER_ALREADY_REFUNDED'), { code: 'ORDER_ALREADY_REFUNDED' })
  }

  await db.invoice.updateMany({
    where: { orderId, restaurantId },
    data: { statoSdi: 'refunded' },
  }).catch(() => {
    /* invoice opzionale */
  })

  return reversePostPaymentEffects(orderId, restaurantId, db)
}

async function syncTierAfterRefund(
  restaurantId: string,
  reversal: { customerId: string; loyaltyPoints: number } | null,
): Promise<void> {
  if (!reversal) return
  await updateCustomerTier(restaurantId, reversal.customerId, reversal.loyaltyPoints)
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
 * Rimborso unificato. Supporta solo rimborso intero (o amount ≈ total).
 * Gestisce anche settlement misto (split cash + saldo CARD).
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
      collectedAmount: true,
    },
  })
  if (!order) {
    throw Object.assign(new Error('ORDER_NOT_REFUNDABLE'), { code: 'ORDER_NOT_REFUNDABLE' })
  }
  if (order.refundedAt) {
    throw Object.assign(new Error('ORDER_ALREADY_REFUNDED'), { code: 'ORDER_ALREADY_REFUNDED' })
  }

  const orderTotal = moneyNumber(order.total)
  const refundAmount = Math.min(input.amount ?? orderTotal, orderTotal)
  if (Math.abs(refundAmount - orderTotal) > 0.009) {
    throw Object.assign(new Error('PARTIAL_REFUND_NOT_SUPPORTED'), {
      code: 'PARTIAL_REFUND_NOT_SUPPORTED',
    })
  }

  const cashSales = await prisma.cashTransaction.aggregate({
    where: { orderId: order.id, type: 'SALE' },
    _sum: { amount: true },
  })
  const cashPart = Math.min(orderTotal, moneyNumber(cashSales._sum.amount))
  const hasStripe = Boolean(order.stripePaymentIntent)
  const stripePart = hasStripe
    ? Math.max(0, Math.round((orderTotal - cashPart) * 100) / 100)
    : 0

  const isDigital =
    order.paymentMethod != null && DIGITAL_METHODS.includes(order.paymentMethod)

  // Mixed: cash SALE rows + Stripe residual (or pure digital with no cash).
  if (isDigital && hasStripe) {
    if (cashPart > 0.009 && (!input.cashSessionId || !input.userId)) {
      throw Object.assign(new Error('CASH_SESSION_REQUIRED'), {
        code: 'CASH_SESSION_REQUIRED',
        message: 'Rimborso misto: serve cassa aperta per la quota contanti',
      })
    }

    const stripeRefundAmount = stripePart > 0.009 ? stripePart : refundAmount
    await refundStripePaymentIntent(
      order.stripePaymentIntent!,
      {
        orderId: order.id,
        restaurantId: input.restaurantId,
        reason: input.reason ?? 'staff_refund',
      },
      stripePart > 0.009 ? stripePart : refundAmount,
    )

    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const reversal = await prisma.$transaction(async tx => {
          if (cashPart > 0.009 && input.cashSessionId && input.userId) {
            const open = await tx.cashRegisterSession.findFirst({
              where: { id: input.cashSessionId, restaurantId: input.restaurantId, status: 'OPEN' },
            })
            if (!open) {
              throw Object.assign(new Error('CASH_SESSION_CLOSED'), { code: 'CASH_SESSION_CLOSED' })
            }
            await tx.cashTransaction.create({
              data: {
                sessionId: open.id,
                userId: input.userId,
                type: 'REFUND',
                amount: toMoney(cashPart),
                reason: input.reason ?? `Rimborso contanti ordine #${order.id.slice(-6).toUpperCase()}`,
                orderId: order.id,
              },
            })
          }
          return markOrderRefunded(order.id, input.restaurantId, refundAmount, tx)
        })
        await syncTierAfterRefund(input.restaurantId, reversal)
        return { refundAmount }
      } catch (err) {
        const code = err instanceof Error ? (err as { code?: string }).code : undefined
        if (code === 'ORDER_ALREADY_REFUNDED') {
          return { refundAmount }
        }
        if (code === 'CASH_SESSION_CLOSED') throw err
        lastErr = err
      }
    }
    throw Object.assign(
      new Error('REFUND_MARK_FAILED_AFTER_STRIPE'),
      { code: 'REFUND_MARK_FAILED_AFTER_STRIPE', cause: lastErr, stripeRefundAmount },
    )
  }

  if (order.paymentMethod === 'CASH' || (!hasStripe && cashPart > 0)) {
    if (!input.cashSessionId || !input.userId) {
      throw Object.assign(new Error('CASH_SESSION_REQUIRED'), { code: 'CASH_SESSION_REQUIRED' })
    }
    const cashSessionId = input.cashSessionId
    const userId = input.userId
    const reversal = await prisma.$transaction(async tx => {
      const open = await tx.cashRegisterSession.findFirst({
        where: { id: cashSessionId, restaurantId: input.restaurantId, status: 'OPEN' },
      })
      if (!open) {
        throw Object.assign(new Error('CASH_SESSION_CLOSED'), { code: 'CASH_SESSION_CLOSED' })
      }
      const rev = await markOrderRefunded(order.id, input.restaurantId, refundAmount, tx)
      await tx.cashTransaction.create({
        data: {
          sessionId: open.id,
          userId,
          type: 'REFUND',
          amount: toMoney(refundAmount),
          reason: input.reason ?? `Rimborso ordine #${order.id.slice(-6).toUpperCase()}`,
          orderId: order.id,
        },
      })
      return rev
    })
    await syncTierAfterRefund(input.restaurantId, reversal)
    return { refundAmount }
  }

  throw Object.assign(new Error('ORDER_NOT_REFUNDABLE'), { code: 'ORDER_NOT_REFUNDABLE' })
}
