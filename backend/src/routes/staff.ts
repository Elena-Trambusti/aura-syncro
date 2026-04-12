import { Router, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const staffRouter = Router()

staffRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const staff = await prisma.user.findMany({
    where: { restaurantId: req.restaurantId! },
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, active: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
  res.json(staff)
})

staffRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['MANAGER', 'WAITER', 'KITCHEN', 'CASHIER']),
    phone: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const hashedPassword = await bcrypt.hash(result.data.password, 12)
  const user = await prisma.user.create({
    data: {
      ...result.data,
      password: hashedPassword,
      restaurantId: req.restaurantId!,
    },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  })
  res.status(201).json(user)
})

staffRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { password, ...data } = req.body
  const updateData: Record<string, unknown> = { ...data }
  if (password) updateData.password = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  })
  res.json(user)
})

// Turni
staffRouter.get('/shifts', async (req: AuthRequest, res: Response): Promise<void> => {
  const { week } = req.query
  const startDate = week ? new Date(week as string) : (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d
  })()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId: req.restaurantId!,
      date: { gte: startDate, lt: endDate },
    },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })
  res.json(shifts)
})

staffRouter.post('/shifts', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    userId: z.string(),
    date: z.string().datetime(),
    startTime: z.string(),
    endTime: z.string(),
    role: z.string().optional(),
    notes: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const shift = await prisma.shift.create({
    data: {
      ...result.data,
      date: new Date(result.data.date),
      restaurantId: req.restaurantId!,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  res.status(201).json(shift)
})

staffRouter.patch('/shifts/:id/clock', async (req: AuthRequest, res: Response): Promise<void> => {
  const { action } = req.body
  const data = action === 'in'
    ? { clockIn: new Date(), status: 'ACTIVE' as const }
    : { clockOut: new Date(), status: 'COMPLETED' as const }

  const shift = await prisma.shift.update({ where: { id: req.params.id }, data })
  res.json(shift)
})

staffRouter.delete('/shifts/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.shift.delete({ where: { id: req.params.id } })
  res.status(204).send()
})
