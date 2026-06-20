
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency, ORDER_STATUS_LABELS } from '../../lib/utils'
import { X, Plus, Minus, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'

interface MenuItem { id: string; name: string; price: number; available: boolean; category: { name: string } }
interface Category { id: string; name: string; items: MenuItem[] }
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string }

interface Table {
  id: string; number: number; seats: number; status: string
  orders: Array<{ id: string; status: string; total: number; subtotal: number; tax: number; items: Array<{ id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string }> }>
}


export default function OrderModal({ table, onClose }: { table: Table; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [tab, setTab] = useState<'menu' | 'order'>('menu')
  const [wantsTip, setWantsTip] = useState(false)
  const [tipAmount, setTipAmount] = useState('')

  const activeOrder = table.orders?.find(o => !['PAID', 'CANCELLED'].includes(o.status))

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
      toast.success('Ordine inviato in cucina!')
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
      toast.success('Piatto aggiunto!')
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
      toast.success('Pagamento registrato!')
      onClose()
    },
    onError: () => toast.error('Errore durante il pagamento'),
  })

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }]
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
  const currentCategory = selectedCategory
    ? categories.find(c => c.id === selectedCategory)
    : categories[0]

  const handleSendOrder = () => {
    if (cart.length === 0) return
    if (activeOrder) {
      cart.forEach(item => addToOrder.mutate({ orderId: activeOrder.id, menuItemId: item.menuItemId, quantity: item.quantity }))
    } else {
      createOrder.mutate({ tableId: table.id, items: cart })
    }
  }

  return (
    <div className="glass-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-modal w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-800/50">
          <div>
            <h2 className="text-lg font-bold text-stone-100">Tavolo {table.number}</h2>
            <p className="text-sm text-stone-400">{table.seats} posti</p>
          </div>
          <div className="flex items-center gap-3">
            {['menu', 'order'].map(t => (
              <button key={t} onClick={() => setTab(t as 'menu' | 'order')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-amber-600 text-white' : 'bg-stone-800/50 text-stone-300'}`}
              >
                {t === 'menu' ? 'Menu' : 'Ordine'}
                {t === 'order' && activeOrder && (
                  <span className="ml-1.5 bg-amber-950/40 text-amber-400 text-xs px-1.5 rounded-full">
                    {activeOrder.items.length}
                  </span>
                )}
              </button>
            ))}
            <button onClick={onClose} className="p-2 hover:bg-stone-800/50 rounded-lg">
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {tab === 'menu' ? (
            <>
              {/* Categorie */}
              <div className="w-36 border-r border-stone-800/50 overflow-y-auto py-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors ${(selectedCategory || categories[0]?.id) === cat.id ? 'bg-amber-950/30 text-amber-400 border-r-2 border-orange-500' : 'text-stone-300 hover:glass-table-head'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Piatti */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  {(currentCategory?.items || []).filter(i => i.available).map(item => {
                    const inCart = cart.find(c => c.menuItemId === item.id)
                    return (
                      <div
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${inCart ? 'border-orange-400 bg-amber-950/30' : 'border-stone-800/50 hover:border-amber-700/40 hover:bg-stone-800/40/50'}`}
                      >
                        <p className="text-sm font-semibold text-stone-100">{item.name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-base font-bold text-amber-400">{formatCurrency(item.price)}</p>
                          {inCart && (
                            <div className="flex items-center gap-1.5 bg-amber-600 rounded-full px-2 py-0.5">
                              <button onClick={e => { e.stopPropagation(); removeFromCart(item.id) }} className="text-white">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold text-white">{inCart.quantity}</span>
                              <button onClick={e => { e.stopPropagation(); addToCart(item) }} className="text-white">
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

              {/* Carrello */}
              {cart.length > 0 && (
                <div className="w-56 border-l border-stone-800/50 flex flex-col">
                  <div className="p-3 border-b border-stone-800/50">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-stone-200">Carrello ({cart.reduce((s, c) => s + c.quantity, 0)})</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.map(item => (
                      <div key={item.menuItemId} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-amber-950/40 rounded-full px-2 py-0.5">
                          <button onClick={() => removeFromCart(item.menuItemId)}><Minus className="w-3 h-3 text-amber-400" /></button>
                          <span className="text-xs font-bold text-amber-400">{item.quantity}</span>
                          <button onClick={() => addToCart({ id: item.menuItemId, name: item.name, price: item.price, available: true, category: { name: '' } })}><Plus className="w-3 h-3 text-amber-400" /></button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-stone-200 truncate">{item.name}</p>
                          <p className="text-xs text-stone-400">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-stone-800/50">
                    <div className="flex justify-between text-sm font-bold text-stone-100 mb-3">
                      <span>Totale</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <button
                      onClick={handleSendOrder}
                      disabled={createOrder.isPending || addToOrder.isPending}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
                    >
                      Invia in cucina
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tab ordine esistente */
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {activeOrder ? (
                <div className="space-y-6 max-w-lg mx-auto py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-500">Ordine #{activeOrder.id.slice(-6).toUpperCase()}</span>
                    <span className="text-xs px-3 py-1 rounded-full font-medium bg-amber-950/40 text-amber-400">
                      {ORDER_STATUS_LABELS[activeOrder.status]}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeOrder.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 shrink-0 bg-stone-800/50 text-stone-300 rounded-full flex items-center justify-center text-xs font-bold">{item.quantity}</span>
                          <span className="text-sm text-stone-200 truncate">{item.menuItem.name}</span>
                        </div>
                        <span className="text-sm text-stone-400 shrink-0 ml-3">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-lg font-bold text-slate-900">
                    Total Comanda: {formatCurrency(activeOrder.total)}
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-stone-400">¿Añadir propina voluntaria?</span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTipToggle(false)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            !wantsTip
                              ? 'bg-slate-800 text-white'
                              : 'bg-stone-800/50 text-stone-400 hover:bg-slate-200'
                          }`}
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTipToggle(true)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            wantsTip
                              ? 'bg-slate-800 text-white'
                              : 'bg-stone-800/50 text-stone-400 hover:bg-slate-200'
                          }`}
                        >
                          Sí
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
                        placeholder="€ 0,00"
                        autoFocus
                        className="w-full py-3 rounded-xl border border-stone-700/50 text-sm text-stone-100 text-center placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                      />
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => handlePayment('CASH')}
                      disabled={payOrder.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-950/400 hover:bg-emerald-600 text-white font-semibold py-4 rounded-xl text-sm transition-colors disabled:opacity-60"
                    >
                      💵 Pagar {formatCurrency(posTotal)} en Efectivo
                    </button>
                    <button
                      onClick={() => handlePayment('CARD')}
                      disabled={payOrder.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-blue-950/400 hover:bg-blue-600 text-white font-semibold py-4 rounded-xl text-sm transition-colors disabled:opacity-60"
                    >
                      💳 Pagar {formatCurrency(posTotal)} con Tarjeta
                    </button>
                  </div>

                  <button
                    onClick={() => setTab('menu')}
                    className="w-full text-amber-400 hover:text-amber-400 font-medium py-2 text-sm transition-colors"
                  >
                    + Aggiungi altri piatti
                  </button>

                  <p className="text-xs text-stone-400 text-center pt-2">
                    *Propina voluntaria exenta de IGIC
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingCart className="w-12 h-12 text-stone-300 mb-3" />
                  <p className="text-stone-400 font-medium">Nessun ordine aperto</p>
                  <button onClick={() => setTab('menu')} className="mt-3 text-amber-400 text-sm font-medium hover:underline">
                    Apri il menu per ordinare
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
