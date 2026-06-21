import { Response, NextFunction } from 'express'
import { hasAnyPermission, Permission } from '../lib/permissions'
import { AuthRequest } from './auth'

/** Richiede almeno uno dei permessi indicati */
export function requirePermission(...permissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!hasAnyPermission(req.userRole, ...permissions)) {
      res.status(403).json({
        error: 'Permessi insufficienti',
        code: 'FORBIDDEN',
      })
      return
    }
    next()
  }
}
