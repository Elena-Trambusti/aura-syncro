import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const pushRouter = Router()

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

pushRouter.post('/subscribe', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = subscribeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Subscription non valida' })
    return
  }

  const { endpoint, keys } = parsed.data
  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: req.userId!,
        endpoint,
      },
    },
    create: {
      userId: req.userId!,
      restaurantId: req.restaurantId!,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      restaurantId: req.restaurantId!,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  })

  res.json({ ok: true })
})

pushRouter.delete('/subscribe', async (req: AuthRequest, res: Response): Promise<void> => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : req.query.endpoint
  if (typeof endpoint !== 'string') {
    res.status(400).json({ error: 'Endpoint mancante' })
    return
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId: req.userId!, endpoint },
  })

  res.json({ ok: true })
})
