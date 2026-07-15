import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { STRIPE_ENABLED } from '../lib/stripe'
import { io } from '../index'
import { publicCheckoutLimiter, publicMenuLimiter, publicOrderLimiter, publicReservationLimiter } from '../middleware/rateLimit'
import { createReservation, ReservationValidationError } from '../lib/createReservation'
import { createDepositCheckoutSession } from '../lib/depositCheckout'
import { requiresDeposit } from '../lib/reservationRules'
import { resolveMaxCoversPerSlot } from '../lib/reservationCapacity'
import { parseLocalDateTimeInTimezone } from '../lib/romeDate'
import { enrichCategoriesWithStock } from '../lib/menuStock'
import {
  acquireIdempotencyLock,
  getIdempotentResponse,
  releaseIdempotencyLock,
  saveIdempotentResponse,
} from '../lib/apiIdempotency'

export const publicRouter = Router()

import { GUEST_ORDERING_DISABLED, isGuestOrderingEnabled } from '../lib/guestOrderingPolicy'
import { createPublicOrder, publicOrderSchema, PublicOrderError } from '../lib/publicOrder'
import { createGuestStripeCheckout, guestCheckoutSchema } from '../lib/publicCheckout'
import { broadcastNewOrderNotification, formatOrderCurrency } from '../lib/orderNotifications'

/** GET /api/public/menu/:slug — Menu digitale (solo consultazione) */
publicRouter.get('/menu/:slug', publicMenuLimiter, async (req: Request, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: req.params.slug },
    include: {
      settings: true,
      menuCategories: {
        where: { active: true },
        include: {
          items: {
            where: { available: true, archived: false },
            orderBy: { sortOrder: 'asc' },
            include: {
              modifierGroups: {
                orderBy: { sortOrder: 'asc' },
                include: { options: { orderBy: { sortOrder: 'asc' } } },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const fiscal = buildFiscalConfig(restaurant.settings)
  const categories = await enrichCategoriesWithStock(restaurant.menuCategories, restaurant.id)
  res.json({
    restaurant: {
      name: restaurant.name,
      logo: restaurant.logoUrl ?? restaurant.logo,
      description: restaurant.description,
      colorTheme: restaurant.colorTheme,
      slug: restaurant.slug,
      fiscal: fiscalConfigPayload(fiscal),
    },
    categories: categories.filter(cat => cat.items.length > 0),
    guestOrderingEnabled: isGuestOrderingEnabled(),
    stripeEnabled: STRIPE_ENABLED,
  })
})

/** GET /api/public/booking/:slug — Info prenotazione pubblica */
publicRouter.get('/booking/:slug', publicReservationLimiter, async (req: Request, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: req.params.slug },
    include: { settings: true },
  })

  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const s = restaurant.settings
  const effectiveMaxCoversPerSlot = await resolveMaxCoversPerSlot(restaurant.id)
  res.json({
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      phone: restaurant.phone,
      logo: restaurant.logoUrl ?? restaurant.logo,
      coverImage: restaurant.coverImage,
      colorTheme: restaurant.colorTheme,
    },
    settings: {
      openTime: s?.openTime ?? '12:00',
      closeTime: s?.closeTime ?? '23:00',
      maxCoversPerSlot: s?.maxCoversPerSlot ?? 20,
      effectiveMaxCoversPerSlot,
      reservationSlotMinutes: s?.reservationSlotMinutes ?? 90,
      depositRequired: requiresDeposit(s),
      depositAmount: s?.depositAmount ?? 0,
      timezone: restaurant.timezone ?? 'Europe/Rome',
    },
  })
})

const publicReservationSchema = z.object({
  slug: z.string().min(1),
  guestName: z.string().min(2),
  guestPhone: z.string().min(6),
  guestEmail: z.string().email().optional(),
  covers: z.number().int().positive(),
  date: z.string().datetime().optional(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  localTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
  clientRequestId: z.string().min(8).max(128).optional(),
}).refine(
  data => data.date || (data.localDate && data.localTime),
  { message: 'Data e ora obbligatorie' },
)

/** POST /api/public/reservations — Prenotazione tavolo dal cliente */
publicRouter.post('/reservations', publicReservationLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = publicReservationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true, slug: true, timezone: true, settings: true },
  })
  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const idemKey = parsed.data.clientRequestId
    ? `public-reservation:${parsed.data.clientRequestId}`
    : (typeof req.headers['x-idempotency-key'] === 'string' && req.headers['x-idempotency-key'].trim().length >= 8
      ? `public-reservation:${req.headers['x-idempotency-key'].trim().slice(0, 128)}`
      : null)
  let idempotencyLocked = false
  if (idemKey) {
    const cached = await getIdempotentResponse(restaurant.id, idemKey, 'PUBLIC_RESERVATION')
    if (cached && cached.statusCode === 201) {
      res.status(201).json(cached.responseBody)
      return
    }
    const locked = await acquireIdempotencyLock(restaurant.id, idemKey, 'PUBLIC_RESERVATION')
    if (!locked) {
      const raced = await getIdempotentResponse(restaurant.id, idemKey, 'PUBLIC_RESERVATION')
      if (raced?.statusCode === 201) {
        res.status(201).json(raced.responseBody)
        return
      }
      res.status(409).json({ error: 'Prenotazione già in elaborazione', code: 'RESERVATION_IN_PROGRESS' })
      return
    }
    idempotencyLocked = true
  }

  if (requiresDeposit(restaurant.settings) && !STRIPE_ENABLED) {
    if (idempotencyLocked && idemKey) await releaseIdempotencyLock(restaurant.id, idemKey)
    res.status(503).json({
      error: 'Prenotazione con caparra non disponibile: pagamenti non configurati.',
      code: 'DEPOSIT_UNAVAILABLE',
    })
    return
  }

  const timeZone = restaurant.timezone ?? 'Europe/Rome'
  const reservationDate = parsed.data.date
    ? new Date(parsed.data.date)
    : parseLocalDateTimeInTimezone(parsed.data.localDate!, parsed.data.localTime!, timeZone)

  try {
    const { reservation, depositRequired } = await createReservation({
      restaurantId: restaurant.id,
      guestName: parsed.data.guestName,
      guestPhone: parsed.data.guestPhone,
      guestEmail: parsed.data.guestEmail,
      covers: parsed.data.covers,
      date: reservationDate,
      notes: parsed.data.notes,
      internalNotes: 'Prenotazione online (QR / link pubblico)',
    })

    io.to(restaurant.id).emit('reservation:created', reservation)

    let checkoutUrl: string | undefined
    if (depositRequired && STRIPE_ENABLED) {
      const session = await createDepositCheckoutSession(reservation.id, restaurant.slug)
      checkoutUrl = session.checkoutUrl
    }

    const body = {
      reservationId: reservation.id,
      status: reservation.status,
      depositRequired,
      checkoutUrl,
    }
    if (idemKey) {
      await saveIdempotentResponse(restaurant.id, idemKey, 'PUBLIC_RESERVATION', 201, body)
      idempotencyLocked = false
    }
    res.status(201).json(body)
  } catch (err) {
    if (idempotencyLocked && idemKey) await releaseIdempotencyLock(restaurant.id, idemKey)
    if (err instanceof ReservationValidationError) {
      res.status(409).json({ error: err.message, code: err.code })
      return
    }
    const prismaCode = (err as { code?: string })?.code
    if (prismaCode === 'P2002') {
      res.status(409).json({ error: 'Slot o tavolo non più disponibile', code: 'SLOT_CONFLICT' })
      return
    }
    console.error('[public/reservations]', err)
    res.status(500).json({ error: 'Errore durante la prenotazione' })
  }
})

/** POST /api/public/orders — Ordine guest dal menu QR (paga al tavolo) */
publicRouter.post('/orders', publicOrderLimiter, async (req: Request, res: Response): Promise<void> => {
  if (!isGuestOrderingEnabled()) {
    res.status(403).json(GUEST_ORDERING_DISABLED)
    return
  }

  const bodySchema = publicOrderSchema.extend({ slug: z.string().min(1) })
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true, slug: true },
  })
  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  try {
    const { order, restaurantId, tableNumber, total } = await createPublicOrder(restaurant.id, parsed.data)
    io.to(restaurantId).emit('order:created', order)
    io.to(restaurantId).emit('print:kitchen', { type: 'kitchen', order })
    if (order.tableId) {
      const table = await prisma.table.findUnique({ where: { id: order.tableId } })
      if (table) io.to(restaurantId).emit('table:updated', table)
    }

    const tableLabel = tableNumber ? `tavolo ${tableNumber}` : parsed.data.type.toLowerCase()
    void broadcastNewOrderNotification(
      restaurantId,
      order.id,
      `Ordine QR da ${tableLabel} — ${formatOrderCurrency(total)}`,
    )

    res.status(201).json({ orderId: order.id, status: order.status })
  } catch (err) {
    if (err instanceof PublicOrderError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code })
      return
    }
    if ((err as { code?: string }).code === 'INSUFFICIENT_STOCK') {
      res.status(409).json({ error: 'Piatto esaurito — ingredienti insufficienti', code: 'MENU_ITEM_SOLD_OUT' })
      return
    }
    console.error('[public/orders]', err)
    res.status(500).json({ error: 'Errore durante l\'ordine' })
  }
})

/** POST /api/public/checkout — Stripe Checkout per ordine guest */
publicRouter.post('/checkout', publicCheckoutLimiter, async (req: Request, res: Response): Promise<void> => {
  if (!isGuestOrderingEnabled()) {
    res.status(403).json(GUEST_ORDERING_DISABLED)
    return
  }

  const parsed = guestCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  try {
    const result = await createGuestStripeCheckout(parsed.data)
    res.json({
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      orderId: result.orderId,
    })
  } catch (err) {
    if (err instanceof PublicOrderError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code })
      return
    }
    if ((err as { code?: string }).code === 'INSUFFICIENT_STOCK') {
      res.status(409).json({ error: 'Piatto esaurito — ingredienti insufficienti', code: 'MENU_ITEM_SOLD_OUT' })
      return
    }
    console.error('[public/checkout]', err)
    res.status(500).json({ error: 'Errore durante il checkout' })
  }
})

/** POST /api/public/telegram-webhook — Webhook ufficiale Telegram per registrare i Chat ID */
publicRouter.post('/telegram-webhook', async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'Telegram webhook not configured' })
      return
    }
    console.warn('[Telegram Webhook] TELEGRAM_WEBHOOK_SECRET unset — skipping secret bind in non-production')
  } else {
    const { verifyTelegramWebhookSecret } = await import('../lib/telegramBot')
    const header = req.header('x-telegram-bot-api-secret-token') ?? undefined
    if (!verifyTelegramWebhookSecret(header)) {
      res.sendStatus(401)
      return
    }
  }

  // Telegram invia i messaggi nel body: req.body.message
  const message = req.body?.message
  if (!message || !message.text) {
    res.sendStatus(200) // Rispondi 200 per non far ritentare a Telegram
    return
  }

  const chatId = message.chat.id
  const text = String(message.text).trim()

  // Deep link: t.me/Bot?start=<restaurantId>_<pairToken>
  // Telegram invia: "/start <restaurantId>_<pairToken>"
  if (text.startsWith('/start ')) {
    const payload = text.slice('/start '.length).trim()
    const sep = payload.lastIndexOf('_')
    const restaurantId = sep > 0 ? payload.slice(0, sep) : ''
    const pairToken = sep > 0 ? payload.slice(sep + 1) : ''

    if (restaurantId && pairToken) {
      try {
        const { verifyTelegramPairToken, sendTelegramMessage } = await import('../lib/telegramBot')
        if (!verifyTelegramPairToken(restaurantId, pairToken)) {
          res.sendStatus(200)
          return
        }

        const restaurant = await prisma.restaurant.findUnique({
          where: { id: restaurantId },
        })

        if (restaurant) {
          await prisma.restaurantSettings.upsert({
            where: { restaurantId: restaurant.id },
            update: { telegramChatId: String(chatId) },
            create: { restaurantId: restaurant.id, telegramChatId: String(chatId) },
          })

          await sendTelegramMessage(
            String(chatId),
            `✅ <b>Perfetto!</b>\nTelegram collegato con successo al ristorante <b>${restaurant.name}</b>.\n\nRiceverai qui gli Alert della AI Predittiva.`,
          )
        }
      } catch (err) {
        console.error('[Telegram Webhook] Errore salvataggio chat:', err)
      }
    }
  }

  res.sendStatus(200)
})
