import { useTranslation } from 'react-i18next'
import { Users, CalendarDays, ShieldCheck, Bell } from 'lucide-react'
import KpiCard from '../ui/KpiCard'
import type { PredictiveKpiMetrics } from './types'
import { DAY_KEYS } from './types'

interface PredictiveKpiStripProps {
  metrics: PredictiveKpiMetrics
  sparklineCovers: number[]
}

export default function PredictiveKpiStrip({ metrics, sparklineCovers }: PredictiveKpiStripProps) {
  const { t } = useTranslation()

  const peakLabel = metrics.peakDay
    ? t(`aiPredictive.days.${DAY_KEYS[metrics.peakDay.dayOfWeek]}`)
    : '—'

  return (
    <section
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      aria-label={t('aiPredictive.kpi.sectionLabel')}
    >
      <KpiCard
        title={t('aiPredictive.kpi.totalCovers')}
        value={String(metrics.totalCovers)}
        subtitle={t('aiPredictive.kpi.totalCoversSub')}
        icon={Users}
        accent="gold"
        size="compact"
        sparklineData={sparklineCovers}
      />
      <KpiCard
        title={t('aiPredictive.kpi.peakDay')}
        value={peakLabel.slice(0, 3)}
        subtitle={metrics.peakDay
          ? t('aiPredictive.kpi.peakDaySub', { covers: metrics.peakDay.predictedCovers })
          : undefined}
        icon={CalendarDays}
        accent="amber"
        size="compact"
      />
      <KpiCard
        title={t('aiPredictive.kpi.confidence')}
        value={`${metrics.avgConfidence}%`}
        subtitle={t('aiPredictive.kpi.confidenceSub')}
        icon={ShieldCheck}
        accent="emerald"
        size="compact"
      />
      <KpiCard
        title={t('aiPredictive.kpi.alerts')}
        value={String(metrics.alertCount)}
        subtitle={metrics.alertCount > 0
          ? t('aiPredictive.kpi.alertsSub', {
              critical: metrics.criticalCount,
              opportunity: metrics.opportunityCount,
            })
          : t('aiPredictive.kpi.alertsClear')}
        icon={Bell}
        accent="blue"
        size="compact"
      />
    </section>
  )
}
