import { prisma } from './prisma'

export type DepositSessionPayload = {
  id?: string
  payment_status?: string | null
  amount_total?: number | null
  metadata?: Record<string, string> | null
}

export interface DepositPaymentResult {
  reservationId: string
  restaurantId: string
  amountPaid: number | null
}

/** Segna caparra prenotazione come pagata dopo checkout.session.completed */
export async function markReservationDepositPaid(
  session: DepositSessionPayload,
): Promise<DepositPaymentResult | null> {
  const reservationId = session.metadata?.reservationId
  if (!reservationId) return null

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    console.warn('[deposit-webhook] Sessione caparra non autorizzata:', session.id, session.payment_status)
    return null
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, restaurantId: true, depositPaid: true },
  })

  if (!reservation) {
    console.warn('[deposit-webhook] Prenotazione non trovata:', reservationId)
    return null
  }

  if (reservation.depositPaid) {
    return {
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
      amountPaid: session.amount_total ? session.amount_total / 100 : null,
    }
  }

  // In mode: setup, amount_total is null. We parse it from metadata.
  let amountPaid = session.amount_total ? session.amount_total / 100 : null
  if (amountPaid === null && session.metadata?.depositAmount) {
    amountPaid = parseFloat(session.metadata.depositAmount)
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      depositPaid: true,
      depositAmountPaid: amountPaid,
      ...(session.id ? { depositStripeSessionId: session.id } : {}),
    },
  })

  return {
    reservationId: reservation.id,
    restaurantId: reservation.restaurantId,
    amountPaid,
  }
}
