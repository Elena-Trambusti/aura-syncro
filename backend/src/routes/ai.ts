import { Router, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { runPredictiveAnalysis } from '../lib/predictiveAI'

export const aiRouter = Router()

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
  const result = await runPredictiveAnalysis(req.restaurantId!)
  res.json(result)
})
