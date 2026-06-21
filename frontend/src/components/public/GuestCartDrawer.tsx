import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  X, Minus, Plus, Trash2, CreditCard, UtensilsCrossed, Loader2, CheckCircle2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { computeGuestOrderTax } from '../../lib/guestOrderTax'
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
  onSetQuantity: (menuItemId: string, quantity: number) => void
  onRemoveItem: (menuItemId: string) => void
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
  const [loading, setLoading] = useState<'card' | 'table' | null>(null)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const { tax, total } = computeGuestOrderTax(subtotal, fiscal.taxRate)

  if (!open) return null

  const parsedTable = tableInput.trim() ? Number.parseInt(tableInput, 10) : undefined
  const effectiveTable = orderType === 'DINE_IN' && parsedTable && parsedTable > 0
    ? parsedTable
    : undefined

  const payloadItems = items.map(i => ({
    menuItemId: i.menuItemId,
    quantity: i.quantity,
    notes: i.notes,
  }))

  const basePayload = {
    slug,
    type: orderType,
    tableNumber: effectiveTable,
    notes: notes.trim() || undefined,
    items: payloadItems,
  }

  async function handlePayWithCard() {
    if (items.length === 0) return
    setLoading('card')
    try {
      const res = await api.post('/public/checkout', {
        ...basePayload,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
      })
      window.location.href = res.data.checkoutUrl
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? t('publicMenu.checkoutError'))
      setLoading(null)
    }
  }

  async function handleOrderAtTable() {
    if (items.length === 0) return
    setLoading('table')
    try {
      await api.post('/public/orders', basePayload)
      setOrderSuccess(true)
      onClearCart()
      toast.success(t('publicMenu.orderSuccess'))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? t('publicMenu.checkoutError'))
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

      <div className="relative mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('publicMenu.cart')}</h2>
            <p className="text-xs text-slate-500">{restaurantName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {orderSuccess ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" />
            <h3 className="text-xl font-bold text-slate-900">{t('publicMenu.orderSuccess')}</h3>
            <p className="mt-2 text-sm text-slate-500">{t('publicMenu.orderSuccessHint')}</p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-8 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('publicMenu.cartEmpty')}</p>
              ) : (
                <ul className="space-y-3">
                  {items.map(item => (
                    <li
                      key={item.menuItemId}
                      className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-sm tabular-nums text-slate-500">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSetQuantity(item.menuItemId, item.quantity - 1)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                          aria-label={t('publicMenu.decreaseQty')}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onSetQuantity(item.menuItemId, item.quantity + 1)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                          aria-label={t('publicMenu.increaseQty')}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.menuItemId)}
                          className="ml-1 rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
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
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
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
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('publicMenu.tableNumber')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={tableInput}
                        onChange={e => setTableInput(e.target.value)}
                        placeholder={t('publicMenu.tableNumberPlaceholder')}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <p className="mt-1 text-xs text-slate-400">{t('publicMenu.tableNumberHint')}</p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('publicMenu.orderNotes')}
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder={t('publicMenu.orderNotesPlaceholder')}
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {stripeEnabled && (
                    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('publicMenu.paymentDetails')}
                      </p>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder={t('publicMenu.customerName')}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={e => setCustomerEmail(e.target.value)}
                        placeholder={t('publicMenu.customerEmail')}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="mb-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>{t('publicMenu.subtotal')}</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>{fiscal.taxName} ({fiscal.taxRate}%)</span>
                      <span className="tabular-nums">{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900">
                    <span>{t('publicMenu.total')}</span>
                    <span className="tabular-nums">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {stripeEnabled ? (
                    <button
                      type="button"
                      disabled={loading !== null}
                      onClick={() => void handlePayWithCard()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                    >
                      {loading === 'card'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CreditCard className="h-4 w-4" />}
                      {t('publicMenu.payWithCard')}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-slate-500">{t('publicMenu.stripeUnavailable')}</p>
                  )}

                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => void handleOrderAtTable()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
