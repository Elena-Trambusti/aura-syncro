import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { X } from 'lucide-react'
import { formatCurrency, cn } from '../../lib/utils'
import { addMoney } from '../../lib/money'
import type { GuestModifierGroup } from '../../hooks/useGuestCart'

export interface GuestMenuItemForCustomize {
  id: string
  name: string
  price: number
  modifierGroups?: GuestModifierGroup[]
}

interface Props {
  item: GuestMenuItemForCustomize
  onClose: () => void
  onConfirm: (selection: {
    modifierIds: string[]
    modifierLabels: string[]
    unitPrice: number
  }) => void
}

export default function GuestItemCustomizer({ item, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({})

  const unitPrice = useMemo(() => {
    const ids = Object.values(selectedModifiers).flat()
    const options = item.modifierGroups?.flatMap(g => g.options) ?? []
    const extra = ids.reduce((sum, id) => addMoney(sum, options.find(o => o.id === id)?.price ?? 0), 0)
    return addMoney(item.price, extra)
  }, [item, selectedModifiers])

  function handleConfirm() {
    for (const group of item.modifierGroups ?? []) {
      const selectedCount = (selectedModifiers[group.id] ?? []).length
      const min = group.isRequired ? Math.max(1, group.minOptions) : group.minOptions
      if (selectedCount < min) {
        toast.error(t('orderModal.minModifiers', { min, group: group.name }))
        return
      }
    }
    const modifierIds = Object.values(selectedModifiers).flat()
    const modifierLabels = item.modifierGroups
      ?.flatMap(g => g.options.filter(o => modifierIds.includes(o.id)).map(o => o.name))
      ?? []
    onConfirm({ modifierIds, modifierLabels, unitPrice })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/[0.08] bg-navy-elevated shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h3 className="text-lg font-bold text-pietra">{item.name}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-fumo hover:bg-white/5" aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {(item.modifierGroups ?? []).map(group => {
            const selected = selectedModifiers[group.id] ?? []
            return (
              <div key={group.id} className="space-y-2">
                <h4 className="font-semibold text-pietra">{group.name}</h4>
                <div className="grid gap-2">
                  {group.options.map(opt => {
                    const isSelected = selected.includes(opt.id)
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-colors',
                          isSelected ? 'border-aura-gold bg-aura-gold/10' : 'border-white/[0.08] hover:border-aura-gold/30',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type={group.multiSelect ? 'checkbox' : 'radio'}
                            name={`guest-group-${group.id}`}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedModifiers(prev => {
                                const next = { ...prev }
                                if (group.multiSelect) {
                                  const max = group.maxOptions || 99
                                  if (isSelected) {
                                    next[group.id] = selected.filter(id => id !== opt.id)
                                  } else if (selected.length < max) {
                                    next[group.id] = [...selected, opt.id]
                                  }
                                } else {
                                  next[group.id] = [opt.id]
                                }
                                return next
                              })
                            }}
                            className="h-4 w-4 accent-aura-gold"
                          />
                          <span className={cn('text-sm font-medium', isSelected ? 'text-aura-gold' : 'text-pietra')}>{opt.name}</span>
                        </div>
                        {opt.price > 0 && (
                          <span className="text-sm font-bold text-aura-gold">+{formatCurrency(opt.price)}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t border-white/[0.08] p-4">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-xl bg-aura-gold py-3.5 text-sm font-bold text-navy hover:bg-aura-gold-light"
          >
            {t('publicMenu.addToCart')} · {formatCurrency(unitPrice)}
          </button>
        </div>
      </div>
    </div>
  )
}
