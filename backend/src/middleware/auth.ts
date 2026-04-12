import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  userId?: string
  restaurantId?: string
  userRole?: string
  // Override Express 5 params type (string | string[]) to ensure plain strings for Prisma
  params: Record<string, string>
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
    req.userId = payload.userId
    req.restaurantId = payload.restaurantId
    req.userRole = payload.role
    next()
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Permessi insufficienti' })
      return
    }
    next()
  }
}
