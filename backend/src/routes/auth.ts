import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { CountryCode, TaxRegion } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { restaurantPayload } from '../lib/tenant'
import { getPermissionsForRole } from '../lib/permissions'
import { settingsForRegistration } from '../lib/taxEngine'
import { sendEmail } from '../lib/email'
import { resolvePrimaryFrontendUrl } from '../lib/frontendUrl'
import { ensureDefaultTables } from '../lib/defaultTables'
import { bootstrapLoyaltyProgram } from '../lib/loyaltyHelpers'
import { signAuthToken, verifyAuthToken } from '../lib/jwtAuth'
import { asyncHandler } from '../lib/asyncHandler'
import {
  authForgotPasswordLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authResetPasswordLimiter,
} from '../middleware/rateLimit'

export const authRouter = Router()

const PASSWORD_MIN = 8

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  restaurantSlug: z.string().min(1).optional(),
})

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN),
  phone: z.string().optional(),
  countryCode: z.nativeEnum(CountryCode).default('IT'),
  taxRegion: z.nativeEnum(TaxRegion).optional(),
})

async function findUserWithRestaurant(userId: string, restaurantId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { restaurant: { include: { settings: true } } },
  }).then(user => {
    if (!user || user.restaurantId !== restaurantId || !user.active) return null
    return user
  })
}

function issueAuthResponse(user: {
  id: string
  name: string
  email: string
  role: string
  restaurantId: string
  tokenVersion: number
  restaurant: Parameters<typeof restaurantPayload>[0]
}) {
  const token = signAuthToken({
    id: user.id,
    restaurantId: user.restaurantId,
    role: user.role,
    tokenVersion: user.tokenVersion,
  })
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: restaurantPayload(user.restaurant),
    permissions: getPermissionsForRole(user.role),
  }
}

authRouter.post('/register', authRegisterLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  const { restaurantName, name, email, password, phone, countryCode, taxRegion } = result.data

  const existingUser = await prisma.user.findFirst({ where: { email } })
  if (existingUser) {
    res.status(409).json({ error: 'Email già registrata', code: 'EMAIL_TAKEN' })
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
  await ensureDefaultTables(restaurant.id)
  await bootstrapLoyaltyProgram(restaurant.id)

  res.status(201).json(issueAuthResponse({
    ...user,
    restaurant,
  }))
}))

authRouter.post('/login', authLoginLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }
  const { email, password, restaurantSlug } = result.data

  const candidates = await prisma.user.findMany({
    where: { email, active: true },
    include: { restaurant: { include: { settings: true } } },
  })

  if (candidates.length === 0) {
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  if (candidates.length > 1 && !restaurantSlug) {
    res.status(409).json({
      error: 'Email associata a più ristoranti. Inserisci il codice ristorante.',
      code: 'MULTIPLE_TENANTS',
      restaurants: candidates.map(u => ({
        name: u.restaurant.name,
        slug: u.restaurant.slug,
      })),
    })
    return
  }

  const user = candidates.length === 1
    ? candidates[0]
    : candidates.find(u => u.restaurant.slug === restaurantSlug)

  if (!user) {
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  res.json(issueAuthResponse(user))
}))

authRouter.get('/me', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante' })
    return
  }
  const token = authHeader.split(' ')[1]
  const payload = verifyAuthToken(token)
  const user = await findUserWithRestaurant(payload.userId, payload.restaurantId)
  if (!user) {
    res.status(401).json({ error: 'Sessione non valida', code: 'SESSION_INVALID' })
    return
  }
  if (user.tokenVersion !== (payload.tv ?? 0)) {
    res.status(401).json({ error: 'Sessione non più valida', code: 'SESSION_REVOKED' })
    return
  }
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: restaurantPayload(user.restaurant),
    permissions: getPermissionsForRole(user.role),
  })
}))

authRouter.post('/forgot-password', authForgotPasswordLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Email non valida' })
    return
  }

  const users = await prisma.user.findMany({ where: { email: parsed.data.email, active: true } })
  for (const user of users) {
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    )
    const frontend = resolvePrimaryFrontendUrl()
    await sendEmail({
      to: user.email,
      subject: 'Reimposta password — Aura Syncro',
      text: `Clicca per reimpostare la password (valido 1 ora):\n${frontend}/reset-password?token=${resetToken}`,
    })
  }

  res.json({ success: true, message: 'Se l\'email esiste, riceverai le istruzioni.' })
}))

authRouter.post('/reset-password', authResetPasswordLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(PASSWORD_MIN),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  try {
    const payload = jwt.verify(parsed.data.token, process.env.JWT_SECRET!) as {
      userId: string
      purpose?: string
    }
    if (payload.purpose !== 'password-reset') {
      res.status(400).json({ error: 'Token non valido' })
      return
    }
    const hashed = await bcrypt.hash(parsed.data.password, 12)
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
      },
    })
    res.json({ success: true, message: 'Password aggiornata' })
  } catch {
    res.status(400).json({ error: 'Token scaduto o non valido' })
  }
}))
