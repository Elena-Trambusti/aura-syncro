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
  const setupAuthorized = isSetup && session.payment_status === 'no_payment_required'

  if (!fundsCaptured && !setupAuthorized) {
    console.warn('[deposit-webhook] Sessione caparra non autorizzata:', session.id, session.payment_status)
    return null
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      restaurantId: true,
      depositPaid: true,
      depositStripeSessionId: true,
      status: true,
    },
  })

  if (!reservation) {
    console.warn('[deposit-webhook] Prenotazione non trovata:', reservationId)
    return null
  }

  if (
    reservation.depositStripeSessionId
    && session.id
    && reservation.depositStripeSessionId !== session.id
  ) {
    console.warn('[deposit-webhook] Session ID mismatch — ignore', {
      reservationId,
      expected: reservation.depositStripeSessionId,
      got: session.id,
    })
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

  // Setup: carta salvata a garanzia — depositPaid=true indica garanzia pronta (non fondi incassati).
  if (setupAuthorized) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        depositPaid: true,
        ...(reservation.status === 'PENDING' ? { status: 'CONFIRMED' } : {}),
        ...(session.id ? { depositStripeSessionId: session.id } : {}),
      },
    })
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
      ...(reservation.status === 'PENDING' ? { status: 'CONFIRMED' } : {}),
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
