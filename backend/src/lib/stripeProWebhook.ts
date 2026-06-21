import { prisma } from './prisma'
import type { CheckoutSessionPayload } from './stripeSubscriptionWebhook'

export function isProUpgradeSession(session: CheckoutSessionPayload): boolean {
  return session.metadata?.plan === 'pro'
}

export interface ProActivationResult {
  restaurantId: string
  stripeProSubscriptionId: string | null
  updated: boolean
}

/** Attiva piano Pro dopo checkout Stripe (add-on mensile). */
export async function activateProPlan(
  session: CheckoutSessionPayload,
): Promise<ProActivationResult | null> {
  if (!isProUpgradeSession(session)) return null

  const restaurantId =
    session.metadata?.restaurantId
    ?? session.client_reference_id
    ?? null

  if (!restaurantId) {
    console.warn('[stripe-webhook] Pro checkout senza restaurantId')
    return null
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, settings: { select: { id: true, hasActiveSubscription: true } } },
  })

  if (!restaurant) {
    console.warn('[stripe-webhook] Ristorante non trovato per Pro:', restaurantId)
    return null
  }

  if (!restaurant.settings?.hasActiveSubscription) {
    console.warn('[stripe-webhook] Pro checkout senza Premium attivo:', restaurantId)
    return null
  }

  if (restaurant.settings) {
    await prisma.restaurantSettings.update({
      where: { restaurantId },
      data: {
        planTier: 'PRO',
        ...(subscriptionId ? { stripeProSubscriptionId: subscriptionId } : {}),
      },
    })
  } else {
    await prisma.restaurantSettings.create({
      data: {
        restaurantId,
        hasActiveSubscription: true,
        planTier: 'PRO',
        stripeProSubscriptionId: subscriptionId,
      },
    })
  }

  return {
    restaurantId,
    stripeProSubscriptionId: subscriptionId,
    updated: true,
  }
}
