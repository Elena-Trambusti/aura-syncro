import { io } from '../index'
import { prisma } from './prisma'
import {
  finalizeOrderPayment,
  releaseTableIfEmpty,
  type FinalizePaymentInput,
  type SplitBreakdown,
} from './orderPayment'
import { chargePosCard } from './posCharge'
import { sendEmail } from './email'

const posOrderInclude = {
  table: true,
  items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' as const } },
}

export async function completeOrderPayment(input: {
  finalize: FinalizePaymentInput
  splitBreakdown?: SplitBreakdown
  stripePaymentIntentId?: string
  receiptEmail?: string
  restaurantName?: string
}) {
  const orderPreview = await prisma.order.findFirst({
    where: { id: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
  })

  let posResult = null
  if (input.finalize.paymentMethod === 'CARD') {
    const amount = (orderPreview?.total ?? 0) + (input.finalize.tipAmount ?? 0)
    posResult = await chargePosCard(
      amount,
      { orderId: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
      input.stripePaymentIntentId,
    )
  }

  const result = await finalizeOrderPayment(input.finalize, {
    splitBreakdown: input.splitBreakdown,
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

  const releasedTable = await releaseTableIfEmpty(updatedOrder?.tableId)
  if (releasedTable) io.to(input.finalize.restaurantId).emit('table:updated', releasedTable)
  io.to(input.finalize.restaurantId).emit('order:updated', updatedOrder)

  let emailSent = false
  if (input.receiptEmail) {
    const r = await sendEmail({
      to: input.receiptEmail,
      subject: `Ricevuta — ${input.restaurantName ?? 'Aura Syncro'}`,
      text: `Grazie per la visita!\nTotale: €${result.total.toFixed(2)}\nTransazione: ${result.transactionId}`,
    })
    emailSent = r.sent
  }

  return { result, updatedOrder, posResult, emailSent }
}

/** Webhook guest Stripe → stesso flusso di finalize. */
export async function completeGuestStripePayment(
  orderId: string,
  paymentIntentId?: string | null,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status === 'PAID' || order.status === 'CANCELLED') return null

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
  })
}
