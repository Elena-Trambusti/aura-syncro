
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatCurrency, ORDER_STATUS_LABELS, cn } from '../../lib/utils'
import { X, Plus, Minus, ShoppingCart, Sparkles, ArrowLeft, Receipt, ArrowRightLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRole } from '../../hooks/useRole'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'

interface MenuItem { id: string; name: string; price: number; available: boolean; soldOut?: boolean; orderable?: boolean; category: { name: string } }
interface Category { id: string; name: string; items: MenuItem[] }
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string }

interface Table {
  id: string; number: number; seats: number; status: string
  orders: Array<{ id: string; status: string; total: number; subtotal: number; tax: number; items: Array<{ id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string }> }>
}

const LG_BREAKPOINT = 1024

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= LG_BREAKPOINT,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`)
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isDesktop
}

export default function OrderModal({
  tableId,
  onClose,
  onStartTransfer,
}: {
  tableId: string
  onClose: () => void
  onStartTransfer?: (tableId: string) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { can } = useRole()
  const tk = useTenantQueryKey()
  const canPayOrder = can('orders.pay')
  const canTransferOrder = can('orders.items')
  const isDesktop = useIsDesktop()
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [tab, setTab] = useState<'menu' | 'order'>('menu')
  const [cartPulse, setCartPulse] = useState(false)

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: tq(tk, 'tables'),
    queryFn: () => api.get('/tables').then(r => r.data),
    refetchInterval: 5_000,
  })

  const table = tables.find(tbl => tbl.id === tableId)
  const activeOrder = table?.orders?.find(o => !['PAID', 'CANCELLED'].includes(o.status))

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: tq(tk, 'menu', 'categories'),
    queryFn: () => api.get('/menu/categories').then(r => r.data),
  })

  const createOrder = useMutation({
    mutationFn: (data: { tableId: string; items: CartItem[] }) =>
      api.post('/orders', {
        tableId: data.tableId,
        type: 'DINE_IN',
        items: data.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'kitchen', 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
      setCart([])
      toast.success(t('orderModal.orderSent'))
      setTab('order')
    },
    onError: (err: { response?: { data?: { code?: string } } }) => {
      if (err.response?.data?.code === 'MENU_ITEM_SOLD_OUT') {
        toast.error(t('orderModal.soldOutToast'))
        queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
      }
    },
  })

  const addToOrder = useMutation({
    mutationFn: ({ orderId, menuItemId, quantity }: { orderId: string; menuItemId: string; quantity: number }) =>
      api.post(`/orders/${orderId}/items`, { menuItemId, quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'kitchen', 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
      setCart([])
      toast.success(t('orderModal.dishAdded'))
      setTab('order')
    },
    onError: (err: { response?: { data?: { code?: string } } }) => {
      if (err.response?.data?.code === 'MENU_ITEM_SOLD_OUT') {
        toast.error(t('orderModal.soldOutToast'))
        queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
      }
    },
  })

  const markFree = useMutation({
    mutationFn: () => api.patch(`/tables/${tableId}/status`, { status: 'FREE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      toast.success(t('orderModal.tableReady', { number: table?.number ?? '' }))
      onClose()
    },
  })

  const addToCart = (item: MenuItem) => {
    if (item.soldOut || item.orderable === false) {
      toast.error(t('orderModal.soldOutToast'))
      return
    }
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      return existing
        ? prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
    setCartPulse(true)
    window.setTimeout(() => setCartPulse(false), 700)
  }

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === menuItemId)
      if (existing && existing.quantity > 1) return prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c)
      return prev.filter(c => c.menuItemId !== menuItemId)
    })
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const orderBadgeCount = cartCount > 0 ? cartCount : (activeOrder?.items.length ?? 0)

  const goToCheckout = () => {
    if (!activeOrder) return
    onClose()
    navigate(`/checkout/${activeOrder.id}`)
  }

  const handleSendOrder = () => {
    if (cart.length === 0 || !table) return
    if (activeOrder) {
      cart.forEach(item => addToOrder.mutate({ orderId: activeOrder.id, menuItemId: item.menuItemId, quantity: item.quantity }))
    } else {
      createOrder.mutate({ tableId: table.id, items: cart })
    }
  }

  if (!table) {
    return (
      <div className="saas-overlay flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-10 h-10 border-4 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (table.status === 'CLEANING') {
    return (
      <div className="saas-overlay flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div
          className="saas-modal w-full sm:max-w-md flex flex-col overflow-hidden rounded-none sm:rounded-xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t('orderModal.title', { number: table.number })}</h2>
              <p className="text-sm text-slate-500">{t('orderModal.seats', { count: table.seats })}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label={t('common.close')}>
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="p-6 text-center space-y-5 bg-white">
            <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('orderModal.cleaningTitle')}</h3>
              <p className="text-sm text-slate-500 mt-2">{t('orderModal.cleaningDescription')}</p>
            </div>
            <button
              type="button"
              onClick={() => markFree.mutate()}
              disabled={markFree.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {t('orderModal.markFree')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentCategory = selectedCategory
    ? categories.find(c => c.id === selectedCategory)
    : categories[0]

  const showCheckout = Boolean(activeOrder && cart.length === 0 && (isDesktop || tab === 'order'))
  const showCart = cart.length > 0 && !showCheckout

  const tabButtons = (fullWidth = false) => (
    <div className={cn('flex gap-1', fullWidth && 'flex-1')}>
      {(['menu', 'order'] as const).map(tabKey => {
        const isActive = tab === tabKey
        const showBadge = tabKey === 'order' && orderBadgeCount > 0
        return (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={cn(
              'relative px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              fullWidth && 'flex-1',
              isActive ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            {tabKey === 'menu' ? t('orderModal.tabMenu') : t('orderModal.tabOrder')}
            {showBadge && (
              <span
                className={cn(
                  'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold',
                  isActive ? 'bg-white/25 text-white' : 'bg-amber-500 text-white',
                  cartPulse && cartCount > 0 && 'animate-pulse ring-2 ring-amber-300 ring-offset-1',
                )}
              >
                {orderBadgeCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  /** Menu: categorie + griglia piatti */
  const menuPanel = (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="flex min-h-0 flex-1">
        <div className="w-28 shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50 py-2 sm:w-36">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'w-full px-3 py-2.5 text-left text-sm font-medium transition-colors',
                (selectedCategory || categories[0]?.id) === cat.id
                  ? 'border-r-2 border-amber-500 bg-amber-50 text-amber-700'
                  : 'text-slate-700 hover:bg-white',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            {(currentCategory?.items || []).filter(i => i.available).map(item => {
              const inCart = cart.find(c => c.menuItemId === item.id)
              const isSoldOut = item.soldOut || item.orderable === false
              return (
                <div
                  key={item.id}
                  role={isSoldOut ? undefined : 'button'}
                  tabIndex={isSoldOut ? undefined : 0}
                  onClick={() => !isSoldOut && addToCart(item)}
                  onKeyDown={e => { if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) addToCart(item) }}
                  className={cn(
                    'rounded-xl border-2 p-3 transition-all',
                    isSoldOut
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-75'
                      : inCart
                        ? 'cursor-pointer border-amber-400 bg-amber-50'
                        : 'cursor-pointer border-slate-200 bg-white hover:border-amber-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm font-semibold', isSoldOut ? 'text-slate-500' : 'text-slate-900')}>{item.name}</p>
                    {isSoldOut && (
                      <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                        {t('orderModal.soldOut')}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className={cn('text-base font-bold', isSoldOut ? 'text-slate-400' : 'text-amber-600')}>{formatCurrency(item.price)}</p>
                    {!isSoldOut && inCart && (
                      <div className="flex items-center gap-1.5 rounded-full bg-amber-500 px-2 py-0.5">
                        <button type="button" onClick={e => { e.stopPropagation(); removeFromCart(item.id) }} className="text-white">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold text-white">{inCart.quantity}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); addToCart(item) }} className="text-white">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {!isDesktop && cartCount > 0 && tab === 'menu' && (
        <button
          type="button"
          onClick={() => setTab('order')}
          className="shrink-0 flex w-full items-center justify-between gap-3 border-t border-amber-600 bg-amber-500 px-4 py-4 text-white shadow-lg pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <span className="text-sm font-semibold tabular-nums">
            {t('orderModal.floatingSummary', { count: cartCount, total: formatCurrency(cartTotal) })}
          </span>
          <span className="shrink-0 text-sm font-bold">{t('orderModal.goToOrder')}</span>
        </button>
      )}
    </div>
  )

  /** Carrello con articoli da inviare */
  const cartContent = showCart ? (
    <>
      <div className="shrink-0 border-b border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-900">{t('orderModal.cartTitle', { count: cartCount })}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          {cart.map(item => (
            <div key={item.menuItemId} className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
                <button type="button" onClick={() => removeFromCart(item.menuItemId)} aria-label="-">
                  <Minus className="h-3 w-3 text-amber-700" />
                </button>
                <span className="text-xs font-bold text-slate-900">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => addToCart({ id: item.menuItemId, name: item.name, price: item.price, available: true, category: { name: '' } })}
                  aria-label="+"
                >
                  <Plus className="h-3 w-3 text-amber-700" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                <p className="text-sm font-medium tabular-nums text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex justify-between text-sm font-bold text-slate-900">
          <span>{t('orderModal.total')}</span>
          <span className="tabular-nums">{formatCurrency(cartTotal)}</span>
        </div>
        <button
          type="button"
          onClick={handleSendOrder}
          disabled={createOrder.isPending || addToOrder.isPending}
          className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
        >
          {t('orderModal.sendToKitchen')}
        </button>
      </div>
    </>
  ) : null

  /** Checkout / pagamento ordine attivo */
  const checkoutContent = showCheckout ? (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{t('orderModal.orderRef', { ref: activeOrder!.id.slice(-6).toUpperCase() })}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {ORDER_STATUS_LABELS[activeOrder!.status]}
            </span>
          </div>

          <div className="space-y-3">
            {activeOrder!.items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-900">
                    {item.quantity}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-900">{item.menuItem.name}</span>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-slate-900">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-lg font-bold text-slate-900">
            {t('orderModal.orderTotal')}: {formatCurrency(activeOrder!.total)}
          </p>

          {canPayOrder && (
          <button
            type="button"
            onClick={goToCheckout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            <Receipt className="h-5 w-5" />
            {t('orderModal.goToPayment')}
          </button>
          )}

          <button
            type="button"
            onClick={() => setTab('menu')}
            className="w-full py-2 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700"
          >
            {t('orderModal.addMoreDishes')}
          </button>
        </div>
      </div>
    </>
  ) : null

  const orderEmptyContent = !showCart && !showCheckout && (isDesktop || tab === 'order') ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <ShoppingCart className="mb-3 h-12 w-12 text-slate-400" />
      <p className="font-medium text-slate-700">{t('orderModal.noOpenOrder')}</p>
      <button type="button" onClick={() => setTab('menu')} className="mt-3 text-sm font-medium text-amber-600 hover:underline">
        {t('orderModal.openMenuToOrder')}
      </button>
    </div>
  ) : null

  /** Pannello ordine / carrello / checkout */
  const orderPanel = (
    <div className="flex h-full min-h-0 w-full flex-col bg-white lg:border-l lg:border-slate-200">
      {cartContent}
      {checkoutContent}
      {orderEmptyContent}
    </div>
  )

  return (
    <div
      className="saas-overlay flex min-h-[100dvh] flex-col p-0 sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="saas-modal flex min-h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-white sm:min-h-0 sm:h-[85dvh] sm:max-h-[85dvh] sm:max-w-4xl sm:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — sempre visibile, non scrolla */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{t('orderModal.title', { number: table.number })}</h2>
            <p className="text-sm text-slate-500">{t('orderModal.seats', { count: table.seats })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canTransferOrder && activeOrder && onStartTransfer && (
              <button
                type="button"
                onClick={() => onStartTransfer(tableId)}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-800"
              >
                <ArrowRightLeft className="h-4 w-4" />
                {t('orderModal.transferActionShort')}
              </button>
            )}
            {isDesktop && tabButtons()}
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label={t('common.close')}>
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {canTransferOrder && activeOrder && onStartTransfer && !isDesktop && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3">
            <button
              type="button"
              onClick={() => onStartTransfer(tableId)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-base font-bold text-white shadow-md transition-colors hover:bg-slate-800"
            >
              <ArrowRightLeft className="h-5 w-5" />
              {t('orderModal.transferActionShort')}
            </button>
          </div>
        )}

        {/* Tab bar mobile — shrink-0, sotto header fisso */}
        {!isDesktop && (
          <div className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              {tab === 'order' ? (
                <button
                  type="button"
                  onClick={() => setTab('menu')}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  aria-label={t('orderModal.backToMenu')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">{t('orderModal.backToMenu')}</span>
                </button>
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              {tabButtons(true)}
            </div>
          </div>
        )}

        {/* Body: solo questa area scrolla; header/tab restano fissi */}
        <div className="min-h-0 flex-1 overflow-hidden overscroll-contain">
          {isDesktop ? (
            <div className="grid h-full min-h-0 grid-cols-3">
              <div className="col-span-2 flex min-h-0 flex-col overflow-hidden">{menuPanel}</div>
              <div className="col-span-1 flex min-h-0 flex-col overflow-hidden">{orderPanel}</div>
            </div>
          ) : tab === 'menu' ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">{menuPanel}</div>
          ) : (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">{orderPanel}</div>
          )}
        </div>
      </div>
    </div>
  )
}
