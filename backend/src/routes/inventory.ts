import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const inventoryRouter = Router()

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string(),
  quantity: z.number().min(0).default(0),
  minQuantity: z.number().min(0).default(0),
  cost: z.number().min(0).default(0),
  supplier: z.string().optional(),
  category: z.string().optional(),
})

inventoryRouter.get('/', requirePermission('inventory.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.inventoryItem.findMany({
    where: tenantWhere(req),
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  const alerts = items.filter(i => i.quantity <= i.minQuantity)
  res.json({ items, alerts })
})

inventoryRouter.post('/', requirePermission('inventory.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const result = itemSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const item = await prisma.inventoryItem.create({
    data: { ...result.data, restaurantId: tenantId(req) },
  })
  res.status(201).json(item)
})

inventoryRouter.put('/:id', requirePermission('inventory.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const result = itemSchema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const updated = await prisma.inventoryItem.updateMany({
    where: scopedWhere(req, req.params.id),
    data: result.data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Prodotto non trovato')
    return
  }
  const item = await prisma.inventoryItem.findFirst({ where: scopedWhere(req, req.params.id) })
  res.json(item)
})

inventoryRouter.patch('/:id/quantity', requirePermission('inventory.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    delta: z.number().finite(),
    operation: z.enum(['set', 'add']).optional().default('add'),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati quantità non validi' })
    return
  }
  const { delta, operation } = parsed.data

  const current = await prisma.inventoryItem.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!current) {
    tenantNotFound(res, 'Prodotto non trovato')
    return
  }

  const newQuantity = operation === 'set' ? delta : current.quantity + delta
  const quantityAfter = Math.max(0, newQuantity)

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.inventoryItem.updateMany({
      where: scopedWhere(req, req.params.id),
      data: { quantity: quantityAfter },
    })
    if (result.count === 0) return null

    await tx.inventoryAdjustment.create({
      data: {
        restaurantId: tenantId(req),
        inventoryItemId: req.params.id,
        userId: req.userId ?? null,
        delta: quantityAfter - current.quantity,
        quantityBefore: current.quantity,
        quantityAfter,
        reason: operation === 'set' ? 'manual_set' : 'manual_adjust',
      },
    })
    return tx.inventoryItem.findFirst({ where: scopedWhere(req, req.params.id) })
  })

  if (!updated) {
    tenantNotFound(res, 'Prodotto non trovato')
    return
  }
  res.json(updated)
})

inventoryRouter.delete('/:id', requirePermission('inventory.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.inventoryItem.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Prodotto non trovato')
    return
  }
  res.status(204).send()
})
