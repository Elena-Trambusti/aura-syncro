import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const customersRouter = Router()

customersRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search } = req.query
  const customers = await prisma.customer.findMany({
    where: {
      restaurantId: req.restaurantId!,
      ...(search ? {
        OR: [
          { name: { contains: search as string } },
          { email: { contains: search as string } },
          { phone: { contains: search as string } },
        ],
      } : {}),
    },
    orderBy: { totalVisits: 'desc' },
  })
  res.json(customers)
})

customersRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId! },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: { include: { menuItem: true } } },
      },
      reservations: { orderBy: { date: 'desc' }, take: 5 },
    },
  })
  if (!customer) {
    res.status(404).json({ error: 'Cliente non trovato' })
    return
  }
  res.json(customer)
})

customersRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const emptyToUndefined = (val: unknown) =>
    val === '' || val === null || val === undefined ? undefined : val

  const schema = z.object({
    name: z.string().trim().min(2),
    email: z.preprocess(emptyToUndefined, z.string().email().optional()),
    phone: z.preprocess(emptyToUndefined, z.string().optional()),
    birthdate: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().optional()),
    allergens: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  try {
    const customer = await prisma.customer.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone,
        notes: result.data.notes,
        allergens: result.data.allergens,
        restaurantId: req.restaurantId!,
        totalVisits: 0,
        totalSpent: 0,
        loyaltyPoints: 0,
        ...(result.data.birthdate ? { birthdate: new Date(result.data.birthdate) } : {}),
      },
    })
    res.status(201).json(customer)
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      res.status(409).json({ error: 'Esiste già un cliente con questa email' })
      return
    }
    throw err
  }
})

customersRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json(customer)
})
