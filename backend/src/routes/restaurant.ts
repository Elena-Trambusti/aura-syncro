import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const restaurantRouter = Router()

restaurantRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId! },
    include: { settings: true },
  })
  res.json(restaurant)
})

restaurantRouter.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { settings, ...data } = req.body
  const restaurant = await prisma.restaurant.update({
    where: { id: req.restaurantId! },
    data,
    include: { settings: true },
  })
  if (settings) {
    await prisma.restaurantSettings.upsert({
      where: { restaurantId: req.restaurantId! },
      update: settings,
      create: { restaurantId: req.restaurantId!, ...settings },
    })
  }
  res.json(restaurant)
})
