import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'

export const menuRouter = Router()

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  image: z.string().optional(),
  sortOrder: z.number().default(0),
  active: z.boolean().optional(),
})

const itemSchema = z.object({
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

async function assertCategoryBelongsToTenant(req: AuthRequest, categoryId: string) {
  return prisma.menuCategory.findFirst({
    where: { id: categoryId, restaurantId: tenantId(req) },
  })
}

// Categorie
menuRouter.get('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  const categories = await prisma.menuCategory.findMany({
    where: tenantWhere(req),
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(categories)
})

menuRouter.post('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = categorySchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const category = await prisma.menuCategory.create({
    data: { ...result.data, restaurantId: tenantId(req) },
  })
  res.status(201).json(category)
})

menuRouter.put('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = categorySchema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const updated = await prisma.menuCategory.updateMany({
    where: scopedWhere(req, req.params.id),
    data: result.data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Categoria non trovata')
    return
  }
  const category = await prisma.menuCategory.findFirst({ where: scopedWhere(req, req.params.id) })
  res.json(category)
})

menuRouter.delete('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.menuCategory.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Categoria non trovata')
    return
  }
  res.status(204).send()
})

// Piatti
menuRouter.get('/items', async (req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.menuItem.findMany({
    where: tenantWhere(req),
    include: { category: true },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  })
  res.json(items)
})

menuRouter.post('/items', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = itemSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  const category = await assertCategoryBelongsToTenant(req, result.data.categoryId)
  if (!category) {
    tenantNotFound(res, 'Categoria non trovata')
    return
  }
  const item = await prisma.menuItem.create({
    data: { ...result.data, restaurantId: tenantId(req) },
    include: { category: true },
  })
  res.status(201).json(item)
})

menuRouter.put('/items/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = itemSchema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  if (result.data.categoryId) {
    const category = await assertCategoryBelongsToTenant(req, result.data.categoryId)
    if (!category) {
      tenantNotFound(res, 'Categoria non trovata')
      return
    }
  }
  const updated = await prisma.menuItem.updateMany({
    where: scopedWhere(req, req.params.id),
    data: result.data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  const item = await prisma.menuItem.findFirst({
    where: scopedWhere(req, req.params.id),
    include: { category: true },
  })
  res.json(item)
})

menuRouter.patch('/items/:id/availability', async (req: AuthRequest, res: Response): Promise<void> => {
  const { available } = req.body
  const updated = await prisma.menuItem.updateMany({
    where: scopedWhere(req, req.params.id),
    data: { available },
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  const item = await prisma.menuItem.findFirst({ where: scopedWhere(req, req.params.id) })
  res.json(item)
})

menuRouter.delete('/items/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.menuItem.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  res.status(204).send()
})
