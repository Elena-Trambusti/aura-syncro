import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { verifyAuthToken } from '../lib/jwtAuth'
import { tenantForbidden } from '../lib/tenant'

export interface AuthRequest extends Request {
  userId?: string
  restaurantId?: string
  userRole?: string
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
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante', code: 'AUTH_REQUIRED' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = verifyAuthToken(token)

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

    // Modalità Sandbox Interattiva: blocchiamo solo le impostazioni (Settings/Tenant) e le cancellazioni distruttive.
    // Questo permette ai prospect di giocare con tavoli, ordini e prenotazioni.
    if (user.email === 'admin@demo.it' && !['GET', 'OPTIONS'].includes(req.method)) {
      const isDestructive = req.method === 'DELETE'
      const isSettings = req.path.includes('/settings') || req.path.includes('/users')
      if (isDestructive || isSettings) {
        res.status(403).json({ error: 'Nelle Demo Live non puoi cancellare o modificare le impostazioni del locale.', code: 'DEMO_READ_ONLY' })
        return
      }
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
} | null> {
  try {
    const payload = verifyAuthToken(token)
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        restaurantId: payload.restaurantId,
        active: true,
      },
      select: { id: true, role: true, tokenVersion: true },
    })
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) return null
    return {
      userId: user.id,
      restaurantId: payload.restaurantId,
      role: normalizeRole(user.role),
    }
  } catch {
    return null
  }
}

export function requireSocketRole(socketRole: string | undefined, ...roles: string[]): boolean {
  const role = normalizeRole(socketRole ?? '')
  return !!role && roles.includes(role)
}
