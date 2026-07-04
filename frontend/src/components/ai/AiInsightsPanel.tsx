import { useTranslation } from 'react-i18next'
import { Lightbulb } from 'lucide-react'
import type { PredictiveInsight } from '../../hooks/usePredictiveAI'
import PageSkeleton from '../ui/PageSkeleton'

function resolveInsightParams(
  params: Record<string, string | number>,
  t: (key: string) => string,
): Record<string, string | number> {
  const resolved = { ...params }
  if (typeof resolved.dayKey === 'string') {
    resolved.day = t(resolved.dayKey)
  }
  return resolved
}

interface AiInsightsPanelProps {
  insights: PredictiveInsight[]
  isLoading: boolean
  isError: boolean
}

const TYPE_ACCENT = {
  peak_day: 'border-l-amber-400/80',
  weather: 'border-l-blue-400/80',
  inventory: 'border-l-red-400/80',
  trend: 'border-l-emerald-400/80',
} as const

export default function AiInsightsPanel({ insights, isLoading, isError }: AiInsightsPanelProps) {
  const { t } = useTranslation()

  return (
    <section className="aura-module-frame h-full">
      <div className="border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-aura-gold" />
          <h2 className="text-base font-semibold text-pietra">{t('aiPredictive.insights.title')}</h2>
        </div>
        <p className="mt-1 text-sm text-fumo">{t('aiPredictive.insights.subtitle')}</p>
      </div>

      {isLoading ? (
        <PageSkeleton variant="list" count={3} className="p-4" />
      ) : isError ? (
        <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
      ) : insights.length === 0 ? (
        <div className="p-8 text-center text-sm text-fumo">{t('aiPredictive.insights.empty')}</div>
      ) : (
        <div className="space-y-3 p-4">
          {insights.map(insight => {
            const params = resolveInsightParams(insight.params, t)
            return (
            <article
              key={insight.id}
              className={`rounded-xl border border-white/[0.08] border-l-4 bg-white/[0.02] p-4 ${TYPE_ACCENT[insight.type]}`}
            >
              <p className="text-sm font-semibold text-pietra">
                {t(insight.titleKey, params)}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-fumo">
                {t(insight.bodyKey, params)}
              </p>
            </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
