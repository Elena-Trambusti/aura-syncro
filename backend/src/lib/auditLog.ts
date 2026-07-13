import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export type AuditAction =
  | 'PAYMENT_FINALIZE'
  | 'PAYMENT_REFUND'
  | 'DISCOUNT_APPLY'
  | 'TABLE_CLAIM'
  | 'TABLE_RELEASE'
  | 'ONBOARDING_GO_LIVE'
  | 'PRINT_AGENT_TOKEN_REGEN'

export interface WriteAuditLogInput {
  restaurantId: string
  userId?: string | null
  action: AuditAction | string
  entityType?: string
  entityId?: string
  metadata?: Prisma.InputJsonValue
  req?: Pick<Request, 'ip' | 'headers'>
}

function resolveClientIp(req?: Pick<Request, 'ip' | 'headers'>): string | null {
  if (!req) return null
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null
  }
  return req.ip ?? null
}

/** Registra evento audit — fire-and-forget, non blocca il flusso principale. */
export function writeAuditLog(input: WriteAuditLogInput): void {
  const { restaurantId, userId, action, entityType, entityId, metadata, req } = input
  void prisma.auditLog
    .create({
      data: {
        restaurantId,
        userId: userId ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: metadata ?? undefined,
        ipAddress: resolveClientIp(req),
        userAgent: typeof req?.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      },
    })
    .catch(err => {
      console.error('[auditLog] write failed:', action, err)
    })
}
