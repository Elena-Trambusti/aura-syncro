import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { ui } from '../lib/ui'
import { useRole } from '../hooks/useRole'
import { useDemoMode } from '../hooks/useDemoMode'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { Plus, Edit2, Trash2, BookOpen, Package } from 'lucide-react'
import { toast } from '@/lib/toast'
import GlassModal from '../components/ui/GlassModal'
import AuraSelect from '../components/ui/AuraSelect'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import RecipeEditorModal from '../components/menu/RecipeEditorModal'
import { numericFieldFrom, numericInputProps, numericToNumber } from '../lib/numericInput'

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
    price: numericFieldFrom(item?.price, ''),
    allergens: item?.allergens || '',
    preparationTime: numericFieldFrom(item?.preparationTime, ''),
    calories: numericFieldFrom(item?.calories, ''),
    available: item?.available ?? true,
    featured: item?.featured ?? false,
  })

  const handleSave = () => {
    if (form.price === '') {
      return
    }
    onSave({
      ...form,
      price: numericToNumber(form.price),
      preparationTime: numericToNumber(form.preparationTime),
      calories: numericToNumber(form.calories),
    })
  }

  return (
    <GlassModal onClose={onCancel} maxWidth="lg">
      <h3 className={ui.modalTitle}>{item?.id ? t('menu.editDish') : t('menu.newDish')}</h3>
        <div className="space-y-4">
          <div>
            <label className={ui.label}>{t('menu.category')} *</label>
            <AuraSelect
              value={form.categoryId}
              onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
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
              <input
                {...numericInputProps(form.price, v => setForm(f => ({ ...f, price: v })), 'float')}
                step="0.5"
                className={ui.input}
                required
              />
            </div>
            <div>
              <label className={ui.label}>{t('menu.prepTime')}</label>
              <input
                {...numericInputProps(form.preparationTime, v => setForm(f => ({ ...f, preparationTime: v })), 'int')}
                className={ui.input}
              />
            </div>
            <div>
              <label className={ui.label}>{t('menu.calories')}</label>
              <input
                {...numericInputProps(form.calories, v => setForm(f => ({ ...f, calories: v })), 'int')}
                className={ui.input}
              />
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
          <button onClick={handleSave} className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm`}>{t('common.save')}</button>
        </div>
    </GlassModal>
  )
}

export default function MenuPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const { canWrite: demoCanWrite } = useDemoMode()
  const canManageMenu = can('menu.manage') && demoCanWrite
  const canToggleAvailability = can('menu.availability') && demoCanWrite
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
    onError: () => toast.error(t('menu.saveError', { defaultValue: 'Impossibile salvare il piatto' })),
  })
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/menu/items/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: tq(tk, 'menu') }); setEditingItem(null); toast.success(t('menu.updated')) },
    onError: () => toast.error(t('menu.saveError', { defaultValue: 'Impossibile salvare il piatto' })),
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
    onError: () => toast.error(t('menu.saveError', { defaultValue: 'Impossibile aggiornare la disponibilità' })),
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
    <ExecutivePageShell className="space-y-5">
      <div className={`${ui.card} p-4 sm:p-5 space-y-4`}>
        <ExecutivePageHeader
          title={t('menu.title')}
          subtitle={t('menu.subtitle', { count: allItems.length, categories: categories.length })}
          actions={canManageMenu ? (
            <button onClick={() => setShowForm(true)}
              className={`flex items-center justify-center gap-2 ${ui.btnPrimary} px-4 py-2.5 text-sm w-full sm:w-auto shrink-0`}>
              <Plus className="w-4 h-4" />
              {t('menu.newDish')}
            </button>
          ) : undefined}
        />
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
                    className="p-1.5 rounded-lg text-fumo hover:text-aura-gold hover:bg-aura-gold/10 transition-colors"
                    aria-label={t('menu.editCategory')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('menu.confirmDeleteCategory'))) deleteCategory.mutate(cat.id)
                    }}
                    className="p-1.5 rounded-lg text-fumo hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
          <EmptyState icon={BookOpen} title={t('menu.noDishes')} />
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
        <GlassModal onClose={() => !createCategory.isPending && !updateCategory.isPending && setCategoryForm(null)} maxWidth="md">
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
        </GlassModal>
      )}
    </ExecutivePageShell>
  )
}
