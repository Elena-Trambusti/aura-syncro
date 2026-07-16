import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { deleteRestaurantCascade } from '../lib/deleteRestaurant'
import { requireAdminKey } from '../middleware/adminAuth'
import { adminApiLimiter } from '../middleware/rateLimit'
import { formatRomeDate, formatRomeDateTime } from '../lib/romeDate'

export const adminRouter = Router()

adminRouter.use(adminApiLimiter)
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
      onboardingIntake: true,
      onboardingSubmittedAt: true,
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
 * GET /api/admin/registrations
 * Elenco iscrizioni (OWNER). Query: ?today=true | ?date=YYYY-MM-DD | ?limit=50
 */
adminRouter.get('/registrations', async (req: Request, res: Response): Promise<void> => {
  const today = req.query.today === 'true'
  const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)

  const dateFilter = today
    ? formatRomeDate(new Date())
    : dateParam?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? dateParam
      : null

  const fetchLimit = dateFilter ? 500 : limit

  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    orderBy: { createdAt: 'desc' },
    take: fetchLimit,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      restaurant: {
        select: {
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
              countryCode: true,
              onboardingIntake: true,
              onboardingSubmittedAt: true,
            },
          },
        },
      },
    },
  })

  let registrations = owners.map((u: any) => ({
    userId: u.id,
    ownerName: u.name,
    email: u.email,
    phone: u.phone,
    registeredAt: u.createdAt,
    registeredAtRome: formatRomeDateTime(u.createdAt),
    restaurantId: u.restaurant.id,
    restaurantName: u.restaurant.name,
    slug: u.restaurant.slug,
    restaurantEmail: u.restaurant.email,
    isSetupComplete: u.restaurant.isSetupComplete,
    hasActiveSubscription: u.restaurant.settings?.hasActiveSubscription === true,
    planTier: u.restaurant.settings?.planTier ?? 'BASE',
    countryCode: u.restaurant.settings?.countryCode ?? 'IT',
    onboardingIntake: u.restaurant.settings?.onboardingIntake,
    onboardingSubmittedAt: u.restaurant.settings?.onboardingSubmittedAt,
  }))

  if (dateFilter) {
    registrations = registrations
      .filter((r: any) => formatRomeDate(r.registeredAt) === dateFilter)
      .slice(0, limit)
  }

  res.json({
    count: registrations.length,
    filter: {
      today: today || undefined,
      date: dateFilter ?? undefined,
      timezone: 'Europe/Rome',
    },
    registrations,
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

const posConfigSchema = z.object({
  restaurantId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  ownerEmail: z.string().email().optional(),
  mode: z.enum(['PENDING_SETUP', 'SIMULATION', 'STRIPE_TERMINAL', 'EXTERNAL']),
  posProviderLabel: z.string().max(120).optional().nullable(),
  posTerminalId: z.string().max(120).optional().nullable(),
  posMerchantId: z.string().max(120).optional().nullable(),
  posSetupNotes: z.string().max(2000).optional().nullable(),
}).refine(
  data => !!(data.restaurantId || data.slug || data.ownerEmail),
  { message: 'Specificare almeno uno tra restaurantId, slug o ownerEmail' },
)

/**
 * POST /api/admin/pos-config
 * Configura integrazione POS fisico dopo la call di setup (concierge).
 * Ogni ristorante ha hardware diverso — si compila quando il cliente fornisce i dati.
 */
adminRouter.post('/pos-config', async (req: Request, res: Response): Promise<void> => {
  const parsed = posConfigSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = await resolveRestaurantId(parsed.data as any)
  if (!restaurantId) {
    res.status(404).json({ error: 'Ristorante non trovato con i criteri indicati' })
    return
  }

  const { mode, posProviderLabel, posTerminalId, posMerchantId, posSetupNotes } = parsed.data

  const settings = await prisma.restaurantSettings.update({
    where: { restaurantId },
    data: {
      posIntegrationMode: mode,
      posProviderLabel: posProviderLabel ?? null,
      posTerminalId: posTerminalId ?? null,
      posMerchantId: posMerchantId ?? null,
      posSetupNotes: posSetupNotes ?? null,
      posConfiguredAt: new Date(),
    },
    select: {
      posIntegrationMode: true,
      posProviderLabel: true,
      posTerminalId: true,
      posMerchantId: true,
      posConfiguredAt: true,
    },
  })

  console.info('[admin] POS configurato:', restaurantId, mode, posProviderLabel)

  res.json({
    success: true,
    message: 'Configurazione POS salvata',
    pos: settings,
  })
})

const planDowngradeSchema = z.object({
  restaurantId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  ownerEmail: z.string().email().optional(),
}).refine(
  data => !!(data.restaurantId || data.slug || data.ownerEmail),
  { message: 'Specificare almeno uno tra restaurantId, slug o ownerEmail' },
)

/**
 * POST /api/admin/plan-downgrade
 * Downgrade manuale: disattiva abbonamento e accesso completo.
 */
adminRouter.post('/plan-downgrade', async (req: Request, res: Response): Promise<void> => {
  const parsed = planDowngradeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = await resolveRestaurantId(parsed.data)
  if (!restaurantId) {
    res.status(404).json({ error: 'Ristorante non trovato con i criteri indicati' })
    return
  }

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { planTier: true },
  })

  if (!settings) {
    res.status(404).json({ error: 'Impostazioni ristorante non trovate' })
    return
  }

  if (settings.planTier !== 'PRO') {
    res.status(400).json({ error: 'Il tenant non è sul piano Pro', code: 'NOT_PRO' })
    return
  }

  await prisma.restaurantSettings.update({
    where: { restaurantId },
    data: {
      planTier: 'BASE',
      hasActiveSubscription: false,
      stripeSubscriptionId: null,
      stripeProSubscriptionId: null,
    },
  })

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { subscriptionPlan: 'STARTER' },
  })

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: restaurantSummarySelect,
  })

  console.info('[admin] Downgrade Pro → Base:', restaurant?.slug, restaurantId)

  res.json({
    success: true,
    message: 'Abbonamento disattivato e piano impostato su Base.',
    restaurant,
  })
})

const deleteRestaurantSchema = z.object({
  restaurantId: z.string().min(1),
  confirm: z.boolean(),
})

/**
 * DELETE /api/admin/restaurant-delete
 * Distrugge definitivamente un ristorante e tutti i suoi dati.
 */
adminRouter.post('/restaurant-delete', async (req: Request, res: Response): Promise<void> => {
  const parsed = deleteRestaurantSchema.safeParse(req.body)
  if (!parsed.success || !parsed.data.confirm) {
    res.status(400).json({ error: 'Dati non validi o conferma mancante' })
    return
  }

  const { restaurantId } = parsed.data

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  console.warn(`[admin] INIZIO ELIMINAZIONE DISTRUTTIVA TENANT: ${restaurantId} - ${restaurant.name}`)

  try {
    await prisma.$transaction(async tx => {
      await deleteRestaurantCascade(tx, restaurantId)
    })

    console.warn(`[admin] ELIMINAZIONE COMPLETATA: ${restaurantId}`)
    res.json({ success: true, message: 'Ristorante eliminato con successo.' })
  } catch (err: any) {
    console.error(`[admin] ERRORE ELIMINAZIONE TENANT ${restaurantId}:`, err)
    res.status(500).json({ error: 'Errore durante la cancellazione. Dettagli nel log del server.' })
  }
})

