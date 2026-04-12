import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const inventoryRouter = Router()

inventoryRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.inventoryItem.findMany({
    where: { restaurantId: req.restaurantId! },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  const alerts = items.filter((i: { quantity: number; minQuantity: number }) => i.quantity <= i.minQuantity)
  res.json({ items, alerts })
})

inventoryRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    unit: z.string(),
    quantity: z.number().default(0),
    minQuantity: z.number().default(0),
    cost: z.number().default(0),
    supplier: z.string().optional(),
    category: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const item = await prisma.inventoryItem.create({
    data: { ...result.data, restaurantId: req.restaurantId! },
  })
  res.status(201).json(item)
})

inventoryRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json(item)
})

inventoryRouter.patch('/:id/quantity', async (req: AuthRequest, res: Response): Promise<void> => {
  const { delta, operation } = req.body
  const current = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } })
  if (!current) {
    res.status(404).json({ error: 'Prodotto non trovato' })
    return
  }

  const newQuantity = operation === 'set' ? delta : current.quantity + delta
  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: { quantity: Math.max(0, newQuantity) },
  })
  res.json(item)
})

inventoryRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.inventoryItem.delete({ where: { id: req.params.id } })
  res.status(204).send()
})
