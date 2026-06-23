import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'

interface TrendBadgeProps {
  value: number
  label: string
  className?: string
}

export default function TrendBadge({ value, label, className }: TrendBadgeProps) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'aura-trend-badge',
        positive ? 'aura-trend-badge--up' : 'aura-trend-badge--down',
        className,
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
      )}
      {label}
    </span>
  )
}
