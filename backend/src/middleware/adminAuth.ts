import { Request, Response, NextFunction } from 'express'

export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY?.trim()

  if (!adminKey || adminKey.includes('inserisci')) {
    res.status(503).json({ error: 'ADMIN_API_KEY non configurata sul server' })
    return
  }

  const authHeader = req.headers.authorization
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const headerKey = typeof req.headers['x-admin-key'] === 'string'
    ? req.headers['x-admin-key'].trim()
    : null

  const provided = bearer ?? headerKey

  if (!provided || provided !== adminKey) {
    res.status(401).json({ error: 'Chiave admin non valida' })
    return
  }

  next()
}
