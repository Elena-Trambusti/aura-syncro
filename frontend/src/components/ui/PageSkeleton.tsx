import { cn } from '../../lib/utils'

interface PageSkeletonProps {
  variant?: 'cards' | 'table' | 'list' | 'kpi'
  count?: number
  className?: string
}

export default function PageSkeleton({
  variant = 'cards',
  count = 6,
  className,
}: PageSkeletonProps) {
  if (variant === 'kpi') {
    return (
      <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="aura-skeleton aura-skeleton--kpi" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('aura-module-frame overflow-hidden', className)}>
        <div className="aura-skeleton aura-skeleton--row h-10 rounded-none border-b border-white/[0.06]" />
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="aura-skeleton aura-skeleton--row h-12 rounded-none border-b border-white/[0.04]"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="aura-skeleton aura-skeleton--row h-14" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aura-skeleton aura-skeleton--card h-36" style={{ animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  )
}
