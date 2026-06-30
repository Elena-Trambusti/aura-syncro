import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface LuxuryChartFrameProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  hero?: boolean
  className?: string
}

/** Contenitore premium per grafici finanziari — allineato al design executive */
export default function LuxuryChartFrame({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  hero = false,
  className,
}: LuxuryChartFrameProps) {
  return (
    <section
      className={cn(
        'aura-module-frame',
        hero && 'aura-module-frame--hero',
        'p-5 sm:p-6',
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="aura-brand-eyebrow">{eyebrow}</p>}
          <h3 className="premium-section-title mt-1">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-fumo/80">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="luxury-chart-canvas">{children}</div>
    </section>
  )
}
