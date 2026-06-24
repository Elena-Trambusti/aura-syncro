import { stripe, STRIPE_ENABLED } from './stripe'
import { loadRestaurantPosConfig } from './posIntegration'

export interface PosChargeBreakdown {
  taxableAmount: number
  tipAmount: number
  totalCustomerAmount: number
  taxRegion?: string
}

export interface PosChargeResult {
  success: boolean
  transactionId: string
  terminalId: string
  provider: 'stripe' | 'simulated' | 'external'
  stripePaymentIntentId?: string
  breakdown?: PosChargeBreakdown
  /** true se la ricevuta fiscale legale deve essere emessa dal POS del ristorante */
  externalFiscalReceipt?: boolean
}

async function simulatePosTerminal(
  breakdown: PosChargeBreakdown,
  terminalId?: string | null,
): Promise<PosChargeResult> {
  const delayMs = Number(process.env.POS_SIMULATE_DELAY_MS) || 800
  await new Promise(resolve => setTimeout(resolve, delayMs))
  return {
    success: true,
    transactionId: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    terminalId: terminalId || process.env.POS_TERMINAL_ID || 'SIM-TPV-001',
    provider: 'simulated',
    breakdown,
  }
}

function externalPosAcknowledgment(
  breakdown: PosChargeBreakdown,
  terminalId?: string | null,
  providerLabel?: string | null,
): PosChargeResult {
  return {
    success: true,
    transactionId: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    terminalId: terminalId || providerLabel || 'EXTERNAL-POS',
    provider: 'external',
    breakdown,
    externalFiscalReceipt: true,
  }
}

function normalizeBreakdown(
  input: number | PosChargeBreakdown,
): PosChargeBreakdown {
  if (typeof input === 'number') {
    return {
      taxableAmount: input,
      tipAmount: 0,
      totalCustomerAmount: input,
    }
  }
  return {
    ...input,
    totalCustomerAmount: input.totalCustomerAmount
      ?? Math.round((input.taxableAmount + input.tipAmount) * 100) / 100,
  }
}

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
 * Addebito carta al POS con separazione fiscale mance.
 * Rispetta la configurazione POS per-ristorante (setup concierge).
 */
export async function chargePosCard(
  input: number | PosChargeBreakdown,
  metadata: Record<string, string> & { restaurantId: string },
  stripePaymentIntentId?: string,
): Promise<PosChargeResult> {
  const breakdown = normalizeBreakdown(input)
  const posConfig = await loadRestaurantPosConfig(metadata.restaurantId)

  if (breakdown.totalCustomerAmount <= 0) {
    return simulatePosTerminal(breakdown, posConfig.terminalId)
  }

  const enrichedMeta: Record<string, string> = {
    ...metadata,
    taxable_amount: String(breakdown.taxableAmount),
    tip_amount: String(breakdown.tipAmount),
    tip_tax_exempt: 'true',
    pos_mode: posConfig.mode,
    ...(breakdown.taxRegion ? { tax_region: breakdown.taxRegion } : {}),
  }

  if (stripePaymentIntentId && STRIPE_ENABLED) {
    const ok = await verifyStripePaymentIntent(
      stripePaymentIntentId,
      breakdown.totalCustomerAmount,
    )
    if (ok) {
      return {
        success: true,
        transactionId: stripePaymentIntentId,
        terminalId: posConfig.terminalId || 'STRIPE-POS',
        provider: 'stripe',
        stripePaymentIntentId,
        breakdown,
      }
    }
    throw new Error('STRIPE_PAYMENT_FAILED')
  }

  if (posConfig.mode === 'EXTERNAL') {
    void enrichedMeta
    return externalPosAcknowledgment(breakdown, posConfig.terminalId, posConfig.providerLabel)
  }

  if (posConfig.mode === 'STRIPE_TERMINAL') {
    throw new Error('STRIPE_PAYMENT_INTENT_REQUIRED')
  }

  if (posConfig.isCardChargeSimulated) {
    void enrichedMeta
    return simulatePosTerminal(breakdown, posConfig.terminalId)
  }

  if (process.env.POS_USE_SIMULATION === 'false') {
    throw new Error('STRIPE_PAYMENT_INTENT_REQUIRED')
  }

  void enrichedMeta
  return simulatePosTerminal(breakdown, posConfig.terminalId)
}
