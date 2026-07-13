import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { transferOrderBetweenTables } from '../lib/transferTable'
import { countActiveTableOrders } from '../lib/orderSession'
import { assertTableCanBeSetFree, TABLE_HAS_ACTIVE_ORDER } from '../lib/tableReleaseGuard'
import { isManualTableTransitionAllowed, TABLE_TRANSITION_ERROR } from '../lib/tableStatus'
import { signTableToken } from '../lib/tableToken'
import { dayBoundsInTimezone, formatRomeDate } from '../lib/romeDate'
import { writeAuditLog } from '../lib/auditLog'

import { floorPlanLayoutSchema, parseFloorPlanLayout, EMPTY_FLOOR_PLAN_LAYOUT } from '../lib/floorPlanLayout'

export const tablesRouter = Router()

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

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
        where: {
          OR: [
            { status: { notIn: ['PAID', 'CANCELLED'] } },
            {
              status: 'PAID',
              items: { some: { status: { notIn: ['SERVED', 'CANCELLED'] } } },
            },
          ],
          NOT: {
            status: 'PENDING',
            stripeSessionId: { not: null },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          total: true,
          type: true,
          createdAt: true,
          stripeSessionId: true,
          items: { select: { status: true } },
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
      data: {
        posX: clampPercent(table.posX),
        posY: clampPercent(table.posY),
        rotation: Number.isFinite(table.rotation) ? table.rotation : 0,
      }
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

tablesRouter.get('/floor-layout', requirePermission('tables.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: tenantId(req) },
    select: { floorPlanLayout: true },
  })
  if (!settings) {
    res.json(EMPTY_FLOOR_PLAN_LAYOUT)
    return
  }
  res.json(parseFloorPlanLayout(settings.floorPlanLayout))
})

tablesRouter.patch('/floor-layout', requirePermission('tables.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const result = floorPlanLayoutSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Layout non valido', details: result.error.flatten() })
    return
  }

  const updated = await prisma.restaurantSettings.upsert({
    where: { restaurantId: tenantId(req) },
    create: {
      restaurantId: tenantId(req),
      floorPlanLayout: result.data,
    },
    update: {
      floorPlanLayout: result.data,
    },
    select: { floorPlanLayout: true },
  })

  io.to(tenantId(req)).emit('floor-layout:updated', result.data)
  res.json(parseFloorPlanLayout(updated.floorPlanLayout))
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
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE', 'BAR_STOOL', 'BOOTH']).default('SQUARE'),
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
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE', 'BAR_STOOL', 'BOOTH']).optional(),
    area: z.string().optional(),
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

  const currentTable = await prisma.table.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!currentTable) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }

  if (status !== currentTable.status && !isManualTableTransitionAllowed(currentTable.status, status)) {
    res.status(409).json({
      error: 'Transizione di stato non consentita',
      code: TABLE_TRANSITION_ERROR,
      from: currentTable.status,
      to: status,
    })
    return
  }

  if (status === 'FREE') {
    const activeCount = await countActiveTableOrders(req.params.id, tenantId(req))
    try {
      assertTableCanBeSetFree(activeCount)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === TABLE_HAS_ACTIVE_ORDER) {
        res.status(409).json({
          error: err instanceof Error ? err.message : 'Impossibile liberare il tavolo',
          code: TABLE_HAS_ACTIVE_ORDER,
        })
        return
      }
      throw err
    }
  }

  const updated = await prisma.table.update({
    where: { id: req.params.id, restaurantId: tenantId(req) },
    data: {
      status,
      ...(status === 'FREE'
        ? { servingUserId: null, servingUserName: null, servingClaimedAt: null }
        : {}),
    },
  })

  res.json(updated)
  setImmediate(() => {
    io.to(tenantId(req)).emit('table:updated', updated)
  })
})

tablesRouter.post('/:id/claim', requirePermission('tables.status'), async (req: AuthRequest, res: Response): Promise<void> => {
  const table = await prisma.table.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!table) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }

  if (table.servingUserId && table.servingUserId !== req.userId) {
    res.status(409).json({
      error: 'Tavolo già in carico a un altro cameriere',
      code: 'TABLE_CLAIMED',
      servingUserName: table.servingUserName,
    })
    return
  }

  const user = await prisma.user.findFirst({
    where: { id: req.userId!, restaurantId: tenantId(req) },
    select: { name: true },
  })

  const updated = await prisma.table.update({
    where: { id: table.id },
    data: {
      servingUserId: req.userId!,
      servingUserName: user?.name ?? 'Staff',
      servingClaimedAt: new Date(),
    },
  })

  writeAuditLog({
    restaurantId: tenantId(req),
    userId: req.userId,
    action: 'TABLE_CLAIM',
    entityType: 'Table',
    entityId: table.id,
    metadata: { tableNumber: table.number },
    req,
  })

  res.json(updated)
  setImmediate(() => io.to(tenantId(req)).emit('table:updated', updated))
})

tablesRouter.post('/:id/release', requirePermission('tables.status'), async (req: AuthRequest, res: Response): Promise<void> => {
  const table = await prisma.table.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!table) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }

  if (table.servingUserId && table.servingUserId !== req.userId && req.userRole !== 'OWNER' && req.userRole !== 'MANAGER') {
    res.status(403).json({ error: 'Solo chi ha preso in carico il tavolo può rilasciarlo', code: 'TABLE_CLAIM_FORBIDDEN' })
    return
  }

  const updated = await prisma.table.update({
    where: { id: table.id },
    data: {
      servingUserId: null,
      servingUserName: null,
      servingClaimedAt: null,
    },
  })

  writeAuditLog({
    restaurantId: tenantId(req),
    userId: req.userId,
    action: 'TABLE_RELEASE',
    entityType: 'Table',
    entityId: table.id,
    metadata: { tableNumber: table.number },
    req,
  })

  res.json(updated)
  setImmediate(() => io.to(tenantId(req)).emit('table:updated', updated))
})

tablesRouter.get('/:number/qr-token', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const tableNumber = Number.parseInt(req.params.number, 10)
  if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
    res.status(400).json({ error: 'Numero tavolo non valido' })
    return
  }
  const table = await prisma.table.findFirst({
    where: { restaurantId: tenantId(req), number: tableNumber },
    select: { id: true, number: true },
  })
  if (!table) {
    tenantNotFound(res, 'Tavolo non trovato')
    return
  }
  const token = signTableToken(tenantId(req), table.number)
  res.json({ tableNumber: table.number, token })
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

      res.json(moved)
      setImmediate(() => {
        const rid = tenantId(req)
        io.to(rid).emit('table:updated', moved.sourceTable)
        io.to(rid).emit('table:updated', moved.targetTable)
        io.to(rid).emit('order:updated', moved.order)
      })
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
