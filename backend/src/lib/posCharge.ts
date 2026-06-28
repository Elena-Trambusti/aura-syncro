import { stripe, STRIPE_ENABLED } from './stripe'
import { loadRestaurantPosConfig } from './posIntegration'
import { isProduction } from './env'
import { prisma } from './prisma'

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
  const envDelay = Number(process.env.POS_SIMULATE_DELAY_MS)
  const delayMs = isNaN(envDelay) ? 0 : envDelay
  // Removed artificial delay to speed up checkout

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
  context: { orderId: string; restaurantId: string },
): Promise<void> {
  if (!STRIPE_ENABLED) {
    throw new Error('STRIPE_PAYMENT_FAILED')
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (intent.status !== 'succeeded') {
    throw new Error('STRIPE_PAYMENT_FAILED')
  }

  const expectedCents = Math.round(expectedAmountEur * 100)
  if (intent.amount < expectedCents) {
    throw new Error('STRIPE_AMOUNT_MISMATCH')
  }
  if (intent.amount > expectedCents + 1) {
    throw new Error('STRIPE_AMOUNT_OVERPAY')
  }

  if (intent.metadata?.orderId !== context.orderId) {
    throw new Error('STRIPE_PI_ORDER_MISMATCH')
  }
  if (intent.metadata?.restaurantId !== context.restaurantId) {
    throw new Error('STRIPE_PI_TENANT_MISMATCH')
  }

  const reused = await prisma.order.findFirst({
    where: {
      stripePaymentIntent: paymentIntentId,
      id: { not: context.orderId },
    },
    select: { id: true },
  })
  if (reused) {
    throw new Error('STRIPE_PI_ALREADY_USED')
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
    await verifyStripePaymentIntent(
      stripePaymentIntentId,
      breakdown.totalCustomerAmount,
      { orderId: metadata.orderId, restaurantId: metadata.restaurantId },
    )
    return {
      success: true,
      transactionId: stripePaymentIntentId,
      terminalId: posConfig.terminalId || 'STRIPE-POS',
      provider: 'stripe',
      stripePaymentIntentId,
      breakdown,
    }
  }

  if (posConfig.mode === 'EXTERNAL') {
    void enrichedMeta
    return externalPosAcknowledgment(breakdown, posConfig.terminalId, posConfig.providerLabel)
  }

  if (posConfig.mode === 'STRIPE_TERMINAL') {
    throw new Error('STRIPE_PAYMENT_INTENT_REQUIRED')
  }

  if (posConfig.isCardChargeSimulated) {
    if (isProduction() && process.env.POS_ALLOW_SIMULATION !== 'true') {
      throw new Error('POS_SIMULATION_NOT_ALLOWED')
    }
    void enrichedMeta
    return simulatePosTerminal(breakdown, posConfig.terminalId)
  }

  if (process.env.POS_USE_SIMULATION === 'false') {
    throw new Error('STRIPE_PAYMENT_INTENT_REQUIRED')
  }

  void enrichedMeta
  return simulatePosTerminal(breakdown, posConfig.terminalId)
}
