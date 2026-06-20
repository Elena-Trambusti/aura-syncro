import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { restaurantPayload } from '../lib/tenant'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
})

authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  const { restaurantName, name, email, password, phone } = result.data

  const existingUser = await prisma.user.findFirst({ where: { email } })
  if (existingUser) {
    res.status(409).json({ error: 'Email già registrata' })
    return
  }

  const slug = restaurantName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now()

  const hashedPassword = await bcrypt.hash(password, 12)

  const restaurant = await prisma.restaurant.create({
    data: {
      name: restaurantName,
      slug,
      colorTheme: '#f97316',
      settings: { create: {} },
      users: {
        create: {
          name,
          email,
          password: hashedPassword,
          role: 'OWNER',
          phone,
        },
      },
    },
    include: { users: true },
  })

  const user = restaurant.users[0]
  const token = jwt.sign(
    { userId: user.id, restaurantId: restaurant.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: restaurantPayload(restaurant),
  })
})

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const { email, password } = result.data

  const user = await prisma.user.findFirst({
    where: { email, active: true },
    include: { restaurant: true },
  })

  if (!user) {
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  const token = jwt.sign(
    { userId: user.id, restaurantId: user.restaurantId, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: restaurantPayload(user.restaurant),
  })
})

authRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante' })
    return
  }
  try {
    const token = authHeader.split(' ')[1]
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; restaurantId: string; role: string }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { restaurant: true },
    })
    if (!user || user.restaurantId !== payload.restaurantId) {
      res.status(404).json({ error: 'Utente non trovato' })
      return
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      restaurant: restaurantPayload(user.restaurant),
    })
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
})
