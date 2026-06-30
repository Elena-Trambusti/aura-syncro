import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import AuraIcon from './AuraIcon'

interface TrendBadgeProps {
  value: number
  label: string
  className?: string
  size?: 'default' | 'sm' | 'xs'
}

const ICON_SIZE = {
  default: 'xs',
  sm: '2xs',
  xs: '2xs',
} as const

export default function TrendBadge({ value, label, className, size = 'default' }: TrendBadgeProps) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'aura-trend-badge',
        positive ? 'aura-trend-badge--up' : 'aura-trend-badge--down',
        size === 'sm' && 'aura-trend-badge--sm',
        size === 'xs' && 'aura-trend-badge--xs',
        className,
      )}
    >
      {positive ? (
        <AuraIcon icon={TrendingUp} size={ICON_SIZE[size]} className="shrink-0" />
      ) : (
        <AuraIcon icon={TrendingDown} size={ICON_SIZE[size]} className="shrink-0" />
      )}
      {label}
    </span>
  )
}
