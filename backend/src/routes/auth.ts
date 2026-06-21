import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { CountryCode, TaxRegion } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { restaurantPayload } from '../lib/tenant'
import { getPermissionsForRole } from '../lib/permissions'
import { settingsForRegistration } from '../lib/taxEngine'

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
  countryCode: z.nativeEnum(CountryCode).default('IT'),
  taxRegion: z.nativeEnum(TaxRegion).optional(),
})

async function findUserWithRestaurant(userId: string, restaurantId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { restaurant: { include: { settings: true } } },
  }).then(user => {
    if (!user || user.restaurantId !== restaurantId) return null
    return user
  })
}

authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  const { restaurantName, name, email, password, phone, countryCode, taxRegion } = result.data

  const existingUser = await prisma.user.findFirst({ where: { email } })
  if (existingUser) {
    res.status(409).json({ error: 'Email già registrata' })
    return
  }

  const slug = restaurantName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now()

  const hashedPassword = await bcrypt.hash(password, 12)
  const fiscalSettings = settingsForRegistration(countryCode, taxRegion)

  const restaurant = await prisma.restaurant.create({
    data: {
      name: restaurantName,
      slug,
      colorTheme: '#c9a227',
      timezone: fiscalSettings.taxRegion === 'ES_CANARIAS'
        ? 'Atlantic/Canary'
        : fiscalSettings.taxRegion === 'ES_PENINSULA'
          ? 'Europe/Madrid'
          : 'Europe/Rome',
      settings: { create: fiscalSettings },
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
    include: { users: true, settings: true },
  })

  const user = restaurant.users[0]
  const token = jwt.sign(
    { userId: user.id, restaurantId: restaurant.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' },
  )

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: restaurantPayload(restaurant),
    permissions: getPermissionsForRole(user.role),
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
    include: { restaurant: { include: { settings: true } } },
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
    { expiresIn: '7d' },
  )

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: restaurantPayload(user.restaurant),
    permissions: getPermissionsForRole(user.role),
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
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      restaurantId: string
      role: string
    }
    const user = await findUserWithRestaurant(payload.userId, payload.restaurantId)
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' })
      return
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      restaurant: restaurantPayload(user.restaurant),
      permissions: getPermissionsForRole(user.role),
    })
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
})
