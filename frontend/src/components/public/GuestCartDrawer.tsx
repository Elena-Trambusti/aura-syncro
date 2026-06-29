import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  X, Minus, Plus, Trash2, CreditCard, UtensilsCrossed, Loader2, CheckCircle2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { computeGuestOrderTax } from '../../lib/guestOrderTax'
import { resolvePublicOrderErrorMessage } from '../../lib/publicOrderErrors'
import type { GuestCartItem } from '../../hooks/useGuestCart'

interface FiscalInfo {
  taxRate: number
  taxName: string
}

interface GuestCartDrawerProps {
  open: boolean
  onClose: () => void
  slug: string
  restaurantName: string
  stripeEnabled: boolean
  fiscal: FiscalInfo
  tableNumber: number | null
  items: GuestCartItem[]
  subtotal: number
  onSetQuantity: (cartLineId: string, quantity: number) => void
  onRemoveItem: (cartLineId: string) => void
  onClearCart: () => void
}

type OrderType = 'DINE_IN' | 'TAKEAWAY'

export default function GuestCartDrawer({
  open,
  onClose,
  slug,
  restaurantName,
  stripeEnabled,
  fiscal,
  tableNumber,
  items,
  subtotal,
  onSetQuantity,
  onRemoveItem,
  onClearCart,
}: GuestCartDrawerProps) {
  const { t } = useTranslation()
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN')
  const [tableInput, setTableInput] = useState(tableNumber?.toString() ?? '')
  const [notes, setNotes] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [tipInput, setTipInput] = useState('')
  const [loading, setLoading] = useState<'card' | 'table' | null>(null)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [clientRequestId] = useState(() => (
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
  ))

  const { subtotal: taxableBase, tax, total } = computeGuestOrderTax(subtotal, fiscal.taxRate)

  if (!open) return null

  const parsedTable = tableInput.trim() ? Number.parseInt(tableInput, 10) : undefined
  const effectiveTable = orderType === 'DINE_IN' && parsedTable && parsedTable > 0
    ? parsedTable
    : undefined

  const payloadItems = items.map(i => ({
    menuItemId: i.menuItemId,
    quantity: i.quantity,
    notes: i.notes,
    modifiers: i.modifierIds.length ? i.modifierIds : undefined,
  }))

  const parsedTip = Math.max(0, Number.parseFloat(tipInput.replace(',', '.')) || 0)
  const grandTotal = total + parsedTip

  const basePayload = {
    slug,
    type: orderType,
    tableNumber: effectiveTable,
    notes: notes.trim() || undefined,
    items: payloadItems,
    clientRequestId,
    tipAmount: stripeEnabled && parsedTip > 0 ? parsedTip : undefined,
  }

  async function handlePayWithCard() {
    if (items.length === 0) return
    setLoading('card')
    try {
      const res = await api.post('/public/checkout', {
        ...basePayload,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
      }, { headers: { 'X-Idempotency-Key': clientRequestId } })
      window.location.href = res.data.checkoutUrl
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
      toast.error(resolvePublicOrderErrorMessage(t, data))
      setLoading(null)
    }
  }

  async function handleOrderAtTable() {
    if (items.length === 0) return
    setLoading('table')
    try {
      await api.post('/public/orders', basePayload, { headers: { 'X-Idempotency-Key': clientRequestId } })
      setOrderSuccess(true)
      onClearCart()
      toast.success(t('publicMenu.orderSuccess'))
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
      toast.error(resolvePublicOrderErrorMessage(t, data))
    } finally {
      setLoading(null)
    }
  }

  function handleClose() {
    setOrderSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t('common.close')}
        onClick={handleClose}
      />

      <div className="relative mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/[0.08] bg-navy-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-pietra">{t('publicMenu.cart')}</h2>
            <p className="text-xs text-fumo">{restaurantName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-fumo hover:bg-white/5 hover:text-pietra"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {orderSuccess ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" />
            <h3 className="text-xl font-bold text-pietra">{t('publicMenu.orderSuccess')}</h3>
            <p className="mt-2 text-sm text-fumo">{t('publicMenu.orderSuccessHint')}</p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-8 w-full rounded-xl bg-aura-gold py-3.5 text-sm font-semibold text-navy hover:bg-aura-gold-light"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-fumo">{t('publicMenu.cartEmpty')}</p>
              ) : (
                <ul className="space-y-3">
                  {items.map(item => (
                    <li
                      key={item.cartLineId}
                      className="flex gap-3 rounded-xl border border-white/[0.08] bg-navy-surface/80 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-pietra">{item.name}</p>
                        {item.modifierLabels.length > 0 && (
                          <p className="text-xs text-fumo">{item.modifierLabels.join(' · ')}</p>
                        )}
                        <p className="text-sm tabular-nums text-fumo">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSetQuantity(item.cartLineId, item.quantity - 1)}
                          className="rounded-lg border border-white/[0.08] bg-navy-mid p-1.5 text-fumo hover:bg-white/5"
                          aria-label={t('publicMenu.decreaseQty')}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums text-pietra">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onSetQuantity(item.cartLineId, item.quantity + 1)}
                          className="rounded-lg border border-white/[0.08] bg-navy-mid p-1.5 text-fumo hover:bg-white/5"
                          aria-label={t('publicMenu.increaseQty')}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartLineId)}
                          className="ml-1 rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
                          aria-label={t('publicMenu.remove')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {items.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex gap-2">
                    {(['DINE_IN', 'TAKEAWAY'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                          orderType === type
                            ? 'border-aura-gold bg-aura-gold/10 text-aura-gold'
                            : 'border-white/[0.08] text-fumo hover:bg-white/5'
                        }`}
                      >
                        {type === 'DINE_IN'
                          ? t('publicMenu.orderTypeDineIn')
                          : t('publicMenu.orderTypeTakeaway')}
                      </button>
                    ))}
                  </div>

                  {orderType === 'DINE_IN' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fumo">
                        {t('publicMenu.tableNumber')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={tableInput}
                        onChange={e => setTableInput(e.target.value)}
                        placeholder={t('publicMenu.tableNumberPlaceholder')}
                        className="w-full rounded-xl border border-white/[0.08] bg-navy-surface px-4 py-2.5 text-sm text-pietra placeholder:text-fumo/60 focus:border-aura-gold focus:outline-none focus:ring-2 focus:ring-aura-gold/20"
                      />
                      <p className="mt-1 text-xs text-fumo/70">{t('publicMenu.tableNumberHint')}</p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fumo">
                      {t('publicMenu.orderNotes')}
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder={t('publicMenu.orderNotesPlaceholder')}
                      className="w-full resize-none rounded-xl border border-white/[0.08] bg-navy-surface px-4 py-2.5 text-sm text-pietra placeholder:text-fumo/60 focus:border-aura-gold focus:outline-none focus:ring-2 focus:ring-aura-gold/20"
                    />
                  </div>

                  {stripeEnabled && (
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-navy-surface/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-fumo">
                        {t('publicMenu.paymentDetails')}
                      </p>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder={t('publicMenu.customerName')}
                        className="w-full rounded-xl border border-white/[0.08] bg-navy-mid px-4 py-2.5 text-sm text-pietra placeholder:text-fumo/60 focus:border-aura-gold focus:outline-none focus:ring-2 focus:ring-aura-gold/20"
                      />
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={e => setCustomerEmail(e.target.value)}
                        placeholder={t('publicMenu.customerEmail')}
                        className="w-full rounded-xl border border-white/[0.08] bg-navy-mid px-4 py-2.5 text-sm text-pietra placeholder:text-fumo/60 focus:border-aura-gold focus:outline-none focus:ring-2 focus:ring-aura-gold/20"
                      />
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fumo">
                          {t('publicMenu.tipOptional')}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tipInput}
                          onChange={e => setTipInput(e.target.value)}
                          placeholder={t('publicMenu.tipPlaceholder')}
                          className="w-full rounded-xl border border-white/[0.08] bg-navy-mid px-4 py-2.5 text-sm text-pietra placeholder:text-fumo/60 focus:border-aura-gold focus:outline-none focus:ring-2 focus:ring-aura-gold/20"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-white/[0.08] px-5 py-4">
                <div className="mb-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-fumo">
                    <span>{t('publicMenu.taxableBase')}</span>
                    <span className="tabular-nums text-pietra">{formatCurrency(taxableBase)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-fumo">
                      <span>{fiscal.taxName} ({fiscal.taxRate}%)</span>
                      <span className="tabular-nums text-pietra">{formatCurrency(tax)}</span>
                    </div>
                  )}
                  {parsedTip > 0 && (
                    <div className="flex justify-between text-fumo">
                      <span>{t('checkout.tip')}</span>
                      <span className="tabular-nums text-pietra">{formatCurrency(parsedTip)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-pietra">
                    <span>{t('publicMenu.total')}</span>
                    <span className="tabular-nums text-aura-gold">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {stripeEnabled ? (
                    <button
                      type="button"
                      disabled={loading !== null}
                      onClick={() => void handlePayWithCard()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-aura-gold py-3.5 text-sm font-semibold text-navy hover:bg-aura-gold-light disabled:opacity-60"
                    >
                      {loading === 'card'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CreditCard className="h-4 w-4" />}
                      {t('publicMenu.payWithCard')}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-fumo">{t('publicMenu.stripeUnavailable')}</p>
                  )}

                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => void handleOrderAtTable()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/[0.12] py-3.5 text-sm font-semibold text-pietra hover:bg-white/5 disabled:opacity-60"
                  >
                    {loading === 'table'
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <UtensilsCrossed className="h-4 w-4" />}
                    {t('publicMenu.orderAtTable')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
