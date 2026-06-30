import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import AuraIcon from './AuraIcon'

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
        <AuraIcon icon={TrendingUp} size={size === 'sm' ? '2xs' : 'xs'} className="shrink-0" />
      ) : (
        <AuraIcon icon={TrendingDown} size={size === 'sm' ? '2xs' : 'xs'} className="shrink-0" />
      )}
      {label}
    </span>
  )
}
