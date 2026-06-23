import type { ElementType, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon: ElementType
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('aura-empty-state', className)}>
      <div className="aura-empty-state__icon">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <p className="aura-empty-state__title">{title}</p>
      {description && <p className="aura-empty-state__desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
