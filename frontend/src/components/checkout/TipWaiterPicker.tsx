import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface TipWaiterOption {
  id: string
  name: string
}

interface TipWaiterPickerProps {
  staff: TipWaiterOption[]
  value: string
  onChange: (waiterId: string) => void
  className?: string
}

/**
 * Selezione cameriere per mancia — sempre card/pill (mai <select> nativo).
 * Il picker di sistema Android/iOS è bianco e fuori tema.
 */
export default function TipWaiterPicker({
  staff,
  value,
  onChange,
  className,
}: TipWaiterPickerProps) {
  const { t } = useTranslation()
  const label = t('checkout.assignWaiter')

  if (!staff.length) {
    return (
      <p className="text-sm text-fumo">{t('checkout.noWaitersForTip')}</p>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-fumo">{label}</p>
      <div
        className="grid max-h-[min(40dvh,280px)] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
        role="listbox"
        aria-label={label}
      >
        {staff.map(user => {
          const selected = value === user.id
          return (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(user.id)}
              className={cn(
                'min-h-[48px] rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors touch-manipulation',
                selected
                  ? 'border-aura-gold/50 bg-aura-gold/15 text-pietra shadow-[0_0_16px_rgba(197,160,89,0.12)]'
                  : 'border-white/[0.08] bg-[#0B0E14] text-slate-300 hover:border-white/15 hover:bg-white/[0.04]',
              )}
            >
              {user.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
