import { Router, Response } from 'express'
import { z } from 'zod'
import { CountryCode, FiscalRegion, TaxRegion } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AuthRequest, authenticate, requireRole } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { requireFullDashboardAccess } from '../middleware/dashboardAccess'
import { buildFiscalConfig, resolveTaxRegion, type RestaurantSettingsLike } from '../lib/taxEngine'
import { loadRestaurantPosConfig, serializePosStatusForCheckout } from '../lib/posIntegration'
import { computeOnboardingReadiness } from '../lib/onboardingReadiness'
import { computeComplianceStatus } from '../lib/complianceStatus'
import { writeAuditLog } from '../lib/auditLog'
import { randomBytes } from 'crypto'
import { resolveMaxCoversPerSlot } from '../lib/reservationCapacity'
import { onboardingRouter } from './onboarding'

const SENSITIVE_SETTINGS_FIELDS = new Set([
  'stripeCustomerId',
  'stripeSubscriptionId',
  'stripeProSubscriptionId',
  'posMerchantId',
  'posSetupNotes',
  'printAgentToken',
])

function serializeRestaurantResponse(
  restaurant: (Awaited<ReturnType<typeof prisma.restaurant.findUnique>> & { settings?: Record<string, unknown> | null }) | null,
) {
  if (!restaurant) return null
  const { settings, ...base } = restaurant
  if (!settings) return { ...base, settings: null }

  const safeSettings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (!SENSITIVE_SETTINGS_FIELDS.has(key)) {
      safeSettings[key] = value
    }
  }
  safeSettings.hasStripeBilling = Boolean(settings.stripeCustomerId)
  safeSettings.hasStripeProAddon = Boolean(settings.stripeProSubscriptionId)

  return { ...base, settings: safeSettings }
}

export const restaurantRouter = Router()

restaurantRouter.use('/onboarding', onboardingRouter)

const emptyToNull = (val: unknown) =>
  val === '' || val === null || val === undefined ? null : val

const settingsSchema = z.object({
  countryCode: z.nativeEnum(CountryCode).optional(),
  taxRegion: z.nativeEnum(TaxRegion).optional(),
  fiscalRegion: z.nativeEnum(FiscalRegion).optional(),
  defaultLocale: z.string().min(2).max(5).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxId: z.preprocess(emptyToNull, z.string().max(32).nullable().optional()),
  legalName: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  legalAddress: z.preprocess(emptyToNull, z.string().max(500).nullable().optional()),
  fiscalCode: z.preprocess(emptyToNull, z.string().max(32).nullable().optional()),
  pec: z.preprocess(emptyToNull, z.string().email().max(200).nullable().optional()),
  sdiRecipientCode: z.preprocess(emptyToNull, z.string().max(7).nullable().optional()),
  invoicePrefix: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase().slice(0, 12) : undefined),
    z.string().min(2).max(12).optional(),
  ),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  maxCoversPerSlot: z.number().int().positive().optional(),
  reservationSlotMinutes: z.number().int().positive().optional(),
  serviceCharge: z.number().min(0).optional(),
  autoConfirmReservations: z.boolean().optional(),
  noShowDepositRequired: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  laborHourlyRate: z.number().min(0).max(500).optional(),
  legalCity: z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  legalZip: z.preprocess(emptyToNull, z.string().max(12).nullable().optional()),
  legalProvince: z.preprocess(emptyToNull, z.string().max(4).nullable().optional()),
  posProviderLabel: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
  posTerminalId: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
  onboardingConcierge: z.object({
    menu: z.boolean().optional(),
    call: z.boolean().optional(),
  }).optional(),
}).optional()

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.preprocess(emptyToNull, z.string().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().nullable().optional()),
  email: z.preprocess(emptyToNull, z.string().email().nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  timezone: z.string().optional(),
  settings: settingsSchema,
})

restaurantRouter.get('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId! },
    include: { settings: true },
  })
  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }
  const effectiveMaxCoversPerSlot = await resolveMaxCoversPerSlot(req.restaurantId!)
  const payload = serializeRestaurantResponse(restaurant)
  if (payload?.settings && typeof payload.settings === 'object') {
    payload.settings = {
      ...payload.settings,
      effectiveMaxCoversPerSlot,
    }
  }
  res.json(payload)
})

/** Stato integrazione POS (sola lettura per owner/manager) */
restaurantRouter.get('/pos-status', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const config = await loadRestaurantPosConfig(req.restaurantId!)
  res.json(serializePosStatusForCheckout(config))
})

/** Checklist go-live verificata dal sistema (menu, fiscale, POS, tavoli). */
restaurantRouter.get('/onboarding-readiness', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const readiness = await computeOnboardingReadiness(req.restaurantId!)
  res.json(readiness)
})

/** Sblocco automatico dashboard quando tutti i prerequisiti sistema sono soddisfatti. */
restaurantRouter.post('/onboarding/go-live', requireRole('OWNER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const readiness = await computeOnboardingReadiness(restaurantId)
  if (!readiness.readyForService) {
    res.status(409).json({
      error: 'Prerequisiti go-live non ancora soddisfatti',
      code: 'ONBOARDING_NOT_READY',
      readiness,
    })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { isSetupComplete: true },
  })
  if (restaurant?.isSetupComplete) {
    res.json({ success: true, alreadyComplete: true })
    return
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { isSetupComplete: true },
    include: { settings: true },
  })

  writeAuditLog({
    restaurantId,
    userId: req.userId,
    action: 'ONBOARDING_GO_LIVE',
    entityType: 'Restaurant',
    entityId: restaurantId,
    req,
  })

  res.json({ success: true, restaurant: serializeRestaurantResponse(updated) })
})

/** Stato conformità fiscale/operativa per chiusura guidata. */
restaurantRouter.get('/compliance-status', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const status = await computeComplianceStatus(req.restaurantId!)
  res.json(status)
})

/** Stato Print Agent (token mascherato). */
restaurantRouter.get('/print-agent', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: req.restaurantId! },
    select: { printAgentToken: true },
  })
  const token = settings?.printAgentToken
  res.json({
    configured: Boolean(token),
    tokenPreview: token ? `••••${token.slice(-6)}` : null,
  })
})

restaurantRouter.post('/print-agent/regenerate', requireRole('OWNER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const token = randomBytes(24).toString('hex')
  await prisma.restaurantSettings.upsert({
    where: { restaurantId },
    update: { printAgentToken: token },
    create: { restaurantId, printAgentToken: token },
  })
  writeAuditLog({
    restaurantId,
    userId: req.userId,
    action: 'PRINT_AGENT_TOKEN_REGEN',
    entityType: 'RestaurantSettings',
    entityId: restaurantId,
    req,
  })
  res.json({ token, message: 'Salva il token nel Print Agent — non verrà mostrato di nuovo.' })
})

restaurantRouter.get('/audit-log', requireRole('OWNER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const rows = await prisma.auditLog.findMany({
    where: { restaurantId: req.restaurantId! },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  res.json({ count: rows.length, entries: rows })
})

restaurantRouter.get('/onboarding-concierge', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: req.restaurantId! },
    select: { onboardingConcierge: true },
  })
  const raw = settings?.onboardingConcierge as { menu?: boolean; call?: boolean } | null
  res.json({ menu: Boolean(raw?.menu), call: Boolean(raw?.call) })
})

restaurantRouter.patch('/onboarding-concierge', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    menu: z.boolean().optional(),
    call: z.boolean().optional(),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const current = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: req.restaurantId! },
    select: { onboardingConcierge: true },
  })
  const prev = (current?.onboardingConcierge as { menu?: boolean; call?: boolean } | null) ?? {}
  const next = { ...prev, ...parsed.data }
  await prisma.restaurantSettings.upsert({
    where: { restaurantId: req.restaurantId! },
    update: { onboardingConcierge: next },
    create: { restaurantId: req.restaurantId!, onboardingConcierge: next },
  })
  res.json(next)
})

restaurantRouter.put('/', requirePermission('settings.manage'), requireFullDashboardAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const { settings, ...data } = parsed.data
  const restaurantId = req.restaurantId!

  if (settings) {
    const current = await prisma.restaurantSettings.findUnique({ where: { restaurantId } })
    const countryCode = settings.countryCode ?? current?.countryCode ?? 'IT'
    const taxRegion = resolveTaxRegion(countryCode, settings.taxRegion ?? current?.taxRegion)
    const regionOrCountryChanged =
      (settings.taxRegion != null && settings.taxRegion !== current?.taxRegion) ||
      (settings.countryCode != null && settings.countryCode !== current?.countryCode)
    const settingsForFiscal: RestaurantSettingsLike = { ...current, ...settings, countryCode, taxRegion }
    if (regionOrCountryChanged && settings.taxRate === undefined) {
      settingsForFiscal.taxRate = null
    }
    const fiscal = buildFiscalConfig(settingsForFiscal)

    await prisma.restaurantSettings.upsert({
      where: { restaurantId },
      update: {
        ...settings,
        countryCode,
        taxRegion: fiscal.taxRegion,
        fiscalRegion: fiscal.fiscalRegion,
        taxRate: settings.taxRate ?? fiscal.taxRate,
      },
      create: {
        restaurantId,
        countryCode,
        taxRegion: fiscal.taxRegion,
        fiscalRegion: fiscal.fiscalRegion,
        taxRate: settings.taxRate ?? fiscal.taxRate,
        defaultLocale: settings.defaultLocale ?? fiscal.defaultLocale,
        taxId: settings.taxId ?? null,
      },
    })

    if (settings.countryCode || settings.taxRegion) {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { timezone: fiscal.timezone },
      })
    }
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data,
    include: { settings: true },
  })

  res.json(restaurant)
})
