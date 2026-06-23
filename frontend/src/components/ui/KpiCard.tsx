import type { ElementType } from 'react'
import { cn } from '../../lib/utils'
import TrendBadge from './TrendBadge'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: ElementType
  trend?: number
  trendLabel?: (value: number) => string
  accent?: 'gold' | 'emerald' | 'blue' | 'amber'
  size?: 'hero' | 'standard' | 'compact'
  valueTone?: 'gold' | 'light'
  className?: string
}

const ACCENT_ICON = {
  gold: 'text-aura-gold border-aura-gold/30 bg-aura-gold/[0.08]',
  emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]',
  blue: 'text-blue-400 border-blue-500/30 bg-blue-500/[0.08]',
  amber: 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]',
} as const

function KpiSparkline({ accent }: { accent: KpiCardProps['accent'] }) {
  const stroke =
    accent === 'emerald' ? '#34d399' :
    accent === 'blue' ? '#60a5fa' :
    accent === 'amber' ? '#fbbf24' :
    '#D4AF37'

  return (
    <svg className="aura-kpi-spark" viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 48 C 30 44, 50 36, 80 38 S 140 28, 180 22 S 220 18, 240 12"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0 48 C 30 44, 50 36, 80 38 S 140 28, 180 22 S 220 18, 240 12 V 64 H 0 Z"
        fill={`url(#kpi-spark-${accent})`}
        opacity="0.35"
      />
      <defs>
        <linearGradient id={`kpi-spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  accent = 'gold',
  size = 'standard',
  valueTone = 'light',
  className,
}: KpiCardProps) {
  return (
    <div className={cn('aura-kpi', `aura-kpi--${size}`, className)}>
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="aura-kpi-label">{title}</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
            <p
              className={cn(
                'aura-kpi-value',
                size === 'hero' ? 'aura-kpi-value--hero' : 'aura-kpi-value--standard',
                valueTone === 'gold' && 'aura-kpi-value--gold',
              )}
            >
              {value}
            </p>
            {trend !== undefined && trendLabel && (
              <TrendBadge value={trend} label={trendLabel(Math.abs(trend))} className="mb-1" />
            )}
          </div>
        </div>
        <div className={cn('aura-kpi-icon', ACCENT_ICON[accent])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      {subtitle && (
        <p className="relative z-[1] mt-3 text-[11px] leading-relaxed text-fumo/75">{subtitle}</p>
      )}
      <KpiSparkline accent={accent} />
    </div>
  )
}
