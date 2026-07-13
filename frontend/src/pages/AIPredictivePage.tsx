import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '../lib/utils'
import { usePredictiveAI } from '../hooks/usePredictiveAI'
import { useTenantQueryKey } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import PredictiveFactorChips from '../components/ai/PredictiveFactorChips'
import PredictiveKpiStrip from '../components/ai/PredictiveKpiStrip'
import AffluenceForecastPanel from '../components/ai/AffluenceForecastPanel'
import SmartAlertsPanel from '../components/ai/SmartAlertsPanel'
import InventoryForecastPanel from '../components/ai/InventoryForecastPanel'
import DishTrendsPanel from '../components/ai/DishTrendsPanel'
import AiInsightsPanel from '../components/ai/AiInsightsPanel'
import PredictiveMobileTabs from '../components/ai/PredictiveMobileTabs'
import { DAY_KEYS, buildChartRows, computePredictiveKpis } from '../components/ai/types'

export default function AIPredictivePage() {
  return <AIPredictivePageContent />
}

function AIPredictivePageContent() {
  const { t, i18n } = useTranslation()
  const tk = useTenantQueryKey()
  const {
    forecast,
    alerts,
    factorsUsed,
    engineVersion,
    generatedAt,
    weatherSource,
    inventoryForecast,
    dishTrends,
    insights,
    suggestedActions,
    hasRecipeLinks,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = usePredictiveAI()
  const toastedAlertsRef = useRef(new Set<string>())

  useEffect(() => {
    toastedAlertsRef.current.clear()
  }, [tk])

  useEffect(() => {
    if (isLoading || alerts.length === 0) return
    let count = 0
    for (const alert of alerts) {
      if (toastedAlertsRef.current.has(alert.id)) continue
      toastedAlertsRef.current.add(alert.id)
      const dayKey = alert.params.dayKey as string | undefined
      const msg = t(alert.i18nKey, {
        ...alert.params,
        ...(dayKey ? { day: t(dayKey) } : {}),
      })
      if (alert.severity === 'critical') toast.aiCritical(msg)
      else if (alert.severity === 'opportunity') toast.aiOpportunity(msg)
      else toast.ai(msg)
      count += 1
      if (count >= 2) break
    }
  }, [alerts, isLoading, t])

  const chartData = buildChartRows(
    forecast,
    dow => t(`aiPredictive.days.${DAY_KEYS[dow]}`),
    date => new Date(date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
  )

  const metrics = computePredictiveKpis(forecast, alerts)
  const sparklineCovers = forecast.map(day => day.predictedCovers)

  const mainGrid = (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
    <AffluenceForecastPanel
      className="xl:col-span-3"
      chartData={chartData}
      isLoading={isLoading}
      isError={isError}
    />
    <SmartAlertsPanel
      className="aura-module-frame xl:col-span-2"
      alerts={alerts}
      metrics={metrics}
      factorsUsed={factorsUsed}
      generatedAt={generatedAt}
      isLoading={isLoading}
      isError={isError}
    />
  </div>
  )

  const secondaryGrid = (
    <>
      <InventoryForecastPanel
        items={inventoryForecast}
        hasRecipeLinks={hasRecipeLinks}
        isLoading={isLoading}
        isError={isError}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DishTrendsPanel trends={dishTrends} isLoading={isLoading} isError={isError} />
        <AiInsightsPanel insights={insights} isLoading={isLoading} isError={isError} />
      </div>
    </>
  )

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('aiPredictive.title')}
        subtitle={t('aiPredictive.subtitle')}
        meta={(
          <PredictiveFactorChips
            engineVersion={engineVersion}
            weatherSource={weatherSource}
            factorsUsed={factorsUsed}
          />
        )}
        actions={(
          <div className="flex items-center gap-2">
            {generatedAt && (
              <p className="text-xs text-fumo">
                {t('aiPredictive.updatedAt', {
                  date: new Date(generatedAt).toLocaleString(i18n.language, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }),
                })}
              </p>
            )}
            <button
              type="button"
              disabled={isFetching}
              onClick={async () => {
                toastedAlertsRef.current.clear()
                const result = await refetch()
                if (result.isError) toast.error(t('aiPredictive.loadError'))
                else toast.success(t('aiPredictive.refreshed'))
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-fumo transition-colors hover:bg-white/[0.05] disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {t('aiPredictive.refresh')}
            </button>
          </div>
        )}
      />

      {isError && (
        <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-400">{t('aiPredictive.loadError')}</p>
        </div>
      )}

      <PredictiveKpiStrip metrics={metrics} sparklineCovers={sparklineCovers} />

      {suggestedActions.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-pietra mb-3">{t('aiPredictive.suggestedActionsTitle')}</h3>
          <ul className="space-y-2">
            {suggestedActions.map(action => (
              <li key={action.id}>
                <Link
                  to={action.href}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-fumo hover:border-aura-gold/30 hover:text-pietra transition-colors"
                >
                  <span>{t(action.actionKey, action.params)}</span>
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    action.priority === 'high' ? 'text-red-400' : action.priority === 'medium' ? 'text-amber-400' : 'text-fumo',
                  )}>
                    {action.priority}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="hidden xl:block space-y-6">
        {mainGrid}
        {secondaryGrid}
      </div>

      <div className="xl:hidden">
        <PredictiveMobileTabs
          mainContent={mainGrid}
          inventoryContent={(
            <InventoryForecastPanel
              items={inventoryForecast}
              hasRecipeLinks={hasRecipeLinks}
              isLoading={isLoading}
              isError={isError}
            />
          )}
          trendsContent={(
            <DishTrendsPanel trends={dishTrends} isLoading={isLoading} isError={isError} />
          )}
          insightsContent={(
            <AiInsightsPanel insights={insights} isLoading={isLoading} isError={isError} />
          )}
        />
      </div>
    </ExecutivePageShell>
  )
}
