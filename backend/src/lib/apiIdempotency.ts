import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from './prisma'

const HEADER = 'x-idempotency-key'
const MAX_KEY_LEN = 128

export function readIdempotencyKey(req: AuthRequest): string | null {
  const raw = req.headers[HEADER]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < 8) return null
  return trimmed.slice(0, MAX_KEY_LEN)
}

export async function getIdempotentResponse(
  restaurantId: string,
  key: string,
): Promise<{ statusCode: number; responseBody: unknown } | null> {
  const row = await prisma.apiIdempotencyRecord.findUnique({
    where: { restaurantId_key: { restaurantId, key } },
    select: { statusCode: true, responseBody: true },
  })
  if (!row) return null
  return { statusCode: row.statusCode, responseBody: row.responseBody }
}

/** Tenta di registrare subito la chiave. Se fallisce, un'altra richiesta l'ha già presa. */
export async function acquireIdempotencyLock(
  restaurantId: string,
  key: string,
  route: string
): Promise<boolean> {
  try {
    await prisma.apiIdempotencyRecord.create({
      data: {
        restaurantId,
        key,
        route,
        statusCode: 202,
        responseBody: { message: 'processing' },
      },
    })
    return true
  } catch {
    return false
  }
}

export async function saveIdempotentResponse(
  restaurantId: string,
  key: string,
  route: string,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  try {
    await prisma.apiIdempotencyRecord.update({
      where: { restaurantId_key: { restaurantId, key } },
      data: {
        route,
        statusCode,
        responseBody: responseBody as object,
      },
    })
  } catch {
    // Ignora se la chiave per qualche motivo non c'è
  }
}

/** Risponde dalla cache se presente; altrimenti esegue handler e salva solo successi 2xx. */
export async function withIdempotency(
  req: AuthRequest,
  res: Response,
  route: string,
  handler: () => Promise<{ status: number; body: unknown } | null>,
): Promise<void> {
  const key = readIdempotencyKey(req)
  const restaurantId = req.restaurantId

  if (key && restaurantId) {
    const cached = await getIdempotentResponse(restaurantId, key)
    if (cached) {
      if (cached.statusCode === 202) {
        res.status(409).json({ error: 'Richiesta già in elaborazione' })
        return
      }
      res.status(cached.statusCode).json(cached.responseBody)
      return
    }
    const locked = await acquireIdempotencyLock(restaurantId, key, route)
    if (!locked) {
      res.status(409).json({ error: 'Richiesta duplicata' })
      return
    }
  }

  const result = await handler()
  if (!result) return

  if (key && restaurantId && result.status >= 200 && result.status < 300) {
    await saveIdempotentResponse(restaurantId, key, route, result.status, result.body)
  }

  res.status(result.status).json(result.body)
}
