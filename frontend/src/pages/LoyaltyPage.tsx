import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { ui } from '../lib/ui'
import { Star, Gift, TrendingUp, Users, ChevronRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'

interface LoyaltyTier {
  id: string; name: string; minPoints: number; color: string
  benefits?: string; discountPct: number; cashbackPct: number
  pointsPerEuro: number; sortOrder: number
  _count: { customers: number }
}
interface Customer {
  id: string; name: string; email?: string; loyaltyPoints: number
  totalSpent: number; loyaltyTier?: { name: string; color: string }
}
interface Overview {
  autoManaged?: boolean
  tiers: LoyaltyTier[]
  stats: { totalMembers: number; activeThisMonth: number; totalPointsIssued: number }
  topCustomers: Customer[]
}

export default function LoyaltyPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const tk = useTenantQueryKey()
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [adjustPoints, setAdjustPoints] = useState(0)
  const [adjustNote, setAdjustNote] = useState('')

  const { data: overview, isError: overviewError } = useQuery<Overview>({
    queryKey: tq(tk, 'loyalty', 'overview'),
    queryFn: () => api.get('/loyalty/overview').then(r => r.data),
  })

  const { data: customers = [], isError: customersError } = useQuery<Customer[]>({
    queryKey: tq(tk, 'loyalty', 'customers'),
    queryFn: () => api.get('/customers').then(r => r.data),
  })

  const adjustMutation = useMutation({
    mutationFn: () => api.post('/loyalty/adjust', {
      customerId: selectedCustomer?.id,
      points: adjustPoints,
      description: adjustNote,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'loyalty') })
      qc.invalidateQueries({ queryKey: tq(tk, 'customers') })
      setShowAdjustModal(false); setSelectedCustomer(null); setAdjustPoints(0); setAdjustNote('')
      toast.success(t('loyalty.pointsUpdated'))
    },
  })

  const tiers = overview?.tiers || []
  const stats = overview?.stats
  const topCustomers = overview?.topCustomers || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="aura-page-title">{t('loyalty.title')}</h1>
          <p className="aura-page-subtitle">{t('loyalty.subtitleAuto')}</p>
        </div>
        {overview?.autoManaged !== false && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
            {t('loyalty.autoManagedBadge')}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">{t('loyalty.autoManagedHint')}</p>
      </div>

      {(overviewError || customersError) && <QueryErrorBanner />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('loyalty.stats.members'), value: stats?.totalMembers || 0, icon: Users, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
          { label: t('loyalty.stats.activeMonth'), value: stats?.activeThisMonth || 0, icon: TrendingUp, iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
          { label: t('loyalty.stats.pointsIssued'), value: (stats?.totalPointsIssued || 0).toLocaleString(), icon: Star, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="saas-card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 ${s.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <s.icon className={`w-6 h-6 ${s.iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-slate-700">{t('loyalty.vipLevels')}</h2>
          <div className="space-y-3">
            {tiers.map(tier => (
              <div key={tier.id} className="glass-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: tier.color + '22', border: `2px solid ${tier.color}` }}>
                      <Star className="w-5 h-5" style={{ color: tier.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{tier.name}</p>
                      <p className="text-xs text-slate-500">{t('loyalty.tierFromPoints', { points: tier.minPoints.toLocaleString(), count: tier._count.customers })}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block shrink-0">
                    <p className="text-xs text-slate-500">{t('loyalty.tierRates', { pts: tier.pointsPerEuro, discount: tier.discountPct, cashback: tier.cashbackPct })}</p>
                  </div>
                </div>
                {tier.benefits && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500">{tier.benefits}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-700">{t('loyalty.topCustomers')}</h2>
          <div className="glass-card overflow-hidden">
            {topCustomers.length === 0 ? (
              <p className="text-sm text-slate-600 text-center p-6">{t('loyalty.noData')}</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {topCustomers.map((c, idx) => (
                  <li key={c.id} className="flex items-center gap-3 p-4">
                    <span className="text-sm font-bold text-slate-400 w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.loyaltyTier && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                        )}
                        <span className="text-xs text-slate-500">{t('loyalty.spent', { amount: formatCurrency(c.totalSpent) })}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-600">{c.loyaltyPoints.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{t('loyalty.pointsShort')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">{t('loyalty.allCustomers')}</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="glass-table-head">
              <tr>
                {[t('loyalty.tableCustomer'), t('loyalty.tableLevel'), t('loyalty.tablePoints'), t('loyalty.tableSpent'), ''].map(h => (
                  <th key={h || 'actions'} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.slice(0, 20).map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3">
                    {c.loyaltyTier ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                    ) : <span className="text-xs text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-amber-600">{c.loyaltyPoints.toLocaleString()}</span>
                    <span className="text-slate-500 text-xs ml-1">{t('loyalty.pointsShort')}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => { setSelectedCustomer(c); setShowAdjustModal(true) }} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                      <Gift className="w-3.5 h-3.5" /> {t('loyalty.adjust')} <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdjustModal && selectedCustomer && (
        <div className={ui.modalOverlay}>
          <div className={`${ui.modal} max-w-sm space-y-4`} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">{t('loyalty.adjustPointsTitle', { name: selectedCustomer.name })}</h3>
            <p className="text-sm text-slate-500">{t('loyalty.currentPoints')} <strong className="text-amber-600">{selectedCustomer.loyaltyPoints}</strong></p>
            <div>
              <label className={ui.label}>{t('loyalty.adjustPointsLabel')}</label>
              <input type="number" value={adjustPoints} onChange={e => setAdjustPoints(+e.target.value)} className={ui.input} placeholder={t('loyalty.adjustPointsPlaceholder')} />
            </div>
            <div>
              <label className={ui.label}>{t('loyalty.adjustNote')}</label>
              <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} className={ui.input} placeholder={t('loyalty.adjustNotePlaceholder')} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAdjustModal(false)} className={`flex-1 py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}>{t('common.cancel')}</button>
              <button type="button" onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || adjustPoints === 0} className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm disabled:opacity-60`}>
                {t('loyalty.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
