import type { StripeEventPayload } from './stripeTypes'
import { prisma } from './prisma'

export type WebhookClaimResult =
  | { duplicate: true; status: 'processing' | 'succeeded' | 'failed' }
  | { duplicate: false; recordId: string }

/**
 * Registra l'evento Stripe prima dell'elaborazione.
 * Se evt_xxx esiste già → duplicate (idempotenza).
 */
export async function claimStripeWebhookEvent(
  event: StripeEventPayload,
  restaurantId?: string | null,
): Promise<WebhookClaimResult> {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
    select: { id: true, status: true },
  })

  if (existing) {
    return { duplicate: true, status: existing.status }
  }

  try {
    const record = await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        status: 'processing',
        restaurantId: restaurantId ?? null,
        metadata: {
          objectId: typeof event.data.object === 'object' && event.data.object && 'id' in event.data.object
            ? (event.data.object as { id: string }).id
            : undefined,
        },
      },
      select: { id: true },
    })
    return { duplicate: false, recordId: record.id }
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : null
    if (code === 'P2002') {
      const again = await prisma.stripeWebhookEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { status: true },
      })
      return { duplicate: true, status: again?.status ?? 'processing' }
    }
    throw err
  }
}

export async function reclaimFailedStripeWebhookEvent(stripeEventId: string): Promise<boolean> {
  const updated = await prisma.stripeWebhookEvent.updateMany({
    where: { stripeEventId, status: 'failed' },
    data: { status: 'processing', errorMessage: null, processedAt: null },
  })
  return updated.count > 0
}

/** Lease su claim bloccati in `processing` (crash mid-handler). Default 5 minuti. */
const STALE_PROCESSING_MS = 5 * 60 * 1000

export async function reclaimStaleProcessingStripeWebhookEvent(
  stripeEventId: string,
  staleMs = STALE_PROCESSING_MS,
): Promise<boolean> {
  const staleBefore = new Date(Date.now() - staleMs)
  const updated = await prisma.stripeWebhookEvent.updateMany({
    where: {
      stripeEventId,
      status: 'processing',
      createdAt: { lt: staleBefore },
    },
    data: {
      status: 'processing',
      errorMessage: null,
      processedAt: null,
      createdAt: new Date(),
    },
  })
  return updated.count > 0
}

export async function markStripeWebhookSucceeded(stripeEventId: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({
    where: { stripeEventId },
    data: { status: 'succeeded', processedAt: new Date(), errorMessage: null },
  })
}

export async function markStripeWebhookFailed(stripeEventId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  await prisma.stripeWebhookEvent.update({
    where: { stripeEventId },
    data: { status: 'failed', processedAt: new Date(), errorMessage: message.slice(0, 2000) },
  }).catch(() => {
    console.error('[stripe-webhook] Impossibile aggiornare stato fallimento per', stripeEventId)
  })
}
