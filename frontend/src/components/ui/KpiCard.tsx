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
  sparklineData?: number[]
  className?: string
}

const ACCENT_ICON = {
  gold: 'text-[#D4AF37]',
  emerald: 'text-[#34d399]',
  blue: 'text-[#60a5fa]',
  amber: 'text-[#fbbf24]',
} as const

const ACCENT_STROKE = {
  gold: '#D4AF37',
  emerald: '#34d399',
  blue: '#60a5fa',
  amber: '#fbbf24',
} as const

function buildSparkPath(data: number[], width = 240, height = 64): string {
  if (data.length === 0) return ''
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  return data
    .map((v, i) => {
      const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width
      const y = height - 10 - ((v - min) / range) * (height - 20)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function KpiSparkline({
  accent,
  data,
}: {
  accent: KpiCardProps['accent']
  data?: number[]
}) {
  const stroke = ACCENT_STROKE[accent ?? 'gold']
  const path = data && data.length >= 2
    ? buildSparkPath(data)
    : 'M0 48 C 30 44, 50 36, 80 38 S 140 28, 180 22 S 220 18, 240 12'

  return (
    <svg className="absolute inset-x-0 bottom-0 w-full h-full max-h-[55%] pointer-events-none opacity-20" viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden style={{ maskImage: 'linear-gradient(to top, black 30%, transparent)' }}>
      <path
        d={`${path} V 64 H 0 Z`}
        fill={`url(#kpi-area-${accent})`}
        opacity="0.28"
      />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <defs>
        <linearGradient id={`kpi-area-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
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
  sparklineData,
  className,
}: KpiCardProps) {
  return (
    <div className={cn('aura-kpi', `aura-kpi--${size}`, size === 'hero' && 'aura-kpi--command', className)}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="aura-kpi-label">{title}</p>
          <div className={cn('mt-2', size === 'hero' && 'mt-3')}>
            <p
              className={cn(
                'aura-kpi-value',
                size === 'hero' ? 'aura-kpi-value--hero' : 'aura-kpi-value--standard',
                size === 'compact' && 'text-2xl sm:text-3xl',
                valueTone === 'gold' && 'aura-kpi-value--gold',
              )}
            >
              {value}
            </p>
            {trend !== undefined && trendLabel && (
              <div className="mt-2.5">
                <TrendBadge
                  value={trend}
                  label={trendLabel(Math.abs(trend))}
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>
        <div className={cn('aura-kpi-icon', ACCENT_ICON[accent], size === 'hero' && 'h-10 w-10')}>
          <Icon className={cn('h-5 w-5', size === 'hero' && 'h-6 w-6')} strokeWidth={1.5} aria-hidden />
        </div>
      </div>
      
      {subtitle && (
        <p className="relative z-10 mt-3 text-[11px] leading-relaxed text-fumo/80">{subtitle}</p>
      )}

      <KpiSparkline accent={accent} data={sparklineData} />
    </div>
  )
}
