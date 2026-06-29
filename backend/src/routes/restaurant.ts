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

export const restaurantRouter = Router()

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
  res.json(restaurant)
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
