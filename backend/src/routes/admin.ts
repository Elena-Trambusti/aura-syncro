import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAdminKey } from '../middleware/adminAuth'

export const adminRouter = Router()

adminRouter.use(requireAdminKey)

const setupCompleteSchema = z.object({
  restaurantId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  ownerEmail: z.string().email().optional(),
}).refine(
  data => !!(data.restaurantId || data.slug || data.ownerEmail),
  { message: 'Specificare almeno uno tra restaurantId, slug o ownerEmail' },
)

async function resolveRestaurantId(input: z.infer<typeof setupCompleteSchema>): Promise<string | null> {
  if (input.restaurantId) {
    const byId = await prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { id: true },
    })
    return byId?.id ?? null
  }

  if (input.slug) {
    const bySlug = await prisma.restaurant.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    })
    return bySlug?.id ?? null
  }

  if (input.ownerEmail) {
    const owner = await prisma.user.findFirst({
      where: { email: input.ownerEmail, role: 'OWNER' },
      select: { restaurantId: true },
    })
    return owner?.restaurantId ?? null
  }

  return null
}

const restaurantSummarySelect = {
  id: true,
  name: true,
  slug: true,
  email: true,
  isSetupComplete: true,
  createdAt: true,
  settings: {
    select: {
      hasActiveSubscription: true,
      planTier: true,
    },
  },
  users: {
    where: { role: 'OWNER' as const },
    select: { name: true, email: true },
    take: 1,
  },
} as const

/**
 * POST /api/admin/setup-complete
 * Sblocca la dashboard operativa dopo onboarding concierge.
 */
adminRouter.post('/setup-complete', async (req: Request, res: Response): Promise<void> => {
  const parsed = setupCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = await resolveRestaurantId(parsed.data)
  if (!restaurantId) {
    res.status(404).json({ error: 'Ristorante non trovato con i criteri indicati' })
    return
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { isSetupComplete: true },
    select: restaurantSummarySelect,
  })

  console.info('[admin] Setup completato:', restaurant.slug, restaurant.id)

  res.json({
    success: true,
    message: 'Dashboard sbloccata per il cliente',
    restaurant,
  })
})

/**
 * POST /api/admin/setup-reset
 * Rimette un ristorante in onboarding (solo emergenze).
 */
adminRouter.post('/setup-reset', async (req: Request, res: Response): Promise<void> => {
  const parsed = setupCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = await resolveRestaurantId(parsed.data)
  if (!restaurantId) {
    res.status(404).json({ error: 'Ristorante non trovato con i criteri indicati' })
    return
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { isSetupComplete: false },
    select: restaurantSummarySelect,
  })

  console.info('[admin] Setup resettato:', restaurant.slug, restaurant.id)

  res.json({
    success: true,
    message: 'Ristorante rimesso in onboarding',
    restaurant,
  })
})

/**
 * GET /api/admin/pending-setup
 * Elenco clienti abbonati in attesa di sblocco concierge.
 */
adminRouter.get('/pending-setup', async (_req: Request, res: Response): Promise<void> => {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isSetupComplete: false,
      settings: { hasActiveSubscription: true },
    },
    select: restaurantSummarySelect,
    orderBy: { createdAt: 'asc' },
  })

  res.json({ count: restaurants.length, restaurants })
})

/**
 * GET /api/admin/restaurant/:slug
 * Stato setup di un singolo cliente.
 */
adminRouter.get('/restaurant/:slug', async (req: Request, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: req.params.slug },
    select: restaurantSummarySelect,
  })

  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  res.json({ restaurant })
})
