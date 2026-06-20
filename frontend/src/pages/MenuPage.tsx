import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

interface MenuItem {
  id: string; name: string; description?: string; price: number
  available: boolean; featured: boolean; allergens?: string
  preparationTime?: number; calories?: number
  category: { id: string; name: string }
}

interface Category { id: string; name: string; items: MenuItem[] }

function ItemForm({ item, categories, onSave, onCancel }: {
  item?: Partial<MenuItem> & { categoryId?: string }
  categories: Category[]
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    categoryId: item?.categoryId || item?.category?.id || categories[0]?.id || '',
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price || 0,
    allergens: item?.allergens || '',
    preparationTime: item?.preparationTime || 0,
    calories: item?.calories || 0,
    available: item?.available ?? true,
    featured: item?.featured ?? false,
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-stone-900/80 border border-stone-700/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-stone-100 mb-5">{item?.id ? t('menu.editDish') : t('menu.newDish')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-200 mb-1">{t('menu.category')} *</label>
            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-200 mb-1">{t('common.name')} *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35"
              placeholder={t('menu.namePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-200 mb-1">{t('common.description')}</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35 resize-none"
              rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">{t('menu.price')} *</label>
              <input type="number" step="0.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">{t('menu.prepTime')}</label>
              <input type="number" value={form.preparationTime} onChange={e => setForm(f => ({ ...f, preparationTime: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">{t('menu.calories')}</label>
              <input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-200 mb-1">{t('menu.allergens')}</label>
            <input value={form.allergens} onChange={e => setForm(f => ({ ...f, allergens: e.target.value }))}
              className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35"
              placeholder={t('menu.allergensPlaceholder')} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
              <span className="text-sm text-stone-200">{t('menu.available')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
              <span className="text-sm text-stone-200">{t('menu.featured')}</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-stone-700/50 rounded-xl text-sm font-medium text-stone-300 hover:bg-stone-900/30">{t('common.cancel')}</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold">{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editingItem, setEditingItem] = useState<(Partial<MenuItem> & { categoryId?: string }) | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['menu', 'categories'],
    queryFn: () => api.get('/menu/categories').then(r => r.data),
  })

  const createItem = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/menu/items', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); setShowForm(false); toast.success(t('menu.added')) },
  })
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/menu/items/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); setEditingItem(null); toast.success(t('menu.updated')) },
  })
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); toast.success(t('menu.deleted')) },
  })
  const toggleAvail = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) => api.patch(`/menu/items/${id}/availability`, { available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  })

  const allItems = categories.flatMap(c =>
    c.items.map(i => ({ ...i, category: { id: c.id, name: c.name } }))
  )
  const filteredItems = selectedCat ? allItems.filter(i => i.category.id === selectedCat) : allItems

  return (
    <div className="space-y-6">
      <div className="aura-page-header">
        <div className="min-w-0">
          <h1 className="aura-page-title">{t('menu.title')}</h1>
          <p className="aura-page-subtitle">{t('menu.subtitle', { count: allItems.length, categories: categories.length })}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors w-full sm:w-auto shrink-0">
          <Plus className="w-4 h-4" />
          {t('menu.newDish')}
        </button>
      </div>

      <div className="aura-filter-row">
        <button onClick={() => setSelectedCat(null)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${!selectedCat ? 'bg-amber-600 text-stone-950 font-semibold' : 'bg-stone-800/50 text-stone-300 border border-stone-700/40 hover:bg-stone-800 hover:text-stone-100'}`}>
          {t('common.all')} ({allItems.length})
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCat === cat.id ? 'bg-amber-600 text-stone-950 font-semibold' : 'bg-stone-800/50 text-stone-300 border border-stone-700/40 hover:bg-stone-800 hover:text-stone-100'}`}>
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </div>

      <div className="aura-card overflow-hidden">
        <div className="aura-table-wrap">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-800/60 bg-stone-900/40">
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide px-5 py-3">{t('menu.dish')}</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide px-4 py-3">{t('menu.category')}</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide px-4 py-3">{t('menu.price')}</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide px-4 py-3">{t('menu.prep')}</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide px-4 py-3">{t('common.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/40">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-stone-900/30 transition-colors">
                <td className="px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                      {item.name}
                      {item.featured && <span className="text-xs bg-amber-950/50 text-amber-400 px-1.5 py-0.5 rounded-full">{t('menu.topBadge')}</span>}
                    </p>
                    {item.description && <p className="text-xs text-stone-500 mt-0.5 truncate max-w-xs">{item.description}</p>}
                    {item.allergens && <p className="text-xs text-red-400 mt-0.5">⚠ {item.allergens}</p>}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs bg-stone-800/50 text-stone-300 px-2 py-1 rounded-lg">{item.category.name}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm font-bold text-amber-400">{formatCurrency(item.price)}</span>
                </td>
                <td className="px-4 py-3.5 text-sm text-stone-400">
                  {item.preparationTime ? `${item.preparationTime} ${t('common.minutes')}` : '-'}
                </td>
                <td className="px-4 py-3.5">
                  <button onClick={() => toggleAvail.mutate({ id: item.id, available: !item.available })}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.available ? 'bg-emerald-950/50 text-emerald-400' : 'bg-stone-800/50 text-stone-400'}`}>
                    {item.available ? `● ${t('menu.available')}` : `○ ${t('menu.notAvailable')}`}
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingItem({ ...item, categoryId: item.category.id }); }}
                      className="p-1.5 hover:bg-stone-800/50 rounded-lg text-stone-500 hover:text-stone-200 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(t('menu.confirmDelete'))) deleteItem.mutate(item.id) }}
                      className="p-1.5 hover:bg-red-950/30 rounded-lg text-stone-500 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center py-12 text-stone-500">
            <BookOpen className="w-10 h-10 mb-2 opacity-30" />
            <p>{t('menu.noDishes')}</p>
          </div>
        )}
      </div>

      {showForm && (
        <ItemForm
          categories={categories}
          onSave={data => createItem.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editingItem && (
        <ItemForm
          item={editingItem}
          categories={categories}
          onSave={data => updateItem.mutate({ id: editingItem.id!, data })}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}
