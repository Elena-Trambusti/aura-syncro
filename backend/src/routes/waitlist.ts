import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const waitlistRouter = Router()

waitlistRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { date } = req.query
  const where: Record<string, unknown> = { ...tenantWhere(req), status: 'WAITING' }
  if (date) {
    const d = new Date(date as string)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    where.requestedDate = { gte: d, lt: next }
  }
  const entries = await prisma.waitlistEntry.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  })
  res.json(entries)
})

waitlistRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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

waitlistRouter.patch('/:id/notify', async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await updateWaitlistEntry(req, res, { status: 'NOTIFIED', notifiedAt: new Date() })
  if (entry) res.json(entry)
})

waitlistRouter.patch('/:id/confirm', async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await updateWaitlistEntry(req, res, { status: 'CONFIRMED' })
  if (entry) res.json(entry)
})

waitlistRouter.patch('/:id/cancel', async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await updateWaitlistEntry(req, res, { status: 'CANCELLED' })
  if (entry) res.json(entry)
})

waitlistRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.waitlistEntry.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Voce non trovata')
    return
  }
  res.status(204).send()
})
