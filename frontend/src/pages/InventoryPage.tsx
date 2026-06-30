import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { Plus, AlertTriangle, Package, Edit2, Trash2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { ui } from '../lib/ui'
import { useRole } from '../hooks/useRole'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { toast } from '@/lib/toast'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import FilterPills from '../components/ui/FilterPills'
import ModuleFrame from '../components/ui/ModuleFrame'
import { numericFieldFrom, numericInputProps, numericToNumber } from '../lib/numericInput'

interface InventoryItem {
  id: string; name: string; unit: string; quantity: number
  minQuantity: number; cost: number; supplier?: string; category?: string
}

function ItemForm({ item, onSave, onCancel }: {
  item?: Partial<InventoryItem>
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: item?.name || '', unit: item?.unit || 'kg',
    quantity: numericFieldFrom(item?.quantity, ''),
    minQuantity: numericFieldFrom(item?.minQuantity, ''),
    cost: numericFieldFrom(item?.cost, ''),
    supplier: item?.supplier || '', category: item?.category || '',
  })

  const handleSave = () => {
    onSave({
      ...form,
      quantity: numericToNumber(form.quantity),
      minQuantity: numericToNumber(form.minQuantity),
      cost: numericToNumber(form.cost),
    })
  }
  return (
    <div className="glass-overlay flex items-center justify-center p-4" onClick={onCancel}>
      <div className="glass-modal p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-pietra mb-5">{item?.id ? t('inventory.editProduct') : t('inventory.newProduct')}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.productName')} *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.unit')}</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50">
                {['kg', 'g', 'L', 'ml', 'pz', 'casse', 'bottiglie'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.category')}</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50"
                placeholder={t('inventory.categoryPlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.currentQty')}</label>
              <input {...numericInputProps(form.quantity, v => setForm(f => ({ ...f, quantity: v })), 'float')} step="0.1"
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.minStock')}</label>
              <input {...numericInputProps(form.minQuantity, v => setForm(f => ({ ...f, minQuantity: v })), 'float')} step="0.1"
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.costPerUnit')}</label>
              <input {...numericInputProps(form.cost, v => setForm(f => ({ ...f, cost: v })), 'float')} step="0.01"
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1">{t('inventory.supplier')}</label>
              <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50"
                placeholder={t('inventory.supplierPlaceholder')} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-white/[0.1] rounded-xl text-sm font-medium">{t('common.cancel')}</button>
          <button onClick={handleSave} className="flex-1 py-2.5 bg-aura-gold hover:bg-aura-gold text-navy font-semibold rounded-xl text-sm font-semibold">{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const canManageInventory = can('inventory.manage')
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const allCategoriesKey = t('inventory.allCategories')
  const otherCategoryKey = t('inventory.otherCategory')
  const [filterCategory, setFilterCategory] = useState(allCategoriesKey)

  const { data, isError } = useQuery<{ items: InventoryItem[]; alerts: InventoryItem[] }>({
    queryKey: tq(tk, 'inventory'),
    queryFn: () => api.get('/inventory').then(r => r.data),
  })
  const items = data?.items || []
  const alerts = data?.alerts || []

  const categories = [allCategoriesKey, ...Array.from(new Set(items.map(i => i.category || otherCategoryKey).filter(Boolean)))]
  const filtered = filterCategory === allCategoriesKey ? items : items.filter(i => (i.category || otherCategoryKey) === filterCategory)

  const inventoryError = () => toast.error(t('inventory.saveError', { defaultValue: 'Operazione magazzino non riuscita' }))

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/inventory', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }); setShowForm(false); toast.success(t('inventory.added')) },
    onError: inventoryError,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }); setEditingItem(null); toast.success(t('inventory.updated')) },
    onError: inventoryError,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }); toast.success(t('inventory.deleted')) },
    onError: inventoryError,
  })
  const adjustQty = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => api.patch(`/inventory/${id}/quantity`, { delta, operation: 'add' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }),
    onError: inventoryError,
  })

  const totalValue = items.reduce((s, i) => s + i.quantity * i.cost, 0)

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('inventory.title')}
        subtitle={(
          <>
            <p>{t('inventory.subtitle')}</p>
            <p className="text-fumo text-sm mt-1">{t('inventory.summary', { count: items.length, value: formatCurrency(totalValue) })}</p>
          </>
        )}
        actions={canManageInventory ? (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-aura-gold hover:bg-aura-gold text-navy font-semibold px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" />
            {t('inventory.newProduct')}
          </button>
        ) : undefined}
      />

      {isError && <QueryErrorBanner />}

      <div className="rounded-xl border border-aura-gold/20 bg-aura-gold/5 p-4 flex gap-3">
        <Package className="w-5 h-5 text-aura-gold shrink-0 mt-0.5" />
        <div className="text-sm text-fumo space-y-1">
          <p className="font-semibold text-pietra">{t('inventory.integrationTitle', { defaultValue: 'Collegato al menu e agli ordini' })}</p>
          <p>{t('inventory.integrationHint', { defaultValue: 'Le ricette dei piatti scalano automaticamente le quantità quando un ordine viene confermato. Configura le ricette dal menu per attivare la sincronizzazione.' })}</p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-400">{t('inventory.lowStockAlert', { count: alerts.length })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="text-xs bg-red-100 text-red-400 px-2 py-1 rounded-lg">
                {t('inventory.lowStockItem', { name: a.name, qty: a.quantity, unit: a.unit, min: a.minQuantity })}
              </span>
            ))}
          </div>
        </div>
      )}

      <FilterPills
        filters={categories.map(cat => ({ key: cat, label: cat }))}
        active={filterCategory}
        onChange={setFilterCategory}
      />

      <ModuleFrame bodyClassName="p-0">
        <div className={ui.tableWrap}>
        <table className="w-full max-w-full">
          <thead>
            <tr className="border-b border-white/[0.08] glass-table-head">
              <th className="text-left text-xs font-semibold text-fumo uppercase px-5 py-3">{t('inventory.colProduct')}</th>
              <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('inventory.colCategory')}</th>
              <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('inventory.colQty')}</th>
              <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('inventory.colMin')}</th>
              <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('inventory.colCost')}</th>
              <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('inventory.colValue')}</th>
              <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('inventory.colSupplier')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filtered.map(item => {
              const isLow = item.quantity <= item.minQuantity
              return (
                <tr key={item.id} className={`hover:glass-table-head transition-colors ${isLow ? 'bg-red-950/40/50' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                      <p className="text-sm font-semibold text-pietra">{item.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs bg-navy-surface text-fumo px-2 py-1 rounded-lg">{item.category || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {canManageInventory ? (
                        <>
                      <button onClick={() => adjustQty.mutate({ id: item.id, delta: -1 })}
                        className="w-6 h-6 rounded-full bg-navy-surface hover:bg-red-100 flex items-center justify-center text-fumo hover:text-red-400 transition-colors text-xs font-bold">−</button>
                      <span className={`text-sm font-semibold min-w-12 text-center ${isLow ? 'text-red-400' : 'text-pietra'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      <button onClick={() => adjustQty.mutate({ id: item.id, delta: 1 })}
                        className="w-6 h-6 rounded-full bg-navy-surface hover:bg-emerald-100 flex items-center justify-center text-fumo hover:text-emerald-400 transition-colors text-xs font-bold">+</button>
                        </>
                      ) : (
                      <span className={`text-sm font-semibold min-w-12 text-center ${isLow ? 'text-red-400' : 'text-pietra'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-fumo">{item.minQuantity} {item.unit}</td>
                  <td className="px-4 py-3.5 text-sm text-fumo">{formatCurrency(item.cost)}</td>
                  <td className="px-4 py-3.5 text-sm font-medium text-fumo">{formatCurrency(item.quantity * item.cost)}</td>
                  <td className="px-4 py-3.5 text-xs text-fumo">{item.supplier || '—'}</td>
                  <td className="px-4 py-3.5">
                    {canManageInventory && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingItem(item)} className="p-1.5 hover:bg-white/[0.05] rounded-lg text-fumo hover:text-fumo transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(t('inventory.confirmDelete'))) remove.mutate(item.id) }} className="p-1.5 hover:bg-red-500/10 rounded-lg text-fumo hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState icon={Package} title={t('inventory.noProductsFound')} />
        )}
      </ModuleFrame>

      {showForm && <ItemForm onSave={d => create.mutate(d)} onCancel={() => setShowForm(false)} />}
      {editingItem && <ItemForm item={editingItem} onSave={d => update.mutate({ id: editingItem.id, data: d })} onCancel={() => setEditingItem(null)} />}
    </ExecutivePageShell>
  )
}
