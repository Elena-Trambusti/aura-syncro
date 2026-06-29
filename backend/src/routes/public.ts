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
import { parseLocalDateTimeInTimezone } from '../lib/romeDate'
import { enrichCategoriesWithStock } from '../lib/menuStock'

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
publicRouter.get('/booking/:slug', async (req: Request, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: req.params.slug },
    include: { settings: true },
  })

  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const s = restaurant.settings
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

  if (requiresDeposit(restaurant.settings) && !STRIPE_ENABLED) {
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

    res.status(201).json({
      reservationId: reservation.id,
      status: reservation.status,
      depositRequired,
      checkoutUrl,
    })
  } catch (err) {
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
    console.error('[public/checkout]', err)
    res.status(500).json({ error: 'Errore durante il checkout' })
  }
})
