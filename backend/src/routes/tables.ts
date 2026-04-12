import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { io } from '../index'

export const tablesRouter = Router()

tablesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const tables = await prisma.table.findMany({
    where: { restaurantId: req.restaurantId! },
    include: {
      orders: {
        where: { status: { notIn: ['PAID', 'CANCELLED'] } },
        include: { items: { include: { menuItem: true } } },
      },
    },
    orderBy: { number: 'asc' },
  })
  res.json(tables)
})

tablesRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    number: z.number().int().positive(),
    name: z.string().optional(),
    seats: z.number().int().positive().default(4),
    posX: z.number().default(0),
    posY: z.number().default(0),
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).default('SQUARE'),
    area: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  const table = await prisma.table.create({
    data: { ...result.data, restaurantId: req.restaurantId! },
  })
  io.to(req.restaurantId!).emit('table:created', table)
  res.status(201).json(table)
})

tablesRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    number: z.number().int().positive().optional(),
    name: z.string().optional(),
    seats: z.number().int().positive().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).optional(),
    area: z.string().optional(),
    status: z.enum(['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING']).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const table = await prisma.table.update({
    where: { id: req.params.id },
    data: result.data,
  })
  io.to(req.restaurantId!).emit('table:updated', table)
  res.json(table)
})

tablesRouter.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body
  const table = await prisma.table.update({
    where: { id: req.params.id },
    data: { status },
  })
  io.to(req.restaurantId!).emit('table:updated', table)
  res.json(table)
})

tablesRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.table.delete({ where: { id: req.params.id } })
  io.to(req.restaurantId!).emit('table:deleted', { id: req.params.id })
  res.status(204).send()
})
