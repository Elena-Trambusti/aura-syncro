import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import AuraIcon from './AuraIcon'

interface EmptyStateProps {
  icon: LucideIcon
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
        <AuraIcon icon={Icon} size="xl" className="text-fumo" />
      </div>
      <p className="aura-empty-state__title">{title}</p>
      {description && <p className="aura-empty-state__desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
