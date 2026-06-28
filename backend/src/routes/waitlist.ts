import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { createReservation } from '../lib/createReservation'
import { dayBoundsInTimezone } from '../lib/romeDate'

export const waitlistRouter = Router()

const ACTIVE_WAITLIST_STATUSES = ['WAITING', 'NOTIFIED'] as const

waitlistRouter.get('/', requirePermission('reservations.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { date } = req.query
  const where: Record<string, unknown> = {
    ...tenantWhere(req),
    status: { in: [...ACTIVE_WAITLIST_STATUSES] },
  }
  if (date && typeof date === 'string') {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenantId(req) },
      select: { timezone: true },
    })
    const { gte, lt } = dayBoundsInTimezone(date, restaurant?.timezone ?? 'Europe/Rome')
    where.requestedDate = { gte, lt }
  }
  const entries = await prisma.waitlistEntry.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  })
  res.json(entries)
})

waitlistRouter.post('/', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    guestName: z.string().min(1),
    guestPhone: z.string().min(1),
    guestEmail: z.string().email().optional(),
    covers: z.number().int().min(1).default(2),
    requestedDate: z.string().datetime(),
    notes: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const entry = await prisma.waitlistEntry.create({
    data: {
      ...result.data,
      requestedDate: new Date(result.data.requestedDate),
      restaurantId: tenantId(req),
    },
  })
  io.to(tenantId(req)).emit('waitlist:created', entry)
  res.status(201).json(entry)
})

async function updateWaitlistEntry(req: AuthRequest, res: Response, data: Record<string, unknown>) {
  const updated = await prisma.waitlistEntry.updateMany({
    where: scopedWhere(req, req.params.id),
    data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Voce non trovata')
    return null
  }
  return prisma.waitlistEntry.findFirst({ where: scopedWhere(req, req.params.id) })
}

waitlistRouter.patch('/:id/notify', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await updateWaitlistEntry(req, res, { notifiedAt: new Date(), status: 'NOTIFIED' })
  if (entry) {
    io.to(tenantId(req)).emit('waitlist:updated', entry)
    res.json(entry)
  }
})

waitlistRouter.patch('/:id/confirm', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = tenantId(req)
  const entryId = req.params.id

  const entry = await prisma.waitlistEntry.findFirst({
    where: scopedWhere(req, entryId),
  })
  if (!entry) {
    tenantNotFound(res, 'Voce non trovata')
    return
  }
  if (entry.status === 'CONFIRMED') {
    res.json({ waitlistEntry: entry, duplicate: true })
    return
  }
  if (!ACTIVE_WAITLIST_STATUSES.includes(entry.status as typeof ACTIVE_WAITLIST_STATUSES[number])) {
    res.status(400).json({ error: 'Voce non confermabile', code: 'INVALID_STATUS' })
    return
  }

  const locked = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, restaurantId, status: { in: [...ACTIVE_WAITLIST_STATUSES] } },
    data: { status: 'CONFIRMED' },
  })
  if (locked.count === 0) {
    res.status(409).json({ error: 'Voce già elaborata', code: 'ALREADY_PROCESSED' })
    return
  }

  try {
    const { reservation } = await createReservation({
      restaurantId,
      guestName: entry.guestName,
      guestPhone: entry.guestPhone,
      guestEmail: entry.guestEmail ?? undefined,
      covers: entry.covers,
      date: entry.requestedDate,
      notes: entry.notes ?? undefined,
      internalNotes: 'Promossa da lista d\'attesa',
    })

    const waitlistEntry = { ...entry, status: 'CONFIRMED' as const }
    io.to(restaurantId).emit('reservation:created', reservation)
    io.to(restaurantId).emit('waitlist:updated', waitlistEntry)
    res.json({ reservation, waitlistEntry })
  } catch (err) {
    await prisma.waitlistEntry.updateMany({
      where: { id: entryId, restaurantId, status: 'CONFIRMED' },
      data: { status: entry.status },
    })
    const code = err instanceof Error && 'code' in err ? String((err as { code: string }).code) : 'UNKNOWN'
    res.status(400).json({ error: err instanceof Error ? err.message : 'Impossibile creare prenotazione', code })
  }
})

waitlistRouter.patch('/:id/cancel', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await updateWaitlistEntry(req, res, { status: 'CANCELLED' })
  if (entry) {
    io.to(tenantId(req)).emit('waitlist:updated', entry)
    res.json(entry)
  }
})

waitlistRouter.delete('/:id', requirePermission('reservations.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.waitlistEntry.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Voce non trovata')
    return
  }
  io.to(tenantId(req)).emit('waitlist:deleted', { id: req.params.id })
  res.status(204).send()
})
