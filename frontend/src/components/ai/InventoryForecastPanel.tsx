import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { InventoryForecastItem } from '../../hooks/usePredictiveAI'
import PageSkeleton from '../ui/PageSkeleton'

const STATUS_STYLES = {
  ok: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  low: 'bg-amber-500/10 text-amber-200 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-300 border-red-500/20',
  overstock: 'bg-blue-500/10 text-blue-200 border-blue-500/20',
} as const

interface InventoryForecastPanelProps {
  items: InventoryForecastItem[]
  hasRecipeLinks: boolean
  isLoading: boolean
  isError: boolean
}

export default function InventoryForecastPanel({
  items,
  hasRecipeLinks,
  isLoading,
  isError,
}: InventoryForecastPanelProps) {
  const { t } = useTranslation()

  const sorted = [...items].sort((a, b) => {
    const order = { critical: 0, low: 1, overstock: 2, ok: 3 }
    return order[a.status] - order[b.status]
  })

  return (
    <section className="aura-module-frame">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-aura-gold" />
            <h2 className="text-base font-semibold text-pietra">{t('aiPredictive.inventory.title')}</h2>
          </div>
          <p className="mt-1 text-sm text-fumo">{t('aiPredictive.inventory.subtitle')}</p>
        </div>
        <Link
          to="/magazzino"
          className="inline-flex items-center gap-1 text-xs font-medium text-aura-gold hover:text-aura-gold-light"
        >
          {t('aiPredictive.inventory.goToInventory')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <PageSkeleton variant="list" count={4} className="p-4" />
      ) : isError ? (
        <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
      ) : !hasRecipeLinks ? (
        <div className="p-6 text-center">
          <p className="text-sm font-medium text-pietra">{t('aiPredictive.inventory.noRecipesTitle')}</p>
          <p className="mt-1 text-sm text-fumo">{t('aiPredictive.inventory.noRecipesHint')}</p>
          <Link
            to="/menu"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-fumo hover:text-pietra"
          >
            {t('aiPredictive.emptyState.ctaMenu')}
          </Link>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-8 text-center text-sm text-fumo">{t('aiPredictive.inventory.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wide text-fumo/70">
                <th className="px-5 py-3 font-medium">{t('aiPredictive.inventory.colItem')}</th>
                <th className="px-3 py-3 font-medium">{t('aiPredictive.inventory.colStock')}</th>
                <th className="px-3 py-3 font-medium">{t('aiPredictive.inventory.colDemand')}</th>
                <th className="px-3 py-3 font-medium">{t('aiPredictive.inventory.colDaysLeft')}</th>
                <th className="px-3 py-3 font-medium">{t('aiPredictive.inventory.colReorder')}</th>
                <th className="px-5 py-3 font-medium">{t('aiPredictive.inventory.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 12).map(item => {
                const fillPct = item.demandNext7Days > 0
                  ? Math.min(100, Math.round((item.currentStock / item.demandNext7Days) * 100))
                  : 100
                return (
                  <tr key={item.itemId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-pietra">{item.itemName}</td>
                    <td className="px-3 py-3 tabular-nums text-fumo">
                      {item.currentStock}{item.unit}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="premium-progress-track w-16">
                          <div
                            className={cn(
                              'premium-progress-bar',
                              item.status === 'critical' && 'bg-red-400',
                              item.status === 'low' && 'bg-amber-400',
                            )}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-fumo">
                          {Math.round(item.demandNext7Days * 10) / 10}{item.unit}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-fumo">
                      {item.daysUntilStockout != null ? item.daysUntilStockout : '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-aura-gold-light">
                      {item.suggestedReorderQty > 0
                        ? `+${item.suggestedReorderQty}${item.unit}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[item.status],
                      )}
                      >
                        {t(`aiPredictive.inventory.status.${item.status}`)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
