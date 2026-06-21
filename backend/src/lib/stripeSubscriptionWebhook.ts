import { prisma } from './prisma'

export type CheckoutSessionPayload = {
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
  subscription?: string | { id: string } | null
}

export interface SubscriptionActivationResult {
  restaurantId: string
  stripeSubscriptionId: string | null
  updated: boolean
}

/**
 * Attiva Premium dopo checkout.session.completed (abbonamento SaaS).
 * restaurantId da metadata o client_reference_id impostati in /api/checkout.
 */
export async function activateRestaurantSubscription(
  session: CheckoutSessionPayload,
): Promise<SubscriptionActivationResult | null> {
  const restaurantId =
    session.metadata?.restaurantId
    ?? session.client_reference_id
    ?? null

  if (!restaurantId) {
    console.warn('[stripe-webhook] checkout.session.completed senza restaurantId')
    return null
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, settings: { select: { id: true } } },
  })

  if (!restaurant) {
    console.warn('[stripe-webhook] Ristorante non trovato:', restaurantId)
    return null
  }

  if (restaurant.settings) {
    await prisma.restaurantSettings.update({
      where: { restaurantId },
      data: {
        hasActiveSubscription: true,
        ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      },
    })
  } else {
    await prisma.restaurantSettings.create({
      data: {
        restaurantId,
        hasActiveSubscription: true,
        stripeSubscriptionId: subscriptionId,
      },
    })
  }

  return {
    restaurantId,
    stripeSubscriptionId: subscriptionId,
    updated: true,
  }
}
