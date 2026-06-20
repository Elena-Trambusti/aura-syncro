import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { buildCustomerName, splitCustomerName } from '../lib/crmCustomer'
import { scopedWhere, tenantNotFound } from '../lib/tenant'

export const customersRouter = Router()

function serializeCustomer(customer: {
  id: string
  restaurantId: string
  firstName: string
  lastName: string
  name: string
  email: string | null
  phone: string | null
  birthdate: Date | null
  notes: string | null
  allergens: string | null
  tags: string[]
  loyaltyPoints: number
  totalVisits: number
  totalSpent: number
  lastVisit: Date | null
  loyaltyTierId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const firstName = customer.firstName || splitCustomerName(customer.name).firstName
  const lastName = customer.lastName || splitCustomerName(customer.name).lastName
  return {
    ...customer,
    firstName,
    lastName,
    name: buildCustomerName(firstName, lastName) || customer.name,
    birthDate: customer.birthdate,
  }
}

customersRouter.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const customers = await prisma.customer.findMany({
    where: { restaurantId },
    select: { totalSpent: true, totalVisits: true, tags: true },
  })

  const total = customers.length
  const vipCount = customers.filter(c =>
    c.tags.includes('VIP') || c.totalVisits >= 10 || c.totalSpent >= 500,
  ).length
  const avgSpent = total
    ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / total
    : 0

  res.json({ total, vipCount, avgSpent: Math.round(avgSpent * 100) / 100 })
})

customersRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search } = req.query
  const customers = await prisma.customer.findMany({
    where: {
      restaurantId: req.restaurantId!,
      ...(search ? {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
          { tags: { has: search as string } },
        ],
      } : {}),
    },
    orderBy: { totalVisits: 'desc' },
  })
  res.json(customers.map(serializeCustomer))
})

customersRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    include: {
      orders: {
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 12,
        select: {
          id: true,
          total: true,
          revenueAmount: true,
          paidAt: true,
          createdAt: true,
          paymentMethod: true,
        },
      },
      reservations: { orderBy: { date: 'desc' }, take: 5 },
    },
  })
  if (!customer) {
    res.status(404).json({ error: 'Cliente non trovato' })
    return
  }
  const { orders, reservations, ...base } = customer
  res.json({ ...serializeCustomer(base), orders, reservations })
})

customersRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const emptyToUndefined = (val: unknown) =>
    val === '' || val === null || val === undefined ? undefined : val

  const schema = z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    name: z.string().trim().min(2).optional(),
    email: z.preprocess(emptyToUndefined, z.string().email().optional()),
    phone: z.preprocess(emptyToUndefined, z.string().optional()),
    birthDate: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().optional()),
    allergens: z.preprocess(emptyToUndefined, z.string().optional()),
    tags: z.array(z.string().trim().min(1)).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const firstName = result.data.firstName ?? (result.data.name ? splitCustomerName(result.data.name).firstName : '')
  const lastName = result.data.lastName ?? (result.data.name ? splitCustomerName(result.data.name).lastName : '')
  const name = buildCustomerName(firstName, lastName) || result.data.name || ''

  if (!name) {
    res.status(400).json({ error: 'Nome obbligatorio' })
    return
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName,
        name,
        email: result.data.email,
        phone: result.data.phone,
        notes: result.data.notes,
        allergens: result.data.allergens,
        tags: result.data.tags ?? [],
        restaurantId: req.restaurantId!,
        totalVisits: 0,
        totalSpent: 0,
        loyaltyPoints: 0,
        ...(result.data.birthDate ? { birthdate: new Date(result.data.birthDate) } : {}),
      },
    })
    res.status(201).json(serializeCustomer(customer))
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      res.status(409).json({ error: 'Esiste già un cliente con questa email' })
      return
    }
    throw err
  }
})

customersRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    name: z.string().trim().min(2).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    allergens: z.string().optional().nullable(),
    tags: z.array(z.string().trim().min(1)).optional(),
    birthDate: z.string().datetime().optional().nullable(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const current = await prisma.customer.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!current) {
    tenantNotFound(res, 'Cliente non trovato')
    return
  }

  const firstName = result.data.firstName ?? current.firstName
  const lastName = result.data.lastName ?? current.lastName
  const name = result.data.name ?? (buildCustomerName(firstName, lastName) || current.name)

  const updated = await prisma.customer.updateMany({
    where: scopedWhere(req, req.params.id),
    data: {
      firstName,
      lastName,
      name,
      email: result.data.email,
      phone: result.data.phone,
      notes: result.data.notes,
      allergens: result.data.allergens,
      tags: result.data.tags,
      ...(result.data.birthDate !== undefined
        ? { birthdate: result.data.birthDate ? new Date(result.data.birthDate) : null }
        : {}),
    },
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Cliente non trovato')
    return
  }

  const customer = await prisma.customer.findFirst({ where: scopedWhere(req, req.params.id) })
  res.json(customer ? serializeCustomer(customer) : null)
})
