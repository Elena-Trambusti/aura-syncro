import { useTranslation } from 'react-i18next'
import { AlertTriangle, CloudRain, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { PredictiveAlert, AlertSeverity } from '../../hooks/usePredictiveAI'
import AuraIcon from '../ui/AuraIcon'

const SEVERITY_STYLES: Record<AlertSeverity, {
  border: string
  icon: typeof AlertTriangle
  iconColor: string
  badge: string
}> = {
  critical: {
    border: 'border-l-red-400/80',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    badge: 'bg-red-500/10 text-red-300 border-red-500/20',
  },
  optimization: {
    border: 'border-l-amber-400/80',
    icon: CloudRain,
    iconColor: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-200 border-amber-500/20',
  },
  opportunity: {
    border: 'border-l-emerald-400/80',
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
  },
}

interface PredictiveAlertCardProps {
  alert: PredictiveAlert
}

export default function PredictiveAlertCard({ alert }: PredictiveAlertCardProps) {
  const { t } = useTranslation()
  const style = SEVERITY_STYLES[alert.severity]
  const Icon = style.icon

  const dayKey = alert.params.dayKey as string | undefined
  const params = {
    ...alert.params,
    ...(dayKey ? { day: t(dayKey) } : {}),
  }

  return (
    <article
      className={cn(
        'rounded-xl border border-white/[0.08] border-l-4 bg-white/[0.02] p-4',
        style.border,
      )}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
          <AuraIcon icon={Icon} size="lg" className={style.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <span className={cn('inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.badge)}>
            {t(`aiPredictive.severity.${alert.severity}`)}
          </span>
          <p className="mt-2 text-sm font-medium leading-relaxed text-pietra">
            {t(alert.i18nKey, params)}
          </p>
        </div>
      </div>
    </article>
  )
}
