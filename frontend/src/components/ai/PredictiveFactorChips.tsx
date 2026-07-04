import { Brain, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuraIcon from '../ui/AuraIcon'

interface PredictiveFactorChipsProps {
  engineVersion?: string
  weatherSource?: 'open-meteo' | 'simulated'
  factorsUsed: ('orderHistory' | 'dayOfWeek' | 'weather' | 'reservations')[]
}

const FACTOR_KEYS = {
  orderHistory: 'aiPredictive.factors.orderHistory',
  dayOfWeek: 'aiPredictive.factors.dayOfWeek',
  weather: 'aiPredictive.factors.weather',
  reservations: 'aiPredictive.factors.reservations',
} as const

export default function PredictiveFactorChips({
  engineVersion,
  weatherSource,
  factorsUsed,
}: PredictiveFactorChipsProps) {
  const { t } = useTranslation()

  if (!engineVersion && factorsUsed.length === 0) return null

  return (
    <>
      {engineVersion && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-fumo">
          <AuraIcon icon={Brain} size="xs" className="text-aura-gold" />
          {t('aiPredictive.engineLabel', { version: engineVersion })}
          {weatherSource && (
            <span className="text-fumo/80">
              · {t(`aiPredictive.weatherSource.${weatherSource === 'open-meteo' ? 'openMeteo' : 'simulated'}`)}
            </span>
          )}
        </span>
      )}
      {factorsUsed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {factorsUsed.map(factor => (
            <span
              key={factor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-fumo"
            >
              <AuraIcon icon={Sparkles} size="xs" className="text-aura-gold" />
              {t(FACTOR_KEYS[factor])}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
