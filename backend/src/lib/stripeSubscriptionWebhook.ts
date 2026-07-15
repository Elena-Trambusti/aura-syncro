import { prisma } from './prisma'

export type CheckoutSessionPayload = {
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
  subscription?: string | { id: string } | null
  customer?: string | { id: string } | null
  mode?: string | null
}

/** Esclude pagamenti guest (ordini, caparre) e upgrade Pro dall'attivazione abbonamento Premium */
export function isSaasSubscriptionSession(session: CheckoutSessionPayload): boolean {
  if (session.metadata?.orderId) return false
  if (session.metadata?.reservationId) return false
  if (session.metadata?.plan === 'pro') return false
  if (session.metadata?.plan === 'premium') return true
  if (session.metadata?.plan === 'STARTER') return true
  if (session.metadata?.plan === 'PREMIUM') return true
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

  const stripeCustomerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null

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
        planTier: 'PRO',
        ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      },
    })
  } else {
    await prisma.restaurantSettings.create({
      data: {
        restaurantId,
        hasActiveSubscription: true,
        planTier: 'PRO',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId,
      },
    })
  }

  const plan = session.metadata?.plan?.toUpperCase()
  if (plan === 'STARTER' || plan === 'PREMIUM') {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { subscriptionPlan: plan as 'STARTER' | 'PREMIUM' }
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

/** Allinea hasActiveSubscription / planTier allo stato Stripe (updated / deleted) */
export async function syncRestaurantSubscriptionStatus(
  subscription: SubscriptionPayload,
): Promise<SubscriptionSyncResult | null> {
  const hasActiveSubscription = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)

  const proSettings = await prisma.restaurantSettings.findFirst({
    where: { stripeProSubscriptionId: subscription.id },
    select: { restaurantId: true, hasActiveSubscription: true },
  })

  if (proSettings) {
    if (!hasActiveSubscription) {
      await prisma.restaurantSettings.update({
        where: { restaurantId: proSettings.restaurantId },
        data: {
          stripeProSubscriptionId: null,
          ...(proSettings.hasActiveSubscription ? { planTier: 'PRO' as const } : { planTier: 'BASE' as const }),
        },
      })
    }
    return {
      restaurantId: proSettings.restaurantId,
      hasActiveSubscription: proSettings.hasActiveSubscription,
      status: subscription.status,
    }
  }

  const restaurantId = await resolveRestaurantIdFromSubscription(subscription)
  if (!restaurantId) {
    console.warn('[stripe-webhook] Subscription senza restaurantId:', subscription.id)
    return null
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      settings: {
        select: {
          id: true,
          stripeSubscriptionId: true,
          hasActiveSubscription: true,
        },
      },
    },
  })

  if (!restaurant) {
    console.warn('[stripe-webhook] Ristorante non trovato per subscription:', restaurantId)
    return null
  }

  const currentSubId = restaurant.settings?.stripeSubscriptionId ?? null
  // Evento stantio su una subscription diversa da quella attuale: non degradare il tenant.
  if (currentSubId && currentSubId !== subscription.id && !hasActiveSubscription) {
    console.info('[stripe-webhook] Ignora evento subscription non corrente:', {
      restaurantId,
      eventSub: subscription.id,
      currentSub: currentSubId,
      status: subscription.status,
    })
    return {
      restaurantId,
      hasActiveSubscription: restaurant.settings?.hasActiveSubscription ?? false,
      status: subscription.status,
    }
  }

  const data = {
    hasActiveSubscription,
    stripeSubscriptionId: subscription.id,
    ...(hasActiveSubscription ? { planTier: 'PRO' as const } : { planTier: 'BASE' as const, stripeProSubscriptionId: null }),
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
