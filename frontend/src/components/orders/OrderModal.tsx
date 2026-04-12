
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency, ORDER_STATUS_LABELS } from '../../lib/utils'
import { X, Plus, Minus, ShoppingCart, CreditCard, Banknote } from 'lucide-react'
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
      setCart([])
      toast.success('Piatto aggiunto!')
    },
  })

  const updateOrderStatus = useMutation({
    mutationFn: ({ orderId, status, paymentMethod }: { orderId: string; status: string; paymentMethod?: string }) =>
      api.patch(`/orders/${orderId}/status`, { status, paymentMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Stato aggiornato!')
      onClose()
    },
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Tavolo {table.number}</h2>
            <p className="text-sm text-slate-500">{table.seats} posti</p>
          </div>
          <div className="flex items-center gap-3">
            {['menu', 'order'].map(t => (
              <button key={t} onClick={() => setTab(t as 'menu' | 'order')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {t === 'menu' ? 'Menu' : 'Ordine'}
                {t === 'order' && activeOrder && (
                  <span className="ml-1.5 bg-orange-100 text-orange-600 text-xs px-1.5 rounded-full">
                    {activeOrder.items.length}
                  </span>
                )}
              </button>
            ))}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {tab === 'menu' ? (
            <>
              {/* Categorie */}
              <div className="w-36 border-r border-slate-100 overflow-y-auto py-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors ${(selectedCategory || categories[0]?.id) === cat.id ? 'bg-orange-50 text-orange-700 border-r-2 border-orange-500' : 'text-slate-600 hover:bg-slate-50'}`}
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
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${inCart ? 'border-orange-400 bg-orange-50' : 'border-slate-100 hover:border-orange-300 hover:bg-orange-50/50'}`}
                      >
                        <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-base font-bold text-orange-600">{formatCurrency(item.price)}</p>
                          {inCart && (
                            <div className="flex items-center gap-1.5 bg-orange-500 rounded-full px-2 py-0.5">
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
                <div className="w-56 border-l border-slate-100 flex flex-col">
                  <div className="p-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-semibold text-slate-700">Carrello ({cart.reduce((s, c) => s + c.quantity, 0)})</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.map(item => (
                      <div key={item.menuItemId} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-orange-100 rounded-full px-2 py-0.5">
                          <button onClick={() => removeFromCart(item.menuItemId)}><Minus className="w-3 h-3 text-orange-600" /></button>
                          <span className="text-xs font-bold text-orange-700">{item.quantity}</span>
                          <button onClick={() => addToCart({ id: item.menuItemId, name: item.name, price: item.price, available: true, category: { name: '' } })}><Plus className="w-3 h-3 text-orange-600" /></button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-100">
                    <div className="flex justify-between text-sm font-bold text-slate-800 mb-3">
                      <span>Totale</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <button
                      onClick={handleSendOrder}
                      disabled={createOrder.isPending || addToOrder.isPending}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
                    >
                      Invia in cucina
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tab ordine esistente */
            <div className="flex-1 overflow-y-auto p-4">
              {activeOrder ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Ordine #{activeOrder.id.slice(-6).toUpperCase()}</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium bg-orange-100 text-orange-700`}>
                      {ORDER_STATUS_LABELS[activeOrder.status]}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeOrder.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold">{item.quantity}</span>
                          <span className="text-sm text-slate-700">{item.menuItem.name}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Subtotale</span><span>{formatCurrency(activeOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>IVA (10%)</span><span>{formatCurrency(activeOrder.tax)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-800 pt-2 border-t border-slate-200">
                      <span>Totale</span><span>{formatCurrency(activeOrder.total)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateOrderStatus.mutate({ orderId: activeOrder.id, status: 'PAID', paymentMethod: 'CASH' })}
                      className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                      <Banknote className="w-4 h-4" />
                      Contanti
                    </button>
                    <button
                      onClick={() => updateOrderStatus.mutate({ orderId: activeOrder.id, status: 'PAID', paymentMethod: 'CARD' })}
                      className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Carta
                    </button>
                  </div>

                  <button
                    onClick={() => setTab('menu')}
                    className="w-full border-2 border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    + Aggiungi altri piatti
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingCart className="w-12 h-12 text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium">Nessun ordine aperto</p>
                  <button onClick={() => setTab('menu')} className="mt-3 text-orange-600 text-sm font-medium hover:underline">
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
