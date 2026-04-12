
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-5">{item?.id ? 'Modifica Piatto' : 'Nuovo Piatto'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria *</label>
            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="es. Spaghetti alla Carbonara" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prezzo (€) *</label>
              <input type="number" step="0.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prep (min)</label>
              <input type="number" value={form.preparationTime} onChange={e => setForm(f => ({ ...f, preparationTime: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Calorie</label>
              <input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Allergeni</label>
            <input value={form.allergens} onChange={e => setForm(f => ({ ...f, allergens: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="glutine, latte, uova..." />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
              <span className="text-sm text-slate-700">Disponibile</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
              <span className="text-sm text-slate-700">In evidenza</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Annulla</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">Salva</button>
        </div>
      </div>
    </div>
  )
}

export default function MenuPage() {
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); setShowForm(false); toast.success('Piatto aggiunto!') },
  })
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/menu/items/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); setEditingItem(null); toast.success('Piatto aggiornato!') },
  })
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); toast.success('Piatto eliminato') },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestione Menu</h1>
          <p className="text-slate-500 text-sm mt-1">{allItems.length} piatti in {categories.length} categorie</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />
          Nuovo Piatto
        </button>
      </div>

      {/* Filtri categoria */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedCat(null)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${!selectedCat ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          Tutti ({allItems.length})
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCat === cat.id ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </div>

      {/* Tabella piatti */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Piatto</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Categoria</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Prezzo</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Prep.</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Stato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      {item.name}
                      {item.featured && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">★ Top</span>}
                    </p>
                    {item.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{item.description}</p>}
                    {item.allergens && <p className="text-xs text-red-400 mt-0.5">⚠ {item.allergens}</p>}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{item.category.name}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm font-bold text-orange-600">{formatCurrency(item.price)}</span>
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-500">
                  {item.preparationTime ? `${item.preparationTime} min` : '-'}
                </td>
                <td className="px-4 py-3.5">
                  <button onClick={() => toggleAvail.mutate({ id: item.id, available: !item.available })}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.available ? '● Disponibile' : '○ Non disp.'}
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingItem({ ...item, categoryId: item.category.id }); }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Eliminare questo piatto?')) deleteItem.mutate(item.id) }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <BookOpen className="w-10 h-10 mb-2 opacity-30" />
            <p>Nessun piatto trovato</p>
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
