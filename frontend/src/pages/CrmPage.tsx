import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, formatDate, cn } from '../lib/utils'
import { ui } from '../lib/ui'
import { customerDisplayName, isVipCustomer, tagBadgeClass } from '../lib/customerTags'
import CustomerSlideOver, { type CustomerDetail, type CustomerEditData } from '../components/crm/CustomerSlideOver'
import { useRole } from '../hooks/useRole'
import { Search, Users, TrendingUp, Award, Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { formatApiError } from '../lib/formatApiError'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'
import KpiStatCard from '../components/ui/KpiStatCard'

interface CustomerListItem {
  id: string
  firstName?: string
  lastName?: string
  name: string
  email?: string | null
  phone?: string | null
  tags: string[]
  totalVisits: number
  totalSpent: number
  loyaltyPoints: number
  lastVisit?: string | null
}

interface CrmStats {
  total: number
  vipCount: number
  avgSpent: number
}

interface NewCustomerForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  notes: string
  tags: string
}

const emptyForm = (): NewCustomerForm => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  notes: '',
  tags: '',
})

export default function CrmPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const canManageCustomers = can('customers.manage')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openCustomerEdit, setOpenCustomerEdit] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState<NewCustomerForm>(emptyForm)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: customers = [], isError: customersError, isLoading: customersLoading, isFetching: customersFetching } = useQuery<CustomerListItem[]>({
    queryKey: tq(tk, 'customers', debouncedSearch),
    queryFn: () => api.get(`/customers${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`).then(r => r.data),
  })

  const { data: stats, isError: statsError } = useQuery<CrmStats>({
    queryKey: tq(tk, 'customers', 'stats'),
    queryFn: () => api.get('/customers/stats').then(r => r.data),
  })

  const { data: selectedCustomer, isLoading: detailLoading } = useQuery<CustomerDetail>({
    queryKey: tq(tk, 'customers', selectedId),
    queryFn: () => api.get(`/customers/${selectedId}`).then(r => r.data),
    enabled: Boolean(selectedId),
  })

  const createCustomer = useMutation({
    mutationFn: (data: NewCustomerForm) =>
      api.post('/customers', {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        ...(data.email.trim() ? { email: data.email.trim() } : {}),
        ...(data.phone.trim() ? { phone: data.phone.trim() } : {}),
        ...(data.birthDate.trim() ? { birthDate: data.birthDate.trim() } : {}),
        ...(data.notes.trim() ? { notes: data.notes.trim() } : {}),
        ...(data.tags.trim()
          ? { tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean) }
          : {}),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: tq(tk, 'customers') })
      setShowCreateModal(false)
      setForm(emptyForm())
      setSelectedId(res.data.id)
      toast.success(t('crm.created'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'crm.saveError'))
    },
  })

  const updateCustomer = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerEditData }) =>
      api.put(`/customers/${id}`, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim() || null,
        phone: data.phone.trim() || null,
        birthDate: data.birthDate?.trim() || null,
        notes: data.notes.trim() || null,
        allergens: data.allergens.trim() || null,
        tags: data.tags.trim()
          ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : [],
        taxId: data.taxId.trim() || null,
        fiscalCode: data.fiscalCode.trim() || null,
        sdiRecipientCode: data.sdiRecipientCode.trim() || null,
        pec: data.pec.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'customers') })
      toast.success(t('crm.updated'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'crm.saveError'))
    },
  })

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'customers') })
      setSelectedId(null)
      toast.success(t('crm.deleted', { defaultValue: 'Cliente eliminato' }))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'crm.deleteError'))
    },
  })

  const handleDeleteCustomer = async (customer: CustomerListItem) => {
    const name = customerDisplayName(customer)
    const confirmed = await toast.confirm({
      title: t('crm.deleteCustomerTitle', { defaultValue: 'Elimina cliente' }),
      description: t('crm.confirmDelete', { name, defaultValue: `Eliminare ${name}? L'operazione non è reversibile.` }),
      confirmLabel: t('common.delete', { defaultValue: 'Elimina' }),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    })
    if (!confirmed) return
    deleteCustomer.mutate(customer.id)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim()) {
      toast.error(t('crm.firstNameRequired'))
      return
    }
    createCustomer.mutate(form)
  }

  const statBlocks = [
    {
      label: t('crm.stats.total'),
      value: String(stats?.total ?? customers.length),
      icon: Users,
      accent: 'gold' as const,
    },
    {
      label: t('crm.stats.avgSpent'),
      value: formatCurrency(stats?.avgSpent ?? 0),
      icon: TrendingUp,
      accent: 'emerald' as const,
    },
    {
      label: t('crm.stats.vip'),
      value: String(stats?.vipCount ?? customers.filter(isVipCustomer).length),
      icon: Award,
      accent: 'amber' as const,
    },
  ]

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('crm.title')}
        subtitle={t('crm.subtitle')}
        actions={canManageCustomers ? (
          <button
            type="button"
            onClick={() => { setForm(emptyForm()); setShowCreateModal(true) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-aura-gold px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-aura-gold-light sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('crm.newCustomer')}
          </button>
        ) : undefined}
      />

      {(customersError || statsError) && <QueryErrorBanner />}

      <div className="pwa-kpi-compact grid grid-cols-3 gap-2 sm:gap-4">
        {statBlocks.map(s => (
          <KpiStatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            accent={s.accent}
          />
        ))}
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fumo" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={cn(ui.input, 'pl-10')}
          placeholder={t('crm.searchPlaceholder')}
        />
        {(customersLoading || customersFetching) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fumo animate-spin" />
        )}
      </div>

      <div className={`${ui.cardSm} overflow-hidden`}>
        {customersLoading && customers.length === 0 ? (
          <PageSkeleton variant="table" count={8} />
        ) : customers.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState
              icon={Users}
              title={debouncedSearch ? t('crm.noResults', { defaultValue: 'Nessun cliente trovato' }) : t('crm.empty', { defaultValue: 'Nessun cliente ancora' })}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 p-3 lg:hidden">
              {customers.map(customer => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => { setOpenCustomerEdit(false); setSelectedId(customer.id) }}
                  className={cn(
                    'pwa-crm-card',
                    selectedId === customer.id && 'border-aura-gold/35 bg-aura-gold/[0.06]',
                  )}
                >
                  <div className="pwa-crm-card__row">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-semibold text-pietra">{customerDisplayName(customer)}</p>
                      <p className="truncate text-xs text-fumo">{customer.email || customer.phone || '—'}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-pietra">
                      {formatCurrency(customer.totalSpent)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            tagBadgeClass(tag),
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                      {customer.tags.length === 0 && isVipCustomer(customer) && (
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', tagBadgeClass('VIP'))}>
                          VIP
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-fumo">
                      {t('crm.table.visits')}: {customer.totalVisits}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className={cn(ui.tableWrap, 'hidden lg:block')}>
          <table className="w-full max-w-full">
            <thead>
              <tr className={ui.tableHeadBg}>
                <th className={cn('text-left px-5 py-3', ui.tableHead)}>{t('crm.table.customer')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.tags')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.visits')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.spent')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.lastVisit')}</th>
                <th className={cn('text-right px-4 py-3', ui.tableHead)}>
                  {canManageCustomers ? t('crm.table.actions', { defaultValue: 'Azioni' }) : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr
                  key={customer.id}
                  onClick={() => { setOpenCustomerEdit(false); setSelectedId(customer.id) }}
                  className={cn(
                    ui.tableRow,
                    'cursor-pointer',
                    selectedId === customer.id && 'bg-aura-gold/10/60',
                  )}
                >
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-pietra">{customerDisplayName(customer)}</p>
                    <p className="text-xs text-fumo">{customer.email || customer.phone || '—'}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex w-full max-w-full flex-wrap gap-1">
                      {customer.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            tagBadgeClass(tag),
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                      {customer.tags.length === 0 && isVipCustomer(customer) && (
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', tagBadgeClass('VIP'))}>
                          VIP
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-fumo">{customer.totalVisits}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-pietra">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-fumo">
                    {customer.lastVisit ? formatDate(customer.lastVisit) : t('crm.neverVisited')}
                  </td>
                  <td className="px-4 py-3.5">
                    {canManageCustomers && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setOpenCustomerEdit(true); setSelectedId(customer.id) }}
                        className="rounded-lg p-2 text-fumo hover:bg-white/[0.06] hover:text-pietra"
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDeleteCustomer(customer) }}
                        className="rounded-lg p-2 text-fumo hover:bg-rose-500/10 hover:text-rose-400"
                        aria-label={t('common.delete')}
                        disabled={deleteCustomer.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </>
        )}
      </div>

      <CustomerSlideOver
        customer={selectedId ? (selectedCustomer ?? null) : null}
        onClose={() => { setOpenCustomerEdit(false); setSelectedId(null) }}
        isLoading={detailLoading && Boolean(selectedId)}
        isSaving={updateCustomer.isPending}
        startInEditMode={openCustomerEdit}
        onSave={canManageCustomers && selectedId ? async data => {
          await updateCustomer.mutateAsync({ id: selectedId, data })
        } : undefined}
        onDelete={canManageCustomers && selectedId ? async () => {
          const c = customers.find(x => x.id === selectedId)
          if (!c) return
          const confirmed = await toast.confirm({
            title: t('crm.deleteCustomerTitle', { defaultValue: 'Elimina cliente' }),
            description: t('crm.confirmDelete', {
              name: customerDisplayName(c),
              defaultValue: `Eliminare ${customerDisplayName(c)}? L'operazione non è reversibile.`,
            }),
            confirmLabel: t('common.delete', { defaultValue: 'Elimina' }),
            cancelLabel: t('common.cancel'),
            variant: 'danger',
          })
          if (!confirmed) return
          await deleteCustomer.mutateAsync(selectedId)
        } : undefined}
        isDeleting={deleteCustomer.isPending}
      />

      {showCreateModal && (
        <div className={ui.modalOverlay} onClick={() => !createCustomer.isPending && setShowCreateModal(false)}>
          <div className={cn(ui.modal, 'max-w-md')} onClick={e => e.stopPropagation()}>
            <h3 className={ui.modalTitle}>{t('crm.newCustomer')}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={ui.label}>{t('crm.form.firstName')}</label>
                  <input
                    value={form.firstName}
                    onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                    className={ui.input}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className={ui.label}>{t('crm.form.lastName')}</label>
                  <input
                    value={form.lastName}
                    onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                    className={ui.input}
                  />
                </div>
              </div>
              <div>
                <label className={ui.label}>{t('common.email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className={ui.input}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={ui.label}>{t('common.phone')}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className={ui.label}>{t('crm.form.birthDate', { defaultValue: 'Data di Nascita' })}</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))}
                    className={ui.input}
                  />
                </div>
              </div>
              <div>
                <label className={ui.label}>{t('crm.form.tags')}</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  className={ui.input}
                  placeholder={t('crm.form.tagsPlaceholder')}
                />
              </div>
              <div>
                <label className={ui.label}>{t('crm.form.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className={ui.textarea}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createCustomer.isPending}
                  className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium', ui.chipInactive)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createCustomer.isPending}
                  className="flex-1 bg-aura-gold hover:bg-aura-gold text-navy font-semibold py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {createCustomer.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ExecutivePageShell>
  )
}
