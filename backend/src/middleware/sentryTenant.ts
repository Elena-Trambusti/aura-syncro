import { Response, NextFunction } from 'express'
import * as Sentry from '@sentry/node'
import { AuthRequest } from './auth'

/** Tag Sentry per correlare errori al tenant. */
export function attachSentryTenantScope(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.restaurantId) {
    Sentry.setTag('restaurant_id', req.restaurantId)
  }
  if (req.userId) {
    Sentry.setUser({
      id: req.userId,
      segment: req.userRole ?? undefined,
    })
  }
  next()
}
