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
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birthdate: z.string().datetime().optional(),
    notes: z.string().optional(),
    allergens: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const customer = await prisma.customer.create({
    data: {
      ...result.data,
      restaurantId: req.restaurantId!,
      ...(result.data.birthdate ? { birthdate: new Date(result.data.birthdate) } : {}),
    },
  })
  res.status(201).json(customer)
})

customersRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json(customer)
})
