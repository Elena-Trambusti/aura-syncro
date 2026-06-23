import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'
import { ui } from '../../lib/ui'
import ModalPortal from '../ModalPortal'

interface InventoryOption {
  id: string
  name: string
  unit: string
}

interface RecipeLinkRow {
  inventoryItemId: string
  quantity: number
}

interface RecipeEditorModalProps {
  itemId: string
  itemName: string
  onClose: () => void
  onSaved: () => void
}

export default function RecipeEditorModal({ itemId, itemName, onClose, onSaved }: RecipeEditorModalProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<RecipeLinkRow[]>([])

  const { data: recipeLinks, isLoading: recipeLoading } = useQuery({
    queryKey: ['menu-recipe', itemId],
    queryFn: () => api.get<Array<{ inventoryItemId: string; quantity: number }>>(`/menu/items/${itemId}/recipe`).then(r => r.data),
  })

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery<InventoryOption[]>({
    queryKey: ['inventory-list'],
    queryFn: () => api.get<{ items: InventoryOption[] }>('/inventory').then(r => r.data.items ?? []),
  })

  useEffect(() => {
    if (recipeLinks) {
      setRows(recipeLinks.map(l => ({
        inventoryItemId: l.inventoryItemId,
        quantity: l.quantity,
      })))
    }
  }, [recipeLinks])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/menu/items/${itemId}/recipe`, {
      links: rows.filter(r => r.inventoryItemId && r.quantity > 0),
    }),
    onSuccess: () => {
      toast.success(t('menu.recipeSaved'))
      onSaved()
      onClose()
    },
    onError: () => toast.error(t('menu.recipeSaveError')),
  })

  const addRow = () => {
    const unused = inventory.find(inv => !rows.some(r => r.inventoryItemId === inv.id))
    setRows(prev => [...prev, {
      inventoryItemId: unused?.id ?? '',
      quantity: 1,
    }])
  }

  const updateRow = (index: number, patch: Partial<RecipeLinkRow>) => {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const isLoading = recipeLoading || inventoryLoading

  return (
    <ModalPortal onClose={onClose}>
      <div className={`${ui.modal} max-w-lg`} onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <Package className="h-5 w-5 text-aura-gold" aria-hidden />
          <h3 className={ui.modalTitle}>{t('menu.recipeTitle')}</h3>
        </div>
        <p className="mb-4 text-sm text-fumo">
          {t('menu.recipeDesc', { dish: itemName })}
        </p>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-fumo">{t('common.loading')}</p>
        ) : inventory.length === 0 ? (
          <div className="rounded-xl border border-aura-gold/25 bg-aura-gold/10 px-4 py-6 text-center text-sm text-amber-900">
            {t('menu.recipeNoInventory')}
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {rows.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/[0.08] bg-navy-surface/50 px-4 py-6 text-center text-sm text-fumo">
                {t('menu.recipeEmpty')}
              </p>
            )}
            {rows.map((row, index) => (
              <div key={index} className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-navy-surface/50 p-3">
                <div className="min-w-0 flex-1">
                  <label className={ui.label}>{t('menu.recipeIngredient')}</label>
                  <select
                    value={row.inventoryItemId}
                    onChange={e => updateRow(index, { inventoryItemId: e.target.value })}
                    className={ui.select}
                  >
                    <option value="">{t('menu.recipeSelectIngredient')}</option>
                    {inventory.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28 shrink-0">
                  <label className={ui.label}>{t('menu.recipeQty')}</label>
                  <input
                    type="number"
                    min={0.001}
                    step={0.01}
                    value={row.quantity}
                    onChange={e => updateRow(index, { quantity: parseFloat(e.target.value) || 0 })}
                    className={ui.input}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="mb-0.5 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {inventory.length > 0 && (
          <button
            type="button"
            onClick={addRow}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.1] py-2.5 text-sm font-medium text-fumo hover:bg-white/[0.05]`}
          >
            <Plus className="h-4 w-4" />
            {t('menu.recipeAdd')}
          </button>
        )}

        <p className="mt-3 text-xs text-fumo">{t('menu.recipeQtyHint')}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className={`flex-1 py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || inventory.length === 0}
            className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm disabled:opacity-60`}
          >
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}
