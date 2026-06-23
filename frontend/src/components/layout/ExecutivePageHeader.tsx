import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { BRAND } from '../../lib/brand'

interface ExecutivePageHeaderProps {
  title: string
  subtitle?: ReactNode
  eyebrow?: string
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}

export default function ExecutivePageHeader({
  title,
  subtitle,
  eyebrow = BRAND.name,
  actions,
  meta,
  className,
}: ExecutivePageHeaderProps) {
  return (
    <div className={cn('aura-executive-header', className)}>
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow && <p className="aura-brand-eyebrow">{eyebrow}</p>}
        <h1 className="aura-page-title">{title}</h1>
        {subtitle && <div className="aura-page-subtitle">{subtitle}</div>}
        {meta}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      )}
    </div>
  )
}
