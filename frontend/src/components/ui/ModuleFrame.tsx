import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ModuleFrameProps {
  children: ReactNode
  title?: string
  eyebrow?: string
  subtitle?: string
  action?: ReactNode
  hero?: boolean
  className?: string
  bodyClassName?: string
}

export default function ModuleFrame({
  children,
  title,
  eyebrow,
  subtitle,
  action,
  hero,
  className,
  bodyClassName,
}: ModuleFrameProps) {
  return (
    <section className={cn('aura-module-frame', hero && 'aura-module-frame--hero', className)}>
      {(title || eyebrow || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5 sm:py-5">
          <div>
            {eyebrow && <p className="aura-brand-eyebrow">{eyebrow}</p>}
            {title && <h2 className="premium-section-title mt-1">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-fumo">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
