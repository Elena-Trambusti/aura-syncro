import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { Megaphone, Plus, Send, Trash2, Calendar, Users, Gift, RefreshCw, PartyPopper, Mail } from 'lucide-react'
import { formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

interface Campaign {
  id: string; name: string; type: string; status: string
  subject?: string; message: string; targetFilter?: string
  scheduledAt?: string; sentAt?: string; recipientCount: number
  discountCode?: string; discountPct?: number; createdAt: string
}
interface BirthdayCustomer { id: string; name: string; email?: string; phone?: string; birthdate: string; loyaltyPoints: number }
interface BirthdayData { today: BirthdayCustomer[]; upcoming: BirthdayCustomer[]; totalWithBirthdate: number }
interface Stats { total: number; sent: number; draft: number; scheduled: number; totalRecipients: number }

const CAMPAIGN_TYPES = [
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'SMS', label: 'SMS', icon: Send },
  { value: 'BIRTHDAY', label: 'Compleanno', icon: PartyPopper },
  { value: 'WIN_BACK', label: 'Riacquisizione', icon: RefreshCw },
  { value: 'PROMOTION', label: 'Promozione', icon: Gift },
  { value: 'NEWS', label: 'Novità', icon: Megaphone },
]

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-stone-800/50 text-stone-300',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

const defaultForm = { name: '', type: 'EMAIL', subject: '', message: '', targetFilter: '{}', discountCode: '', discountPct: 0, scheduledAt: '' }

export default function MarketingPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'campagne' | 'compleanni'>('campagne')

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['marketing', 'campaigns'],
    queryFn: () => api.get('/marketing').then(r => r.data),
  })

  const { data: stats } = useQuery<Stats>({
    queryKey: ['marketing', 'stats'],
    queryFn: () => api.get('/marketing/stats').then(r => r.data),
  })

  const { data: birthdays } = useQuery<BirthdayData>({
    queryKey: ['marketing', 'birthdays'],
    queryFn: () => api.get('/marketing/automations/birthdays').then(r => r.data),
  })

  const createCampaign = useMutation({
    mutationFn: (data: typeof form) => api.post('/marketing', {
      ...data,
      discountPct: data.discountPct || undefined,
      scheduledAt: data.scheduledAt || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing'] }); setShowModal(false); setForm(defaultForm); toast.success(t('marketing.campaignCreated')) },
  })

  const sendCampaign = useMutation({
    mutationFn: (id: string) => api.post(`/marketing/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing'] })
      toast.success(t('marketing.campaignSent'))
    },
  })

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing'] }); toast.success(t('marketing.deleted')) },
  })

  const previewRecipients = async () => {
    const res = await api.post('/marketing/preview', { targetFilter: form.targetFilter })
    setPreviewCount(res.data.count)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-page-title">{t('marketing.title')}</h1>
          <p className="aura-page-subtitle">{t('marketing.subtitle')}</p>
          <p className="text-stone-400 text-sm mt-1">Raggiungi i tuoi clienti con messaggi mirati</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuova Campagna
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Totale', value: stats?.total || 0, color: 'text-stone-200' },
          { label: 'Inviate', value: stats?.sent || 0, color: 'text-green-600' },
          { label: 'Bozze', value: stats?.draft || 0, color: 'text-stone-400' },
          { label: 'Destinatari totali', value: (stats?.totalRecipients || 0).toLocaleString('it-IT'), color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-stone-900/55 rounded-2xl p-4 border border-stone-800/50 shadow-sm text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-stone-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['campagne', 'compleanni'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-amber-600 text-white' : 'bg-stone-900/55 border border-stone-700/50 text-stone-300 hover:bg-stone-900/30'}`}>
            {tab === 'campagne' ? '📢 Campagne' : '🎂 Compleanni'}
          </button>
        ))}
      </div>

      {activeTab === 'campagne' && (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="bg-stone-900/55 rounded-2xl p-10 text-center border border-stone-800/50">
              <Megaphone className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-400 font-medium">Nessuna campagna ancora</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-amber-400 text-sm font-medium hover:underline">Crea la prima campagna →</button>
            </div>
          ) : campaigns.map(c => {
            const typeInfo = CAMPAIGN_TYPES.find(t => t.value === c.type)
            return (
              <div key={c.id} className="bg-stone-900/55 rounded-2xl p-5 border border-stone-800/50 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-amber-950/30 rounded-xl flex items-center justify-center shrink-0">
                      {typeInfo && <typeInfo.icon className="w-5 h-5 text-amber-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-stone-100">{c.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                        <span className="text-xs bg-stone-800/50 text-stone-300 px-2 py-0.5 rounded-full">{typeInfo?.label}</span>
                      </div>
                      <p className="text-sm text-stone-400 mt-1 line-clamp-2">{c.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                        {c.recipientCount > 0 && <span><Users className="w-3 h-3 inline mr-1" />{c.recipientCount} destinatari</span>}
                        {c.sentAt && <span><Send className="w-3 h-3 inline mr-1" />Inviata {formatDate(c.sentAt)}</span>}
                        {c.scheduledAt && c.status === 'SCHEDULED' && <span><Calendar className="w-3 h-3 inline mr-1" />Programmata {formatDate(c.scheduledAt)}</span>}
                        {c.discountCode && <span><Gift className="w-3 h-3 inline mr-1" />Codice: <strong>{c.discountCode}</strong></span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === 'DRAFT' && (
                      <button onClick={() => { if (confirm(`Inviare la campagna "${c.name}"?`)) sendCampaign.mutate(c.id) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors">
                        <Send className="w-3 h-3" /> Invia
                      </button>
                    )}
                    <button onClick={() => { if (confirm('Eliminare questa campagna?')) deleteCampaign.mutate(c.id) }} className="p-2 hover:bg-red-950/30 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'compleanni' && (
        <div className="space-y-6">
          {/* Oggi */}
          <div>
            <h3 className="text-sm font-semibold text-stone-200 mb-3">🎂 Compleanni Oggi ({birthdays?.today.length || 0})</h3>
            {(birthdays?.today.length || 0) === 0 ? (
              <div className="bg-stone-900/55 rounded-xl p-6 text-center border border-stone-800/50 text-stone-500 text-sm">Nessun compleanno oggi</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {birthdays?.today.map(c => (
                  <div key={c.id} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{c.name[0]}</div>
                      <div>
                        <p className="font-semibold text-stone-100">{c.name}</p>
                        <p className="text-xs text-stone-400">{c.phone} {c.email && `· ${c.email}`}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prossimi 7 giorni */}
          <div>
            <h3 className="text-sm font-semibold text-stone-200 mb-3">📅 Prossimi 7 giorni ({birthdays?.upcoming.length || 0})</h3>
            <div className="bg-stone-900/55 rounded-2xl border border-stone-800/50 shadow-sm divide-y divide-stone-800/40">
              {(birthdays?.upcoming.length || 0) === 0 ? (
                <p className="text-sm text-stone-500 text-center p-6">Nessun compleanno in arrivo</p>
              ) : birthdays?.upcoming.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 bg-stone-800/50 rounded-full flex items-center justify-center text-stone-300 text-xs font-bold">{c.name[0]}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-200">{c.name}</p>
                    <p className="text-xs text-stone-500">{new Date(c.birthdate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</p>
                  </div>
                  <span className="text-xs text-stone-400">{c.phone}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-2">{birthdays?.totalWithBirthdate || 0} clienti con data di nascita registrata</p>
          </div>
        </div>
      )}

      {/* Modal Nuova Campagna */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-stone-900/55 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-100">Nuova Campagna</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nome campagna</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" placeholder="es. Promo Weekend" />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {CAMPAIGN_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${form.type === t.value ? 'bg-amber-950/30 border-amber-700/40 text-amber-400' : 'border-stone-700/50 text-stone-300 hover:bg-stone-900/30'}`}>
                      <t.icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Oggetto</label>
                <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" placeholder="es. 🎁 Offerta speciale per te!" />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Messaggio</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={4} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm resize-none" placeholder="Ciao [nome], abbiamo una sorpresa per te..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Codice sconto</label>
                  <input value={form.discountCode} onChange={e => setForm(p => ({ ...p, discountCode: e.target.value.toUpperCase() }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm font-mono" placeholder="PROMO20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Sconto %</label>
                  <input type="number" value={form.discountPct} onChange={e => setForm(p => ({ ...p, discountPct: +e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Filtro target */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-300">Destinatari (JSON filtro)</label>
                  <button onClick={previewRecipients} className="text-xs text-amber-400 hover:underline">Anteprima →</button>
                </div>
                <input value={form.targetFilter} onChange={e => setForm(p => ({ ...p, targetFilter: e.target.value }))} className="w-full border border-stone-700/50 rounded-xl px-3 py-2 text-sm font-mono" placeholder='{"minSpent": 100, "inactiveDays": 60}' />
                {previewCount !== null && <p className="text-xs text-amber-400 mt-1">→ {previewCount} destinatari trovati</p>}
                <p className="text-xs text-stone-500 mt-1">Filtri: minSpent, minVisits, tierId, inactiveDays. Vuoto = tutti</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-stone-700/50 text-stone-300 py-2.5 rounded-xl text-sm font-medium">Annulla</button>
              <button onClick={() => createCampaign.mutate(form)} disabled={createCampaign.isPending || !form.name || !form.message}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
                {createCampaign.isPending ? 'Salvataggio...' : 'Crea Campagna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
