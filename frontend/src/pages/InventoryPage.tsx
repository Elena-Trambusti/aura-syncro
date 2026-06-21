import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { Plus, AlertTriangle, Package, Edit2, Trash2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { useRole } from '../hooks/useRole'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import toast from 'react-hot-toast'

interface InventoryItem {
  id: string; name: string; unit: string; quantity: number
  minQuantity: number; cost: number; supplier?: string; category?: string
}

function ItemForm({ item, onSave, onCancel }: {
  item?: Partial<InventoryItem>
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name || '', unit: item?.unit || 'kg',
    quantity: item?.quantity || 0, minQuantity: item?.minQuantity || 0,
    cost: item?.cost || 0, supplier: item?.supplier || '', category: item?.category || '',
  })
  return (
    <div className="glass-overlay flex items-center justify-center p-4" onClick={onCancel}>
      <div className="glass-modal p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-5">{item?.id ? 'Modifica' : 'Nuovo'} Prodotto</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome prodotto *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unità</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500">
                {['kg', 'g', 'L', 'ml', 'pz', 'casse', 'bottiglie'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                placeholder="Carni, Latticini..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantità attuale</label>
              <input type="number" step="0.1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scorta minima</label>
              <input type="number" step="0.1" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Costo/unità (€)</label>
              <input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornitore</label>
              <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                className="w-full px-3 py-2 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                placeholder="Nome fornitore" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium">Annulla</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold">Salva</button>
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
  const [filterCategory, setFilterCategory] = useState('Tutti')

  const { data } = useQuery<{ items: InventoryItem[]; alerts: InventoryItem[] }>({
    queryKey: tq(tk, 'inventory'),
    queryFn: () => api.get('/inventory').then(r => r.data),
  })
  const items = data?.items || []
  const alerts = data?.alerts || []

  const categories = ['Tutti', ...Array.from(new Set(items.map(i => i.category || 'Altro').filter(Boolean)))]
  const filtered = filterCategory === 'Tutti' ? items : items.filter(i => (i.category || 'Altro') === filterCategory)

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/inventory', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }); setShowForm(false); toast.success(t('inventory.added')) },
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }); setEditingItem(null); toast.success(t('inventory.updated')) },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }); toast.success(t('inventory.deleted')) },
  })
  const adjustQty = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => api.patch(`/inventory/${id}/quantity`, { delta, operation: 'add' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tq(tk, 'inventory') }),
  })

  const totalValue = items.reduce((s, i) => s + i.quantity * i.cost, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-page-title">{t('inventory.title')}</h1>
          <p className="aura-page-subtitle">{t('inventory.subtitle')}</p>
          <p className="text-slate-500 text-sm mt-1">{items.length} prodotti · Valore: {formatCurrency(totalValue)}</p>
        </div>
        {canManageInventory && (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Nuovo Prodotto
        </button>
        )}
      </div>

      {/* Alert scorte */}
      {alerts.length > 0 && (
        <div className="bg-red-950/40 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700">{alerts.length} prodotti sotto scorta minima</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">
                {a.name}: {a.quantity} {a.unit} (min: {a.minQuantity})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterCategory === cat ? 'bg-amber-600 text-white' : 'glass-chip'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 glass-table-head">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Prodotto</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Categoria</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Quantità</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Scorta min.</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Costo/u</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Valore</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Fornitore</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map(item => {
              const isLow = item.quantity <= item.minQuantity
              return (
                <tr key={item.id} className={`hover:glass-table-head transition-colors ${isLow ? 'bg-red-950/40/50' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{item.category || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {canManageInventory ? (
                        <>
                      <button onClick={() => adjustQty.mutate({ id: item.id, delta: -1 })}
                        className="w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-500 hover:text-red-600 transition-colors text-xs font-bold">−</button>
                      <span className={`text-sm font-semibold min-w-12 text-center ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      <button onClick={() => adjustQty.mutate({ id: item.id, delta: 1 })}
                        className="w-6 h-6 rounded-full bg-slate-100 hover:bg-emerald-100 flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-colors text-xs font-bold">+</button>
                        </>
                      ) : (
                      <span className={`text-sm font-semibold min-w-12 text-center ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{item.minQuantity} {item.unit}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{formatCurrency(item.cost)}</td>
                  <td className="px-4 py-3.5 text-sm font-medium text-slate-700">{formatCurrency(item.quantity * item.cost)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{item.supplier || '—'}</td>
                  <td className="px-4 py-3.5">
                    {canManageInventory && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingItem(item)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-700 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Eliminare?')) remove.mutate(item.id) }} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-600 hover:text-red-500 transition-colors">
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
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <Package className="w-10 h-10 mb-2 opacity-30" />
            <p>Nessun prodotto trovato</p>
          </div>
        )}
      </div>

      {showForm && <ItemForm onSave={d => create.mutate(d)} onCancel={() => setShowForm(false)} />}
      {editingItem && <ItemForm item={editingItem} onSave={d => update.mutate({ id: editingItem.id, data: d })} onCancel={() => setEditingItem(null)} />}
    </div>
  )
}
