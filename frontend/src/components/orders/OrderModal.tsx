
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatCurrency, ORDER_STATUS_LABELS, cn } from '../../lib/utils'
import { useFiscalRegime } from '../../contexts/AuthContext'
import { tRegime } from '../../lib/fiscalRegime'
import { X, Plus, Minus, ShoppingCart, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface MenuItem { id: string; name: string; price: number; available: boolean; category: { name: string } }
interface Category { id: string; name: string; items: MenuItem[] }
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string }

interface Table {
  id: string; number: number; seats: number; status: string
  orders: Array<{ id: string; status: string; total: number; subtotal: number; tax: number; items: Array<{ id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string }> }>
}

export default function OrderModal({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const fiscal = useFiscalRegime()
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [tab, setTab] = useState<'menu' | 'order'>('menu')
  const [wantsTip, setWantsTip] = useState(false)
  const [tipAmount, setTipAmount] = useState('')

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data),
    refetchInterval: 5_000,
  })

  const table = tables.find(tbl => tbl.id === tableId)
  const activeOrder = table?.orders?.find(o => !['PAID', 'CANCELLED'].includes(o.status))

  useEffect(() => {
    if (activeOrder) setTab('order')
  }, [activeOrder?.id])

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['menu', 'categories'],
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
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'orders'] })
      setCart([])
      toast.success(t('orderModal.orderSent'))
      setTab('order')
    },
  })

  const addToOrder = useMutation({
    mutationFn: ({ orderId, menuItemId, quantity }: { orderId: string; menuItemId: string; quantity: number }) =>
      api.post(`/orders/${orderId}/items`, { menuItemId, quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'orders'] })
      setCart([])
      toast.success(t('orderModal.dishAdded'))
      setTab('order')
    },
  })

  const payOrder = useMutation({
    mutationFn: ({ orderId, paymentMethod, tipAmount: tip }: {
      orderId: string
      paymentMethod: 'CASH' | 'CARD'
      tipAmount: number
    }) => api.post('/payments/pos-checkout', { orderId, paymentMethod, tipAmount: tip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'fiscal'] })
      toast.success(t('orderModal.paymentRegistered'))
    },
    onError: () => toast.error(t('orderModal.paymentError')),
  })

  const markFree = useMutation({
    mutationFn: () => api.patch(`/tables/${tableId}/status`, { status: 'FREE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success(t('orderModal.tableReady', { number: table?.number ?? '' }))
      onClose()
    },
  })

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      const next = existing
        ? prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }]
      if (prev.length === 0) setTab('order')
      return next
    })
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

  const parsedTip = wantsTip ? Math.max(0, parseFloat(tipAmount) || 0) : 0
  const posTotal = activeOrder ? activeOrder.total + parsedTip : 0

  const handleTipToggle = (enabled: boolean) => {
    setWantsTip(enabled)
    if (!enabled) setTipAmount('')
  }

  const handlePayment = (paymentMethod: 'CASH' | 'CARD') => {
    if (!activeOrder) return
    payOrder.mutate({
      orderId: activeOrder.id,
      paymentMethod,
      tipAmount: parsedTip,
    })
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
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t('orderModal.title', { number: table.number })}</h2>
              <p className="text-sm text-slate-500">{t('orderModal.seats', { count: table.seats })}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label={t('common.close')}>
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="p-6 text-center space-y-5">
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

  const showCheckout = tab === 'order' && activeOrder && cart.length === 0
  const showCart = cart.length > 0 && !showCheckout
  const showRightPanel = showCart || showCheckout || tab === 'order'

  const tabButtons = (
    <div className="flex gap-1">
      {(['menu', 'order'] as const).map(tabKey => (
        <button
          key={tabKey}
          type="button"
          onClick={() => setTab(tabKey)}
          className={cn(
            'px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            tab === tabKey ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          {tabKey === 'menu' ? t('orderModal.tabMenu') : t('orderModal.tabOrder')}
          {tabKey === 'order' && (cartCount > 0 || activeOrder) && (
            <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 rounded-full">
              {cartCount > 0 ? cartCount : activeOrder?.items.length}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  const cartPanel = showCart ? (
    <>
      <div className="p-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-900">{t('orderModal.cartTitle', { count: cartCount })}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {cart.map(item => (
          <div key={item.menuItemId} className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <button type="button" onClick={() => removeFromCart(item.menuItemId)} aria-label="-">
                <Minus className="w-3 h-3 text-amber-600" />
              </button>
              <span className="text-xs font-bold text-amber-700">{item.quantity}</span>
              <button type="button" onClick={() => addToCart({ id: item.menuItemId, name: item.name, price: item.price, available: true, category: { name: '' } })} aria-label="+">
                <Plus className="w-3 h-3 text-amber-600" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">{item.name}</p>
              <p className="text-xs text-slate-500">{formatCurrency(item.price * item.quantity)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-slate-200 shrink-0">
        <div className="flex justify-between text-sm font-bold text-slate-900 mb-3">
          <span>{t('orderModal.total')}</span>
          <span>{formatCurrency(cartTotal)}</span>
        </div>
        <button
          type="button"
          onClick={handleSendOrder}
          disabled={createOrder.isPending || addToOrder.isPending}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {t('orderModal.sendToKitchen')}
        </button>
        {activeOrder && (
          <button
            type="button"
            onClick={() => setTab('order')}
            className="w-full mt-2 text-amber-600 hover:text-amber-700 font-medium py-2 text-sm transition-colors"
          >
            {t('orderModal.goToPayment')}
          </button>
        )}
      </div>
    </>
  ) : null

  const checkoutPanel = showCheckout ? (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{t('orderModal.orderRef', { ref: activeOrder!.id.slice(-6).toUpperCase() })}</span>
          <span className="text-xs px-3 py-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
            {ORDER_STATUS_LABELS[activeOrder!.status]}
          </span>
        </div>

        <div className="space-y-3">
          {activeOrder!.items.map(item => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 shrink-0 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold">{item.quantity}</span>
                <span className="text-sm text-slate-900 truncate">{item.menuItem.name}</span>
              </div>
              <span className="text-sm text-slate-500 shrink-0 ml-3">{formatCurrency(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>

        <p className="text-lg font-bold text-slate-900">
          {t('orderModal.orderTotal')}: {formatCurrency(activeOrder!.total)}
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">{t('orderModal.addTipQuestion')}</span>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleTipToggle(false)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  !wantsTip ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {t('orderModal.tipNo')}
              </button>
              <button
                type="button"
                onClick={() => handleTipToggle(true)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  wantsTip ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {t('orderModal.tipYes')}
              </button>
            </div>
          </div>

          {wantsTip && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={tipAmount}
              onChange={e => setTipAmount(e.target.value)}
              placeholder={t('orderModal.tipPlaceholder')}
              autoFocus
              className="saas-input w-full py-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          )}
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => handlePayment('CASH')}
            disabled={payOrder.isPending}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl text-sm transition-colors disabled:opacity-60"
          >
            {t('orderModal.payCash', { amount: formatCurrency(posTotal) })}
          </button>
          <button
            type="button"
            onClick={() => handlePayment('CARD')}
            disabled={payOrder.isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-sm transition-colors disabled:opacity-60"
          >
            {t('orderModal.payCard', { amount: formatCurrency(posTotal) })}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setTab('menu')}
          className="w-full text-amber-600 hover:text-amber-700 font-medium py-2 text-sm transition-colors"
        >
          {t('orderModal.addMoreDishes')}
        </button>

        <p className="text-xs text-slate-500 text-center pt-2">
          {tRegime(t, fiscal.taxRegion, 'tipExemptNote')}
        </p>
      </div>
    </div>
  ) : null

  const orderEmptyPanel = tab === 'order' && !showCart && !showCheckout ? (
    <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
      <ShoppingCart className="w-12 h-12 text-slate-400 mb-3" />
      <p className="text-slate-500 font-medium">{t('orderModal.noOpenOrder')}</p>
      <button type="button" onClick={() => setTab('menu')} className="mt-3 text-amber-600 text-sm font-medium hover:underline">
        {t('orderModal.openMenuToOrder')}
      </button>
    </div>
  ) : null

  return (
    <div className="saas-overlay flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="saas-modal w-full sm:max-w-4xl h-[100dvh] sm:h-[85vh] flex flex-col overflow-hidden rounded-none sm:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{t('orderModal.title', { number: table.number })}</h2>
            <p className="text-sm text-slate-500">{t('orderModal.seats', { count: table.seats })}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tabButtons}
            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label={t('common.close')}>
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">
          <div
            className={cn(
              'flex flex-1 min-h-0 min-w-0',
              tab === 'menu' ? 'flex' : 'hidden lg:flex',
            )}
          >
            <div className="w-28 sm:w-36 shrink-0 border-r border-slate-200 overflow-y-auto py-2 bg-slate-50">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-sm font-medium transition-colors',
                    (selectedCategory || categories[0]?.id) === cat.id
                      ? 'bg-amber-50 text-amber-700 border-r-2 border-amber-500'
                      : 'text-slate-600 hover:bg-white',
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                {(currentCategory?.items || []).filter(i => i.available).map(item => {
                  const inCart = cart.find(c => c.menuItemId === item.id)
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => addToCart(item)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') addToCart(item) }}
                      className={cn(
                        'p-3 rounded-xl border-2 cursor-pointer transition-all',
                        inCart
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-slate-50',
                      )}
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-bold text-amber-600">{formatCurrency(item.price)}</p>
                        {inCart && (
                          <div className="flex items-center gap-1.5 bg-amber-500 rounded-full px-2 py-0.5">
                            <button type="button" onClick={e => { e.stopPropagation(); removeFromCart(item.id) }} className="text-white">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-white">{inCart.quantity}</span>
                            <button type="button" onClick={e => { e.stopPropagation(); addToCart(item) }} className="text-white">
                              <Plus className="w-3 h-3" />
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

          <div
            className={cn(
              'flex flex-col min-h-0 overflow-hidden bg-white',
              'w-full lg:w-80 lg:shrink-0',
              'border-t border-slate-200 lg:border-t-0 lg:border-l',
              showRightPanel ? 'flex flex-1 lg:flex-none' : 'hidden lg:flex lg:flex-none',
            )}
          >
            {cartPanel}
            {checkoutPanel}
            {orderEmptyPanel}
          </div>
        </div>
      </div>
    </div>
  )
}
