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

  const updated = await prisma.$transaction(async tx => {
    const current = await tx.inventoryItem.findFirst({ where: scopedWhere(req, req.params.id) })
    if (!current) return null

    let quantityAfter: number
    if (operation === 'set') {
      quantityAfter = Math.max(0, delta)
      const result = await tx.inventoryItem.updateMany({
        where: { ...scopedWhere(req, req.params.id), quantity: current.quantity },
        data: { quantity: quantityAfter },
      })
      if (result.count === 0) {
        // Race: ri-leggi e forza set
        await tx.inventoryItem.updateMany({
          where: scopedWhere(req, req.params.id),
          data: { quantity: quantityAfter },
        })
      }
    } else {
      // atomic increment via raw-style: clamp at 0 after add
      const tentative = current.quantity + delta
      quantityAfter = Math.max(0, tentative)
      const result = await tx.inventoryItem.updateMany({
        where: { ...scopedWhere(req, req.params.id), quantity: current.quantity },
        data: { quantity: quantityAfter },
      })
      if (result.count === 0) {
        const fresh = await tx.inventoryItem.findFirst({ where: scopedWhere(req, req.params.id) })
        if (!fresh) return null
        quantityAfter = Math.max(0, fresh.quantity + delta)
        await tx.inventoryItem.updateMany({
          where: scopedWhere(req, req.params.id),
          data: { quantity: quantityAfter },
        })
      }
    }

    const afterRow = await tx.inventoryItem.findFirst({ where: scopedWhere(req, req.params.id) })
    if (!afterRow) return null

    await tx.inventoryAdjustment.create({
      data: {
        restaurantId: tenantId(req),
        inventoryItemId: req.params.id,
        userId: req.userId ?? null,
        delta: afterRow.quantity - current.quantity,
        quantityBefore: current.quantity,
        quantityAfter: afterRow.quantity,
        reason: operation === 'set' ? 'manual_set' : 'manual_adjust',
      },
    })
    return afterRow
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
