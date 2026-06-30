import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface LuxuryTooltipRow {
  label: string
  value: string
  tone?: 'gold' | 'muted' | 'emerald'
}

interface LuxuryGlassTooltipProps {
  title?: string
  rows: LuxuryTooltipRow[]
  className?: string
  footer?: ReactNode
}

export default function LuxuryGlassTooltip({
  title,
  rows,
  className,
  footer,
}: LuxuryGlassTooltipProps) {
  if (!rows.length) return null

  return (
    <div className={cn('luxury-chart-tooltip', className)}>
      <div className="luxury-chart-tooltip__shine" aria-hidden />
      {title && <p className="luxury-chart-tooltip__title">{title}</p>}
      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <span className="luxury-chart-tooltip__label">{row.label}</span>
            <span
              className={cn(
                'luxury-chart-tooltip__value tabular-nums',
                row.tone === 'gold' && 'text-aura-gold-light',
                row.tone === 'emerald' && 'text-emerald-300',
                (!row.tone || row.tone === 'muted') && 'text-pietra',
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {footer && <div className="luxury-chart-tooltip__footer">{footer}</div>}
    </div>
  )
}

/** Adapter per Recharts Tooltip content */
export function buildLuxuryTooltipContent(
  title: string | undefined,
  rows: LuxuryTooltipRow[],
) {
  return <LuxuryGlassTooltip title={title} rows={rows} />
}
