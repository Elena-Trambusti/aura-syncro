import { Router, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { runPredictiveAnalysis } from '../lib/predictiveAI'
import { getTenantCache, setTenantCacheBounded } from '../lib/tenantCache'

export const aiRouter = Router()

const PREDICTIVE_CACHE_TTL_MS = 5 * 60 * 1000

function markLegacyAiRoute(res: Response) {
  res.setHeader('Deprecation', 'true')
  res.setHeader('Link', '</api/ai/predictive>; rel="successor-version"')
}

function legacyAiDeprecated(_req: AuthRequest, res: Response): void {
  markLegacyAiRoute(res)
  res.status(410).json({
    error: 'Endpoint deprecato. Usa GET /api/ai/predictive',
    code: 'AI_ENDPOINT_DEPRECATED',
    successor: '/api/ai/predictive',
  })
}

const LEGACY_PATHS = ['/forecast', '/reorder', '/menu-matrix', '/alerts', '/summary'] as const
for (const path of LEGACY_PATHS) {
  aiRouter.get(path, requirePermission('analytics.read'), legacyAiDeprecated)
}

aiRouter.get('/predictive', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const cacheKey = `${restaurantId}:ai:predictive`
  const bypassCache = req.query.refresh === '1'

  if (!bypassCache) {
    const cached = getTenantCache<Awaited<ReturnType<typeof runPredictiveAnalysis>>>(cacheKey)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.json(cached)
      return
    }
  }

  const result = await runPredictiveAnalysis(restaurantId)
  setTenantCacheBounded(cacheKey, result, PREDICTIVE_CACHE_TTL_MS)
  res.setHeader('X-Cache', 'MISS')
  res.json(result)
})
