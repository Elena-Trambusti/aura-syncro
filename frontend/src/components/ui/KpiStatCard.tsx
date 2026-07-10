import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

type Accent =
  | 'gold'
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'rose'
  | 'sage'
  | 'gold-satin'
  | 'amber-soft'
  | 'sapphire'

interface KpiStatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  accent?: Accent
  /** Contatori tavoli: sfondo icona uniforme scuro, toni desaturati su icona e valore */
  luxuryCounters?: boolean
  className?: string
}

const ACCENT = {
  gold: 'text-aura-gold border-aura-gold/25 bg-aura-gold/[0.08]',
  emerald: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.08]',
  blue: 'text-blue-400 border-blue-500/25 bg-blue-500/[0.08]',
  amber: 'text-amber-400 border-amber-500/25 bg-amber-500/[0.08]',
  rose: 'text-rose-400 border-rose-500/25 bg-rose-500/[0.08]',
  sage: 'text-[#8A9A7B]',
  'gold-satin': 'text-[#C5A059]',
  'amber-soft': 'text-[#C9A96E]',
  sapphire: 'text-[#7A9BB8]',
} as const

export default function KpiStatCard({
  label,
  value,
  icon: _icon,
  accent = 'gold',
  luxuryCounters = false,
  className,
}: KpiStatCardProps) {
  const tone = ACCENT[accent]

  return (
    <div className={cn('aura-stat-card', className)}>
      <div className="min-w-0 flex-1">
        <p className="aura-kpi-label">{label}</p>
        <p className={cn('aura-stat-card__value', luxuryCounters && tone)}>{value}</p>
      </div>
    </div>
  )
}
