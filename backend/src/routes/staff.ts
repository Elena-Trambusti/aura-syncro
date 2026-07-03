import { Router, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { io } from '../index'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { weekBoundsInTimezone, parseLocalDateTimeInTimezone } from '../lib/romeDate'
import { asyncHandler } from '../lib/asyncHandler'

export const staffRouter = Router()

const assignableRoles = ['MANAGER', 'WAITER', 'CHEF', 'BARTENDER', 'HOST'] as const

function isDuplicateEmailError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

function parseShiftDate(dateInput: string, timeZone: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return parseLocalDateTimeInTimezone(dateInput, '12:00', timeZone)
  }
  return new Date(dateInput)
}

function isEndAfterStart(startTime: string, endTime: string): boolean {
  return startTime < endTime
}

staffRouter.get('/tip-recipients', requirePermission('orders.pay'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const staff = await prisma.user.findMany({
    where: {
      ...tenantWhere(req),
      active: true,
      role: { in: ['WAITER', 'MANAGER', 'OWNER', 'HOST', 'BARTENDER'] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  res.json(staff)
}))

staffRouter.get('/', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const staff = await prisma.user.findMany({
    where: tenantWhere(req),
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, active: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
  res.json(staff)
}))

staffRouter.post('/', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(assignableRoles),
    phone: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const hashedPassword = await bcrypt.hash(result.data.password, 12)
  try {
    const user = await prisma.user.create({
      data: {
        ...result.data,
        password: hashedPassword,
        restaurantId: tenantId(req),
      },
      select: { id: true, name: true, email: true, role: true, phone: true, active: true },
    })
    res.status(201).json(user)
  } catch (err) {
    if (isDuplicateEmailError(err)) {
      res.status(409).json({ error: 'Email già registrata', code: 'EMAIL_ALREADY_EXISTS' })
      return
    }
    throw err
  }
}))

staffRouter.put('/:id', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
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
  if (result.data.password) {
    updateData.password = await bcrypt.hash(result.data.password, 12)
    updateData.tokenVersion = { increment: 1 }
  }

  try {
    const updated = await prisma.user.updateMany({
      where: scopedWhere(req, req.params.id),
      data: updateData,
    })
    if (updated.count === 0) {
      tenantNotFound(res, 'Utente non trovato')
      return
    }
  } catch (err) {
    if (isDuplicateEmailError(err)) {
      res.status(409).json({ error: 'Email già registrata', code: 'EMAIL_ALREADY_EXISTS' })
      return
    }
    throw err
  }

  if (result.data.active === false) {
    await prisma.user.updateMany({
      where: scopedWhere(req, req.params.id),
      data: { tokenVersion: { increment: 1 } },
    })
  }

  const user = await prisma.user.findFirst({
    where: scopedWhere(req, req.params.id),
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  })
  res.json(user)
}))

staffRouter.get('/shifts', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { week } = req.query
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: { timezone: true },
  })
  const timeZone = restaurant?.timezone ?? 'Europe/Rome'

  let weekStartStr: string
  if (week && typeof week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    weekStartStr = week
  } else {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(monday.getDate() + diff)
    weekStartStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  }

  const { gte, lt } = weekBoundsInTimezone(weekStartStr, timeZone)

  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId: tenantId(req),
      date: { gte, lt },
    },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })
  res.json(shifts)
}))

staffRouter.post('/shifts', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    userId: z.string(),
    date: z.union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.string().datetime(),
    ]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    role: z.string().optional(),
    notes: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  if (!isEndAfterStart(result.data.startTime, result.data.endTime)) {
    res.status(400).json({
      error: 'L\'orario di fine deve essere successivo all\'inizio',
      code: 'SHIFT_INVALID_TIME',
    })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: { timezone: true },
  })
  const timeZone = restaurant?.timezone ?? 'Europe/Rome'

  const user = await prisma.user.findFirst({
    where: { id: result.data.userId, restaurantId: tenantId(req) },
    select: { id: true, role: true, active: true },
  })
  if (!user) {
    tenantNotFound(res, 'Utente non trovato')
    return
  }
  if (!user.active) {
    res.status(400).json({ error: 'Membro disattivato', code: 'STAFF_INACTIVE' })
    return
  }
  if (user.role === 'OWNER') {
    res.status(400).json({ error: 'Il titolare non può essere assegnato ai turni', code: 'SHIFT_OWNER_NOT_ALLOWED' })
    return
  }

  const shift = await prisma.shift.create({
    data: {
      userId: result.data.userId,
      date: parseShiftDate(result.data.date, timeZone),
      startTime: result.data.startTime,
      endTime: result.data.endTime,
      role: result.data.role,
      notes: result.data.notes,
      restaurantId: tenantId(req),
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  io.to(tenantId(req)).emit('shift:created', shift)
  res.status(201).json(shift)
}))

staffRouter.patch('/shifts/:id/clock', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ action: z.enum(['in', 'out']) }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Azione non valida' })
    return
  }
  const { action } = parsed.data

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
}))

staffRouter.delete('/shifts/:id', requirePermission('staff.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.shift.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Turno non trovato')
    return
  }
  io.to(tenantId(req)).emit('shift:deleted', { id: req.params.id })
  res.status(204).send()
}))
