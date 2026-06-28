import { Router, type Request, type Response } from 'express'
import express from 'express'
import { sentryTunnelLimiter } from '../middleware/rateLimit'

export const sentryTunnelRouter = Router()

function resolveUpstreamUrl(req: Request): string | null {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return null

  const dsnUrl = new URL(dsn)
  const projectId = dsnUrl.pathname.replace(/^\//, '')
  const base = `https://${dsnUrl.host}/api/${projectId}/envelope/`
  const qs = new URLSearchParams(req.query as Record<string, string>).toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Proxy Sentry envelope — bypassa ad-blocker in produzione.
 * Richiede SENTRY_DSN in backend/.env (stesso valore di VITE_SENTRY_DSN).
 */
sentryTunnelRouter.post(
  '/',
  sentryTunnelLimiter,
  express.raw({ type: () => true, limit: '2mb' }),
  async (req: Request, res: Response) => {
    try {
      const tunnelSecret = process.env.SENTRY_TUNNEL_SECRET?.trim()
      if (process.env.NODE_ENV === 'production' && !tunnelSecret) {
        res.status(503).end()
        return
      }
      if (tunnelSecret) {
        const provided = req.headers['x-sentry-tunnel-secret']
        if (provided !== tunnelSecret) {
          res.status(403).end()
          return
        }
      }

      const envelope = req.body
      if (!Buffer.isBuffer(envelope) || envelope.length === 0) {
        res.status(400).end()
        return
      }

      const upstream = resolveUpstreamUrl(req)
      if (!upstream) {
        res.status(503).end()
        return
      }

      const upstreamRes = await fetch(upstream, {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] ?? 'application/x-sentry-envelope',
        },
        body: envelope,
      })

      res.status(upstreamRes.status).end()
    } catch {
      res.status(500).end()
    }
  },
)
