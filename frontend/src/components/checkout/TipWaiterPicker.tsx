import { useTranslation } from 'react-i18next'
import AuraSelect from './AuraSelect'
import { cn } from '@/lib/utils'
import { useMediaQuery, TABLE_PHONE_QUERY } from '@/hooks/useMediaQuery'

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

export default function TipWaiterPicker({
  staff,
  value,
  onChange,
  className,
}: TipWaiterPickerProps) {
  const { t } = useTranslation()
  const isPhone = useMediaQuery(TABLE_PHONE_QUERY)
  const placeholder = t('checkout.assignWaiter')

  if (!staff.length) {
    return (
      <p className="text-sm text-fumo">{t('checkout.noWaitersForTip')}</p>
    )
  }

  if (isPhone) {
    return (
      <div className={cn('grid grid-cols-2 gap-2', className)} role="listbox" aria-label={placeholder}>
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
    )
  }

  return (
    <AuraSelect
      value={value}
      onValueChange={onChange}
      options={staff.map(user => ({ value: user.id, label: user.name }))}
      placeholder={placeholder}
      className={className}
      triggerClassName="min-h-[44px] py-3"
      aria-label={placeholder}
    />
  )
}
