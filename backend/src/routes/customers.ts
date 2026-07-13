import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { buildCustomerName, splitCustomerName } from '../lib/crmCustomer'
import { ensureDefaultLoyaltyTiers, ensureLoyaltyEnrollment } from '../lib/loyaltyHelpers'
import { scopedWhere, tenantNotFound } from '../lib/tenant'
import type { MoneyInput } from '../lib/money'
import { moneyNumber } from '../lib/money'

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
  totalSpent: MoneyInput
  lastVisit: Date | null
  loyaltyTierId: string | null
  taxId: string | null
  fiscalCode: string | null
  sdiRecipientCode: string | null
  pec: string | null
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
    tags: customer.tags ?? [],
    totalSpent: moneyNumber(customer.totalSpent),
    birthDate: customer.birthdate ? formatBirthDateOutput(customer.birthdate) : null,
  }
}

customersRouter.get('/stats', requirePermission('customers.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const [total, spendingStats, vipCount] = await Promise.all([
    prisma.customer.count({ where: { restaurantId } }),
    prisma.customer.aggregate({
      where: { restaurantId, totalVisits: { gt: 0 } },
      _avg: { totalSpent: true },
      _count: true,
    }),
    prisma.customer.count({
      where: {
        restaurantId,
        OR: [
          { tags: { has: 'VIP' } },
          { totalVisits: { gte: 10 } },
          { totalSpent: { gte: 500 } },
        ],
      },
    }),
  ])

  const avgSpent = spendingStats._count > 0
    ? moneyNumber(spendingStats._avg.totalSpent)
    : 0

  res.json({
    total,
    vipCount,
    avgSpent: Math.round(avgSpent * 100) / 100,
    activeCustomers: spendingStats._count,
  })
})

customersRouter.get('/', requirePermission('customers.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const searchSchema = z.object({
    search: z.string().trim().min(1).max(100).optional(),
  })
  const parsed = searchSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Parametri di ricerca non validi' })
    return
  }
  const { search } = parsed.data
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
    include: { loyaltyTier: { select: { name: true, color: true } } },
    orderBy: { totalVisits: 'desc' },
  })
  res.json(customers.map(c => serializeCustomer(c)))
})

customersRouter.get('/:id', requirePermission('customers.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    include: {
      orders: {
        where: { status: 'PAID', refundedAt: null },
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

const emptyToNull = (val: unknown) =>
  val === '' || val === null || val === undefined ? null : val

const birthDateInputSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.string().datetime(),
])

function parseBirthDateInput(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, mo, d] = value.split('-').map(Number)
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0))
  }
  return new Date(value)
}

function formatBirthDateOutput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const fiscalFieldsSchema = {
  taxId: z.preprocess(emptyToNull, z.string().max(32).nullable().optional()),
  fiscalCode: z.preprocess(emptyToNull, z.string().max(32).nullable().optional()),
  sdiRecipientCode: z.preprocess(emptyToNull, z.string().max(7).nullable().optional()),
  pec: z.preprocess(emptyToNull, z.string().email().nullable().optional()),
}

customersRouter.post('/', requirePermission('customers.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const emptyToUndefined = (val: unknown) =>
    val === '' || val === null || val === undefined ? undefined : val

  const schema = z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    name: z.string().trim().min(2).optional(),
    email: z.preprocess(emptyToUndefined, z.string().email().optional()),
    phone: z.preprocess(emptyToUndefined, z.string().optional()),
    birthDate: z.preprocess(emptyToUndefined, birthDateInputSchema.optional()),
    notes: z.preprocess(emptyToUndefined, z.string().optional()),
    allergens: z.preprocess(emptyToUndefined, z.string().optional()),
    tags: z.array(z.string().trim().min(1)).optional(),
    ...fiscalFieldsSchema,
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
        taxId: result.data.taxId ?? null,
        fiscalCode: result.data.fiscalCode ?? null,
        sdiRecipientCode: result.data.sdiRecipientCode ?? null,
        pec: result.data.pec ?? null,
        restaurantId: req.restaurantId!,
        totalVisits: 0,
        totalSpent: 0,
        loyaltyPoints: 0,
        ...(result.data.birthDate ? { birthdate: parseBirthDateInput(result.data.birthDate) } : {}),
      },
    })
    await ensureDefaultLoyaltyTiers(req.restaurantId!)
    await ensureLoyaltyEnrollment(req.restaurantId!, customer.id)
    res.status(201).json(serializeCustomer(customer))
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      res.status(409).json({ error: 'Esiste già un cliente con questa email' })
      return
    }
    throw err
  }
})

customersRouter.put('/:id', requirePermission('customers.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    name: z.string().trim().min(2).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    allergens: z.string().optional().nullable(),
    tags: z.array(z.string().trim().min(1)).optional(),
    birthDate: birthDateInputSchema.optional().nullable(),
    ...fiscalFieldsSchema,
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
      taxId: result.data.taxId,
      fiscalCode: result.data.fiscalCode,
      sdiRecipientCode: result.data.sdiRecipientCode,
      pec: result.data.pec,
      ...(result.data.birthDate !== undefined
        ? { birthdate: result.data.birthDate ? parseBirthDateInput(result.data.birthDate) : null }
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

customersRouter.delete('/:id', requirePermission('customers.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const customer = await prisma.customer.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!customer) {
    tenantNotFound(res, 'Cliente non trovato')
    return
  }

  await prisma.$transaction(async tx => {
    await tx.order.updateMany({
      where: { customerId: customer.id, restaurantId: req.restaurantId! },
      data: { customerId: null },
    })
    await tx.reservation.updateMany({
      where: { customerId: customer.id, restaurantId: req.restaurantId! },
      data: { customerId: null },
    })
    await tx.loyaltyTransaction.deleteMany({
      where: { customerId: customer.id, restaurantId: req.restaurantId! },
    })
    await tx.customer.delete({ where: { id: customer.id } })
  })

  res.status(204).send()
})
