import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { tenantForbidden } from '../lib/tenant'

export interface AuthRequest extends Request {
  userId?: string
  restaurantId?: string
  userRole?: string
  /** true quando l'API è servita in anteprima free (senza abbonamento Premium) */
  freeTierPreview?: boolean
  // Override Express 5 params type (string | string[]) to ensure plain strings for Prisma
  params: Record<string, string>
}

/** Allinea ruoli legacy del JWT ai valori Prisma Role */
function normalizeRole(role: string): string {
  if (role === 'KITCHEN') return 'CHEF'
  if (role === 'CASHIER') return 'WAITER'
  return role
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      restaurantId: string
      role: string
    }

    // Optional header: must match JWT tenant if provided
    const headerTenant = req.headers['x-restaurant-id']
    if (headerTenant && headerTenant !== payload.restaurantId) {
      tenantForbidden(res)
      return
    }

    req.userId = payload.userId
    req.restaurantId = payload.restaurantId
    req.userRole = normalizeRole(payload.role)
    next()
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = normalizeRole(req.userRole ?? '')
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'Permessi insufficienti' })
      return
    }
    next()
  }
}
