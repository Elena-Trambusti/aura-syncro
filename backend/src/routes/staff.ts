import { Router, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const staffRouter = Router()

const assignableRoles = ['MANAGER', 'WAITER', 'CHEF'] as const

staffRouter.get('/', requirePermission('staff.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const staff = await prisma.user.findMany({
    where: tenantWhere(req),
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, active: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
  res.json(staff)
})

staffRouter.post('/', requirePermission('staff.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(assignableRoles),
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
      restaurantId: tenantId(req),
    },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  })
  res.status(201).json(user)
})

staffRouter.put('/:id', requirePermission('staff.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.enum(assignableRoles).optional(),
    phone: z.string().optional().nullable(),
    active: z.boolean().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const target = await prisma.user.findFirst({
    where: scopedWhere(req, req.params.id),
    select: { id: true, role: true },
  })
  if (!target) {
    tenantNotFound(res, 'Utente non trovato')
    return
  }

  if (target.role === 'OWNER' && req.userRole !== 'OWNER') {
    res.status(403).json({ error: 'Solo il titolare può modificare il titolare' })
    return
  }

  const updateData: Record<string, unknown> = { ...result.data }
  if (result.data.password) updateData.password = await bcrypt.hash(result.data.password, 12)

  const updated = await prisma.user.updateMany({
    where: scopedWhere(req, req.params.id),
    data: updateData,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Utente non trovato')
    return
  }

  const user = await prisma.user.findFirst({
    where: scopedWhere(req, req.params.id),
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  })
  res.json(user)
})

staffRouter.get('/shifts', async (req: AuthRequest, res: Response): Promise<void> => {
  const { week } = req.query
  const startDate = week ? new Date(week as string) : (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d
  })()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId: tenantId(req),
      date: { gte: startDate, lt: endDate },
    },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })
  res.json(shifts)
})

staffRouter.post('/shifts', requirePermission('staff.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
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

  const user = await prisma.user.findFirst({
    where: { id: result.data.userId, restaurantId: tenantId(req) },
  })
  if (!user) {
    tenantNotFound(res, 'Utente non trovato')
    return
  }

  const shift = await prisma.shift.create({
    data: {
      ...result.data,
      date: new Date(result.data.date),
      restaurantId: tenantId(req),
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  io.to(tenantId(req)).emit('shift:created', shift)
  res.status(201).json(shift)
})

staffRouter.patch('/shifts/:id/clock', async (req: AuthRequest, res: Response): Promise<void> => {
  const { action } = req.body
  const data = action === 'in'
    ? { clockIn: new Date(), status: 'ACTIVE' as const }
    : { clockOut: new Date(), status: 'COMPLETED' as const }

  const updated = await prisma.shift.updateMany({
    where: scopedWhere(req, req.params.id),
    data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Turno non trovato')
    return
  }
  const shift = await prisma.shift.findFirst({ where: scopedWhere(req, req.params.id) })
  if (shift) io.to(tenantId(req)).emit('shift:updated', shift)
  res.json(shift)
})

staffRouter.delete('/shifts/:id', requirePermission('staff.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.shift.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Turno non trovato')
    return
  }
  io.to(tenantId(req)).emit('shift:deleted', { id: req.params.id })
  res.status(204).send()
})
