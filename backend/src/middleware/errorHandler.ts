import { Request, Response, NextFunction } from 'express'
import { HttpError } from '../lib/httpErrors'
import { mapPrismaError } from '../lib/prismaErrors'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const prismaMapped = mapPrismaError(err)
  const resolved = prismaMapped ?? (err instanceof HttpError ? err : null)

  if (resolved) {
    if (resolved.statusCode >= 500) {
      console.error(resolved.stack ?? resolved.message)
    }
    res.status(resolved.statusCode).json({
      error: resolved.message,
      ...(resolved.code ? { code: resolved.code } : {}),
      ...(resolved.details && process.env.NODE_ENV !== 'production' ? { details: resolved.details } : {}),
    })
    return
  }

  console.error(err.stack ?? err.message)
  res.status(500).json({
    error: err.message,
  })
}
