import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, formatDate, cn } from '../lib/utils'
import { ui } from '../lib/ui'
import { customerDisplayName, isVipCustomer, tagBadgeClass } from '../lib/customerTags'
import CustomerSlideOver, { type CustomerDetail } from '../components/crm/CustomerSlideOver'
import { Search, Users, TrendingUp, Award, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

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
  notes: string
  tags: string
}

const emptyForm = (): NewCustomerForm => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  notes: '',
  tags: '',
})

export default function CrmPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState<NewCustomerForm>(emptyForm)

  const { data: customers = [] } = useQuery<CustomerListItem[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => r.data),
  })

  const { data: stats } = useQuery<CrmStats>({
    queryKey: ['customers', 'stats'],
    queryFn: () => api.get('/customers/stats').then(r => r.data),
  })

  const { data: selectedCustomer, isLoading: detailLoading } = useQuery<CustomerDetail>({
    queryKey: ['customers', selectedId],
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
        ...(data.notes.trim() ? { notes: data.notes.trim() } : {}),
        ...(data.tags.trim()
          ? { tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean) }
          : {}),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setShowCreateModal(false)
      setForm(emptyForm())
      setSelectedId(res.data.id)
      toast.success(t('crm.created'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || t('crm.saveError'))
    },
  })

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
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
    },
    {
      label: t('crm.stats.avgSpent'),
      value: formatCurrency(stats?.avgSpent ?? 0),
      icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('crm.stats.vip'),
      value: String(stats?.vipCount ?? customers.filter(isVipCustomer).length),
      icon: Award,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>{t('crm.title')}</h1>
          <p className={ui.pageSubtitle}>{t('crm.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => { setForm(emptyForm()); setShowCreateModal(true) }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('crm.newCustomer')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statBlocks.map(s => (
          <div key={s.label} className={`${ui.cardSm} p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
              </div>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', s.iconBg)}>
                <s.icon className={cn('w-5 h-5', s.iconColor)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={cn(ui.input, 'pl-10')}
          placeholder={t('crm.searchPlaceholder')}
        />
      </div>

      <div className={`${ui.cardSm} overflow-hidden`}>
        <div className={ui.tableWrap}>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className={ui.tableHeadBg}>
                <th className={cn('text-left px-5 py-3', ui.tableHead)}>{t('crm.table.customer')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.tags')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.visits')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.spent')}</th>
                <th className={cn('text-left px-4 py-3', ui.tableHead)}>{t('crm.table.lastVisit')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr
                  key={customer.id}
                  onClick={() => setSelectedId(customer.id)}
                  className={cn(
                    ui.tableRow,
                    'cursor-pointer',
                    selectedId === customer.id && 'bg-amber-50/60',
                  )}
                >
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">{customerDisplayName(customer)}</p>
                    <p className="text-xs text-slate-500">{customer.email || customer.phone || '—'}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
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
                  <td className="px-4 py-3.5 text-sm text-slate-700">{customer.totalVisits}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">
                    {customer.lastVisit ? formatDate(customer.lastVisit) : t('crm.neverVisited')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <div className="flex flex-col items-center py-16 text-slate-500">
            <Users className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">{t('crm.noCustomers')}</p>
          </div>
        )}
      </div>

      <CustomerSlideOver
        customer={selectedId ? (selectedCustomer ?? null) : null}
        onClose={() => setSelectedId(null)}
        isLoading={detailLoading && Boolean(selectedId)}
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
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {createCustomer.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
