import { stripe, STRIPE_ENABLED } from './stripe'

export interface PosChargeResult {
  success: boolean
  transactionId: string
  terminalId: string
  provider: 'stripe' | 'simulated'
  stripePaymentIntentId?: string
}

async function simulatePosTerminal(amount: number): Promise<PosChargeResult> {
  const delayMs = Number(process.env.POS_SIMULATE_DELAY_MS) || 800
  await new Promise(resolve => setTimeout(resolve, delayMs))
  return {
    success: true,
    transactionId: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    terminalId: process.env.POS_TERMINAL_ID || 'SIM-TPV-001',
    provider: 'simulated',
  }
}

/** Verifica PaymentIntent Stripe già incassato (POS con Payment Element / Terminal). */
export async function verifyStripePaymentIntent(
  paymentIntentId: string,
  expectedAmountEur: number,
): Promise<boolean> {
  if (!STRIPE_ENABLED) return false
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
    const expectedCents = Math.round(expectedAmountEur * 100)
    return intent.status === 'succeeded' && intent.amount >= expectedCents
  } catch {
    return false
  }
}

/**
 * Addebito carta al POS.
 * - Se `stripePaymentIntentId` è fornito e valido → Stripe reale.
 * - Altrimenti simulazione (configurabile con POS_USE_SIMULATION=false + intent obbligatorio).
 */
export async function chargePosCard(
  amountEur: number,
  metadata: Record<string, string>,
  stripePaymentIntentId?: string,
): Promise<PosChargeResult> {
  if (amountEur <= 0) {
    return simulatePosTerminal(amountEur)
  }

  if (stripePaymentIntentId && STRIPE_ENABLED) {
    const ok = await verifyStripePaymentIntent(stripePaymentIntentId, amountEur)
    if (ok) {
      return {
        success: true,
        transactionId: stripePaymentIntentId,
        terminalId: 'STRIPE-POS',
        provider: 'stripe',
        stripePaymentIntentId,
      }
    }
    throw new Error('STRIPE_PAYMENT_FAILED')
  }

  if (process.env.POS_USE_SIMULATION === 'false') {
    throw new Error('STRIPE_PAYMENT_INTENT_REQUIRED')
  }

  return simulatePosTerminal(amountEur)
}
