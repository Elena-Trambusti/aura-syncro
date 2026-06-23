import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'

interface TrendBadgeProps {
  value: number
  label: string
  className?: string
  size?: 'default' | 'sm'
}

export default function TrendBadge({ value, label, className, size = 'default' }: TrendBadgeProps) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'aura-trend-badge',
        positive ? 'aura-trend-badge--up' : 'aura-trend-badge--down',
        size === 'sm' && 'aura-trend-badge--sm',
        className,
      )}
    >
      {positive ? (
        <TrendingUp className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} aria-hidden />
      ) : (
        <TrendingDown className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} aria-hidden />
      )}
      {label}
    </span>
  )
}
