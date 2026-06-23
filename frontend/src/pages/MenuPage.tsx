import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { ui } from '../lib/ui'
import { useRole } from '../hooks/useRole'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { Plus, Edit2, Trash2, BookOpen, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalPortal from '../components/ModalPortal'
import QueryErrorBanner from '../components/QueryErrorBanner'
import RecipeEditorModal from '../components/menu/RecipeEditorModal'

interface MenuItem {
  id: string; name: string; description?: string; price: number
  available: boolean; soldOut?: boolean; orderable?: boolean; featured: boolean; allergens?: string
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
    <ModalPortal onClose={onCancel}>
      <div className={ui.modal} onClick={e => e.stopPropagation()}>
        <h3 className={ui.modalTitle}>{item?.id ? t('menu.editDish') : t('menu.newDish')}</h3>
        <div className="space-y-4">
          <div>
            <label className={ui.label}>{t('menu.category')} *</label>
            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              className={ui.select}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={ui.label}>{t('common.name')} *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={ui.input}
              placeholder={t('menu.namePlaceholder')} />
          </div>
          <div>
            <label className={ui.label}>{t('common.description')}</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={ui.textarea}
              rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={ui.label}>{t('menu.price')} *</label>
              <input type="number" step="0.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                className={ui.input} />
            </div>
            <div>
              <label className={ui.label}>{t('menu.prepTime')}</label>
              <input type="number" value={form.preparationTime} onChange={e => setForm(f => ({ ...f, preparationTime: parseInt(e.target.value) || 0 }))}
                className={ui.input} />
            </div>
            <div>
              <label className={ui.label}>{t('menu.calories')}</label>
              <input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: parseInt(e.target.value) || 0 }))}
                className={ui.input} />
            </div>
          </div>
          <div>
            <label className={ui.label}>{t('menu.allergens')}</label>
            <input value={form.allergens} onChange={e => setForm(f => ({ ...f, allergens: e.target.value }))}
              className={ui.input}
              placeholder={t('menu.allergensPlaceholder')} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
              <span className="text-sm text-fumo">{t('menu.available')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
              <span className="text-sm text-fumo">{t('menu.featured')}</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className={`flex-1 py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}>{t('common.cancel')}</button>
          <button onClick={() => onSave(form)} className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm`}>{t('common.save')}</button>
        </div>
      </div>
    </ModalPortal>
  )
}

export default function MenuPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const canManageMenu = can('menu.manage')
  const canToggleAvailability = can('menu.availability')
  const [editingItem, setEditingItem] = useState<(Partial<MenuItem> & { categoryId?: string }) | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string } | null>(null)
  const [recipeItem, setRecipeItem] = useState<{ id: string; name: string } | null>(null)

  const { data: categories = [], isError } = useQuery<Category[]>({
    queryKey: tq(tk, 'menu', 'categories'),
    queryFn: () => api.get('/menu/categories').then(r => r.data),
  })

  const createItem = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/menu/items', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') }); setShowForm(false); toast.success(t('menu.added')) },
  })
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/menu/items/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') }); setEditingItem(null); toast.success(t('menu.updated')) },
  })
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/items/${id}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') })
      toast.success(res.data?.archived ? t('menu.archived') : t('menu.deleted'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || t('menu.deleteError'))
    },
  })
  const toggleAvail = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) => api.patch(`/menu/items/${id}/availability`, { available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') }),
  })

  const createCategory = useMutation({
    mutationFn: (name: string) => api.post('/menu/categories', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') })
      setCategoryForm(null)
      toast.success(t('menu.categoryAdded'))
    },
    onError: () => toast.error(t('menu.categorySaveError')),
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/menu/categories/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') })
      setCategoryForm(null)
      toast.success(t('menu.categoryUpdated'))
    },
    onError: () => toast.error(t('menu.categorySaveError')),
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/categories/${id}`),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') })
      if (selectedCat === deletedId) setSelectedCat(null)
      toast.success(t('menu.categoryDeleted'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || t('menu.categorySaveError'))
    },
  })

  const allItems = categories.flatMap(c =>
    c.items.map(i => ({ ...i, category: { id: c.id, name: c.name } }))
  )
  const filteredItems = selectedCat ? allItems.filter(i => i.category.id === selectedCat) : allItems

  return (
    <div className="space-y-5">
      <div className={`${ui.card} p-4 sm:p-5 space-y-4`}>
        <div className={ui.pageHeader}>
          <div className="min-w-0">
            <h1 className={ui.pageTitle}>{t('menu.title')}</h1>
            <p className={ui.pageSubtitle}>{t('menu.subtitle', { count: allItems.length, categories: categories.length })}</p>
          </div>
          {canManageMenu && (
          <button onClick={() => setShowForm(true)}
            className={`flex items-center justify-center gap-2 ${ui.btnPrimary} px-4 py-2.5 text-sm w-full sm:w-auto shrink-0`}>
            <Plus className="w-4 h-4" />
            {t('menu.newDish')}
          </button>
          )}
        </div>
        <div className={ui.filterRow}>
          <button onClick={() => setSelectedCat(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!selectedCat ? ui.tabActive : ui.tabInactive}`}>
            {t('common.all')} ({allItems.length})
          </button>
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-0.5">
              <button onClick={() => setSelectedCat(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCat === cat.id ? ui.tabActive : ui.tabInactive}`}>
                {cat.name} ({cat.items.length})
              </button>
              {canManageMenu && (
                <>
                  <button
                    type="button"
                    onClick={() => setCategoryForm({ id: cat.id, name: cat.name })}
                    className="p-1.5 rounded-lg text-fumo hover:text-fumo hover:bg-white/[0.05]"
                    aria-label={t('menu.editCategory')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('menu.confirmDeleteCategory'))) deleteCategory.mutate(cat.id)
                    }}
                    className="p-1.5 rounded-lg text-fumo hover:text-red-400 hover:bg-red-500/10"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
          {canManageMenu && (
            <button
              type="button"
              onClick={() => setCategoryForm({ name: '' })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium ${ui.chipInactive}`}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('menu.newCategory')}
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <QueryErrorBanner />
      ) : (
      <div className={`${ui.card} overflow-hidden`}>
        <div className={ui.tableWrap}>
        <table className="w-full">
          <thead>
            <tr className={`border-b border-white/[0.08] ${ui.tableHeadBg}`}>
              <th className={`text-left ${ui.tableHead} px-5 py-3.5 w-[38%]`}>{t('menu.dish')}</th>
              <th className={`text-left ${ui.tableHead} px-4 py-3.5`}>{t('menu.category')}</th>
              <th className={`text-left ${ui.tableHead} px-4 py-3.5`}>{t('menu.price')}</th>
              <th className={`text-left ${ui.tableHead} px-4 py-3.5`}>{t('menu.prep')}</th>
              <th className={`text-left ${ui.tableHead} px-4 py-3.5`}>{t('common.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filteredItems.map(item => (
              <tr key={item.id} className={ui.tableRow}>
                <td className="px-5 py-4 align-top">
                  <div>
                    <p className="text-[15px] font-semibold text-pietra flex items-center gap-2 leading-tight">
                      {item.name}
                      {item.featured && <span className="text-[11px] bg-aura-gold/10 text-aura-gold border border-aura-gold/25 px-2 py-0.5 rounded-full">{t('menu.topBadge')}</span>}
                    </p>
                    {item.description && <p className="text-xs text-fumo mt-1 leading-relaxed">{item.description}</p>}
                    {item.allergens && <p className="text-xs text-red-400 mt-1">⚠ {item.allergens}</p>}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className={`text-xs ${ui.chip} px-2.5 py-1 inline-block`}>{item.category.name}</span>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className="text-[15px] font-bold text-amber-500">{formatCurrency(item.price)}</span>
                </td>
                <td className="px-4 py-4 align-top text-sm text-fumo">
                  {item.preparationTime ? `${item.preparationTime} ${t('common.minutes')}` : '-'}
                </td>
                <td className="px-4 py-4 align-top">
                  {item.soldOut ? (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium border border-rose-200 bg-rose-50 text-rose-700">
                      {t('menu.soldOut')}
                    </span>
                  ) : canToggleAvailability ? (
                  <button onClick={() => toggleAvail.mutate({ id: item.id, available: !item.available })}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${item.available ? ui.badgeSuccess : ui.badgeMuted}`}>
                    {item.available ? `● ${t('menu.available')}` : `○ ${t('menu.notAvailable')}`}
                  </button>
                  ) : (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${item.available ? ui.badgeSuccess : ui.badgeMuted}`}>
                      {item.available ? `● ${t('menu.available')}` : `○ ${t('menu.notAvailable')}`}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  {canManageMenu && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRecipeItem({ id: item.id, name: item.name })}
                      className={`p-1.5 ${ui.chipInactive} rounded-lg text-fumo hover:text-aura-gold`}
                      title={t('menu.editRecipe')}
                    >
                      <Package className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingItem({ ...item, categoryId: item.category.id }); }}
                      className={`p-1.5 ${ui.chipInactive} rounded-lg text-fumo hover:text-pietra`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(t('menu.confirmDelete'))) deleteItem.mutate(item.id) }}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center py-12 text-fumo">
            <BookOpen className="w-10 h-10 mb-2 opacity-30" />
            <p>{t('menu.noDishes')}</p>
          </div>
        )}
      </div>
      )}

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

      {recipeItem && (
        <RecipeEditorModal
          itemId={recipeItem.id}
          itemName={recipeItem.name}
          onClose={() => setRecipeItem(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') })}
        />
      )}

      {categoryForm && (
        <ModalPortal onClose={() => !createCategory.isPending && !updateCategory.isPending && setCategoryForm(null)}>
          <div className={ui.modal} onClick={e => e.stopPropagation()}>
            <h3 className={ui.modalTitle}>
              {categoryForm.id ? t('menu.editCategory') : t('menu.newCategory')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={ui.label}>{t('menu.categoryName')}</label>
                <input
                  value={categoryForm.name}
                  onChange={e => setCategoryForm(f => f ? { ...f, name: e.target.value } : f)}
                  className={ui.input}
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setCategoryForm(null)}
                disabled={createCategory.isPending || updateCategory.isPending}
                className={`flex-1 py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={!categoryForm.name.trim() || createCategory.isPending || updateCategory.isPending}
                onClick={() => {
                  const name = categoryForm.name.trim()
                  if (categoryForm.id) {
                    updateCategory.mutate({ id: categoryForm.id, name })
                  } else {
                    createCategory.mutate(name)
                  }
                }}
                className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm disabled:opacity-60`}
              >
                {createCategory.isPending || updateCategory.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
