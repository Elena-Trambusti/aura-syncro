import { Router, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { enrichCategoriesWithStock } from '../lib/menuStock'

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

const activeMenuItemWhere = { archived: false } as const

async function removeMenuItem(tx: Prisma.TransactionClient, itemId: string): Promise<'deleted' | 'archived'> {
  const orderCount = await tx.orderItem.count({ where: { menuItemId: itemId } })
  if (orderCount > 0) {
    await tx.menuItem.update({
      where: { id: itemId },
      data: { archived: true, available: false },
    })
    return 'archived'
  }
  await tx.inventoryItemLink.deleteMany({ where: { menuItemId: itemId } })
  await tx.menuItem.delete({ where: { id: itemId } })
  return 'deleted'
}

// Categorie
menuRouter.get('/categories', requirePermission('menu.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const categories = await prisma.menuCategory.findMany({
    where: tenantWhere(req),
    include: { 
      items: { 
        where: activeMenuItemWhere, 
        orderBy: { sortOrder: 'asc' },
        include: {
          modifierGroups: {
            include: { options: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' }
          }
        }
      } 
    },
    orderBy: { sortOrder: 'asc' },
  })
  const enriched = await enrichCategoriesWithStock(categories, tenantId(req))
  res.json(enriched)
})

menuRouter.post('/categories', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
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

menuRouter.put('/categories/:id', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
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

menuRouter.delete('/categories/:id', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const category = await prisma.menuCategory.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!category) {
    tenantNotFound(res, 'Categoria non trovata')
    return
  }

  const items = await prisma.menuItem.findMany({
    where: { categoryId: category.id, restaurantId: tenantId(req) },
    select: { id: true },
  })

  if (items.length > 0) {
    const orderedCount = await prisma.orderItem.count({
      where: { menuItemId: { in: items.map(item => item.id) } },
    })
    if (orderedCount > 0) {
      res.status(409).json({
        error: 'Impossibile eliminare la categoria: contiene piatti già ordinati. Rimuovili singolarmente dal menu.',
        code: 'CATEGORY_HAS_ORDER_HISTORY',
      })
      return
    }
  }

  await prisma.$transaction(async tx => {
    for (const item of items) {
      await tx.inventoryItemLink.deleteMany({ where: { menuItemId: item.id } })
      await tx.menuItem.delete({ where: { id: item.id } })
    }
    await tx.menuCategory.delete({ where: { id: category.id } })
  })

  res.status(204).send()
})

// Piatti
menuRouter.get('/items', requirePermission('menu.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.menuItem.findMany({
    where: { ...tenantWhere(req), ...activeMenuItemWhere },
    include: { 
      category: true,
      modifierGroups: {
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  })
  res.json(items)
})

menuRouter.post('/items', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
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
    include: { 
      category: true,
      modifierGroups: { include: { options: true } }
    },
  })
  res.status(201).json(item)
})

menuRouter.put('/items/:id', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
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
    include: { 
      category: true,
      modifierGroups: {
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' }
      }
    },
  })
  res.json(item)
})

menuRouter.patch('/items/:id/availability', requirePermission('menu.availability'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ available: z.boolean() }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Valore disponibilità non valido' })
    return
  }
  const { available } = parsed.data

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

menuRouter.delete('/items/:id', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const item = await prisma.menuItem.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!item) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }

  const outcome = await prisma.$transaction(tx => removeMenuItem(tx, item.id))
  if (outcome === 'archived') {
    res.json({ archived: true })
    return
  }
  res.status(204).send()
})

// Modificatori (Varianti)
menuRouter.put('/items/:id/modifiers', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.array(z.object({
    name: z.string().min(1),
    isRequired: z.boolean().default(false),
    multiSelect: z.boolean().default(false),
    minOptions: z.number().int().default(0),
    maxOptions: z.number().int().nullable().optional(),
    sortOrder: z.number().int().default(0),
    options: z.array(z.object({
      name: z.string().min(1),
      price: z.number().min(0).default(0),
      sortOrder: z.number().int().default(0),
    })),
  }))

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const item = await prisma.menuItem.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!item) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }

  await prisma.$transaction(async tx => {
    await tx.menuModifierGroup.deleteMany({ where: { menuItemId: item.id } })
    
    let gOrder = 0
    for (const group of parsed.data) {
      await tx.menuModifierGroup.create({
        data: {
          menuItemId: item.id,
          name: group.name,
          isRequired: group.isRequired,
          multiSelect: group.multiSelect,
          minOptions: group.minOptions,
          maxOptions: group.maxOptions,
          sortOrder: group.sortOrder ?? gOrder++,
          options: {
            create: group.options.map((opt, i) => ({
              name: opt.name,
              price: opt.price,
              sortOrder: opt.sortOrder ?? i
            }))
          }
        }
      })
    }
  })

  const updatedItem = await prisma.menuItem.findFirst({
    where: { id: item.id },
    include: { modifierGroups: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } }
  })
  res.json(updatedItem?.modifierGroups)
})

// Ricetta / BOM — collegamento piatto ↔ ingredienti magazzino
const recipeLinkSchema = z.object({
  links: z.array(z.object({
    inventoryItemId: z.string(),
    quantity: z.number().positive(),
  })),
})

menuRouter.get('/items/:id/recipe', requirePermission('menu.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const item = await prisma.menuItem.findFirst({
    where: scopedWhere(req, req.params.id),
    include: {
      inventoryLinks: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      },
    },
  })
  if (!item) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }
  res.json(item.inventoryLinks.map(link => ({
    id: link.id,
    inventoryItemId: link.inventoryItemId,
    quantity: link.quantity,
    inventoryItem: link.inventoryItem,
  })))
})

menuRouter.put('/items/:id/recipe', requirePermission('menu.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = recipeLinkSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const item = await prisma.menuItem.findFirst({ where: scopedWhere(req, req.params.id) })
  if (!item) {
    tenantNotFound(res, 'Piatto non trovato')
    return
  }

  const restaurantId = tenantId(req)
  const inventoryIds = parsed.data.links.map(l => l.inventoryItemId)
  if (inventoryIds.length > 0) {
    const validCount = await prisma.inventoryItem.count({
      where: { id: { in: inventoryIds }, restaurantId },
    })
    if (validCount !== inventoryIds.length) {
      res.status(400).json({ error: 'Uno o più ingredienti non appartengono al magazzino' })
      return
    }
  }

  await prisma.$transaction(async tx => {
    await tx.inventoryItemLink.deleteMany({ where: { menuItemId: item.id } })
    if (parsed.data.links.length > 0) {
      await tx.inventoryItemLink.createMany({
        data: parsed.data.links.map(link => ({
          menuItemId: item.id,
          inventoryItemId: link.inventoryItemId,
          quantity: link.quantity,
        })),
      })
    }
  })

  const links = await prisma.inventoryItemLink.findMany({
    where: { menuItemId: item.id },
    include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
  })
  res.json(links)
})
