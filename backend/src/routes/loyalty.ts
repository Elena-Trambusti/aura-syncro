import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { dayBoundsInTimezone, calendarDateInTimezone } from '../lib/dates'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { updateCustomerTier, bootstrapLoyaltyProgram, syncAllCustomerTiers } from '../lib/loyaltyHelpers'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const loyaltyRouter = Router()

// ── Livelli VIP ─────────────────────────────────────────────────────────────

loyaltyRouter.get('/tiers', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const tiers = await prisma.loyaltyTier.findMany({
    where: { restaurantId: req.restaurantId! },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { customers: true } } },
  })
  res.json(tiers)
})

loyaltyRouter.post('/tiers', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    minPoints: z.number().int().min(0),
    color: z.string().default('#94a3b8'),
    benefits: z.string().optional(),
    discountPct: z.number().min(0).max(100).default(0),
    cashbackPct: z.number().min(0).max(100).default(0),
    pointsPerEuro: z.number().min(0).default(1),
    sortOrder: z.number().int().default(0),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const tier = await prisma.loyaltyTier.create({
    data: { ...result.data, restaurantId: req.restaurantId! },
  })
  void syncAllCustomerTiers(req.restaurantId!).catch(err => {
    console.error('[loyalty] sync tiers dopo create fallito:', err)
  })
  res.status(201).json(tier)
})

loyaltyRouter.put('/tiers/:id', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    minPoints: z.number().int().min(0).optional(),
    color: z.string().optional(),
    benefits: z.string().optional(),
    discountPct: z.number().min(0).max(100).optional(),
    cashbackPct: z.number().min(0).max(100).optional(),
    pointsPerEuro: z.number().min(0).optional(),
    sortOrder: z.number().int().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const updated = await prisma.loyaltyTier.updateMany({
    where: scopedWhere(req, req.params.id),
    data: result.data,
  })
  if (updated.count === 0) { tenantNotFound(res, 'Livello non trovato'); return }
  const tier = await prisma.loyaltyTier.findFirst({ where: scopedWhere(req, req.params.id) })
  void syncAllCustomerTiers(req.restaurantId!).catch(err => {
    console.error('[loyalty] sync tiers dopo update fallito:', err)
  })
  res.json(tier)
})

loyaltyRouter.delete('/tiers/:id', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.loyaltyTier.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) { tenantNotFound(res, 'Livello non trovato'); return }
  void syncAllCustomerTiers(req.restaurantId!).catch(err => {
    console.error('[loyalty] sync tiers dopo delete fallito:', err)
  })
  res.status(204).send()
})

// ── Transazioni punti ────────────────────────────────────────────────────────

loyaltyRouter.get('/transactions/:customerId', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const transactions = await prisma.loyaltyTransaction.findMany({
    where: { customerId: req.params.customerId, restaurantId: req.restaurantId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(transactions)
})

loyaltyRouter.post('/earn', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    customerId: z.string(),
    points: z.number().int().positive(),
    description: z.string().optional(),
    orderId: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const { customerId, points, description, orderId } = result.data
  const restaurantId = tenantId(req)

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  })
  if (!customer) { tenantNotFound(res, 'Cliente non trovato'); return }

  if (orderId) {
    const existingEarn = await prisma.loyaltyTransaction.findFirst({
      where: { restaurantId, orderId, type: 'EARNED' },
    })
    if (existingEarn) {
      res.status(409).json({ error: 'Punti già assegnati per questo ordine', code: 'LOYALTY_ALREADY_EARNED' })
      return
    }
  }

  // RC-05: Use Serializable transaction to prevent double-earn on concurrent requests
  try {
  const [tx, updatedCustomer] = await prisma.$transaction(async prismaClient => {
    if (orderId) {
      const dup = await prismaClient.loyaltyTransaction.findFirst({
        where: { restaurantId, orderId, type: 'EARNED' },
      })
      if (dup) {
        throw Object.assign(new Error('LOYALTY_ALREADY_EARNED'), { code: 'LOYALTY_ALREADY_EARNED' })
      }
    }
    const transaction = await prismaClient.loyaltyTransaction.create({
      data: { customerId, restaurantId, type: 'EARNED', points, description, orderId },
    })
    const updated = await prismaClient.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    })
    return [transaction, updated] as const
  }, { isolationLevel: 'Serializable' })

  await updateCustomerTier(restaurantId, customerId, updatedCustomer.loyaltyPoints)

  res.status(201).json({ transaction: tx, newPoints: updatedCustomer.loyaltyPoints })
  } catch (err) {
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
    if (code === 'LOYALTY_ALREADY_EARNED') {
      res.status(409).json({ error: 'Punti già assegnati per questo ordine', code })
      return
    }
    throw err
  }
})

loyaltyRouter.post('/redeem', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    customerId: z.string(),
    points: z.number().int().positive(),
    description: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const { customerId, points, description } = result.data
  const restaurantId = tenantId(req)

  try {
    const [tx, updatedCustomer] = await prisma.$transaction(async tx => {
      const claimed = await tx.customer.updateMany({
        where: { id: customerId, restaurantId, loyaltyPoints: { gte: points } },
        data: { loyaltyPoints: { decrement: points } },
      })
      if (claimed.count === 0) {
        throw Object.assign(new Error('INSUFFICIENT_POINTS'), { code: 'INSUFFICIENT_POINTS' })
      }
      const transaction = await tx.loyaltyTransaction.create({
        data: { customerId, restaurantId, type: 'REDEEMED', points: -points, description },
      })
      const updated = await tx.customer.findFirstOrThrow({ where: { id: customerId } })
      return [transaction, updated] as const
    }, { isolationLevel: 'Serializable' })

    res.status(201).json({ transaction: tx, newPoints: updatedCustomer.loyaltyPoints })
  } catch (err) {
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
    if (code === 'INSUFFICIENT_POINTS') {
      res.status(400).json({ error: 'Punti insufficienti', code })
      return
    }
    throw err
  }
})

loyaltyRouter.post('/adjust', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    customerId: z.string(),
    points: z.number().int(),
    description: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const { customerId, points, description } = result.data
  const restaurantId = tenantId(req)

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  })
  if (!customer) { tenantNotFound(res, 'Cliente non trovato'); return }

  // RC-06: Atomic check-and-decrement — prevents TOCTOU race on concurrent adjustments
  try {
    const [tx, updatedCustomer] = await prisma.$transaction(async prismaClient => {
      const claimed = await prismaClient.customer.updateMany({
        where: {
          id: customerId,
          restaurantId,
          ...(points < 0 ? { loyaltyPoints: { gte: -points } } : {}),
        },
        data: { loyaltyPoints: { increment: points } },
      })
      if (claimed.count === 0) {
        throw Object.assign(new Error('INSUFFICIENT_POINTS'), { code: 'INSUFFICIENT_POINTS' })
      }
      const transaction = await prismaClient.loyaltyTransaction.create({
        data: { customerId, restaurantId, type: 'ADJUSTMENT', points, description },
      })
      const updated = await prismaClient.customer.findFirstOrThrow({ where: { id: customerId } })
      return [transaction, updated] as const
    }, { isolationLevel: 'Serializable' })

    await updateCustomerTier(restaurantId, customerId, updatedCustomer.loyaltyPoints)

    res.status(201).json({ transaction: tx, newPoints: updatedCustomer.loyaltyPoints })
  } catch (err) {
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
    if (code === 'INSUFFICIENT_POINTS') {
      res.status(400).json({ error: 'Saldo punti insufficiente', code })
      return
    }
    throw err
  }
})

// ── Overview statistiche fedeltà ────────────────────────────────────────────

loyaltyRouter.get('/overview', requirePermission('loyalty.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  })
  const timeZone = restaurant?.timezone ?? 'Europe/Rome'
  const cal = calendarDateInTimezone(timeZone, new Date())
  const [y, m] = cal.split('-')
  const { gte: monthStart } = dayBoundsInTimezone(`${y}-${m}-01`, timeZone)

  const tierCount = await prisma.loyaltyTier.count({ where: { restaurantId } })
  if (tierCount === 0) {
    await bootstrapLoyaltyProgram(restaurantId)
  }

  const [tiers, totalMembers, activeThisMonth, topCustomers] = await Promise.all([
    prisma.loyaltyTier.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { customers: true } } },
    }),
    prisma.customer.count({ where: { restaurantId, loyaltyPoints: { gt: 0 } } }),
    prisma.loyaltyTransaction.groupBy({
      by: ['customerId'],
      where: {
        restaurantId,
        createdAt: { gte: monthStart },
        type: 'EARNED',
      },
      _count: true,
    }),
    prisma.customer.findMany({
      where: { restaurantId },
      orderBy: { loyaltyPoints: 'desc' },
      take: 5,
      include: { loyaltyTier: true },
    }),
  ])

  const totalPointsIssued = await prisma.loyaltyTransaction.aggregate({
    where: { restaurantId, type: 'EARNED' },
    _sum: { points: true },
  })

  res.json({
    autoManaged: true,
    tiers,
    stats: {
      totalMembers,
      activeThisMonth: activeThisMonth.length,
      totalPointsIssued: totalPointsIssued._sum.points || 0,
    },
    topCustomers,
  })
})

