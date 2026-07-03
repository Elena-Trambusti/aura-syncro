import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { verifySessionToken } from '../lib/jwtAuth'
import { extractBearerToken } from '../lib/sessionCookie'
import { tenantForbidden } from '../lib/tenant'
import { isDemoUserEmail, isDemoWritePathAllowed } from '../lib/demoSandbox'
import type { TenantPrismaClient } from '../lib/tenantPrisma'

export interface AuthRequest extends Request {
  userId?: string
  restaurantId?: string
  userRole?: string
  /** Client Prisma con scope tenant — popolato da requireTenantContext */
  db?: TenantPrismaClient
  /** true quando l'API è servita in anteprima free (senza abbonamento Premium) */
  freeTierPreview?: boolean
  params: Record<string, string>
}

/** Allinea ruoli legacy del JWT ai valori Prisma Role */
export function normalizeRole(role: string): string {
  if (role === 'KITCHEN') return 'CHEF'
  if (role === 'CASHIER') return 'WAITER'
  return role
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Token mancante', code: 'AUTH_REQUIRED' })
    return
  }
  try {
    const payload = verifySessionToken(token)

    const headerTenant = req.headers['x-restaurant-id']
    if (headerTenant && headerTenant !== payload.restaurantId) {
      tenantForbidden(res)
      return
    }

    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        restaurantId: payload.restaurantId,
        active: true,
      },
      select: { id: true, role: true, tokenVersion: true, email: true },
    })

    if (!user) {
      res.status(401).json({ error: 'Sessione scaduta o account disattivato', code: 'SESSION_INVALID' })
      return
    }

    const tokenVersion = payload.tv ?? 0
    if (user.tokenVersion !== tokenVersion) {
      res.status(401).json({ error: 'Sessione non più valida. Effettua di nuovo l\'accesso.', code: 'SESSION_REVOKED' })
      return
    }

    req.userId = user.id
    req.restaurantId = payload.restaurantId
    req.userRole = normalizeRole(user.role)

    // Demo live: sola lettura ovunque tranne flusso tavoli/comande/incasso.
    if (isDemoUserEmail(user.email) && !isDemoWritePathAllowed(req.originalUrl, req.method)) {
      res.status(403).json({
        error: 'In modalità Demo puoi interagire solo con la sezione Tavoli. Il resto è in sola lettura.',
        code: 'DEMO_READ_ONLY',
      })
      return
    }

    next()
  } catch {
    res.status(401).json({ error: 'Token non valido', code: 'AUTH_INVALID' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = normalizeRole(req.userRole ?? '')
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'Permessi insufficienti', code: 'FORBIDDEN' })
      return
    }
    next()
  }
}

/** Verifica JWT + utente attivo per Socket.IO (stesso criterio di authenticate) */
export async function verifySocketToken(token: string): Promise<{
  userId: string
  restaurantId: string
  role: string
  email: string
  tokenVersion: number
} | null> {
  try {
    const payload = verifySessionToken(token)
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        restaurantId: payload.restaurantId,
        active: true,
      },
      select: { id: true, role: true, tokenVersion: true, email: true },
    })
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) return null
    return {
      userId: user.id,
      restaurantId: payload.restaurantId,
      role: normalizeRole(user.role),
      email: user.email,
      tokenVersion: user.tokenVersion,
    }
  } catch {
    return null
  }
}

export function requireSocketRole(socketRole: string | undefined, ...roles: string[]): boolean {
  const role = normalizeRole(socketRole ?? '')
  return !!role && roles.includes(role)
}
