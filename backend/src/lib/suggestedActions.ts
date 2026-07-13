import type { SmartAlert } from './predictiveEngine'
import type { InventoryForecastItem } from './predictivePayload'
import type { DishTrendItem } from './predictivePayload'

export type SuggestedAction = {
  id: string
  actionKey: string
  href: string
  priority: 'high' | 'medium' | 'low'
  params?: Record<string, string | number>
}

/** Azioni operative derivate dal motore predittivo interno (nessuna API esterna). */
export function buildSuggestedActions(input: {
  alerts: SmartAlert[]
  inventoryForecast: InventoryForecastItem[]
  dishTrends: DishTrendItem[]
}): SuggestedAction[] {
  const actions: SuggestedAction[] = []

  for (const alert of input.alerts) {
    if (alert.severity === 'critical') {
      actions.push({
        id: `alert-${alert.id}`,
        actionKey: 'aiPredictive.suggestedActions.reviewAlert',
        href: '/dashboard/ai-predictive',
        priority: 'high',
        params: { alertKey: alert.i18nKey },
      })
    }
  }

  const criticalStock = input.inventoryForecast.filter(i => i.status === 'critical' || i.status === 'low')
  for (const item of criticalStock.slice(0, 3)) {
    actions.push({
      id: `stock-${item.itemId}`,
      actionKey: 'aiPredictive.suggestedActions.reorderStock',
      href: '/dashboard/inventory',
      priority: item.status === 'critical' ? 'high' : 'medium',
      params: { itemName: item.itemName, qty: item.suggestedReorderQty },
    })
  }

  const trendingDown = input.dishTrends.filter(d => d.direction === 'down' && d.changePct <= -15)
  for (const dish of trendingDown.slice(0, 2)) {
    actions.push({
      id: `dish-${dish.dishId}`,
      actionKey: 'aiPredictive.suggestedActions.reviewDish',
      href: '/dashboard/menu',
      priority: 'medium',
      params: { dishName: dish.dishName, changePct: dish.changePct },
    })
  }

  const seen = new Set<string>()
  return actions.filter(a => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  }).slice(0, 8)
}
