import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Brain, Package, CloudRain, TrendingUp, BookOpen,
} from 'lucide-react'
import { usePermissions } from '../../hooks/usePermissions'
import type { PredictiveAlert } from '../../hooks/usePredictiveAI'
import type { PredictiveKpiMetrics } from './types'
import { DAY_KEYS } from './types'
import PageSkeleton from '../ui/PageSkeleton'
import AuraIcon from '../ui/AuraIcon'
import PredictiveAlertCard from './PredictiveAlertCard'

interface SmartAlertsPanelProps {
  alerts: PredictiveAlert[]
  metrics: PredictiveKpiMetrics
  factorsUsed: string[]
  generatedAt?: string
  isLoading: boolean
  isError: boolean
  className?: string
}

export default function SmartAlertsPanel({
  alerts,
  metrics,
  factorsUsed,
  generatedAt,
  isLoading,
  isError,
  className,
}: SmartAlertsPanelProps) {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()

  const peakLabel = metrics.peakDay
    ? t(`aiPredictive.days.${DAY_KEYS[metrics.peakDay.dayOfWeek]}`)
    : null

  return (
    <section className={className ?? 'aura-module-frame'}>
      <div className="border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-aura-gold" />
          <h2 className="text-base font-semibold text-pietra">{t('aiPredictive.alertsTitle')}</h2>
        </div>
        <p className="mt-1 text-sm text-fumo">{t('aiPredictive.alertsSubtitle')}</p>
      </div>

      {isLoading ? (
        <PageSkeleton variant="list" count={3} className="p-4" />
      ) : isError ? (
        <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
      ) : alerts.length === 0 ? (
        <div className="p-6 sm:p-8">
          <div className="mx-auto max-w-sm text-center">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-aura-gold/10 blur-xl" aria-hidden />
              <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                <AuraIcon icon={Brain} size="xl" className="text-aura-gold" />
              </div>
            </div>
            <p className="text-base font-semibold text-pietra">{t('aiPredictive.noAlerts')}</p>
            <p className="mt-1 text-sm text-fumo">{t('aiPredictive.noAlertsHint')}</p>
          </div>

          <ul className="mt-6 space-y-3">
            {[
              { icon: Package, key: 'inventory' },
              { icon: CloudRain, key: 'weather' },
              { icon: TrendingUp, key: 'trends' },
            ].map(({ icon, key }) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <AuraIcon icon={icon} size="sm" className="mt-0.5 shrink-0 text-aura-gold" />
                <p className="text-sm text-fumo">{t(`aiPredictive.emptyState.monitor.${key}`)}</p>
              </li>
            ))}
          </ul>

          {(peakLabel || factorsUsed.length > 0) && (
            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-fumo/70">
                {t('aiPredictive.emptyState.snapshot')}
              </p>
              {peakLabel && metrics.peakDay && (
                <p className="mt-2 text-sm text-pietra">
                  {t('aiPredictive.emptyState.peakSummary', {
                    day: peakLabel,
                    covers: metrics.peakDay.predictedCovers,
                  })}
                </p>
              )}
              {factorsUsed.length > 0 && (
                <p className="mt-1 text-xs text-fumo">
                  {t('aiPredictive.emptyState.factorsActive', { count: factorsUsed.length })}
                </p>
              )}
              {generatedAt && (
                <p className="mt-1 text-xs text-fumo/70">
                  {t('aiPredictive.updatedAt', {
                    date: new Date(generatedAt).toLocaleString(i18n.language, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }),
                  })}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {can('inventory.read') && (
              <Link
                to="/magazzino"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-fumo transition-colors hover:border-aura-gold/30 hover:text-pietra"
              >
                <Package className="h-4 w-4 text-aura-gold" />
                {t('aiPredictive.emptyState.ctaInventory')}
              </Link>
            )}
            {can('menu.read') && (
              <Link
                to="/menu"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-fumo transition-colors hover:border-aura-gold/30 hover:text-pietra"
              >
                <BookOpen className="h-4 w-4 text-aura-gold" />
                {t('aiPredictive.emptyState.ctaMenu')}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {alerts.map(alert => (
            <PredictiveAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </section>
  )
}
