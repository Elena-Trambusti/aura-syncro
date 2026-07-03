import { Response, NextFunction } from 'express'
import { hasAnyPermission, hasPermission, Permission } from '../lib/permissions'
import { AuthRequest } from './auth'

/** Richiede almeno uno dei permessi indicati (OR). */
export function requirePermission(...permissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: 'Sessione non valida', code: 'AUTH_REQUIRED' })
      return
    }
    if (!hasAnyPermission(req.userRole, ...permissions)) {
      res.status(403).json({
        error: 'Permessi insufficienti',
        code: 'FORBIDDEN',
        required: permissions,
      })
      return
    }
    next()
  }
}

/** Richiede TUTTI i permessi indicati (AND) — per azioni ad alto rischio. */
export function requireAllPermissions(...permissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: 'Sessione non valida', code: 'AUTH_REQUIRED' })
      return
    }
    const missing = permissions.filter(p => !hasPermission(req.userRole, p))
    if (missing.length > 0) {
      res.status(403).json({
        error: 'Permessi insufficienti',
        code: 'FORBIDDEN',
        required: permissions,
        missing,
      })
      return
    }
    next()
  }
}
