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
          <div className="flex items-center gap-2 rounded-xl border border-aura-gold/25 bg-aura-gold/10 px-4 py-2.5 text-sm font-medium text-amber-900 shrink-0">
            <Sparkles className="h-4 w-4 text-aura-gold" aria-hidden />
            {t('loyalty.autoManagedBadge')}
          </div>
        )}
      </div>

      <div className="rounded-xl premium-card p-4 shadow-sm">
        <p className="text-sm text-fumo">{t('loyalty.autoManagedHint')}</p>
      </div>

      {(overviewError || customersError) && <QueryErrorBanner />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('loyalty.stats.members'), value: stats?.totalMembers || 0, icon: Users, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
          { label: t('loyalty.stats.activeMonth'), value: stats?.activeThisMonth || 0, icon: TrendingUp, iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
          { label: t('loyalty.stats.pointsIssued'), value: (stats?.totalPointsIssued || 0).toLocaleString(), icon: Star, iconBg: 'bg-aura-gold/10', iconColor: 'text-aura-gold' },
        ].map(s => (
          <div key={s.label} className="saas-card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 ${s.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <s.icon className={`w-6 h-6 ${s.iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-pietra">{s.value}</p>
              <p className="text-sm font-medium text-fumo">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-fumo">{t('loyalty.vipLevels')}</h2>
          <div className="space-y-3">
            {tiers.map(tier => (
              <div key={tier.id} className="glass-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: tier.color + '22', border: `2px solid ${tier.color}` }}>
                      <Star className="w-5 h-5" style={{ color: tier.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-pietra">{tier.name}</p>
                      <p className="text-xs text-fumo">{t('loyalty.tierFromPoints', { points: tier.minPoints.toLocaleString(), count: tier._count.customers })}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block shrink-0">
                    <p className="text-xs text-fumo">{t('loyalty.tierRates', { pts: tier.pointsPerEuro, discount: tier.discountPct, cashback: tier.cashbackPct })}</p>
                  </div>
                </div>
                {tier.benefits && (
                  <div className="mt-3 pt-3 border-t border-white/[0.08]">
                    <p className="text-xs text-fumo">{tier.benefits}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold text-fumo">{t('loyalty.topCustomers')}</h2>
          <div className="glass-card overflow-hidden">
            {topCustomers.length === 0 ? (
              <p className="text-sm text-fumo text-center p-6">{t('loyalty.noData')}</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {topCustomers.map((c, idx) => (
                  <li key={c.id} className="flex items-center gap-3 p-4">
                    <span className="text-sm font-bold text-fumo w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-pietra truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.loyaltyTier && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                        )}
                        <span className="text-xs text-fumo">{t('loyalty.spent', { amount: formatCurrency(c.totalSpent) })}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-aura-gold">{c.loyaltyPoints.toLocaleString()}</p>
                      <p className="text-xs text-fumo">{t('loyalty.pointsShort')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-fumo mb-3">{t('loyalty.allCustomers')}</h2>

        {/* Mobile: card layout */}
        <div className="space-y-3 md:hidden">
          {customers.slice(0, 20).map(c => (
            <div key={c.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-pietra truncate">{c.name}</p>
                  {c.loyaltyTier ? (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                  ) : <span className="text-xs text-fumo">—</span>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-aura-gold">{c.loyaltyPoints.toLocaleString()}</p>
                  <p className="text-xs text-fumo">{t('loyalty.pointsShort')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                <span className="text-sm text-fumo">{formatCurrency(c.totalSpent)}</span>
                <button type="button" onClick={() => { setSelectedCustomer(c); setShowAdjustModal(true) }} className="flex items-center gap-1 text-xs text-aura-gold font-medium">
                  <Gift className="w-3.5 h-3.5" /> {t('loyalty.adjust')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabella scrollabile */}
        <div className="glass-card overflow-hidden hidden md:block">
          <div className={ui.tableWrap}>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="glass-table-head">
                <tr>
                  {[t('loyalty.tableCustomer'), t('loyalty.tableLevel'), t('loyalty.tablePoints'), t('loyalty.tableSpent'), ''].map(h => (
                    <th key={h || 'actions'} className="text-left px-4 py-3 text-xs font-semibold text-fumo uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {customers.slice(0, 20).map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.05] transition-colors">
                    <td className="px-4 py-3 font-medium text-pietra">{c.name}</td>
                    <td className="px-4 py-3">
                      {c.loyaltyTier ? (
                        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                      ) : <span className="text-xs text-fumo">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-aura-gold">{c.loyaltyPoints.toLocaleString()}</span>
                      <span className="text-fumo text-xs ml-1">{t('loyalty.pointsShort')}</span>
                    </td>
                    <td className="px-4 py-3 text-fumo">{formatCurrency(c.totalSpent)}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => { setSelectedCustomer(c); setShowAdjustModal(true) }} className="flex items-center gap-1 text-xs text-aura-gold hover:text-aura-gold font-medium">
                        <Gift className="w-3.5 h-3.5" /> {t('loyalty.adjust')} <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdjustModal && selectedCustomer && (
        <div className={ui.modalOverlay}>
          <div className={`${ui.modal} max-w-sm space-y-4`} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-pietra">{t('loyalty.adjustPointsTitle', { name: selectedCustomer.name })}</h3>
            <p className="text-sm text-fumo">{t('loyalty.currentPoints')} <strong className="text-aura-gold">{selectedCustomer.loyaltyPoints}</strong></p>
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
