import { Router, Response } from 'express'
import { z } from 'zod'
import { CountryCode, TaxRegion } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireRole } from '../middleware/auth'
import { requireFullDashboardAccess } from '../middleware/dashboardAccess'
import { buildFiscalConfig, resolveTaxRegion } from '../lib/taxEngine'

export const restaurantRouter = Router()

const settingsSchema = z.object({
  countryCode: z.nativeEnum(CountryCode).optional(),
  taxRegion: z.nativeEnum(TaxRegion).optional(),
  defaultLocale: z.string().min(2).max(5).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxId: z.string().max(32).nullable().optional(),
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
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  description: z.string().nullable().optional(),
  timezone: z.string().optional(),
  settings: settingsSchema,
})

restaurantRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId! },
    include: { settings: true },
  })
  res.json(restaurant)
})

restaurantRouter.put('/', requireRole('OWNER', 'MANAGER'), requireFullDashboardAccess, async (req: AuthRequest, res: Response): Promise<void> => {
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
    const fiscal = buildFiscalConfig({ ...current, ...settings, countryCode, taxRegion })

    await prisma.restaurantSettings.upsert({
      where: { restaurantId },
      update: { ...settings, countryCode, taxRegion, taxRate: settings.taxRate ?? fiscal.taxRate },
      create: {
        restaurantId,
        countryCode,
        taxRegion,
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
