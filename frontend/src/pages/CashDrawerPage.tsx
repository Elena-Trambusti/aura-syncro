import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatTime } from '../lib/utils'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { Wallet, Plus, Lock, Unlock } from 'lucide-react'
import toast from 'react-hot-toast'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import { ui } from '../lib/ui'

interface CashSession {
  id: string
  openedBy: { name: string }
  openedAt: string
  closedAt?: string
  status: 'OPEN' | 'CLOSED'
  openingBalance: number
  closingBalance?: number
  expectedBalance?: number
  difference?: number
  notes?: string
}

interface CashTx {
  id: string
  type: 'PAYIN' | 'PAYOUT' | 'SALE' | 'REFUND'
  amount: number
  reason: string
  createdAt: string
  user: { name: string }
}

export default function CashDrawerPage() {
  const { t } = useTranslation()
  const tk = useTenantQueryKey()
  const queryClient = useQueryClient()
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')
  const [txType, setTxType] = useState<'PAYIN'|'PAYOUT'>('PAYOUT')

  const { data: session } = useQuery<CashSession | null>({
    queryKey: tq(tk, 'cash', 'current'),
    queryFn: () => api.get('/cash/session/current').then(r => r.data),
  })

  const { data: txs = [] } = useQuery<CashTx[]>({
    queryKey: tq(tk, 'cash', 'transactions'),
    queryFn: () => api.get('/cash/transactions').then(r => r.data),
    enabled: !!session,
  })

  const openSession = useMutation({
    mutationFn: () => api.post('/cash/session/open', { openingBalance: amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      setShowOpenModal(false)
      toast.success(t('cashDrawer.openSuccess'))
    },
    onError: () => toast.error(t('cashDrawer.openError')),
  })

  const closeSession = useMutation({
    mutationFn: () => api.post('/cash/session/close', { closingBalance: amount }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      setShowCloseModal(false)
      const diff = res.data.difference
      if (diff === 0) toast.success(t('cashDrawer.closeBalanced'))
      else if (diff > 0) toast.success(t('cashDrawer.closeSurplus', { amount: diff }))
      else toast.error(t('cashDrawer.closeShortage', { amount: diff }))
    },
    onError: () => toast.error(t('cashDrawer.closeError')),
  })

  const addTx = useMutation({
    mutationFn: () => api.post('/cash/transactions', { type: txType, amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      setShowTxModal(false)
      toast.success(t('cashDrawer.txSuccess'))
    },
    onError: () => toast.error(t('cashDrawer.txError')),
  })

  const sales = txs.filter(t => t.type === 'SALE' || t.type === 'PAYIN').reduce((sum, t) => sum + t.amount, 0)
  const payouts = txs.filter(t => t.type === 'PAYOUT' || t.type === 'REFUND').reduce((sum, t) => sum + t.amount, 0)
  const currentExpected = (session?.openingBalance || 0) + sales - payouts

  return (
    <ExecutivePageShell>
      <ExecutivePageHeader 
        title="Turno Cassa" 
        subtitle="Gestione del cassetto contanti e controllo ammanchi" 
      />

      {!session ? (
        <div className="flex flex-col items-center justify-center p-12 text-stone-400 bg-navy-surface rounded-xl border border-white/5">
          <Wallet className="w-16 h-16 mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Nessun turno aperto</h2>
          <p className="mb-6">Il cassetto è chiuso. Aprilo inserendo il fondo cassa iniziale.</p>
          <button onClick={() => { setAmount(0); setShowOpenModal(true); }} className={ui.btnPrimary + " px-6 py-3"}>
            <Unlock className="w-4 h-4 mr-2 inline" /> Apri Cassa
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-navy-surface rounded-xl border border-white/10 p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-fumo">Saldo Atteso Attuale</p>
                <p className="text-4xl font-black text-white">€{currentExpected.toFixed(2)}</p>
                <p className="text-xs text-stone-500 mt-2">Aperto da {session.openedBy.name} alle {formatTime(session.openedAt)}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setAmount(0); setReason(''); setShowTxModal(true) }} className={ui.btnGhost + " px-4 py-2"}>
                  <Plus className="w-4 h-4 mr-2 inline" /> Prelievo / Versamento
                </button>
                <button onClick={() => { setAmount(0); setShowCloseModal(true) }} className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg font-bold hover:bg-red-500/20">
                  <Lock className="w-4 h-4 mr-2 inline" /> Chiudi Turno
                </button>
              </div>
            </div>

            <div className="bg-navy-elevated rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-black/20">
                <h3 className="font-bold text-white">Movimenti del turno</h3>
              </div>
              <div className="p-0">
                {txs.length === 0 ? (
                  <p className="p-6 text-center text-stone-500">Nessun movimento registrato.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {txs.map(tx => (
                      <li key={tx.id} className="flex justify-between items-center p-4 hover:bg-white/5">
                        <div>
                          <p className="font-semibold text-stone-200">{tx.reason || tx.type}</p>
                          <p className="text-xs text-fumo">{formatTime(tx.createdAt)} • {tx.user.name}</p>
                        </div>
                        <p className={`font-bold ${['PAYIN', 'SALE'].includes(tx.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                          {['PAYIN', 'SALE'].includes(tx.type) ? '+' : '-'}€{tx.amount.toFixed(2)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-navy-surface rounded-xl border border-white/5 p-5">
              <h3 className="font-bold text-white mb-4">Riepilogo</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-stone-400">
                  <span>Fondo iniziale</span>
                  <span className="text-white">€{session.openingBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Incassi contanti</span>
                  <span className="text-emerald-400">+€{sales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Prelievi/Uscite</span>
                  <span className="text-red-400">-€{payouts.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between font-bold">
                  <span className="text-stone-300">Da versare in cassa</span>
                  <span className="text-white">€{currentExpected.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-elevated rounded-2xl w-full max-w-sm border border-white/10 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Apri Cassa</h3>
            <p className="text-sm text-stone-400 mb-4">Inserisci il fondo cassa iniziale (resto) attualmente presente nel cassetto.</p>
            <input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className={ui.input + " w-full mb-6 text-xl p-3 text-center"} placeholder="0.00" />
            <div className="flex gap-3">
              <button onClick={() => setShowOpenModal(false)} className={ui.chipInactive + " flex-1 py-3 rounded-xl"}>Annulla</button>
              <button onClick={() => openSession.mutate()} className={ui.btnPrimary + " flex-1 py-3"}>Conferma</button>
            </div>
          </div>
        </div>
      )}

      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-elevated rounded-2xl w-full max-w-sm border border-white/10 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Movimento Extra</h3>
            <div className="flex gap-2 mb-4 bg-black/30 p-1 rounded-xl">
              <button onClick={() => setTxType('PAYOUT')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${txType==='PAYOUT' ? 'bg-red-500/20 text-red-400' : 'text-stone-400'}`}>Prelievo (-)</button>
              <button onClick={() => setTxType('PAYIN')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${txType==='PAYIN' ? 'bg-emerald-500/20 text-emerald-400' : 'text-stone-400'}`}>Versamento (+)</button>
            </div>
            <input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className={ui.input + " w-full mb-4 text-xl p-3 text-center"} placeholder="Importo €" />
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className={ui.input + " w-full mb-6 p-3"} placeholder="Motivazione (es. Pagamento fornitore)" />
            <div className="flex gap-3">
              <button onClick={() => setShowTxModal(false)} className={ui.chipInactive + " flex-1 py-3 rounded-xl"}>Annulla</button>
              <button disabled={amount <= 0 || !reason} onClick={() => addTx.mutate()} className={ui.btnPrimary + " flex-1 py-3"}>Registra</button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-elevated rounded-2xl w-full max-w-sm border border-white/10 p-6 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
            <h3 className="text-xl font-bold text-white mb-2">Chiusura alla Cieca</h3>
            <p className="text-sm text-stone-400 mb-6">Conta tutti i soldi fisici nel cassetto e inserisci l'importo totale. Il sistema calcolerà le differenze.</p>
            <input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className={ui.input + " w-full mb-6 text-3xl p-4 text-center font-black"} placeholder="0.00" />
            <div className="flex gap-3">
              <button onClick={() => setShowCloseModal(false)} className={ui.chipInactive + " flex-1 py-3 rounded-xl"}>Annulla</button>
              <button onClick={() => closeSession.mutate()} className="bg-red-600 text-white flex-1 py-3 rounded-xl font-bold hover:bg-red-700">Chiudi Cassa</button>
            </div>
          </div>
        </div>
      )}

    </ExecutivePageShell>
  )
}
