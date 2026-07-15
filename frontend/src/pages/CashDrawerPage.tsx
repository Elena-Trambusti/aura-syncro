import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatTime } from '../lib/utils'
import { moneyNumber } from '../lib/money'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

/** Parse cash amount from input; empty → 0; accepts comma decimal separator. */
function parseCashAmountInput(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed === '') return 0
  return moneyNumber(trimmed.replace(',', '.'))
}
import { Wallet, Plus, Lock, Unlock } from 'lucide-react'
import { toast } from '@/lib/toast'
import { resolveToastApiError } from '../lib/formatApiError'
import { useInstantMutation } from '../hooks/useInstantMutation'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import QueryErrorBanner from '../components/QueryErrorBanner'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useShowQuerySkeleton } from '../hooks/useShowQuerySkeleton'
import { ui } from '../lib/ui'
import GlassModal from '../components/ui/GlassModal'

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

  const { data: session, isLoading: sessionLoading, isError: sessionError } = useQuery<CashSession | null>({
    queryKey: tq(tk, 'cash', 'current'),
    queryFn: () => api.get('/cash/session/current').then(r => r.data),
  })
  const showSessionSkeleton = useShowQuerySkeleton(sessionLoading, session != null)

  const { data: txs = [], isError: txsError } = useQuery<CashTx[]>({
    queryKey: tq(tk, 'cash', 'transactions'),
    queryFn: () => api.get('/cash/transactions').then(r => r.data),
    enabled: !!session,
  })

  const openSession = useInstantMutation<{ data: CashSession }, unknown, void>({
    actionKey: () => 'cash-open',
    mutationFn: () => api.post('/cash/session/open', { openingBalance: amount }),
    onInstant: () => {
      setShowOpenModal(false)
    },
    onSuccess: (res) => {
      if (res?.data?.id) {
        queryClient.setQueryData<CashSession | null>(tq(tk, 'cash', 'current'), res.data)
      }
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      toast.success(t('cashDrawer.openSuccess'))
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      setShowOpenModal(true)
      toast.error(resolveToastApiError(t, err, 'cashDrawer.openError'))
    },
  })

  const closeSession = useInstantMutation<{ data: { difference: number } }, unknown, void>({
    actionKey: () => 'cash-close',
    mutationFn: () => api.post('/cash/session/close', { closingBalance: amount }),
    onInstant: () => {
      setShowCloseModal(false)
      queryClient.setQueryData<CashSession | null>(tq(tk, 'cash', 'current'), null)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      const diff = res.data.difference
      if (diff === 0) toast.success(t('cashDrawer.closeBalanced'))
      else if (diff > 0) toast.success(t('cashDrawer.closeSurplus', { amount: diff }))
      else toast.error(t('cashDrawer.closeShortage', { amount: diff }))
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      setShowCloseModal(true)
      toast.error(resolveToastApiError(t, err, 'cashDrawer.closeError'))
    },
  })

  const addTx = useInstantMutation<unknown, unknown, void>({
    actionKey: () => `cash-tx-${txType}`,
    mutationFn: () => api.post('/cash/transactions', { type: txType, amount, reason }),
    onInstant: () => {
      const tempTx: CashTx = {
        id: `temp-${Date.now()}`,
        type: txType,
        amount,
        reason,
        createdAt: new Date().toISOString(),
        user: { name: '…' },
      }
      queryClient.setQueryData<CashTx[]>(tq(tk, 'cash', 'transactions'), prev => [...(prev ?? []), tempTx])
      setShowTxModal(false)
      toast.success(t('cashDrawer.txSuccess'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash') })
      setShowTxModal(true)
      toast.error(resolveToastApiError(t, err, 'cashDrawer.txError'))
    },
  })

  const sales = txs.filter(t => t.type === 'SALE' || t.type === 'PAYIN').reduce((sum, t) => sum + t.amount, 0)
  const payouts = txs.filter(t => t.type === 'PAYOUT' || t.type === 'REFUND').reduce((sum, t) => sum + t.amount, 0)
  const currentExpected = (session?.openingBalance || 0) + sales - payouts

  return (
    <ExecutivePageShell>
      <ExecutivePageHeader 
        title={t('cashDrawer.title')} 
        subtitle={t('cashDrawer.subtitle')} 
      />

      {(sessionError || txsError) && <QueryErrorBanner />}

      {showSessionSkeleton ? (
        <PageSkeleton variant="cards" count={2} />
      ) : !session ? (
        <div className="flex flex-col items-center justify-center p-12 text-stone-400 bg-navy-surface rounded-xl border border-white/5">
          <Wallet className="w-16 h-16 mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">{t('cashDrawer.noSessionTitle')}</h2>
          <p className="mb-6">{t('cashDrawer.noSessionDesc')}</p>
          <button onClick={() => { setAmount(0); setShowOpenModal(true); }} className={ui.btnPrimary + " px-6 py-3"}>
            <Unlock className="w-4 h-4 mr-2 inline" /> {t('cashDrawer.openDrawer')}
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-navy-surface rounded-xl border border-white/10 p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-fumo">{t('cashDrawer.expectedBalance')}</p>
                <p className="text-4xl font-black text-white">€{currentExpected.toFixed(2)}</p>
                <p className="text-xs text-stone-500 mt-2">{t('cashDrawer.openedBy', { name: session.openedBy.name, time: formatTime(session.openedAt) })}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setAmount(0); setReason(''); setShowTxModal(true) }} className={ui.btnGhost + " px-4 py-2"}>
                  <Plus className="w-4 h-4 mr-2 inline" /> {t('cashDrawer.payInOut')}
                </button>
                <button onClick={() => { setAmount(0); setShowCloseModal(true) }} className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg font-bold hover:bg-red-500/20">
                  <Lock className="w-4 h-4 mr-2 inline" /> {t('cashDrawer.closeShift')}
                </button>
              </div>
            </div>

            <div className="bg-navy-elevated rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-black/20">
                <h3 className="font-bold text-white">{t('cashDrawer.movementsTitle')}</h3>
              </div>
              <div className="p-0">
                {txs.length === 0 ? (
                  <p className="p-6 text-center text-stone-500">{t('cashDrawer.noMovements')}</p>
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
        <GlassModal onClose={() => setShowOpenModal(false)} maxWidth="sm">
          <h3 className="mb-4 text-xl font-bold text-pietra">{t('cashDrawer.openTitle', { defaultValue: 'Apri Cassa' })}</h3>
          <p className="mb-4 text-sm text-fumo">{t('cashDrawer.openHint', { defaultValue: 'Inserisci il fondo cassa iniziale (resto) attualmente presente nel cassetto.' })}</p>
          <input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseCashAmountInput(e.target.value))} className={ui.input + ' mb-6 w-full p-3 text-center text-xl'} placeholder="0.00" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowOpenModal(false)} className={ui.chipInactive + ' flex-1 rounded-xl py-3'}>{t('common.cancel')}</button>
            <button type="button" disabled={openSession.isPending} onClick={() => openSession.mutate(undefined)} className={ui.btnPrimary + ' flex-1 py-3 active:scale-[0.98] disabled:opacity-60'}>{t('common.confirm')}</button>
          </div>
        </GlassModal>
      )}

      {showTxModal && (
        <GlassModal onClose={() => setShowTxModal(false)} maxWidth="sm">
          <h3 className="mb-4 text-xl font-bold text-pietra">{t('cashDrawer.txTitle', { defaultValue: 'Movimento Extra' })}</h3>
          <div className="mb-4 flex gap-2 rounded-xl bg-black/30 p-1">
            <button type="button" onClick={() => setTxType('PAYOUT')} className={`flex-1 rounded-lg py-2 text-sm font-bold ${txType === 'PAYOUT' ? 'bg-red-500/20 text-red-400' : 'text-fumo'}`}>Prelievo (-)</button>
            <button type="button" onClick={() => setTxType('PAYIN')} className={`flex-1 rounded-lg py-2 text-sm font-bold ${txType === 'PAYIN' ? 'bg-emerald-500/20 text-emerald-400' : 'text-fumo'}`}>Versamento (+)</button>
          </div>
          <input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseCashAmountInput(e.target.value))} className={ui.input + ' mb-4 w-full p-3 text-center text-xl'} placeholder="Importo €" />
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} className={ui.input + ' mb-6 w-full p-3'} placeholder="Motivazione (es. Pagamento fornitore)" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowTxModal(false)} className={ui.chipInactive + ' flex-1 rounded-xl py-3'}>{t('common.cancel')}</button>
            <button type="button" disabled={amount <= 0 || !reason || addTx.isPending} onClick={() => addTx.mutate(undefined)} className={ui.btnPrimary + ' flex-1 py-3 disabled:opacity-60'}>{t('common.confirm')}</button>
          </div>
        </GlassModal>
      )}

      {showCloseModal && (
        <GlassModal onClose={() => setShowCloseModal(false)} maxWidth="sm" className="border-rose-500/20">
          <h3 className="mb-2 text-xl font-bold text-pietra">{t('cashDrawer.closeTitle', { defaultValue: 'Chiusura alla Cieca' })}</h3>
          <p className="mb-6 text-sm text-fumo">{t('cashDrawer.closeHint', { defaultValue: "Conta tutti i soldi fisici nel cassetto e inserisci l'importo totale. Il sistema calcolerà le differenze." })}</p>
          <input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseCashAmountInput(e.target.value))} className={ui.input + ' mb-6 w-full p-4 text-center text-3xl font-black'} placeholder="0.00" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCloseModal(false)} className={ui.chipInactive + ' flex-1 rounded-xl py-3'}>{t('common.cancel')}</button>
            <button type="button" disabled={closeSession.isPending} onClick={() => closeSession.mutate(undefined)} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60">{t('cashDrawer.closeAction', { defaultValue: 'Chiudi Cassa' })}</button>
          </div>
        </GlassModal>
      )}

    </ExecutivePageShell>
  )
}
