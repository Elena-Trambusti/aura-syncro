import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatCurrency, cn } from '../lib/utils'
import { useAuth, useFiscalRegime, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { tRegime } from '../lib/fiscalRegime'
import { printReceipt } from '../lib/export'
import ReceiptPreviewModal, { type CheckoutFinalizeResult } from '../components/checkout/ReceiptPreviewModal'
import CustomerPicker from '../components/checkout/CustomerPicker'
import {
  ArrowLeft, CreditCard, Banknote, Users, Loader2, Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'

type PaymentMethod = 'CARD' | 'CASH' | 'SPLIT'
type SplitMode = 'equal' | 'by_items'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  status: string
  menuItem: { name: string }
}

interface CheckoutOrder {
  id: string
  status: string
  subtotal: number
  tax: number
  total: number
  discount?: number
  taxRateApplied?: number | null
  table?: { number: number } | null
  type: string
  createdAt: string
  items: OrderItem[]
  customer?: { id: string; name: string; loyaltyTier?: { name: string; discountPct: number } | null } | null
}

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const tk = useTenantQueryKey()
  const fiscal = useFiscalRegime()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD')
  const [splitSettlement, setSplitSettlement] = useState<'CARD' | 'CASH'>('CARD')
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [guestCount, setGuestCount] = useState(2)
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({})
  const [wantsTip, setWantsTip] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [tipWaiterId, setTipWaiterId] = useState('')
  const [receiptEmail, setReceiptEmail] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [finalizeResult, setFinalizeResult] = useState<CheckoutFinalizeResult | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<{
    order: CheckoutOrder
    restaurant: { name: string; taxId?: string | null }
    loyaltyDiscount?: { pct: number; tierName?: string } | null
    posStatus?: {
      mode: string
      providerLabel?: string | null
      isCardChargeSimulated: boolean
      usesExternalFiscalDevice: boolean
      legalReceiptSource: string
      configured: boolean
    }
    posSimulation?: boolean
  }>({
    queryKey: tq(tk, 'checkout', orderId),
    queryFn: () => api.get(`/payments/checkout/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })

  const { data: staff } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: tq(tk, 'staff'),
    queryFn: () => api.get('/staff').then(r => r.data),
  })

  const order = data?.order
  const parsedTip = wantsTip ? Math.max(0, parseFloat(tipAmount) || 0) : 0
  const grandTotal = (order?.total ?? 0) + parsedTip
  const loyaltyDiscount = data?.loyaltyDiscount
  const posStatus = data?.posStatus
  const posSimulation = posStatus?.isCardChargeSimulated ?? data?.posSimulation !== false

  const applyPromo = useMutation({
    mutationFn: (code: string) =>
      api.post('/payments/apply-discount', { orderId, discountCode: code }).then(r => r.data),
    onSuccess: () => {
      void refetch()
      toast.success(t('checkout.discountApplied'))
    },
    onError: () => toast.error(t('checkout.discountInvalid')),
  })

  const activeItems = useMemo(
    () => order?.items.filter(i => i.status !== 'CANCELLED') ?? [],
    [order?.items],
  )

  const splitPreview = useMemo(() => {
    if (paymentMethod !== 'SPLIT' || !order) return null
    const guests = Array.from({ length: guestCount }, (_, i) => ({
      index: i,
      label: t('checkout.guest', { n: i + 1 }),
      total: 0,
      items: [] as OrderItem[],
    }))

    if (splitMode === 'equal') {
      const share = grandTotal / guestCount
      return guests.map((g, i) => ({
        ...g,
        total: i === guestCount - 1
          ? Math.round((grandTotal - share * (guestCount - 1)) * 100) / 100
          : Math.round(share * 100) / 100,
        items: activeItems,
      }))
    }

    for (const item of activeItems) {
      const gi = itemAssignments[item.id] ?? 0
      const idx = Math.min(Math.max(0, gi), guestCount - 1)
      guests[idx].items.push(item)
      guests[idx].total += item.quantity * item.unitPrice
    }

    const foodTotal = activeItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    return guests.map(g => ({
      ...g,
      total: foodTotal > 0
        ? Math.round((g.total / foodTotal) * grandTotal * 100) / 100
        : grandTotal / guestCount,
    }))
  }, [paymentMethod, order, guestCount, splitMode, itemAssignments, activeItems, grandTotal, t])

  const finalize = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine) {
        throw new Error(t('offline.bannerOffline') || 'Impossibile procedere con il pagamento offline. Controlla la connessione internet.')
      }

      const payload: Record<string, unknown> = {
        orderId,
        tipAmount: parsedTip,
        tipWaiterId: tipWaiterId || undefined,
        paymentMethod,
        splitSettlement: paymentMethod === 'SPLIT' ? splitSettlement : undefined,
        simulateEmail: receiptEmail || undefined,
        discountCode: discountCode.trim() || undefined,
      }

      if (paymentMethod === 'SPLIT') {
        payload.split = {
          mode: splitMode,
          guestCount,
          assignments: splitMode === 'by_items'
            ? activeItems.map(it => ({
              itemId: it.id,
              guestIndex: itemAssignments[it.id] ?? 0,
            }))
            : undefined,
        }
      }

      return api.post('/payments/finalize', payload).then(r => r.data)
    },
    onSuccess: (result: CheckoutFinalizeResult) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reports', 'fiscal') })
      setFinalizeResult(result)
      toast.success(t('checkout.paymentSuccess'))
    },
    onError: (err: any) => {
      console.error("FINALIZE ERROR:", err.response?.data || err.message)
      const serverMsg = err.response?.data?.error || err.message || t('checkout.paymentError')
      const details = err.response?.data?.details ? JSON.stringify(err.response?.data?.details) : ''
      toast.error(`${serverMsg} ${details}`)
    },
  })

  const assignItem = (itemId: string, guestIndex: number) => {
    setItemAssignments(prev => ({ ...prev, [itemId]: guestIndex }))
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (isError || !order || order.status === 'PAID') {
    return (
      <div className="mx-auto max-w-lg rounded-xl premium-card p-8 text-center shadow-sm">
        <p className="text-pietra font-medium">{t('checkout.notAvailable')}</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm text-aura-gold hover:underline">
          {t('checkout.back')}
        </button>
      </div>
    )
  }

  const taxLabel = fiscal.taxName

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg premium-card p-2 text-fumo hover:bg-white/[0.05]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-pietra">{t('checkout.title')}</h1>
            <p className="text-sm text-fumo">
              {t('checkout.orderRef', { ref: order.id.slice(-6).toUpperCase() })}
              {order.table ? ` · ${t('checkout.table', { number: order.table.number })}` : ''}
            </p>
          </div>
        </div>

        {posStatus?.mode === 'PENDING_SETUP' && paymentMethod === 'CARD' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {t('checkout.posPendingSetup')}
          </div>
        )}

        {posStatus?.usesExternalFiscalDevice && paymentMethod === 'CARD' && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
            {t('checkout.posExternalDevice', { provider: posStatus.providerLabel ?? t('checkout.posExternalGeneric') })}
          </div>
        )}

        {posSimulation && paymentMethod === 'CARD' && posStatus?.mode !== 'PENDING_SETUP' && !posStatus?.usesExternalFiscalDevice && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {t('checkout.posSimulationNotice')}
          </div>
        )}

        {orderId && order && (
          <CustomerPicker
            orderId={orderId}
            currentCustomer={order.customer ?? null}
            onLinked={() => { void refetch() }}
          />
        )}

        {(loyaltyDiscount || (order.discount ?? 0) > 0) && (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {loyaltyDiscount && (
              <p>{t('checkout.loyaltyDiscountHint', { pct: loyaltyDiscount.pct, tier: loyaltyDiscount.tierName ?? '' })}</p>
            )}
            {(order.discount ?? 0) > 0 && (
              <p className="font-semibold">{t('checkout.discountAppliedAmount', { amount: formatCurrency(order.discount!) })}</p>
            )}
          </section>
        )}

        {/* Codice promo */}
        <section className="rounded-xl premium-card p-5 shadow-sm">
          <label className="block text-sm font-medium text-pietra">
            {t('checkout.promoCode')}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={discountCode}
                onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                placeholder={t('checkout.promoCodePlaceholder')}
                className="saas-input flex-1 py-2.5 text-sm uppercase"
              />
              <button
                type="button"
                onClick={() => applyPromo.mutate(discountCode.trim())}
                disabled={!discountCode.trim() || applyPromo.isPending}
                className="rounded-xl bg-navy-surface px-4 py-2 text-sm font-semibold text-pietra hover:bg-white/[0.05] disabled:opacity-50"
              >
                {t('checkout.applyPromo')}
              </button>
            </div>
          </label>
        </section>

        {/* Riepilogo piatti */}
        <section className="rounded-xl premium-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-pietra">
            <Receipt className="h-5 w-5 text-amber-500" />
            {t('checkout.summary')}
          </h2>
          <div className="space-y-3">
            {activeItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-surface text-xs font-bold text-pietra">
                    {item.quantity}
                  </span>
                  <span className="truncate text-sm font-medium text-pietra">{item.menuItem.name}</span>
                  <span className="text-xs text-fumo">{item.status}</span>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-pietra">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
            <div className="flex justify-between text-fumo">
              <span>{t('checkout.subtotal')}</span>
              <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-fumo">
              <span>{taxLabel} ({order.taxRateApplied ?? fiscal.taxRate}%)</span>
              <span className="tabular-nums">{formatCurrency(order.tax)}</span>
            </div>
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>{t('checkout.discount')}</span>
                <span className="tabular-nums">-{formatCurrency(order.discount!)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-pietra">
              <span>{t('checkout.foodTotal')}</span>
              <span className="tabular-nums">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Mancia */}
        <section className="rounded-xl premium-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-pietra">{t('checkout.tip')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setWantsTip(false); setTipAmount('') }}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', !wantsTip ? 'bg-slate-900 text-white' : 'bg-navy-surface text-fumo')}
              >
                {t('checkout.tipNo')}
              </button>
              <button
                type="button"
                onClick={() => setWantsTip(true)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', wantsTip ? 'bg-slate-900 text-white' : 'bg-navy-surface text-fumo')}
              >
                {t('checkout.tipYes')}
              </button>
            </div>
          </div>
          {wantsTip && (
            <div className="mt-4 flex gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={tipAmount}
                onChange={e => setTipAmount(e.target.value)}
                placeholder="0.00"
                className="saas-input w-full py-3 text-center text-sm text-pietra"
              />
              <select
                value={tipWaiterId}
                onChange={e => setTipWaiterId(e.target.value)}
                className="saas-input w-full py-3 text-sm text-pietra appearance-none bg-navy-mid focus:border-aura-gold focus:ring-1 focus:ring-aura-gold"
              >
                <option value="">Assegna cameriere</option>
                {staff?.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          )}
          <p className="mt-4 text-xs text-fumo">{tRegime(t, fiscal.taxRegion, 'tipExemptNote')}</p>
        </section>

        {/* Metodo pagamento */}
        <section className="rounded-xl premium-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-pietra">{t('checkout.paymentMethod')}</h2>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'CARD' as const, icon: CreditCard, label: t('checkout.card') },
              { key: 'CASH' as const, icon: Banknote, label: t('checkout.cash') },
              { key: 'SPLIT' as const, icon: Users, label: t('checkout.split') },
            ]).map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPaymentMethod(opt.key)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-colors',
                    paymentMethod === opt.key
                      ? 'border-amber-500 bg-aura-gold/10 text-amber-800'
                      : 'border-white/[0.08] bg-navy-surface text-fumo hover:bg-white/[0.05]',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {opt.label}
                </button>
              )
            })}
          </div>

          {paymentMethod === 'SPLIT' && (
            <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={cn('flex-1 rounded-lg py-2 text-xs font-semibold', splitMode === 'equal' ? 'bg-slate-900 text-white' : 'bg-navy-surface')}
                >
                  {t('checkout.splitEqual')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('by_items')}
                  className={cn('flex-1 rounded-lg py-2 text-xs font-semibold', splitMode === 'by_items' ? 'bg-slate-900 text-white' : 'bg-navy-surface')}
                >
                  {t('checkout.splitByItems')}
                </button>
              </div>

              <label className="block text-sm text-fumo">
                {t('checkout.guestCount')}
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={guestCount}
                  onChange={e => setGuestCount(Math.max(2, parseInt(e.target.value, 10) || 2))}
                  className="saas-input mt-1 w-full py-2 text-sm"
                />
              </label>

              {splitMode === 'by_items' && (
                <div className="space-y-2">
                  {activeItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-navy-surface/50 px-3 py-2">
                      <span className="truncate text-sm text-pietra">{item.menuItem.name}</span>
                      <select
                        value={itemAssignments[item.id] ?? 0}
                        onChange={e => assignItem(item.id, parseInt(e.target.value, 10))}
                        className="rounded-lg premium-card px-2 py-1 text-xs"
                      >
                        {Array.from({ length: guestCount }, (_, i) => (
                          <option key={i} value={i}>{t('checkout.guest', { n: i + 1 })}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-fumo">{t('checkout.splitPreview')}</p>
                <div className="space-y-2">
                  {splitPreview?.map(g => (
                    <div key={g.index} className="flex justify-between rounded-lg border border-white/[0.08] px-3 py-2 text-sm">
                      <span className="font-medium text-pietra">{g.label}</span>
                      <span className="tabular-nums text-pietra">{formatCurrency(g.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-fumo">{t('checkout.splitSettlementHint')}</p>
                <div className="flex gap-2">
                  {(['CARD', 'CASH'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSplitSettlement(m)}
                      className={cn('flex-1 rounded-lg py-2 text-xs font-semibold', splitSettlement === m ? 'bg-slate-900 text-white' : 'bg-navy-surface')}
                    >
                      {m === 'CARD' ? t('checkout.card') : t('checkout.cash')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Email ricevuta (simulata) */}
        <section className="rounded-xl premium-card p-5 shadow-sm">
          <label className="block text-sm font-medium text-pietra">
            {t('checkout.receiptEmail')}
            <input
              type="email"
              value={receiptEmail}
              onChange={e => setReceiptEmail(e.target.value)}
              placeholder={t('checkout.receiptEmailPlaceholder')}
              className="saas-input mt-2 w-full py-2.5 text-sm"
            />
          </label>
        </section>

        {/* Totale e finalizza */}
        <div className="rounded-xl premium-card p-5 shadow-sm">
          <div className="mb-4 flex items-end justify-between">
            <span className="text-lg font-bold text-pietra">{t('checkout.grandTotal')}</span>
            <span className="text-2xl font-black tabular-nums text-pietra">{formatCurrency(grandTotal)}</span>
          </div>
          <button
            type="button"
            onClick={() => finalize.mutate()}
            disabled={finalize.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-aura-gold py-4 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:opacity-60"
          >
            {finalize.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {t('checkout.finalize')}
          </button>
        </div>
      </div>

      {finalizeResult && (
        <ReceiptPreviewModal
          result={finalizeResult}
          restaurantName={restaurant?.name ?? data?.restaurant.name ?? ''}
          taxLabel={taxLabel}
          onClose={() => {
            setFinalizeResult(null)
            navigate('/tavoli')
          }}
          onPrint={() => {
            if (!finalizeResult.order) return
            printReceipt(finalizeResult.order, restaurant?.name ?? '', {
              taxLabel,
              tipLabel: tRegime(t, fiscal.taxRegion, 'cards.tips.label'),
            })
            toast.success(t('checkout.printSimulated'))
          }}
          onEmail={() => toast.success(t('checkout.emailSimulated'))}
        />
      )}
    </>
  )
}
