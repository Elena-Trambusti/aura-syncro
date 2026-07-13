import { useState, useEffect } from 'react'
import { X, Mail, Phone, Calendar, AlertTriangle, Receipt, Pencil, Trash2 } from 'lucide-react'
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
  taxId?: string | null
  fiscalCode?: string | null
  sdiRecipientCode?: string | null
  pec?: string | null
  orders?: CustomerOrder[]
}

export interface CustomerEditData {
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  notes: string
  allergens: string
  tags: string
  taxId: string
  fiscalCode: string
  sdiRecipientCode: string
  pec: string
}

interface CustomerSlideOverProps {
  customer: CustomerDetail | null
  timelineEvents?: Array<{ id: string; kind: string; at: string; title: string; detail?: string; amount?: number; status?: string }>
  onClose: () => void
  isLoading?: boolean
  onSave?: (data: CustomerEditData) => void | Promise<void>
  onDelete?: () => void | Promise<void>
  isSaving?: boolean
  isDeleting?: boolean
  startInEditMode?: boolean
}

function toEditForm(customer: CustomerDetail): CustomerEditData {
  return {
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    birthDate: customer.birthDate ? customer.birthDate.split('T')[0] : '',
    notes: customer.notes || '',
    allergens: customer.allergens || '',
    tags: customer.tags.join(', '),
    taxId: customer.taxId || '',
    fiscalCode: customer.fiscalCode || '',
    sdiRecipientCode: customer.sdiRecipientCode || '',
    pec: customer.pec || '',
  }
}

export default function CustomerSlideOver({ customer, timelineEvents, onClose, isLoading, onSave, onDelete, isSaving, isDeleting, startInEditMode }: CustomerSlideOverProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CustomerEditData>({
    firstName: '', lastName: '', email: '', phone: '', birthDate: '', notes: '', allergens: '', tags: '',
    taxId: '', fiscalCode: '', sdiRecipientCode: '', pec: '',
  })

  useEffect(() => {
    if (customer) {
      setForm(toEditForm(customer))
      setEditing(Boolean(startInEditMode))
    }
  }, [customer?.id, startInEditMode])

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
          ui.slideOverOverlay,
          customer ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          ui.slideOver,
          'transform transition-transform duration-300 ease-out',
          customer ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!customer}
        role="dialog"
        aria-modal={!!customer}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-navy-mid px-6 py-4">
          <h2 className="text-lg font-bold text-pietra">{t('crm.slideOver.title')}</h2>
          <div className="flex items-center gap-1">
            {customer && onSave && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg p-2 text-fumo hover:bg-white/[0.05] hover:text-pietra transition-colors"
                aria-label={t('common.edit')}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {customer && onDelete && !editing && (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={isDeleting}
                className="rounded-lg p-2 text-fumo hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                aria-label={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-fumo hover:bg-white/[0.05] hover:text-pietra transition-colors"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center text-sm text-fumo">
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
            <div className="border-t border-white/[0.08] pt-4">
              <p className="text-sm font-semibold text-pietra mb-3">{t('crm.fiscal.title')}</p>
              <div className="space-y-3">
                <div>
                  <label className={ui.label}>{t('crm.fiscal.taxId')}</label>
                  <input value={form.taxId} onChange={e => setForm(p => ({ ...p, taxId: e.target.value }))} className={ui.input} />
                </div>
                <div>
                  <label className={ui.label}>{t('crm.fiscal.fiscalCode')}</label>
                  <input value={form.fiscalCode} onChange={e => setForm(p => ({ ...p, fiscalCode: e.target.value }))} className={ui.input} />
                </div>
                <div>
                  <label className={ui.label}>{t('crm.fiscal.sdiRecipientCode')}</label>
                  <input
                    value={form.sdiRecipientCode}
                    onChange={e => setForm(p => ({ ...p, sdiRecipientCode: e.target.value.toUpperCase().slice(0, 7) }))}
                    maxLength={7}
                    className={cn(ui.input, 'font-mono')}
                  />
                </div>
                <div>
                  <label className={ui.label}>{t('crm.fiscal.pec')}</label>
                  <input type="email" value={form.pec} onChange={e => setForm(p => ({ ...p, pec: e.target.value }))} className={ui.input} />
                </div>
              </div>
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
                className="flex-1 bg-aura-gold hover:bg-aura-gold text-navy font-semibold py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}

        {!isLoading && customer && !editing && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div>
              <p className="text-xl font-bold text-pietra">{customerDisplayName(customer)}</p>
              <div className="mt-2 space-y-1.5 text-sm text-fumo">
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

            {(customer.taxId || customer.fiscalCode || customer.sdiRecipientCode || customer.pec) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-fumo mb-2">
                  {t('crm.fiscal.title')}
                </p>
                <dl className="space-y-1 text-sm text-fumo">
                  {customer.taxId && (
                    <div><span className="font-medium">{t('crm.fiscal.taxId')}: </span>{customer.taxId}</div>
                  )}
                  {customer.fiscalCode && (
                    <div><span className="font-medium">{t('crm.fiscal.fiscalCode')}: </span><span className="font-mono">{customer.fiscalCode}</span></div>
                  )}
                  {customer.sdiRecipientCode && (
                    <div><span className="font-medium">{t('crm.fiscal.sdiRecipientCode')}: </span><span className="font-mono">{customer.sdiRecipientCode}</span></div>
                  )}
                  {customer.pec && (
                    <div><span className="font-medium">{t('crm.fiscal.pec')}: </span>{customer.pec}</div>
                  )}
                </dl>
              </div>
            )}

            {customer.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-fumo mb-2">
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
                <div key={row.label} className="premium-kpi p-3 sm:p-4">
                  <p className="premium-kpi-label text-[10px]">{row.label}</p>
                  <p className="mt-1 text-base font-semibold text-pietra tabular-nums sm:text-lg">{row.value}</p>
                </div>
              ))}
            </div>

            {customer.allergens && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t('crm.slideOver.allergens')}
                </p>
                <p className="mt-1 text-sm text-red-300/90">{customer.allergens}</p>
              </div>
            )}

            {customer.notes && (
              <div className="rounded-xl premium-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-fumo mb-1">
                  {t('crm.slideOver.notes')}
                </p>
                <p className="text-sm text-fumo italic">&ldquo;{customer.notes}&rdquo;</p>
              </div>
            )}

            <div className="rounded-xl premium-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-fumo mb-3">
                {t('crm.timelineTitle')}
              </p>
              {(timelineEvents?.length ?? 0) === 0 ? (
                <p className="text-sm text-fumo">{t('common.noData')}</p>
              ) : (
                <ul className="space-y-2 max-h-44 overflow-y-auto">
                  {timelineEvents!.map(ev => (
                    <li key={ev.id} className="text-sm border-b border-white/[0.06] pb-2 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-pietra">{ev.title}</span>
                        <span className="text-xs text-fumo">{formatDate(ev.at)}</span>
                      </div>
                      <p className="text-xs text-fumo mt-0.5">
                        {ev.kind}{ev.detail ? ` · ${ev.detail}` : ''}{ev.amount != null ? ` · ${formatCurrency(ev.amount)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fumo mb-3">
                <Receipt className="h-4 w-4" />
                {t('crm.slideOver.spendingHistory')}
              </p>
              {(customer.orders?.length ?? 0) === 0 ? (
                <p className="text-sm text-fumo">{t('crm.slideOver.noOrders')}</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden">
                  {customer.orders!.map(order => (
                    <li key={order.id} className="flex items-center justify-between bg-navy-elevated px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-pietra">
                          #{order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-xs text-fumo">
                          {formatDate(order.paidAt || order.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-pietra">
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
