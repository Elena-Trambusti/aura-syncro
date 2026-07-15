import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { CountryCode, Prisma, TaxRegion } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { restaurantPayload } from '../lib/tenant'
import { getPermissionsForRole } from '../lib/permissions'
import { settingsForRegistration } from '../lib/taxEngine'
import { sendEmail } from '../lib/email'
import { resolvePrimaryFrontendUrl } from '../lib/frontendUrl'
import { ensureDefaultTables, ensureDefaultFloorPlan } from '../lib/defaultTables'
import { bootstrapLoyaltyProgram } from '../lib/loyaltyHelpers'
import { signAuthToken, verifyAuthToken, verifySessionToken } from '../lib/jwtAuth'
import { setSessionCookie, clearSessionCookie, extractBearerToken } from '../lib/sessionCookie'
import { asyncHandler } from '../lib/asyncHandler'
import { AuthRequest, authenticate } from '../middleware/auth'
import { requireTenantContext } from '../middleware/tenantContext'
import {
  authForgotPasswordLimiter,
  authLoginLimiter,
  authMeLimiter,
  authRegisterLimiter,
  authResetPasswordLimiter,
} from '../middleware/rateLimit'
import { CURRENT_LEGAL_VERSION, isAcceptedLegalVersion } from '../config/legal'

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
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Accettazione Termini, Privacy, Cookie Policy e DPA obbligatoria' }),
  }),
  acceptedTermsVersion: z.string().min(1),
})

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim()
  }
  return req.socket.remoteAddress ?? undefined
}

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

function sendAuthResponse(res: Response, user: {
  id: string
  name: string
  email: string
  role: string
  restaurantId: string
  tokenVersion: number
  restaurant: Parameters<typeof restaurantPayload>[0]
}, status = 200) {
  const payload = issueAuthResponse(user)
  setSessionCookie(res, payload.token)
  res.status(status).json(payload)
}

authRouter.post('/register', authRegisterLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }
  const { restaurantName, name, email, password, phone, countryCode, taxRegion, acceptedTermsVersion } = result.data

  if (!isAcceptedLegalVersion(acceptedTermsVersion)) {
    res.status(400).json({
      error: 'Versione documenti legali non valida. Ricarica la pagina e riprova.',
      code: 'LEGAL_VERSION_OUTDATED',
      expectedVersion: CURRENT_LEGAL_VERSION,
    })
    return
  }

  const legalAcceptedAt = new Date()
  const legalMeta = {
    termsAcceptedAt: legalAcceptedAt,
    termsVersion: acceptedTermsVersion,
    dpaAcceptedAt: legalAcceptedAt,
    dpaVersion: acceptedTermsVersion,
    legalAcceptIp: clientIp(req),
    legalAcceptUserAgent: typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent'].slice(0, 512)
      : undefined,
  }

  const slug = restaurantName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now()

  const hashedPassword = await bcrypt.hash(password, 12)
  const fiscalSettings = settingsForRegistration(countryCode, taxRegion)

  let restaurant
  try {
    restaurant = await prisma.$transaction(async tx => {
      return tx.restaurant.create({
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
              ...legalMeta,
            },
          },
        },
        include: { users: true, settings: true },
      })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Email già registrata per questo ristorante', code: 'EMAIL_TAKEN' })
      return
    }
    throw err
  }

  const user = restaurant.users[0]
  await ensureDefaultTables(restaurant.id)
  await ensureDefaultFloorPlan(restaurant.id)
  await bootstrapLoyaltyProgram(restaurant.id)

  sendAuthResponse(res, {
    ...user,
    restaurant,
  }, 201)
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

  sendAuthResponse(res, user)
}))

authRouter.post('/logout', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = extractBearerToken(req)
  if (token) {
    try {
      const payload = verifySessionToken(token)
      await prisma.user.updateMany({
        where: { id: payload.userId, restaurantId: payload.restaurantId },
        data: { tokenVersion: { increment: 1 } },
      })
    } catch {
      /* token scaduto o non valido — basta cancellare il cookie */
    }
  }
  clearSessionCookie(res)
  res.json({ success: true })
}))

authRouter.get('/me', authMeLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = extractBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Token mancante' })
    return
  }
  let payload
  try {
    payload = verifyAuthToken(token)
  } catch {
    res.status(401).json({ error: 'Token non valido', code: 'SESSION_INVALID' })
    return
  }
  const user = await findUserWithRestaurant(payload.userId, payload.restaurantId)
  if (!user) {
    res.status(401).json({ error: 'Sessione non valida', code: 'SESSION_INVALID' })
    return
  }
  if (user.tokenVersion !== (payload.tv ?? 0)) {
    res.status(401).json({ error: 'Sessione non più valida', code: 'SESSION_REVOKED' })
    return
  }
  const session = issueAuthResponse({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurantId,
    tokenVersion: user.tokenVersion,
    restaurant: user.restaurant,
  })
  setSessionCookie(res, session.token)
  res.json(session)
}))

authRouter.post('/forgot-password', authForgotPasswordLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Email non valida' })
    return
  }

  const users = await prisma.user.findMany({
    where: { email: parsed.data.email, active: true },
    select: { id: true, email: true, tokenVersion: true },
  })
  for (const user of users) {
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset', tv: user.tokenVersion },
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
      tv?: number
    }
    if (payload.purpose !== 'password-reset' || typeof payload.tv !== 'number') {
      res.status(400).json({ error: 'Token non valido' })
      return
    }
    const hashed = await bcrypt.hash(parsed.data.password, 12)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, active: true, tokenVersion: true },
    })
    if (!user?.active) {
      res.status(400).json({ error: 'Account non attivo', code: 'ACCOUNT_INACTIVE' })
      return
    }
    if (user.tokenVersion !== payload.tv) {
      res.status(400).json({ error: 'Token già usato o non valido', code: 'RESET_TOKEN_USED' })
      return
    }
    const updated = await prisma.user.updateMany({
      where: { id: payload.userId, tokenVersion: payload.tv, active: true },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
      },
    })
    if (updated.count === 0) {
      res.status(400).json({ error: 'Token già usato o non valido', code: 'RESET_TOKEN_USED' })
      return
    }
    res.json({ success: true, message: 'Password aggiornata' })
  } catch {
    res.status(400).json({ error: 'Token scaduto o non valido' })
  }
}))

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(PASSWORD_MIN).optional(),
}).refine(
  data => !data.newPassword || !!data.currentPassword,
  { message: 'Password attuale richiesta per impostarne una nuova', path: ['currentPassword'] },
)

authRouter.patch('/profile', authenticate, requireTenantContext, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Dati non validi', details: parsed.error.flatten() })
    return
  }

  const { name, email, currentPassword, newPassword } = parsed.data
  if (!name && !email && !newPassword) {
    res.status(400).json({ error: 'Nessun campo da aggiornare' })
    return
  }

  const user = await prisma.user.findFirst({
    where: { id: req.userId!, restaurantId: req.restaurantId!, active: true },
    select: { id: true, name: true, email: true, password: true, role: true, tokenVersion: true },
  })
  if (!user) {
    res.status(401).json({ error: 'Sessione non valida', code: 'SESSION_INVALID' })
    return
  }

  const updateData: { name?: string; email?: string; password?: string; tokenVersion?: { increment: number } } = {}
  if (name) updateData.name = name
  if (email) updateData.email = email

  if (newPassword) {
    const valid = await bcrypt.compare(currentPassword!, user.password)
    if (!valid) {
      res.status(401).json({ error: 'Password attuale non corretta', code: 'INVALID_PASSWORD' })
      return
    }
    updateData.password = await bcrypt.hash(newPassword, 12)
    updateData.tokenVersion = { increment: 1 }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, tokenVersion: true, restaurantId: true },
    })

    if (newPassword) {
      const fullUser = await findUserWithRestaurant(updated.id, updated.restaurantId)
      if (!fullUser) {
        res.status(401).json({ error: 'Sessione non valida', code: 'SESSION_INVALID' })
        return
      }
      const session = issueAuthResponse({
        id: fullUser.id,
        name: fullUser.name,
        email: fullUser.email,
        role: fullUser.role,
        restaurantId: fullUser.restaurantId,
        tokenVersion: fullUser.tokenVersion,
        restaurant: fullUser.restaurant,
      })
      setSessionCookie(res, session.token)
      res.json(session)
      return
    }

    res.json({
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
      permissions: getPermissionsForRole(updated.role),
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Email già in uso', code: 'EMAIL_ALREADY_EXISTS' })
      return
    }
    throw err
  }
}))
