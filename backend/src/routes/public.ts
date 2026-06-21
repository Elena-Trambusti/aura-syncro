import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { createPublicOrder, publicOrderSchema, PublicOrderError } from '../lib/publicOrder'
import { createGuestStripeCheckout, guestCheckoutSchema } from '../lib/publicCheckout'
import { broadcastNewOrderNotification, formatOrderCurrency } from '../lib/orderNotifications'
import { STRIPE_ENABLED } from '../lib/stripe'
import { io } from '../index'

export const publicRouter = Router()

function formatCurrency(amount: number): string {
  return formatOrderCurrency(amount)
}

/** GET /api/public/menu/:slug — Menu QR senza autenticazione */
publicRouter.get('/menu/:slug', async (req: Request, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: req.params.slug },
    include: {
      settings: true,
      menuCategories: {
        where: { active: true },
        include: {
          items: {
            where: { available: true },
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
  res.json({
    restaurant: {
      name: restaurant.name,
      logo: restaurant.logoUrl ?? restaurant.logo,
      description: restaurant.description,
      colorTheme: restaurant.colorTheme,
      slug: restaurant.slug,
      fiscal: fiscalConfigPayload(fiscal, restaurant.settings?.taxId),
      stripeEnabled: STRIPE_ENABLED,
    },
    categories: restaurant.menuCategories.filter(cat => cat.items.length > 0),
  })
})

/** POST /api/public/orders — Ordine guest dal menu QR (senza autenticazione) */
publicRouter.post('/orders', async (req: Request, res: Response): Promise<void> => {
  const parsed = publicOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  try {
    const { order, restaurantId, tableNumber, total } = await createPublicOrder(parsed.data)

    io.to(restaurantId).emit('order:created', order)
    void broadcastNewOrderNotification(
      restaurantId,
      order.id,
      `Nuovo ordine dal tavolo ${tableNumber || 'asporto'} — ${formatCurrency(total)}`,
    )

    res.status(201).json({ success: true, orderId: order.id })
  } catch (err) {
    if (err instanceof PublicOrderError) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    console.error('[public/orders]', err)
    res.status(500).json({ error: 'Errore durante la creazione dell\'ordine' })
  }
})

/** POST /api/public/checkout — Ordine guest + redirect Stripe Checkout */
publicRouter.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  const parsed = guestCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  try {
    const result = await createGuestStripeCheckout(parsed.data)
    res.json(result)
  } catch (err) {
    if (err instanceof PublicOrderError) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    console.error('[public/checkout]', err)
    res.status(500).json({ error: 'Errore durante il checkout' })
  }
})
