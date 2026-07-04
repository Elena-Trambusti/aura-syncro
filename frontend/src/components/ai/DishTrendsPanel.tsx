import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, UtensilsCrossed } from 'lucide-react'
import type { DishTrendItem } from '../../hooks/usePredictiveAI'
import PageSkeleton from '../ui/PageSkeleton'
import TrendBadge from '../ui/TrendBadge'
import AuraIcon from '../ui/AuraIcon'

interface DishTrendsPanelProps {
  trends: DishTrendItem[]
  isLoading: boolean
  isError: boolean
}

export default function DishTrendsPanel({ trends, isLoading, isError }: DishTrendsPanelProps) {
  const { t } = useTranslation()

  const rising = trends
    .filter(t => t.direction === 'up')
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 3)

  const falling = trends
    .filter(t => t.direction === 'down')
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 3)

  return (
    <section className="aura-module-frame h-full">
      <div className="border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-aura-gold" />
          <h2 className="text-base font-semibold text-pietra">{t('aiPredictive.trends.title')}</h2>
        </div>
        <p className="mt-1 text-sm text-fumo">{t('aiPredictive.trends.subtitle')}</p>
      </div>

      {isLoading ? (
        <PageSkeleton variant="list" count={3} className="p-4" />
      ) : isError ? (
        <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
      ) : trends.length === 0 ? (
        <div className="p-8 text-center text-sm text-fumo">{t('aiPredictive.trends.empty')}</div>
      ) : (
        <div className="space-y-5 p-4">
          {rising.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-400/90">
                <AuraIcon icon={TrendingUp} size="xs" />
                {t('aiPredictive.trends.rising')}
              </p>
              <ul className="space-y-2">
                {rising.map(item => (
                  <TrendRow key={item.dishId} item={item} t={t} />
                ))}
              </ul>
            </div>
          )}
          {falling.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fumo">
                <AuraIcon icon={TrendingDown} size="xs" />
                {t('aiPredictive.trends.falling')}
              </p>
              <ul className="space-y-2">
                {falling.map(item => (
                  <TrendRow key={item.dishId} item={item} t={t} />
                ))}
              </ul>
            </div>
          )}
          {rising.length === 0 && falling.length === 0 && (
            <div className="p-4 text-center text-sm text-fumo">{t('aiPredictive.trends.stable')}</div>
          )}
        </div>
      )}
    </section>
  )
}

function TrendRow({
  item,
  t,
}: {
  item: DishTrendItem
  t: ReturnType<typeof useTranslation>['t']
}) {
  const hintKey = item.direction === 'up'
    ? 'aiPredictive.trends.hintUp'
    : item.direction === 'down'
      ? 'aiPredictive.trends.hintDown'
      : 'aiPredictive.trends.hintStable'

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-pietra">{item.dishName}</p>
          <p className="mt-0.5 text-xs text-fumo">{t(hintKey, { dish: item.dishName })}</p>
        </div>
        <TrendBadge
          value={item.changePct}
          label={`${item.changePct > 0 ? '+' : ''}${item.changePct}%`}
          size="xs"
        />
      </div>
    </li>
  )
}
