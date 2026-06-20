import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const loyaltyRouter = Router()

// ── Livelli VIP ─────────────────────────────────────────────────────────────

loyaltyRouter.get('/tiers', async (req: AuthRequest, res: Response): Promise<void> => {
  const tiers = await prisma.loyaltyTier.findMany({
    where: { restaurantId: req.restaurantId! },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { customers: true } } },
  })
  res.json(tiers)
})

loyaltyRouter.post('/tiers', async (req: AuthRequest, res: Response): Promise<void> => {
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
  res.status(201).json(tier)
})

loyaltyRouter.put('/tiers/:id', async (req: AuthRequest, res: Response): Promise<void> => {
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
  res.json(tier)
})

loyaltyRouter.delete('/tiers/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.loyaltyTier.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) { tenantNotFound(res, 'Livello non trovato'); return }
  res.status(204).send()
})

// ── Transazioni punti ────────────────────────────────────────────────────────

loyaltyRouter.get('/transactions/:customerId', async (req: AuthRequest, res: Response): Promise<void> => {
  const transactions = await prisma.loyaltyTransaction.findMany({
    where: { customerId: req.params.customerId, restaurantId: req.restaurantId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(transactions)
})

loyaltyRouter.post('/earn', async (req: AuthRequest, res: Response): Promise<void> => {
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

  const [tx, updatedCustomer] = await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: { customerId, restaurantId, type: 'EARNED', points, description, orderId },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    }),
  ])

  await updateCustomerTier(restaurantId, customerId, updatedCustomer.loyaltyPoints)

  res.status(201).json({ transaction: tx, newPoints: updatedCustomer.loyaltyPoints })
})

loyaltyRouter.post('/redeem', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    customerId: z.string(),
    points: z.number().int().positive(),
    description: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const { customerId, points, description } = result.data

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId: tenantId(req) },
  })
  if (!customer || customer.loyaltyPoints < points) {
    res.status(400).json({ error: 'Punti insufficienti' }); return
  }

  const [tx, updatedCustomer] = await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: { customerId, restaurantId: tenantId(req), type: 'REDEEMED', points: -points, description },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: points } },
    }),
  ])

  res.status(201).json({ transaction: tx, newPoints: updatedCustomer.loyaltyPoints })
})

loyaltyRouter.post('/adjust', async (req: AuthRequest, res: Response): Promise<void> => {
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

  const [tx, updatedCustomer] = await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: { customerId, restaurantId, type: 'ADJUSTMENT', points, description },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    }),
  ])

  res.status(201).json({ transaction: tx, newPoints: updatedCustomer.loyaltyPoints })
})

// ── Overview statistiche fedeltà ────────────────────────────────────────────

loyaltyRouter.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

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
        createdAt: { gte: new Date(new Date().setDate(1)) },
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
    tiers,
    stats: {
      totalMembers,
      activeThisMonth: activeThisMonth.length,
      totalPointsIssued: totalPointsIssued._sum.points || 0,
    },
    topCustomers,
  })
})

// ── Helper ───────────────────────────────────────────────────────────────────

async function updateCustomerTier(restaurantId: string, customerId: string, currentPoints: number) {
  const tiers = await prisma.loyaltyTier.findMany({
    where: { restaurantId },
    orderBy: { minPoints: 'desc' },
  })
  const newTier = tiers.find(t => currentPoints >= t.minPoints)
  if (newTier) {
    await prisma.customer.updateMany({
      where: { id: customerId, restaurantId },
      data: { loyaltyTierId: newTier.id },
    })
  }
}
