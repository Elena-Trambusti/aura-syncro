/**
 * Barriera 2 — Verifica che il contesto tenant sia completo PRIMA di toccare il DB.
 * Montare dopo `authenticate` su tutte le route protette.
 */
import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { getTenantPrisma, TenantPrismaClient } from '../lib/tenantPrisma'
import { tenantId } from '../lib/tenant'

/** Garantisce userId + restaurantId + userRole presenti; attacca `req.db` scoped. */
export function requireTenantContext(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({ error: 'Utente non autenticato', code: 'AUTH_REQUIRED' })
    return
  }
  if (!req.restaurantId) {
    res.status(401).json({ error: 'Tenant non identificato', code: 'TENANT_REQUIRED' })
    return
  }
  if (!req.userRole) {
    res.status(401).json({ error: 'Ruolo non disponibile', code: 'ROLE_REQUIRED' })
    return
  }

  req.db = getTenantPrisma(req.restaurantId)
  next()
}

/** Shortcut type-safe per route handler — lancia se contesto mancante. */
export function tenantDb(req: AuthRequest): TenantPrismaClient {
  return req.db ?? getTenantPrisma(tenantId(req))
}
