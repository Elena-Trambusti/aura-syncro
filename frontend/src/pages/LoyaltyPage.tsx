import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { Star, Plus, Edit2, Trash2, Gift, TrendingUp, Users, Award, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

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
  tiers: LoyaltyTier[]
  stats: { totalMembers: number; activeThisMonth: number; totalPointsIssued: number }
  topCustomers: Customer[]
}

const TIER_COLORS = ['#94a3b8', '#cd7f32', '#c0c0c0', '#ffd700', '#e5e4e2']

export default function LoyaltyPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showTierModal, setShowTierModal] = useState(false)
  const [editTier, setEditTier] = useState<LoyaltyTier | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [adjustPoints, setAdjustPoints] = useState(0)
  const [adjustNote, setAdjustNote] = useState('')
  const [tierForm, setTierForm] = useState({ name: '', minPoints: 0, color: '#94a3b8', discountPct: 0, cashbackPct: 0, pointsPerEuro: 1, benefits: '', sortOrder: 0 })

  const { data: overview } = useQuery<Overview>({
    queryKey: ['loyalty', 'overview'],
    queryFn: () => api.get('/loyalty/overview').then(r => r.data),
  })

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['loyalty', 'customers'],
    queryFn: () => api.get('/customers').then(r => r.data),
  })

  const saveTier = useMutation({
    mutationFn: (data: typeof tierForm) => editTier
      ? api.put(`/loyalty/tiers/${editTier.id}`, data)
      : api.post('/loyalty/tiers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty'] })
      setShowTierModal(false); setEditTier(null)
      toast.success(editTier ? 'Livello aggiornato' : 'Livello creato')
    },
  })

  const deleteTier = useMutation({
    mutationFn: (id: string) => api.delete(`/loyalty/tiers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty'] }); toast.success(t('loyalty.tierDeleted')) },
  })

  const adjustMutation = useMutation({
    mutationFn: () => api.post('/loyalty/adjust', {
      customerId: selectedCustomer?.id,
      points: adjustPoints,
      description: adjustNote,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setShowAdjustModal(false); setSelectedCustomer(null); setAdjustPoints(0); setAdjustNote('')
      toast.success(t('loyalty.pointsUpdated'))
    },
  })

  const openTierModal = (tier?: LoyaltyTier) => {
    if (tier) {
      setEditTier(tier)
      setTierForm({ name: tier.name, minPoints: tier.minPoints, color: tier.color, discountPct: tier.discountPct, cashbackPct: tier.cashbackPct, pointsPerEuro: tier.pointsPerEuro, benefits: tier.benefits || '', sortOrder: tier.sortOrder })
    } else {
      setEditTier(null)
      setTierForm({ name: '', minPoints: 0, color: '#94a3b8', discountPct: 0, cashbackPct: 0, pointsPerEuro: 1, benefits: '', sortOrder: 0 })
    }
    setShowTierModal(true)
  }

  const tiers = overview?.tiers || []
  const stats = overview?.stats
  const topCustomers = overview?.topCustomers || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-page-title">{t('loyalty.title')}</h1>
          <p className="aura-page-subtitle">{t('loyalty.subtitle')}</p>
          <p className="text-stone-400 text-sm mt-1">Livelli VIP, punti e premi per i tuoi clienti</p>
        </div>
        <button onClick={() => openTierModal()} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuovo Livello
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Membri Attivi', value: stats?.totalMembers || 0, icon: Users, color: 'bg-purple-500' },
          { label: 'Attivi questo mese', value: stats?.activeThisMonth || 0, icon: TrendingUp, color: 'bg-amber-600' },
          { label: 'Punti totali emessi', value: (stats?.totalPointsIssued || 0).toLocaleString('it-IT'), icon: Star, color: 'bg-amber-500' },
        ].map(s => (
          <div key={s.label} className="bg-stone-900/55 rounded-2xl p-5 shadow-sm border border-stone-800/50 flex items-center gap-4">
            <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center`}>
              <s.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-100">{s.value}</p>
              <p className="text-sm text-stone-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Livelli VIP */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-stone-200">Livelli VIP</h2>
          {tiers.length === 0 ? (
            <div className="bg-stone-900/55 rounded-2xl p-10 text-center border border-stone-800/50">
              <Award className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-400 font-medium">Nessun livello configurato</p>
              <button onClick={() => openTierModal()} className="mt-3 text-amber-400 text-sm font-medium hover:underline">Crea il primo livello →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {tiers.map(tier => (
                <div key={tier.id} className="bg-stone-900/55 rounded-2xl p-5 border border-stone-800/50 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: tier.color + '22', border: `2px solid ${tier.color}` }}>
                        <Star className="w-5 h-5" style={{ color: tier.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-stone-100">{tier.name}</p>
                        <p className="text-xs text-stone-400">da {tier.minPoints.toLocaleString('it-IT')} punti · {tier._count.customers} clienti</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-stone-400">{tier.pointsPerEuro} pt/€ · {tier.discountPct}% sconto · {tier.cashbackPct}% cashback</p>
                      </div>
                      <button onClick={() => openTierModal(tier)} className="p-2 hover:bg-stone-800/50 rounded-lg"><Edit2 className="w-4 h-4 text-stone-400" /></button>
                      <button onClick={() => { if (confirm('Eliminare questo livello?')) deleteTier.mutate(tier.id) }} className="p-2 hover:bg-red-950/30 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                  {tier.benefits && (
                    <div className="mt-3 pt-3 border-t border-stone-800/40">
                      <p className="text-xs text-stone-400">{tier.benefits}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clienti */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-stone-200">Top Clienti</h2>
          <div className="bg-stone-900/55 rounded-2xl border border-stone-800/50 shadow-sm overflow-hidden">
            {topCustomers.length === 0 ? (
              <p className="text-sm text-stone-500 text-center p-6">Nessun dato</p>
            ) : (
              <ul className="divide-y divide-stone-800/40">
                {topCustomers.map((c, idx) => (
                  <li key={c.id} className="flex items-center gap-3 p-4">
                    <span className="text-sm font-bold text-stone-500 w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-200 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.loyaltyTier && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                        )}
                        <span className="text-xs text-stone-500">{formatCurrency(c.totalSpent)} spesi</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-400">{c.loyaltyPoints.toLocaleString('it-IT')}</p>
                      <p className="text-xs text-stone-500">pt</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Clienti con punti */}
      <div>
        <h2 className="text-base font-semibold text-stone-200 mb-3">Tutti i Clienti</h2>
        <div className="bg-stone-900/55 rounded-2xl border border-stone-800/50 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-900/30">
              <tr>
                {['Cliente', 'Livello', 'Punti', 'Tot. Speso', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/40">
              {customers.slice(0, 20).map(c => (
                <tr key={c.id} className="hover:bg-stone-900/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-stone-100">{c.name}</td>
                  <td className="px-4 py-3">
                    {c.loyaltyTier ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: c.loyaltyTier.color + '22', color: c.loyaltyTier.color }}>{c.loyaltyTier.name}</span>
                    ) : <span className="text-xs text-stone-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-amber-400">{c.loyaltyPoints.toLocaleString('it-IT')}</span>
                    <span className="text-stone-500 text-xs ml-1">pt</span>
                  </td>
                  <td className="px-4 py-3 text-stone-300">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelectedCustomer(c); setShowAdjustModal(true) }} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-400 font-medium">
                      <Gift className="w-3.5 h-3.5" /> Aggiusta <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Livello */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900/55 rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-100">{editTier ? 'Modifica Livello' : 'Nuovo Livello VIP'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Nome livello</label>
                <input value={tierForm.name} onChange={e => setTierForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" placeholder="es. Gold, Platinum..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Punti minimi</label>
                <input type="number" value={tierForm.minPoints} onChange={e => setTierForm(p => ({ ...p, minPoints: +e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Colore</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={tierForm.color} onChange={e => setTierForm(p => ({ ...p, color: e.target.value }))} className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                  <div className="flex-1 flex gap-1.5 flex-wrap">
                    {TIER_COLORS.map(c => <button key={c} onClick={() => setTierForm(p => ({ ...p, color: c }))} className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: c }} />)}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Punti per €</label>
                <input type="number" step="0.5" value={tierForm.pointsPerEuro} onChange={e => setTierForm(p => ({ ...p, pointsPerEuro: +e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Sconto %</label>
                <input type="number" step="0.5" value={tierForm.discountPct} onChange={e => setTierForm(p => ({ ...p, discountPct: +e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Cashback %</label>
                <input type="number" step="0.5" value={tierForm.cashbackPct} onChange={e => setTierForm(p => ({ ...p, cashbackPct: +e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Vantaggi (testo libero)</label>
                <textarea value={tierForm.benefits} onChange={e => setTierForm(p => ({ ...p, benefits: e.target.value }))} rows={2} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm resize-none" placeholder="es. Bottiglia di vino in omaggio, Priorità prenotazioni..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTierModal(false)} className="flex-1 border border-stone-700/50 text-stone-300 py-2.5 rounded-xl text-sm font-medium">Annulla</button>
              <button onClick={() => saveTier.mutate(tierForm)} disabled={saveTier.isPending} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
                {saveTier.isPending ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aggiusta Punti */}
      {showAdjustModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900/55 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-100">Aggiusta Punti — {selectedCustomer.name}</h3>
            <p className="text-sm text-stone-400">Punti attuali: <strong className="text-amber-400">{selectedCustomer.loyaltyPoints}</strong></p>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Punti da aggiungere/rimuovere</label>
              <input type="number" value={adjustPoints} onChange={e => setAdjustPoints(+e.target.value)} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" placeholder="es. +100 o -50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Nota</label>
              <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" placeholder="Motivo aggiustamento" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdjustModal(false)} className="flex-1 border border-stone-700/50 text-stone-300 py-2.5 rounded-xl text-sm font-medium">Annulla</button>
              <button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || adjustPoints === 0} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
