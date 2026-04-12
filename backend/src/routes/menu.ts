import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const menuRouter = Router()

// Categorie
menuRouter.get('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: req.restaurantId! },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(categories)
})

menuRouter.post('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    image: z.string().optional(),
    sortOrder: z.number().default(0),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const category = await prisma.menuCategory.create({
    data: { ...result.data, restaurantId: req.restaurantId! },
  })
  res.status(201).json(category)
})

menuRouter.put('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const category = await prisma.menuCategory.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json(category)
})

menuRouter.delete('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.menuCategory.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

// Piatti
menuRouter.get('/items', async (req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: req.restaurantId! },
    include: { category: true },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  })
  res.json(items)
})

menuRouter.post('/items', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    categoryId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.number().positive(),
    image: z.string().optional(),
    allergens: z.string().optional(),
    calories: z.number().int().optional(),
    preparationTime: z.number().int().optional(),
    available: z.boolean().default(true),
    featured: z.boolean().default(false),
    sortOrder: z.number().default(0),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  const item = await prisma.menuItem.create({
    data: { ...result.data, restaurantId: req.restaurantId! },
    include: { category: true },
  })
  res.status(201).json(item)
})

menuRouter.put('/items/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const item = await prisma.menuItem.update({
    where: { id: req.params.id },
    data: req.body,
    include: { category: true },
  })
  res.json(item)
})

menuRouter.patch('/items/:id/availability', async (req: AuthRequest, res: Response): Promise<void> => {
  const { available } = req.body
  const item = await prisma.menuItem.update({
    where: { id: req.params.id },
    data: { available },
  })
  res.json(item)
})

menuRouter.delete('/items/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.menuItem.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

// Menu pubblico (per QR code - no auth)
menuRouter.get('/public/:slug', async (req, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: req.params.slug },
    include: {
      menuCategories: {
        where: { active: true },
        include: {
          items: {
            where: { available: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }
  res.json({
    restaurant: { name: restaurant.name, logo: restaurant.logo, description: restaurant.description },
    categories: restaurant.menuCategories,
  })
})
