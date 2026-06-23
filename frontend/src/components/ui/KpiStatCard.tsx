import type { ElementType } from 'react'
import { cn } from '../../lib/utils'

interface KpiStatCardProps {
  label: string
  value: string | number
  icon: ElementType
  accent?: 'gold' | 'emerald' | 'blue' | 'amber' | 'rose'
  className?: string
}

const ACCENT = {
  gold: 'text-aura-gold border-aura-gold/25 bg-aura-gold/[0.08]',
  emerald: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.08]',
  blue: 'text-blue-400 border-blue-500/25 bg-blue-500/[0.08]',
  amber: 'text-amber-400 border-amber-500/25 bg-amber-500/[0.08]',
  rose: 'text-rose-400 border-rose-500/25 bg-rose-500/[0.08]',
} as const

export default function KpiStatCard({
  label,
  value,
  icon: Icon,
  accent = 'gold',
  className,
}: KpiStatCardProps) {
  return (
    <div className={cn('aura-stat-card', className)}>
      <div className="min-w-0 flex-1">
        <p className="aura-kpi-label">{label}</p>
        <p className="aura-stat-card__value">{value}</p>
      </div>
      <div className={cn('aura-kpi-icon h-10 w-10', ACCENT[accent])}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
    </div>
  )
}
