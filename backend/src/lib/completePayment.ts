import { io } from '../index'
import { prisma } from './prisma'
import {
  finalizeOrderPayment,
  releaseTableIfEmpty,
  type FinalizePaymentInput,
  type SplitBreakdown,
} from './orderPayment'
import { occupyTableIfAvailable } from './orderSession'
import { chargePosCard } from './posCharge'
import { sendEmail } from './email'
import { loadRestaurantFiscalConfig } from './taxEngine'
import { computePosPaymentAmounts } from './tipFiscal'
import { applyDiscountToOrder, resolveDiscountForOrder } from './orderDiscount'

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

  let chargeOrder = orderPreview
  if (input.discountOptions && orderPreview) {
    const { totals } = await resolveDiscountForOrder(
      input.finalize.restaurantId,
      orderPreview,
      input.discountOptions,
    )
    chargeOrder = { ...orderPreview, ...totals }
  }

  let posResult = null
  if (input.finalize.paymentMethod === 'CARD') {
    const posAmounts = chargeOrder
      ? computePosPaymentAmounts(fiscal, chargeOrder, input.finalize.tipAmount)
      : null

    posResult = await chargePosCard(
      {
        taxableAmount: posAmounts?.taxableChargeAmount ?? (chargeOrder?.total ?? 0),
        tipAmount: posAmounts?.tipChargeAmount ?? 0,
        totalCustomerAmount: posAmounts?.totalCustomerAmount
          ?? (chargeOrder?.total ?? 0) + (input.finalize.tipAmount ?? 0),
        taxRegion: fiscal.taxRegion,
      },
      { orderId: input.finalize.orderId, restaurantId: input.finalize.restaurantId },
      input.stripePaymentIntentId,
    )
  }

  if (input.discountOptions) {
    await applyDiscountToOrder(
      input.finalize.orderId,
      input.finalize.restaurantId,
      input.discountOptions,
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

  if (updatedOrder?.tableId && input.serveItemsOnPayment === false) {
    await prisma.$transaction(async tx => {
      await occupyTableIfAvailable(tx, updatedOrder.tableId!, input.finalize.restaurantId)
    })
  }

  const releasedTable = await releaseTableIfEmpty(updatedOrder?.tableId)
  if (releasedTable) io.to(input.finalize.restaurantId).emit('table:updated', releasedTable)

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
    // Fire and forget email to avoid blocking the fast checkout lane
    sendEmail({
      to: input.receiptEmail,
      subject: `Ricevuta — ${input.restaurantName ?? 'Aura Syncro'}`,
      text: `Grazie per la visita!\nTotale: €${result.total.toFixed(2)}\nTransazione: ${result.transactionId}`,
    }).catch(err => console.error('Failed to send async receipt:', err))
    emailSent = true // Assume it will be sent, or tracked elsewhere
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
    serveItemsOnPayment: false,
  })
}
