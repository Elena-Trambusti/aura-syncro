import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { STRIPE_ENABLED } from '../lib/stripe'
import { io } from '../index'
import { publicCheckoutLimiter, publicOrderLimiter } from '../middleware/rateLimit'
import { createReservation, ReservationValidationError } from '../lib/createReservation'
import { createDepositCheckoutSession } from '../lib/depositCheckout'
import { requiresDeposit } from '../lib/reservationRules'
import { enrichCategoriesWithStock } from '../lib/menuStock'

export const publicRouter = Router()

import { GUEST_ORDERING_DISABLED } from '../lib/guestOrderingPolicy'

/** GET /api/public/menu/:slug — Menu digitale (solo consultazione) */
publicRouter.get('/menu/:slug', async (req: Request, res: Response): Promise<void> => {
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
      fiscal: fiscalConfigPayload(fiscal, restaurant.settings?.taxId),
    },
    categories: categories.filter(cat => cat.items.length > 0),
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
    },
    settings: {
      openTime: s?.openTime ?? '12:00',
      closeTime: s?.closeTime ?? '23:00',
      maxCoversPerSlot: s?.maxCoversPerSlot ?? 20,
      reservationSlotMinutes: s?.reservationSlotMinutes ?? 90,
      depositRequired: requiresDeposit(s),
      depositAmount: s?.depositAmount ?? 0,
    },
  })
})

const publicReservationSchema = z.object({
  slug: z.string().min(1),
  guestName: z.string().min(2),
  guestPhone: z.string().min(6),
  guestEmail: z.string().email().optional(),
  covers: z.number().int().positive(),
  date: z.string().datetime(),
  notes: z.string().optional(),
})

/** POST /api/public/reservations — Prenotazione tavolo dal cliente */
publicRouter.post('/reservations', publicOrderLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = publicReservationSchema.safeParse(req.body)
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
    const { reservation, depositRequired } = await createReservation({
      restaurantId: restaurant.id,
      guestName: parsed.data.guestName,
      guestPhone: parsed.data.guestPhone,
      guestEmail: parsed.data.guestEmail,
      covers: parsed.data.covers,
      date: new Date(parsed.data.date),
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
    console.error('[public/reservations]', err)
    res.status(500).json({ error: 'Errore durante la prenotazione' })
  }
})

/**
 * Ordini guest disabilitati — il ristorante usa i camerieri (POS).
 * Il menu QR è solo consultazione.
 */
publicRouter.post('/orders', publicOrderLimiter, (_req: Request, res: Response): void => {
  res.status(403).json(GUEST_ORDERING_DISABLED)
})

publicRouter.post('/checkout', publicCheckoutLimiter, (_req: Request, res: Response): void => {
  res.status(403).json(GUEST_ORDERING_DISABLED)
})
