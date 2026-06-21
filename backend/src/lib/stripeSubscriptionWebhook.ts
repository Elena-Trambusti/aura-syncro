import { prisma } from './prisma'

export type CheckoutSessionPayload = {
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
  subscription?: string | { id: string } | null
  mode?: string | null
}

/** Esclude pagamenti guest (ordini, caparre) dall'attivazione abbonamento SaaS */
export function isSaasSubscriptionSession(session: CheckoutSessionPayload): boolean {
  if (session.metadata?.orderId) return false
  if (session.metadata?.reservationId) return false
  if (session.metadata?.plan === 'premium') return true
  if (session.mode === 'subscription') return true
  if (session.subscription) return true
  return false
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
  if (!isSaasSubscriptionSession(session)) {
    return null
  }

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
        planTier: 'BASE',
        ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      },
    })
  } else {
    await prisma.restaurantSettings.create({
      data: {
        restaurantId,
        hasActiveSubscription: true,
        planTier: 'BASE',
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

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export type SubscriptionPayload = {
  id: string
  status: string
  metadata?: Record<string, string> | null
}

async function resolveRestaurantIdFromSubscription(
  subscription: SubscriptionPayload,
): Promise<string | null> {
  if (subscription.metadata?.restaurantId) {
    return subscription.metadata.restaurantId
  }

  const settings = await prisma.restaurantSettings.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { restaurantId: true },
  })

  return settings?.restaurantId ?? null
}

export interface SubscriptionSyncResult {
  restaurantId: string
  hasActiveSubscription: boolean
  status: string
}

/** Allinea hasActiveSubscription allo stato Stripe (updated / deleted) */
export async function syncRestaurantSubscriptionStatus(
  subscription: SubscriptionPayload,
): Promise<SubscriptionSyncResult | null> {
  const restaurantId = await resolveRestaurantIdFromSubscription(subscription)
  if (!restaurantId) {
    console.warn('[stripe-webhook] Subscription senza restaurantId:', subscription.id)
    return null
  }

  const hasActiveSubscription = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: { select: { id: true } } },
  })

  if (!restaurant) {
    console.warn('[stripe-webhook] Ristorante non trovato per subscription:', restaurantId)
    return null
  }

  const data = {
    hasActiveSubscription,
    stripeSubscriptionId: subscription.id,
  }

  if (restaurant.settings) {
    await prisma.restaurantSettings.update({
      where: { restaurantId },
      data,
    })
  } else {
    await prisma.restaurantSettings.create({
      data: {
        restaurantId,
        planTier: 'BASE',
        ...data,
      },
    })
  }

  return {
    restaurantId,
    hasActiveSubscription,
    status: subscription.status,
  }
}
