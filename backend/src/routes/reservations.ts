import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { io } from '../index'

export const reservationsRouter = Router()

reservationsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { date, status } = req.query
  const where: Record<string, unknown> = { restaurantId: req.restaurantId! }

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

reservationsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const reservation = await prisma.reservation.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    include: { table: true, customer: true },
  })
  if (!reservation) {
    res.status(404).json({ error: 'Prenotazione non trovata' })
    return
  }
  res.json(reservation)
})

reservationsRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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

  let customerId: string | undefined
  if (result.data.guestEmail) {
    const customer = await prisma.customer.upsert({
      where: { restaurantId_email: { restaurantId: req.restaurantId!, email: result.data.guestEmail } },
      update: { name: result.data.guestName, phone: result.data.guestPhone },
      create: {
        restaurantId: req.restaurantId!,
        name: result.data.guestName,
        email: result.data.guestEmail,
        phone: result.data.guestPhone,
      },
    })
    customerId = customer.id
  }

  const reservation = await prisma.reservation.create({
    data: {
      ...result.data,
      date: new Date(result.data.date),
      restaurantId: req.restaurantId!,
      customerId,
    },
    include: { table: true, customer: true },
  })

  io.to(req.restaurantId!).emit('reservation:created', reservation)
  res.status(201).json(reservation)
})

reservationsRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const reservation = await prisma.reservation.update({
    where: { id: req.params.id },
    data: {
      ...req.body,
      ...(req.body.date ? { date: new Date(req.body.date) } : {}),
    },
    include: { table: true, customer: true },
  })
  io.to(req.restaurantId!).emit('reservation:updated', reservation)
  res.json(reservation)
})

reservationsRouter.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body
  const reservation = await prisma.reservation.update({
    where: { id: req.params.id },
    data: { status },
    include: { table: true },
  })
  io.to(req.restaurantId!).emit('reservation:updated', reservation)
  res.json(reservation)
})

reservationsRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.reservation.delete({ where: { id: req.params.id } })
  io.to(req.restaurantId!).emit('reservation:deleted', { id: req.params.id })
  res.status(204).send()
})
