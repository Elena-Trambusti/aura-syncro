import { io } from '../index'
import { prisma } from './prisma'
import { occupyTableForSessionOrder, releaseTableIfSessionComplete } from './orderSession'
import { applyPostPaymentEffects } from './postPayment'
import { issueInvoiceForOrder } from './fiscalInvoice'
import { scheduleArubaInvoiceSubmission } from './arubaSaleAsync'
import { deductInventoryForOrderBatched } from './inventoryDeduction'
import { runOrderTransaction } from './prismaTransactions'
import { sendEmail } from './email'

const posOrderInclude = {
  table: true,
  items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' as const } },
} as const

export type PaymentSideEffectsInput = {
  orderId: string
  restaurantId: string
  paidAt: Date
  serveItemsOnPayment: boolean
  transactionId: string
  total: number
  receiptEmail?: string
  restaurantName?: string
  stripePaymentIntentId?: string
}

/**
 * Operazioni secondarie post-incasso — eseguite fuori dal percorso critico HTTP.
 * Magazzino, documento fiscale, Aruba SDI, CRM, socket, email.
 */
export async function runPaymentSideEffects(input: PaymentSideEffectsInput): Promise<void> {
  const {
    orderId,
    restaurantId,
    paidAt,
    serveItemsOnPayment,
    receiptEmail,
    restaurantName,
    stripePaymentIntentId,
    transactionId,
    total,
  } = input

  if (stripePaymentIntentId) {
    await prisma.order.updateMany({
      where: { id: orderId, stripePaymentIntent: null },
      data: { stripePaymentIntent: stripePaymentIntentId },
    })
  }

  let invoiceId: string | null = null
  await runOrderTransaction(async tx => {
    const invoice = await issueInvoiceForOrder(tx, orderId, restaurantId, paidAt)
    invoiceId = invoice.id
    await deductInventoryForOrderBatched(tx, orderId, restaurantId)
  })

  if (invoiceId) {
    scheduleArubaInvoiceSubmission(invoiceId)
  }

  await applyPostPaymentEffects(orderId, restaurantId)

  const updatedOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: posOrderInclude,
  })

  if (!updatedOrder) return

  if (updatedOrder.tableId && serveItemsOnPayment === false) {
    const occupiedTable = await runOrderTransaction(tx =>
      occupyTableForSessionOrder(tx, updatedOrder.tableId!, restaurantId, orderId),
    )
    if (occupiedTable) {
      io.to(restaurantId).emit('table:updated', occupiedTable)
    }
    const releasedTable = await releaseTableIfSessionComplete(updatedOrder.tableId)
    if (releasedTable) {
      io.to(restaurantId).emit('table:updated', releasedTable)
    }
  }

  io.to(restaurantId).emit('order:updated', updatedOrder)
  if (serveItemsOnPayment === false) {
    io.to(restaurantId).emit('order:created', updatedOrder)
    io.to(restaurantId).emit('print:kitchen', { type: 'kitchen', order: updatedOrder })
  }
  io.to(restaurantId).emit('print:receipt', { type: 'receipt', order: updatedOrder })

  if (receiptEmail) {
    sendEmail({
      to: receiptEmail,
      subject: `Ricevuta — ${restaurantName ?? 'Aura Syncro'}`,
      text: `Grazie per la visita!\nTotale: €${total.toFixed(2)}\nTransazione: ${transactionId}`,
    }).catch(err => console.error('[payment-side-effects] Email ricevuta fallita:', err))
  }
}

/** Avvia side-effects senza bloccare la risposta HTTP. */
export function schedulePaymentSideEffects(input: PaymentSideEffectsInput): void {
  void runPaymentSideEffects(input).catch(err => {
    console.error('[payment-side-effects] Fallimento elaborazione background', {
      orderId: input.orderId,
      error: err instanceof Error ? err.message : err,
    })
  })
}
