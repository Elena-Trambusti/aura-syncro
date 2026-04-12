import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import {
  ShoppingCart, Plus, Minus, X, ChefHat, Search,
  AlertCircle, CheckCircle2, Send, CreditCard,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface MenuItem {
  id: string; name: string; description?: string; price: number
  available: boolean; allergens?: string; calories?: number
  preparationTime?: number; featured?: boolean
}

interface Category { id: string; name: string; items: MenuItem[] }

interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string }

function AllergenBadge({ allergen }: { allergen: string }) {
  const icons: Record<string, string> = {
    glutine: '🌾', latte: '🥛', uova: '🥚', pesce: '🐟',
    crostacei: '🦐', arachidi: '🥜', soia: '🫘', fruttasecco: '🌰',
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
      {icons[allergen.toLowerCase()] || '⚠'} {allergen}
    </span>
  )
}

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN')
  const [customerEmail, setCustomerEmail] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)

  const { data, isLoading, error } = useQuery<{
    restaurant: { name: string; logo?: string; description?: string }
    categories: Category[]
  }>({
    queryKey: ['public-menu', slug],
    queryFn: () => api.get(`/menu/public/${slug}`).then(r => r.data),
  })

  const placeOrder = useMutation({
    mutationFn: (data: { tableId?: string; type: string; items: CartItem[]; notes?: string }) =>
      api.post('/orders/public', data),
    onSuccess: () => {
      setOrderPlaced(true)
      setCart([])
      setShowCart(false)
    },
    onError: () => toast.error('Errore nell\'invio dell\'ordine. Chiama il cameriere.'),
  })

  const payWithStripe = async () => {
    if (orderType === 'DINE_IN' && !tableNumber) {
      toast.error('Inserisci il numero del tavolo')
      return
    }
    setIsRedirecting(true)
    try {
      const res = await api.post('/payments/checkout', {
        slug,
        type: orderType,
        items: cart,
        ...(orderType === 'DINE_IN' && tableNumber ? { tableNumber: parseInt(tableNumber) } : {}),
        ...(customerEmail ? { customerEmail } : {}),
      })
      window.location.href = res.data.checkoutUrl
    } catch {
      toast.error('Pagamento online non disponibile. Usa "Invia ordine" e paga al tavolo.')
      setIsRedirecting(false)
    }
  }

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

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const allItems = data?.categories.flatMap(c => c.items) || []
  const filteredItems = search
    ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()))
    : null

  const activeCategory = selectedCategory ? data?.categories.find(c => c.id === selectedCategory) : data?.categories[0]

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500">Caricamento menu...</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Menu non trovato</h2>
        <p className="text-slate-500">Il QR code potrebbe non essere più valido.</p>
      </div>
    </div>
  )

  if (orderPlaced) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Ordine inviato!</h2>
        <p className="text-slate-500 mb-6">Il tuo ordine è stato ricevuto dalla cucina. Ti serviremo al più presto!</p>
        <button onClick={() => setOrderPlaced(false)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-2xl transition-colors">
          Ordina ancora
        </button>
      </div>
    </div>
  )

  const displayItems = filteredItems || (activeCategory?.items.filter(i => i.available) || [])
  const displayTitle = search ? `Risultati per "${search}"` : activeCategory?.name

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto">
      {/* Header ristorante */}
      <div className="bg-gradient-to-br from-slate-900 to-orange-900 text-white px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
            <ChefHat className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black">{data.restaurant.name}</h1>
            {data.restaurant.description && (
              <p className="text-xs text-white/70 mt-0.5">{data.restaurant.description}</p>
            )}
          </div>
        </div>

        {/* Barra ricerca */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 text-sm"
            placeholder="Cerca nel menu..."
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categorie orizzontali */}
      {!search && (
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex overflow-x-auto scrollbar-none px-4 py-2 gap-2">
            {data.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  (selectedCategory || data.categories[0]?.id) === cat.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista piatti */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{displayTitle}</h2>
        <div className="space-y-3">
          {displayItems.map(item => {
            const inCart = cart.find(c => c.menuItemId === item.id)
            const allergenList = item.allergens?.split(',').map(a => a.trim()).filter(Boolean) || []
            return (
              <div key={item.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${inCart ? 'border-orange-200' : 'border-slate-100'} transition-all`}>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                          {item.featured && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">⭐ Top</span>}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                        )}
                      </div>
                    </div>

                    {allergenList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {allergenList.map(a => <AllergenBadge key={a} allergen={a} />)}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <span className="text-lg font-black text-orange-600">{formatCurrency(item.price)}</span>
                        {item.calories && <span className="text-xs text-slate-400 ml-2">{item.calories} kcal</span>}
                      </div>

                      {!inCart ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-9 h-9 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-orange-500 rounded-full px-2 py-1">
                          <button onClick={() => removeFromCart(item.id)}>
                            <Minus className="w-4 h-4 text-white" />
                          </button>
                          <span className="text-white font-bold text-sm min-w-4 text-center">{inCart.quantity}</span>
                          <button onClick={() => addToCart(item)}>
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {displayItems.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium">Nessun piatto trovato</p>
            </div>
          )}
        </div>
      </div>

      {/* Spazio per il bottone fisso */}
      {cartCount > 0 && <div className="h-24" />}

      {/* Bottone carrello fisso */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-between px-5 transition-all active:scale-98"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-black">{cartCount}</span>
              </div>
              <span>Visualizza ordine</span>
            </div>
            <span className="font-black text-lg">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Sheet carrello */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowCart(false)}>
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-slate-800">Il tuo ordine</h3>
              </div>
              <button onClick={() => setShowCart(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {/* Tipo ordine */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Tipo di servizio</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['DINE_IN', 'TAKEAWAY'] as const).map(t => (
                    <button key={t} onClick={() => setOrderType(t)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${orderType === t ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>
                      {t === 'DINE_IN' ? '🪑 Al tavolo' : '🥡 Asporto'}
                    </button>
                  ))}
                </div>
              </div>

              {orderType === 'DINE_IN' && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Numero tavolo</p>
                  <input
                    type="number"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-800 font-semibold"
                    placeholder="es. 5"
                  />
                </div>
              )}

              {/* Piatti */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pietanze ({cartCount})</p>
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.menuItemId} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-orange-100 rounded-full px-2.5 py-1">
                        <button onClick={() => removeFromCart(item.menuItemId)}><Minus className="w-3.5 h-3.5 text-orange-600" /></button>
                        <span className="text-sm font-bold text-orange-700 min-w-4 text-center">{item.quantity}</span>
                        <button onClick={() => addToCart({ id: item.menuItemId, name: item.name, price: item.price, available: true })}><Plus className="w-3.5 h-3.5 text-orange-600" /></button>
                      </div>
                      <span className="flex-1 text-sm font-medium text-slate-700">{item.name}</span>
                      <span className="text-sm font-bold text-slate-800">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totale */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotale</span><span>{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>IVA (10%)</span><span>{formatCurrency(cartTotal * 0.1)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-800 pt-2 border-t border-slate-200">
                  <span>Totale</span><span>{formatCurrency(cartTotal * 1.1)}</span>
                </div>
              </div>

              {/* Email opzionale per ricevuta */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Email ricevuta (opzionale)</p>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-800 text-sm"
                  placeholder="tuaemail@esempio.it"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 space-y-2.5">
              {/* Paga con carta (Stripe) */}
              <button
                onClick={payWithStripe}
                disabled={isRedirecting}
                className="w-full bg-[#635BFF] hover:bg-[#5248e8] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <CreditCard className="w-5 h-5" />
                {isRedirecting ? 'Reindirizzamento...' : `Paga ora con carta · ${formatCurrency(cartTotal * 1.1)}`}
              </button>

              {/* Oppure invia e paga dopo */}
              <button
                onClick={() => {
                  if (orderType === 'DINE_IN' && !tableNumber) {
                    toast.error('Inserisci il numero del tavolo')
                    return
                  }
                  placeOrder.mutate({
                    type: orderType,
                    items: cart,
                    ...(orderType === 'DINE_IN' && tableNumber ? { tableNumber: parseInt(tableNumber) } : {}),
                  } as Parameters<typeof placeOrder.mutate>[0])
                }}
                disabled={placeOrder.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <Send className="w-5 h-5" />
                {placeOrder.isPending ? 'Invio in corso...' : 'Ordina · paga al tavolo'}
              </button>
              <p className="text-center text-xs text-slate-400">Il cameriere ti assisterà per il pagamento in contanti o POS</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
