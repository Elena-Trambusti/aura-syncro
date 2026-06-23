import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { ReservationValidationError, requiresDeposit } from '../lib/reservationRules'
import { createDepositCheckoutSession } from '../lib/depositCheckout'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { createReservation } from '../lib/createReservation'
import { dayBoundsInTimezone } from '../lib/romeDate'
import {
  confirmReservationWithTable,
  getAvailableTablesForReservation,
  syncTableOnReservationStatus,
} from '../lib/reservationTableSync'

export const reservationsRouter = Router()

reservationsRouter.get('/', requirePermission('reservations.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { date, status } = req.query
  const where: Record<string, unknown> = { ...tenantWhere(req) }

  let timeZone = 'Europe/Rome'
  if (date) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenantId(req) },
      select: { timezone: true },
    })
    timeZone = restaurant?.timezone ?? 'Europe/Rome'
    const { gte, lt } = dayBoundsInTimezone(date as string, timeZone)
    where.date = { gte, lt }
  }
  if (status) where.status = status

  const [reservations, settings] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        table: true,
        customer: { select: { id: true, name: true, phone: true, totalVisits: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.restaurantSettings.findUnique({ where: { restaurantId: tenantId(req) } }),
  ])
  const depositRequired = requiresDeposit(settings)
  res.json(reservations.map(r => ({ ...r, depositRequired })))
})

reservationsRouter.post('/:id/deposit-checkout', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const reservation = await prisma.reservation.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { restaurant: { select: { slug: true } } },
  })
  if (!reservation) {
    tenantNotFound(res, 'Prenotazione non trovata')
    return
  }

  try {
    const session = await createDepositCheckoutSession(reservation.id, reservation.restaurant.slug)
    res.json(session)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    if (code === 'ALREADY_PAID') {
      res.status(400).json({ error: 'Caparra già pagata' })
      return
    }
    if (code === 'PAYMENTS_DISABLED') {
      res.status(503).json({ error: 'Pagamenti online non configurati' })
      return
    }
    res.status(500).json({ error: 'Errore creazione checkout caparra' })
  }
})

reservationsRouter.get('/:id/available-tables', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tables = await getAvailableTablesForReservation(tenantId(req), req.params.id)
    res.json(tables)
  } catch (err) {
    if (err instanceof ReservationValidationError) {
      res.status(404).json({ error: err.message, code: err.code })
      return
    }
    throw err
  }
})

reservationsRouter.post('/:id/confirm', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ tableId: z.string().min(1) })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Seleziona un tavolo' })
    return
  }

  try {
    const reservation = await confirmReservationWithTable(
      tenantId(req),
      req.params.id,
      result.data.tableId,
    )
    const table = await prisma.table.findUnique({ where: { id: result.data.tableId } })
    io.to(tenantId(req)).emit('reservation:updated', reservation)
    if (table) io.to(tenantId(req)).emit('table:updated', table)
    res.json(reservation)
  } catch (err) {
    if (err instanceof ReservationValidationError) {
      res.status(409).json({ error: err.message, code: err.code })
      return
    }
    throw err
  }
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

  const reservationDate = new Date(result.data.date)
  try {
    const { reservation, depositRequired } = await createReservation({
      restaurantId: tenantId(req),
      guestName: result.data.guestName,
      guestPhone: result.data.guestPhone,
      guestEmail: result.data.guestEmail,
      covers: result.data.covers,
      date: reservationDate,
      duration: result.data.duration,
      tableId: result.data.tableId,
      notes: result.data.notes,
      internalNotes: result.data.internalNotes,
    })

    io.to(tenantId(req)).emit('reservation:created', reservation)
    if (reservation.tableId && reservation.status === 'CONFIRMED') {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'RESERVED' },
      })
      io.to(tenantId(req)).emit('table:updated', await prisma.table.findUnique({ where: { id: reservation.tableId } }))
    }
    res.status(201).json({ ...reservation, depositRequired })
  } catch (err) {
    if (err instanceof ReservationValidationError) {
      res.status(409).json({ error: err.message, code: err.code })
      return
    }
    throw err
  }
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
  const existing = await prisma.reservation.findFirst({
    where: scopedWhere(req, req.params.id),
    select: { id: true, tableId: true, status: true },
  })
  if (!existing) {
    tenantNotFound(res, 'Prenotazione non trovata')
    return
  }

  await prisma.reservation.updateMany({
    where: scopedWhere(req, req.params.id),
    data: { status },
  })

  await syncTableOnReservationStatus(tenantId(req), req.params.id, status)

  const reservation = await prisma.reservation.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { table: true },
  })
  if (reservation?.tableId) {
    const table = await prisma.table.findUnique({ where: { id: reservation.tableId } })
    if (table) io.to(tenantId(req)).emit('table:updated', table)
  }
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
