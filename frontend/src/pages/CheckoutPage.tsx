import { useMemo, useState, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatCurrency, cn, ORDER_STATUS_LABELS } from '../lib/utils'
import { addMoney, lineGrossMoney, moneyNumber } from '../lib/money'
import { useAuth, useFiscalRegime, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { tRegime } from '../lib/fiscalRegime'
import { printReceipt } from '../lib/export'
import ReceiptPreviewModal, { type CheckoutFinalizeResult } from '../components/checkout/ReceiptPreviewModal'
import CustomerPicker from '../components/checkout/CustomerPicker'
import TipWaiterPicker from '../components/checkout/TipWaiterPicker'
import { useRole } from '../hooks/useRole'
import {
  ArrowLeft, CreditCard, Banknote, Users, Loader2, Receipt, RotateCcw,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  isPaymentAlreadyPaid,
  isPaymentInProgress,
  resolvePaymentErrorMessage,
} from '../lib/paymentErrors'
import { isRetryableNetworkError, submitFinalizeOrderCash } from '../lib/offlineSync'
import { resolveToastApiError } from '../lib/formatApiError'
import {
  markTableCleaningAfterPayment,
  patchTableInQueryCache,
  type CachedTableRow,
  type TableStatus,
} from '../lib/tableQueryCache'
import {
  isSplitGuestPaid,
  nextUnpaidSplitGuest,
  splitProgressLabel,
} from '../lib/splitCheckout'

type PaymentMethod = 'CARD' | 'CASH' | 'SPLIT'
type SplitMode = 'equal' | 'by_items'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  status: string
  menuItem: { name: string }
  modifiers?: Array<{ price: number }>
}

function lineGross(item: OrderItem): number {
  return lineGrossMoney(item.quantity, item.unitPrice)
}

type PayingTarget = 'main' | number

type CheckoutPagePosStatus = {
  mode: string
  usesExternalFiscalDevice?: boolean
  isCardChargeSimulated?: boolean
}

function shouldReleaseTableOnFinalize(
  splitUsesIncrementalCash: boolean,
  splitGuestIndex?: number,
): boolean {
  return !(splitUsesIncrementalCash && splitGuestIndex != null)
}

function usesCardSettlement(method: PaymentMethod, splitSettlement: 'CARD' | 'CASH'): boolean {
  return method === 'CARD' || (method === 'SPLIT' && splitSettlement === 'CARD')
}

function requiresBlockingExternalValidation(
  method: PaymentMethod,
  splitSettlement: 'CARD' | 'CASH',
  posStatus: CheckoutPagePosStatus | undefined,
): boolean {
  if (!usesCardSettlement(method, splitSettlement) || !posStatus) return false
  // Solo flussi che richiedono un terminale reale — simulazione/PENDING_SETUP sono istantanei lato UI
  return posStatus.mode === 'EXTERNAL' || posStatus.mode === 'STRIPE_TERMINAL'
}

interface CheckoutOrder {
  id: string
  status: string
  subtotal: number
  tax: number
  total: number
  discount?: number
  taxRateApplied?: number | null
  paymentMethod?: string | null
  stripePaymentIntent?: string | null
  refundedAt?: string | null
  collectedAmount?: number
  splitPaidGuestIndexes?: number[]
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
  const { can } = useRole()
  const canPay = can('orders.pay')

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
  /** Feedback UI istantaneo (0ms) — prima che React Query aggiorni isPending */
  const [payingTarget, setPayingTarget] = useState<PayingTarget | null>(null)
  const optimisticReceiptRef = useRef<CheckoutFinalizeResult | null>(null)

  const isPaymentBusy = payingTarget !== null

  const finalizeIdempotencyKey = useMemo(
    () => (orderId ? `checkout-finalize:${orderId}` : ''),
    [orderId],
  )

  const { data: cashSession } = useQuery<{ id: string; status: string } | null>({
    queryKey: tq(tk, 'cash', 'current'),
    queryFn: () => api.get('/cash/session/current').then(r => r.data),
    enabled: Boolean(orderId) && canPay,
  })

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
    staleTime: 60_000,
  })

  const { data: staff } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: tq(tk, 'staff', 'tip-recipients'),
    queryFn: () => api.get('/staff/tip-recipients').then(r => r.data),
  })

  const order = data?.order
  const needsCashSession = (paymentMethod === 'CASH' || (paymentMethod === 'SPLIT' && splitSettlement === 'CASH'))
    && cashSession === null
  const parsedTip = wantsTip ? Math.max(0, moneyNumber(tipAmount.replace(',', '.'))) : 0
  const orderTotal = moneyNumber(order?.total)
  const grandTotal = addMoney(orderTotal, parsedTip)
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
    onError: (err: unknown) => toast.error(resolveToastApiError(t, err, 'checkout.discountInvalid')),
  })

  const refundOrder = useMutation({
    mutationFn: () => api.post(`/payments/orders/${orderId}/refund`),
    onSuccess: () => {
      void refetch()
      queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'customers') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'analytics') })
      toast.success(t('checkout.refundSuccess'))
    },
    onError: (err: { response?: { data?: { error?: string; code?: string } } }) => {
      toast.error(resolvePaymentErrorMessage(t, err.response?.data))
    },
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
      guests[idx].total += lineGross(item)
    }

    const foodTotal = activeItems.reduce((s, it) => s + lineGross(it), 0)
    return guests.map(g => ({
      ...g,
      total: foodTotal > 0
        ? Math.round((g.total / foodTotal) * grandTotal * 100) / 100
        : grandTotal / guestCount,
    }))
  }, [paymentMethod, order, guestCount, splitMode, itemAssignments, activeItems, grandTotal, t])

  const splitProgress = useMemo(() => {
    if (!order || paymentMethod !== 'SPLIT') return null
    return splitProgressLabel(moneyNumber(order.collectedAmount), grandTotal)
  }, [order, paymentMethod, grandTotal])

  const splitUsesIncrementalCash = paymentMethod === 'SPLIT' && splitSettlement === 'CASH'
  const unpaidSplitGuest = paymentMethod === 'SPLIT'
    ? nextUnpaidSplitGuest(guestCount, order?.splitPaidGuestIndexes)
    : null
  const showMainFinalize = canPay && (paymentMethod !== 'SPLIT' || !splitUsesIncrementalCash)

  const buildFinalizePayload = (splitGuestIndex?: number) => {
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
      if (splitGuestIndex != null) {
        payload.splitGuestIndex = splitGuestIndex
      }
    }
    return payload
  }

  const buildOptimisticFinalizeResult = useCallback((): CheckoutFinalizeResult => {
    if (!order) {
      return { fiscal: { row: null } }
    }
    const settledMethod =
      paymentMethod === 'CASH'
        ? 'CASH'
        : paymentMethod === 'CARD'
          ? 'CARD'
          : splitSettlement

    return {
      transactionId: '',
      order: {
        id: order.id,
        subtotal: moneyNumber(order.subtotal),
        tax: moneyNumber(order.tax),
        total: grandTotal,
        revenueAmount: orderTotal,
        tipAmount: parsedTip,
        paymentMethod: settledMethod,
        table: order.table ?? undefined,
        type: order.type,
        createdAt: order.createdAt,
        items: activeItems.map(it => ({
          menuItem: { name: it.menuItem.name },
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      },
      fiscal: {
        row: {
          baseImponible: moneyNumber(order.subtotal),
          tax: moneyNumber(order.tax),
          revenueAmount: orderTotal,
          tipAmount: parsedTip,
          total: grandTotal,
          paymentMethod: settledMethod,
        },
      },
      receipt: { emailSent: false, emailTo: receiptEmail.trim() || null },
      splitBreakdown: paymentMethod === 'SPLIT' && splitPreview
        ? { guests: splitPreview.map(g => ({ label: g.label, share: g.total })) }
        : undefined,
    }
  }, [
    order,
    paymentMethod,
    splitSettlement,
    grandTotal,
    orderTotal,
    parsedTip,
    receiptEmail,
    activeItems,
    splitPreview,
  ])

  const canOptimisticallyComplete = useCallback(
    (splitGuestIndex?: number) => {
      if (splitUsesIncrementalCash && splitGuestIndex != null) return false
      if (requiresBlockingExternalValidation(paymentMethod, splitSettlement, posStatus)) return false
      return true
    },
    [paymentMethod, splitSettlement, posStatus, splitUsesIncrementalCash],
  )

  const finalize = useMutation({
    mutationFn: async (splitGuestIndex?: number) => {
      const payload = buildFinalizePayload(splitGuestIndex)
      const idempotencySuffix = splitGuestIndex != null ? `:split:${splitGuestIndex}` : ''
      const headers = finalizeIdempotencyKey
        ? { 'X-Idempotency-Key': `${finalizeIdempotencyKey}${idempotencySuffix}` }
        : undefined
      const maxAttempts = 2
      let lastErr: unknown
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await api.post('/payments/finalize', payload, { timeout: 20000, headers }).then(r => r.data)
        } catch (err: unknown) {
          lastErr = err
          const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
          if (isPaymentInProgress(data) && attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 400))
            continue
          }

          // Offline queue: supporta solo incasso contanti intero (no split).
          if (
            splitGuestIndex == null
            && payload?.paymentMethod === 'CASH'
            && isRetryableNetworkError(err)
            && typeof orderId === 'string'
          ) {
            const queuedResult = await submitFinalizeOrderCash({
              orderId,
              paymentMethod: 'CASH',
              tipAmount: payload.tipAmount ?? 0,
            })
            return { offlineQueued: true, queuedResult }
          }

          throw err
        }
      }
      throw lastErr
    },
    onMutate: (splitGuestIndex) => {
      let previousTables: CachedTableRow[] | undefined
      if (orderId && shouldReleaseTableOnFinalize(splitUsesIncrementalCash, splitGuestIndex)) {
        previousTables = markTableCleaningAfterPayment(queryClient, tk, orderId)
      }

      if (!canOptimisticallyComplete(splitGuestIndex)) {
        return { optimistic: false as const, previousTables }
      }
      return {
        optimistic: true as const,
        previousReceipt: optimisticReceiptRef.current ?? finalizeResult,
        previousTables,
      }
    },
    onSuccess: (result: (CheckoutFinalizeResult & { partial?: boolean; remaining?: number; table?: { id: string; number: number; status: string } | null }) | { offlineQueued: true; queuedResult: 'synced' | 'queued' }, _splitGuestIndex, context) => {
      if ('offlineQueued' in result && result.offlineQueued) {
        if (context?.optimistic) {
          setFinalizeResult(context.previousReceipt ?? null)
          optimisticReceiptRef.current = null
        }
        toast.success(t('offline.queued', { defaultValue: 'Operazione salvata: verrà sincronizzata appena torna la connessione.' }))
        return
      }
      if (!result.partial && orderId) {
        if (result.table?.id && result.table.status) {
          patchTableInQueryCache(queryClient, tk, {
            id: result.table.id,
            status: result.table.status as TableStatus,
            number: result.table.number,
            orders: [],
          })
        } else if (shouldReleaseTableOnFinalize(splitUsesIncrementalCash, _splitGuestIndex)) {
          markTableCleaningAfterPayment(queryClient, tk, orderId)
        }
      } else if (result.partial) {
        void queryClient.invalidateQueries({ queryKey: tq(tk, 'tables'), refetchType: 'active' })
      }

      void queryClient.invalidateQueries({ queryKey: tq(tk, 'orders'), refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reports', 'fiscal') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'checkout', orderId) })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'cash', 'current') })

      if (result.partial) {
        if (context?.optimistic) {
          setFinalizeResult(context.previousReceipt ?? null)
          optimisticReceiptRef.current = null
        }
        void refetch()
        toast.success(t('checkout.splitPartialSuccess', { remaining: formatCurrency(result.remaining ?? 0) }))
        return
      }

      setFinalizeResult(result)
      optimisticReceiptRef.current = null
      toast.success(
        (result as CheckoutFinalizeResult & { alreadyPaid?: boolean }).alreadyPaid
          ? t('checkout.alreadyPaid', { defaultValue: 'Pagamento già registrato' })
          : t('checkout.paymentSuccess'),
      )
    },
    onError: async (err: { response?: { data?: { error?: string; code?: string } }; message?: string }, _splitGuestIndex, context) => {
      if (context?.previousTables) {
        queryClient.setQueryData(tq(tk, 'tables'), context.previousTables)
      }
      if (context?.optimistic) {
        setFinalizeResult(context.previousReceipt ?? null)
        optimisticReceiptRef.current = null
      }

      const payload = err.response?.data
      if (isPaymentAlreadyPaid(payload)) {
        try {
          const checkout = await api.get(`/payments/checkout/${orderId}`).then(r => r.data)
          if (checkout.order?.status === 'PAID') {
            const paidOrder = checkout.order
            setFinalizeResult({
              order: paidOrder,
              transactionId: '',
              fiscal: {
                row: {
                  baseImponible: paidOrder.subtotal ?? 0,
                  tax: paidOrder.tax ?? 0,
                  revenueAmount: paidOrder.revenueAmount ?? paidOrder.total,
                  tipAmount: paidOrder.tipAmount ?? 0,
                  total: paidOrder.total,
                  paymentMethod: paidOrder.paymentMethod,
                },
              },
              receipt: { emailSent: false, emailTo: null },
            })
            toast.success(t('checkout.alreadyPaid', { defaultValue: 'Pagamento già registrato' }))
            return
          }
        } catch {
          /* fallback to generic error */
        }
      }
      console.error('FINALIZE ERROR:', err.response?.data || err.message)
      toast.error(resolvePaymentErrorMessage(t, payload))
    },
    onSettled: () => {
      setPayingTarget(null)
    },
  })

  const handleFinalizePayment = useCallback(
    (splitGuestIndex?: number) => {
      if (isPaymentBusy || needsCashSession || !orderId) return
      if (!navigator.onLine && paymentMethod !== 'CASH') {
        toast.error(t('offline.bannerOffline') || 'Impossibile procedere con il pagamento offline. Controlla la connessione internet.')
        return
      }

      const optimistic = canOptimisticallyComplete(splitGuestIndex)

      flushSync(() => {
        setPayingTarget(splitGuestIndex ?? 'main')
        if (optimistic) {
          const nextReceipt = buildOptimisticFinalizeResult()
          optimisticReceiptRef.current = nextReceipt
          setFinalizeResult(nextReceipt)
        }
      })

      void queryClient.cancelQueries({ queryKey: tq(tk, 'checkout', orderId) })
      finalize.mutate(splitGuestIndex)
    },
    [
      buildOptimisticFinalizeResult,
      canOptimisticallyComplete,
      finalize,
      isPaymentBusy,
      needsCashSession,
      orderId,
      queryClient,
      t,
      tk,
    ],
  )

  const assignItem = (itemId: string, guestIndex: number) => {
    setItemAssignments(prev => ({ ...prev, [itemId]: guestIndex }))
  }

  const taxLabel = tRegime(t, fiscal.taxRegion, 'table.tax')

  const receiptModal = finalizeResult ? (
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
  ) : null

  // Keep receipt visible after refetch marks the order PAID
  if (finalizeResult) {
    return receiptModal
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-lg rounded-xl premium-card p-8 text-center shadow-sm">
        <p className="text-pietra font-medium">{t('checkout.notAvailable')}</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm text-aura-gold hover:underline">
          {t('checkout.back')}
        </button>
      </div>
    )
  }

  if (order.status === 'PAID') {
    const isRefunded = Boolean(order.refundedAt)
    const isCash = order.paymentMethod === 'CASH'
    const isDigital = order.paymentMethod === 'STRIPE' || order.paymentMethod === 'CARD' || order.paymentMethod === 'DIGITAL'
    const canRefund = canPay && !isRefunded && (
      (isCash && cashSession?.status === 'OPEN')
      || (isDigital && Boolean(order.stripePaymentIntent))
    )
    const refundLabel = isCash ? t('checkout.refundCash') : t('checkout.refundCard')
    const refundConfirmKey = isCash ? 'checkout.refundConfirmCash' : 'checkout.refundConfirmCard'

    return (
      <div className="mx-auto max-w-lg rounded-xl premium-card p-8 text-center shadow-sm space-y-4">
        <p className="text-pietra font-medium">
          {isRefunded ? t('checkout.alreadyRefunded') : t('checkout.alreadyPaid')}
        </p>
        {canRefund && (
          <button
            type="button"
            onClick={() => {
              void (async () => {
                const confirmed = await toast.confirm({
                  title: t('checkout.refundTitle', { defaultValue: 'Conferma rimborso' }),
                  description: t(refundConfirmKey),
                  confirmLabel: refundLabel,
                  cancelLabel: t('common.cancel'),
                  variant: 'danger',
                })
                if (!confirmed) return
                refundOrder.mutate()
              })()
            }}
            disabled={refundOrder.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {refundOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {refundLabel}
          </button>
        )}
        <button type="button" onClick={() => navigate('/tavoli')} className="block mx-auto text-sm text-aura-gold hover:underline">
          {t('nav.tables')}
        </button>
      </div>
    )
  }

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
                  <span className="text-xs text-fumo">{ORDER_STATUS_LABELS[item.status] ?? item.status}</span>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-pietra">
                  {formatCurrency(lineGrossMoney(item.quantity, item.unitPrice))}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
            <div className="flex justify-between text-fumo">
              <span>{t('checkout.subtotal')}</span>
              <span className="tabular-nums">{formatCurrency(moneyNumber(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-fumo">
              <span>{taxLabel} ({order.taxRateApplied ?? fiscal.taxRate}%)</span>
              <span className="tabular-nums">{formatCurrency(moneyNumber(order.tax))}</span>
            </div>
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>{t('checkout.discount')}</span>
                <span className="tabular-nums">-{formatCurrency(order.discount!)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-pietra">
              <span>{t('checkout.foodTotal')}</span>
              <span className="tabular-nums">{formatCurrency(orderTotal)}</span>
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
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={tipAmount}
                onChange={e => setTipAmount(e.target.value)}
                placeholder={t('checkout.tipPlaceholder', { defaultValue: '0.00' })}
                className="saas-input w-full py-3 text-center text-sm text-pietra"
              />
              <TipWaiterPicker
                staff={staff ?? []}
                value={tipWaiterId}
                onChange={setTipWaiterId}
              />
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

          {needsCashSession && (
            <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              <p>{t('checkout.cashSessionRequired')}</p>
              <Link to="/cassa" className="mt-2 inline-block font-semibold text-amber-800 underline">
                {t('checkout.cashSessionLink')}
              </Link>
            </div>
          )}

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
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-navy-surface/50 px-3 py-2">
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
                {splitProgress && splitProgress.collected > 0 && (
                  <p className="mb-2 text-xs text-emerald-700">
                    {t('checkout.splitProgress', {
                      collected: formatCurrency(splitProgress.collected),
                      remaining: formatCurrency(splitProgress.remaining),
                    })}
                  </p>
                )}
                <div className="space-y-2">
                  {splitPreview?.map(g => {
                    const paid = isSplitGuestPaid(g.index, order.splitPaidGuestIndexes)
                    return (
                      <div
                        key={g.index}
                        className={cn(
                          'flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between',
                          paid ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/[0.08]',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-pietra">{g.label}</span>
                          {paid && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              {t('checkout.splitGuestPaid')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-pietra">{formatCurrency(g.total)}</span>
                          {splitUsesIncrementalCash && canPay && !paid && !needsCashSession && (
                            <button
                              type="button"
                              onClick={() => handleFinalizePayment(g.index)}
                              disabled={isPaymentBusy || needsCashSession}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none"
                            >
                              {payingTarget === g.index ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                t('checkout.splitPayGuest')
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
          {splitUsesIncrementalCash && unpaidSplitGuest != null && (
            <p className="mb-3 text-sm text-fumo">{t('checkout.splitIncrementalHint')}</p>
          )}
          {showMainFinalize && (
            <button
              type="button"
              onClick={() => handleFinalizePayment()}
              disabled={isPaymentBusy || needsCashSession}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-aura-gold py-4 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:opacity-60 disabled:pointer-events-none"
            >
              {payingTarget === 'main' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {paymentMethod === 'SPLIT' ? t('checkout.splitFinalizeAll') : t('checkout.finalize')}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
