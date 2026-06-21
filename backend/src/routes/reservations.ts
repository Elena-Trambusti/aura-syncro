import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { validateReservationSlot, ReservationValidationError, requiresDeposit } from '../lib/reservationRules'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const reservationsRouter = Router()

reservationsRouter.get('/', requirePermission('reservations.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { date, status } = req.query
  const where: Record<string, unknown> = { ...tenantWhere(req) }

  if (date) {
    const d = new Date(date as string)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    where.date = { gte: d, lt: next }
  }
  if (status) where.status = status

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      table: true,
      customer: { select: { id: true, name: true, phone: true, totalVisits: true } },
    },
    orderBy: { date: 'asc' },
  })
  res.json(reservations)
})

reservationsRouter.get('/:id', requirePermission('reservations.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const reservation = await prisma.reservation.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { table: true, customer: true },
  })
  if (!reservation) {
    tenantNotFound(res, 'Prenotazione non trovata')
    return
  }
  res.json(reservation)
})

reservationsRouter.post('/', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    guestName: z.string().min(2),
    guestPhone: z.string().min(6),
    guestEmail: z.string().email().optional(),
    covers: z.number().int().positive(),
    date: z.string().datetime(),
    duration: z.number().int().default(90),
    tableId: z.string().optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  if (result.data.tableId) {
    const table = await prisma.table.findFirst({
      where: { id: result.data.tableId, restaurantId: tenantId(req) },
    })
    if (!table) {
      tenantNotFound(res, 'Tavolo non trovato')
      return
    }
  }

  let customerId: string | undefined
  if (result.data.guestEmail) {
    const customer = await prisma.customer.upsert({
      where: { restaurantId_email: { restaurantId: tenantId(req), email: result.data.guestEmail } },
      update: { name: result.data.guestName, phone: result.data.guestPhone },
      create: {
        restaurantId: tenantId(req),
        name: result.data.guestName,
        email: result.data.guestEmail,
        phone: result.data.guestPhone,
      },
    })
    customerId = customer.id
  }

  const reservationDate = new Date(result.data.date)
  let slotStatus: 'PENDING' | 'CONFIRMED' = 'PENDING'
  try {
    const slot = await validateReservationSlot(tenantId(req), {
      date: reservationDate,
      covers: result.data.covers,
      duration: result.data.duration,
      tableId: result.data.tableId,
    })
    slotStatus = slot.status
  } catch (err) {
    if (err instanceof ReservationValidationError) {
      res.status(409).json({ error: err.message, code: err.code })
      return
    }
    throw err
  }

  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: tenantId(req) } })
  const depositRequired = requiresDeposit(settings)

  const reservation = await prisma.reservation.create({
    data: {
      ...result.data,
      date: reservationDate,
      status: slotStatus,
      restaurantId: tenantId(req),
      customerId,
    },
    include: { table: true, customer: true },
  })

  io.to(tenantId(req)).emit('reservation:created', reservation)
  res.status(201).json({ ...reservation, depositRequired })
})

reservationsRouter.put('/:id', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    guestName: z.string().min(2).optional(),
    guestPhone: z.string().min(6).optional(),
    guestEmail: z.string().email().optional(),
    covers: z.number().int().positive().optional(),
    date: z.string().datetime().optional(),
    duration: z.number().int().optional(),
    tableId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    status: z.enum(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  if (result.data.tableId) {
    const table = await prisma.table.findFirst({
      where: { id: result.data.tableId, restaurantId: tenantId(req) },
    })
    if (!table) {
      tenantNotFound(res, 'Tavolo non trovato')
      return
    }
  }

  const updated = await prisma.reservation.updateMany({
    where: scopedWhere(req, req.params.id),
    data: {
      ...result.data,
      ...(result.data.date ? { date: new Date(result.data.date) } : {}),
    },
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Prenotazione non trovata')
    return
  }

  const reservation = await prisma.reservation.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { table: true, customer: true },
  })
  io.to(tenantId(req)).emit('reservation:updated', reservation)
  res.json(reservation)
})

reservationsRouter.patch('/:id/status', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body
  const updated = await prisma.reservation.updateMany({
    where: scopedWhere(req, req.params.id),
    data: { status },
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Prenotazione non trovata')
    return
  }
  const reservation = await prisma.reservation.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { table: true },
  })
  io.to(tenantId(req)).emit('reservation:updated', reservation)
  res.json(reservation)
})

reservationsRouter.delete('/:id', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.reservation.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Prenotazione non trovata')
    return
  }
  io.to(tenantId(req)).emit('reservation:deleted', { id: req.params.id })
  res.status(204).send()
})
