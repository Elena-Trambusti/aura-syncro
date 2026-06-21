import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const tablesRouter = Router()

tablesRouter.get('/', requirePermission('tables.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const tables = await prisma.table.findMany({
    where: tenantWhere(req),
    include: {
      orders: {
        where: { status: { notIn: ['PAID', 'CANCELLED'] } },
        include: { items: { include: { menuItem: true } } },
      },
    },
    orderBy: { number: 'asc' },
  })
  res.json(tables)
})

tablesRouter.post('/', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    number: z.number().int().positive(),
    name: z.string().optional(),
    seats: z.number().int().positive().default(4),
    posX: z.number().default(0),
    posY: z.number().default(0),
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).default('SQUARE'),
    area: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const table = await prisma.table.create({
    data: { ...result.data, restaurantId: tenantId(req) },
  })
  io.to(tenantId(req)).emit('table:created', table)
  res.status(201).json(table)
})

tablesRouter.put('/:id', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    number: z.number().int().positive().optional(),
    name: z.string().optional(),
    seats: z.number().int().positive().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).optional(),
    area: z.string().optional(),
    status: z.enum(['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING']).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const updated = await prisma.table.updateMany({
    where: scopedWhere(req, req.params.id),
    data: result.data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }
  const table = await prisma.table.findFirst({ where: scopedWhere(req, req.params.id) })
  io.to(tenantId(req)).emit('table:updated', table)
  res.json(table)
})

tablesRouter.patch('/:id/status', requirePermission('tables.status'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body
  const updated = await prisma.table.updateMany({
    where: scopedWhere(req, req.params.id),
    data: { status },
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }
  const table = await prisma.table.findFirst({ where: scopedWhere(req, req.params.id) })
  io.to(tenantId(req)).emit('table:updated', table)
  res.json(table)
})

tablesRouter.delete('/:id', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.table.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }
  io.to(tenantId(req)).emit('table:deleted', { id: req.params.id })
  res.status(204).send()
})
