import type { ElementType } from 'react'
import { cn } from '../../lib/utils'

export type PulseItem = {
  key: string
  label: string
  value: string
  hint?: string
  icon: ElementType
  tone?: 'gold' | 'emerald' | 'blue' | 'amber' | 'rose'
  live?: boolean
}

const TONE = {
  gold: 'text-aura-gold border-aura-gold/20 bg-aura-gold/[0.06]',
  emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06]',
  blue: 'text-blue-400 border-blue-500/20 bg-blue-500/[0.06]',
  amber: 'text-amber-400 border-amber-500/20 bg-amber-500/[0.06]',
  rose: 'text-rose-400 border-rose-500/20 bg-rose-500/[0.06]',
} as const

export default function OperationalPulse({ items }: { items: PulseItem[] }) {
  return (
    <div className="aura-ops-pulse" role="list">
      {items.map(item => {
        const Icon = item.icon
        const tone = item.tone ?? 'gold'
        return (
          <div key={item.key} className="aura-ops-pulse__item" role="listitem">
            <div className={cn('aura-ops-pulse__icon', TONE[tone])}>
              <Icon className="h-4 w-4" aria-hidden />
              {item.live && <span className="aura-live-dot" aria-hidden />}
            </div>
            <div className="min-w-0">
              <p className="aura-ops-pulse__label">{item.label}</p>
              <p className="aura-ops-pulse__value">{item.value}</p>
              {item.hint && <p className="aura-ops-pulse__hint">{item.hint}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
