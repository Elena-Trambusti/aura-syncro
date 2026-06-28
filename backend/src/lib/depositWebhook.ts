import { prisma } from './prisma'

export type DepositSessionPayload = {
  id?: string
  payment_status?: string | null
  mode?: string | null
  amount_total?: number | null
  metadata?: Record<string, string> | null
}

export interface DepositPaymentResult {
  reservationId: string
  restaurantId: string
  amountPaid: number | null
  /** true = denaro incassato; false = solo carta salvata (setup) */
  fundsCaptured: boolean
}

/** Gestisce caparra reale o salvataggio carta a garanzia (setup). */
export async function markReservationDepositPaid(
  session: DepositSessionPayload,
): Promise<DepositPaymentResult | null> {
  const reservationId = session.metadata?.reservationId
  if (!reservationId) return null

  const isSetup = session.mode === 'setup'
  const fundsCaptured = session.payment_status === 'paid'

  if (!fundsCaptured && !(isSetup && session.payment_status === 'no_payment_required')) {
    console.warn('[deposit-webhook] Sessione caparra non autorizzata:', session.id, session.payment_status)
    return null
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, restaurantId: true, depositPaid: true, depositStripeSessionId: true },
  })

  if (!reservation) {
    console.warn('[deposit-webhook] Prenotazione non trovata:', reservationId)
    return null
  }

  if (fundsCaptured && reservation.depositPaid) {
    return {
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
      amountPaid: session.amount_total ? session.amount_total / 100 : null,
      fundsCaptured: true,
    }
  }

  if (isSetup && reservation.depositStripeSessionId && !fundsCaptured) {
    return {
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
      amountPaid: null,
      fundsCaptured: false,
    }
  }

  let amountPaid: number | null = null
  if (fundsCaptured && session.amount_total) {
    amountPaid = session.amount_total / 100
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      depositPaid: fundsCaptured,
      depositAmountPaid: fundsCaptured ? amountPaid : null,
      ...(session.id ? { depositStripeSessionId: session.id } : {}),
    },
  })

  return {
    reservationId: reservation.id,
    restaurantId: reservation.restaurantId,
    amountPaid: fundsCaptured ? amountPaid : null,
    fundsCaptured,
  }
}
