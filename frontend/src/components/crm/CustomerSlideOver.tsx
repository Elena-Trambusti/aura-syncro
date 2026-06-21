import { useState, useEffect } from 'react'
import { X, Mail, Phone, Calendar, AlertTriangle, Receipt, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, formatDate, cn } from '../../lib/utils'
import { tagBadgeClass, customerDisplayName } from '../../lib/customerTags'
import { ui } from '../../lib/ui'

export interface CustomerOrder {
  id: string
  total: number
  revenueAmount: number
  paidAt?: string | null
  createdAt: string
  paymentMethod?: string | null
}

export interface CustomerDetail {
  id: string
  firstName?: string
  lastName?: string
  name: string
  email?: string | null
  phone?: string | null
  birthDate?: string | null
  tags: string[]
  totalVisits: number
  totalSpent: number
  loyaltyPoints: number
  lastVisit?: string | null
  allergens?: string | null
  notes?: string | null
  orders?: CustomerOrder[]
}

export interface CustomerEditData {
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
  allergens: string
  tags: string
}

interface CustomerSlideOverProps {
  customer: CustomerDetail | null
  onClose: () => void
  isLoading?: boolean
  onSave?: (data: CustomerEditData) => void | Promise<void>
  isSaving?: boolean
}

function toEditForm(customer: CustomerDetail): CustomerEditData {
  return {
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    notes: customer.notes || '',
    allergens: customer.allergens || '',
    tags: customer.tags.join(', '),
  }
}

export default function CustomerSlideOver({ customer, onClose, isLoading, onSave, isSaving }: CustomerSlideOverProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CustomerEditData>({
    firstName: '', lastName: '', email: '', phone: '', notes: '', allergens: '', tags: '',
  })

  useEffect(() => {
    if (customer) {
      setForm(toEditForm(customer))
      setEditing(false)
    }
  }, [customer?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSave?.(form)
      setEditing(false)
    } catch {
      // keep edit mode open on error
    }
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity',
          customer ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-xl',
          'transform transition-transform duration-300 ease-out flex flex-col',
          customer ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!customer}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{t('crm.slideOver.title')}</h2>
          <div className="flex items-center gap-1">
            {customer && onSave && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label={t('common.edit')}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            {t('common.loading')}
          </div>
        )}

        {!isLoading && customer && editing && (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={ui.label}>{t('crm.form.firstName')}</label>
                <input
                  value={form.firstName}
                  onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                  className={ui.input}
                  required
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
              <label className={ui.label}>{t('crm.slideOver.allergens')}</label>
              <input
                value={form.allergens}
                onChange={e => setForm(p => ({ ...p, allergens: e.target.value }))}
                className={ui.input}
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
                onClick={() => { setEditing(false); setForm(toEditForm(customer)) }}
                disabled={isSaving}
                className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium', ui.chipInactive)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}

        {!isLoading && customer && !editing && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div>
              <p className="text-xl font-bold text-slate-900">{customerDisplayName(customer)}</p>
              <div className="mt-2 space-y-1.5 text-sm text-slate-500">
                {customer.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    {customer.email}
                  </p>
                )}
                {customer.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    {customer.phone}
                  </p>
                )}
                {customer.birthDate && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {formatDate(customer.birthDate)}
                  </p>
                )}
              </div>
            </div>

            {customer.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  {t('crm.slideOver.tags')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map(tag => (
                    <span
                      key={tag}
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                        tagBadgeClass(tag),
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('crm.slideOver.totalVisits'), value: String(customer.totalVisits) },
                { label: t('crm.slideOver.totalSpent'), value: formatCurrency(customer.totalSpent) },
                { label: t('crm.slideOver.loyaltyPoints'), value: String(customer.loyaltyPoints) },
                {
                  label: t('crm.slideOver.lastVisit'),
                  value: customer.lastVisit ? formatDate(customer.lastVisit) : t('crm.neverVisited'),
                },
              ].map(row => (
                <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{row.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{row.value}</p>
                </div>
              ))}
            </div>

            {customer.allergens && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t('crm.slideOver.allergens')}
                </p>
                <p className="mt-1 text-sm text-red-700">{customer.allergens}</p>
              </div>
            )}

            {customer.notes && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {t('crm.slideOver.notes')}
                </p>
                <p className="text-sm text-slate-700 italic">&ldquo;{customer.notes}&rdquo;</p>
              </div>
            )}

            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                <Receipt className="h-4 w-4" />
                {t('crm.slideOver.spendingHistory')}
              </p>
              {(customer.orders?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">{t('crm.slideOver.noOrders')}</p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 overflow-hidden">
                  {customer.orders!.map(order => (
                    <li key={order.id} className="flex items-center justify-between bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          #{order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(order.paidAt || order.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(order.revenueAmount || order.total)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
