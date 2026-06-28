import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { transferOrderBetweenTables } from '../lib/transferTable'
import { dayBoundsInTimezone, formatRomeDate } from '../lib/romeDate'

export const tablesRouter = Router()

tablesRouter.get('/', requirePermission('tables.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: { timezone: true },
  })
  const timeZone = restaurant?.timezone ?? 'Europe/Rome'
  const today = formatRomeDate(new Date())
  const { gte, lt } = dayBoundsInTimezone(today, timeZone)

  const tables = await prisma.table.findMany({
    where: tenantWhere(req),
    include: {
      orders: {
        where: { status: { notIn: ['PAID', 'CANCELLED'] } },
        include: {
          items: { include: { menuItem: true } },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              loyaltyPoints: true,
              loyaltyTier: { select: { name: true, discountPct: true, color: true } },
            },
          },
        },
      },
      reservations: {
        where: {
          status: { in: ['PENDING', 'CONFIRMED', 'SEATED'] },
          date: { gte, lt },
        },
        select: {
          id: true,
          guestName: true,
          covers: true,
          date: true,
          duration: true,
          status: true,
        },
        orderBy: { date: 'asc' },
        take: 1,
      },
    },
    orderBy: { number: 'asc' },
  })
  res.json(tables)
})

tablesRouter.patch('/positions', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.array(z.object({
    id: z.string(),
    posX: z.number(),
    posY: z.number(),
    rotation: z.number().int().default(0),
  }))
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  // Update tables using a transaction for atomicity
  await prisma.$transaction(
    result.data.map(table => prisma.table.updateMany({
      where: scopedWhere(req, table.id),
      data: { posX: table.posX, posY: table.posY, rotation: table.rotation }
    }))
  )
  
  // Fetch the updated tables to emit via socket
  const updatedTables = await prisma.table.findMany({
    where: tenantWhere(req),
    orderBy: { number: 'asc' }
  })
  io.to(tenantId(req)).emit('tables:updated', updatedTables)
  res.json({ success: true, count: result.data.length })
})

tablesRouter.patch('/area', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    oldName: z.string().nullable(),
    newName: z.string(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const { oldName, newName } = result.data
  
  // Update all tables in this area
  const count = await prisma.table.updateMany({
    where: { restaurantId: tenantId(req), area: oldName },
    data: { area: newName }
  })
  
  if (count.count > 0) {
    const updatedTables = await prisma.table.findMany({
      where: tenantWhere(req),
      orderBy: { number: 'asc' }
    })
    io.to(tenantId(req)).emit('tables:updated', updatedTables)
  }
  
  res.json({ success: true, count: count.count })
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

  // Feature Gating: Subscription Plan
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: { subscriptionPlan: true },
  })
  
  if (restaurant?.subscriptionPlan === 'STARTER') {
    const existingTables = await prisma.table.findMany({
      where: tenantWhere(req),
      select: { area: true }
    })
    
    if (existingTables.length >= 12) {
      res.status(403).json({ error: 'Il piano Starter include un massimo di 12 tavoli. Passa al piano Premium per aggiungere più tavoli.' })
      return
    }
    
    const existingAreas = new Set(existingTables.map(t => t.area || 'Sala'))
    const requestedArea = result.data.area || 'Sala'
    
    if (!existingAreas.has(requestedArea) && existingAreas.size >= 1) {
      res.status(403).json({ error: 'Il piano Starter include una singola area (Sala). Passa al piano Premium per aggiungere nuove aree come la Terrazza.' })
      return
    }
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

  // Feature Gating per Area (Update)
  if (result.data.area) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenantId(req) },
      select: { subscriptionPlan: true },
    })
    
    if (restaurant?.subscriptionPlan === 'STARTER') {
      const existingTables = await prisma.table.findMany({
        where: tenantWhere(req),
        select: { area: true, id: true }
      })
      
      // Count areas excluding the current table's old area if it's changing
      const existingAreas = new Set(existingTables.filter(t => t.id !== req.params.id).map(t => t.area || 'Sala'))
      const requestedArea = result.data.area || 'Sala'
      
      if (!existingAreas.has(requestedArea) && existingAreas.size >= 1) {
        res.status(403).json({ error: 'Il piano Starter include una singola area (Sala). Passa al piano Premium per aggiungere nuove aree come la Terrazza.' })
        return
      }
    }
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
  const parsed = z.object({
    status: z.enum(['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING']),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Stato tavolo non valido' })
    return
  }
  const { status } = parsed.data

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

tablesRouter.post(
  '/:sourceTableId/transfer',
  requirePermission('orders.items'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const schema = z.object({
      targetTableId: z.string().min(1),
    })
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
      return
    }

    try {
      const moved = await transferOrderBetweenTables(
        tenantId(req),
        req.params.sourceTableId,
        result.data.targetTableId,
      )

      io.to(tenantId(req)).emit('table:updated', moved.sourceTable)
      io.to(tenantId(req)).emit('table:updated', moved.targetTable)
      io.to(tenantId(req)).emit('order:updated', moved.order)

      res.json(moved)
      return
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'TABLE_TRANSFER_SAME_TABLE') {
        res.status(400).json({ error: 'Seleziona un tavolo diverso', code })
        return
      }
      if (code === 'TABLE_TRANSFER_NO_ACTIVE_ORDER') {
        res.status(400).json({ error: 'Nessun ordine attivo sul tavolo selezionato', code })
        return
      }
      if (code === 'TABLE_TRANSFER_SOURCE_NOT_FOUND' || code === 'TABLE_TRANSFER_TARGET_NOT_FOUND') {
        tenantNotFound(res, 'Tavolo non trovato')
        return
      }
      if (code === 'TABLE_TRANSFER_TARGET_UNAVAILABLE' || code === 'TABLE_TRANSFER_TARGET_OCCUPIED') {
        res.status(409).json({ error: 'Il tavolo di destinazione non e disponibile', code })
        return
      }
      throw err
    }
  },
)

tablesRouter.delete('/:id', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const table = await prisma.table.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!table) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }
  if (table.status !== 'FREE') {
    res.status(409).json({ error: 'Impossibile eliminare un tavolo attualmente occupato o riservato. Libera prima il tavolo.' })
    return
  }

  const deleted = await prisma.table.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }
  io.to(tenantId(req)).emit('table:deleted', { id: req.params.id })
  res.status(204).send()
})
