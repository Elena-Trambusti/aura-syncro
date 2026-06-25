
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { submitAddOrderItems, submitCreateOrder } from '../../lib/offlineSync'
import { formatCurrency, ORDER_STATUS_LABELS, cn } from '../../lib/utils'
import { X, Plus, Minus, ShoppingCart, ArrowLeft, Receipt, ArrowRightLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRole } from '../../hooks/useRole'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import ModalPortal from '../ModalPortal'
import CustomerPicker, { type CustomerOption } from '../checkout/CustomerPicker'

interface MenuModifierOption { id: string; name: string; price: number }
interface MenuModifierGroup { id: string; name: string; isRequired: boolean; multiSelect: boolean; minOptions: number; maxOptions: number | null; options: MenuModifierOption[] }
interface MenuItem { id: string; name: string; price: number; available: boolean; soldOut?: boolean; orderable?: boolean; category: { name: string }; modifierGroups?: MenuModifierGroup[] }
interface Category { id: string; name: string; items: MenuItem[] }
interface CartItem { menuItemId: string; name: string; basePrice: number; price: number; quantity: number; notes?: string; course: number; modifiers?: string[]; modifierNames?: string[] }

interface Table {
  id: string; number: number; seats: number; status: string
  orders: Array<{
    id: string; status: string; total: number; subtotal: number; tax: number
    customer?: CustomerOption | null
    items: Array<{ id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string }>
  }>
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
  const [selectedCourse, setSelectedCourse] = useState<number>(1)
  const [modifyingItem, setModifyingItem] = useState<MenuItem | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({})
  const [cartPulse, setCartPulse] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const invalidateOrderQueries = () => {
    queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
    queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
    queryClient.invalidateQueries({ queryKey: tq(tk, 'kitchen', 'orders') })
    queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
  }

  const handleOrderSubmitError = (err: unknown) => {
    const ax = err as AxiosError<{ code?: string }>
    if (ax.response?.data?.code === 'MENU_ITEM_SOLD_OUT') {
      toast.error(t('orderModal.soldOutToast'))
      queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
      return
    }
    toast.error(t('orderModal.sendError', { defaultValue: 'Impossibile inviare la comanda' }))
  }

  const handleSendOrder = async () => {
    if (cart.length === 0 || !table || isSubmitting) return

    const lineItems = cart.map(i => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      course: i.course,
      notes: i.notes,
    }))
    const tableLabel = `T${table.number}`

    setIsSubmitting(true)
    const sendPromise = (async () => {
      let result: 'synced' | 'queued'
      if (activeOrder) {
        result = await submitAddOrderItems(
          { orderId: activeOrder.id, items: lineItems },
          { label: tableLabel },
        )
      } else {
        result = await submitCreateOrder(
          { tableId: table.id, type: 'DINE_IN', items: lineItems },
          { label: tableLabel },
        )
      }
      return result
    })()

    // Optimistic UI update: reset cart immediately
    setCart([])
    setTab('order')
    setIsSubmitting(false)

    sendPromise.then((result) => {
      invalidateOrderQueries()
      if (result === 'queued') {
        toast.success(t('offline.orderQueued', { defaultValue: 'Comanda salvata — invio appena torna la connessione' }))
      } else if (activeOrder) {
        toast.success(t('orderModal.dishAdded'))
      } else {
        toast.success(t('orderModal.orderSent'))
      }
    }).catch(err => {
      handleOrderSubmitError(err)
      // Could restore cart here ideally
    })
  }

  const getModifiersPrice = (item: MenuItem, modifiers: string[]) => {
    let sum = 0
    item.modifierGroups?.forEach(g => {
      g.options.forEach(o => {
        if (modifiers.includes(o.id)) sum += o.price
      })
    })
    return sum
  }

  const handleItemClick = (item: MenuItem) => {
    if (item.soldOut || item.orderable === false) {
      toast.error(t('orderModal.soldOutToast'))
      return
    }
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setModifyingItem(item)
      setSelectedModifiers({})
      return
    }
    addToCart(item, [], [])
  }

  const addToCart = (item: MenuItem, modifiers: string[], modifierNames: string[]) => {
    setCart(prev => {
      const modifierKey = modifiers.slice().sort().join(',')
      const existing = prev.find(c => c.menuItemId === item.id && c.course === selectedCourse && (c.modifiers || []).slice().sort().join(',') === modifierKey)
      return existing
        ? prev.map(c => c === existing ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { 
            menuItemId: item.id, 
            name: item.name, 
            basePrice: item.price,
            price: item.price + (modifiers.length > 0 ? getModifiersPrice(item, modifiers) : 0), 
            quantity: 1, 
            course: selectedCourse,
            modifiers,
            modifierNames
          }]
    })
    setModifyingItem(null)
    setCartPulse(true)
    window.setTimeout(() => setCartPulse(false), 700)
  }

  const removeFromCart = (menuItemId: string, course: number, modifiers: string[] = []) => {
    setCart(prev => {
      const modifierKey = modifiers.slice().sort().join(',')
      const existing = prev.find(c => c.menuItemId === menuItemId && c.course === course && (c.modifiers || []).slice().sort().join(',') === modifierKey)
      if (existing && existing.quantity > 1) return prev.map(c => c === existing ? { ...c, quantity: c.quantity - 1 } : c)
      return prev.filter(c => c !== existing)
    })
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const orderBadgeCount = cartCount > 0 ? cartCount : (activeOrder?.items.length ?? 0)

  const goToCheckout = () => {
    if (!activeOrder) return
    if (!navigator.onLine) {
      toast.error(t('offline.bannerOffline') || 'Impossibile procedere con il pagamento offline. Controlla la connessione internet.')
      return
    }
    onClose()
    navigate(`/checkout/${activeOrder.id}`)
  }

  if (!table) {
    return (
      <ModalPortal onClose={onClose} overlayClassName="items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
      </ModalPortal>
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
              isActive ? 'bg-aura-gold text-navy font-semibold shadow-sm' : 'bg-navy-surface text-fumo hover:bg-navy-surface',
            )}
          >
            {tabKey === 'menu' ? t('orderModal.tabMenu') : t('orderModal.tabOrder')}
            {showBadge && (
              <span
                className={cn(
                  'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold',
                  isActive ? 'bg-white/25 text-white' : 'bg-aura-gold text-navy font-semibold',
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

  const modifierSelectionPanel = modifyingItem && (
    <div className="flex h-full flex-col bg-navy-elevated w-full">
      <div className="shrink-0 p-3 sm:p-4 border-b border-white/[0.08] flex items-center bg-navy-mid sticky top-0 z-10">
        <button type="button" onClick={() => setModifyingItem(null)} className="text-fumo hover:text-white p-2 -ml-2 rounded-lg hover:bg-white/[0.05] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h3 className="font-bold text-pietra text-base sm:text-lg flex-1 ml-2">{modifyingItem.name}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-6">
        {modifyingItem.modifierGroups?.map(group => {
          const selected = selectedModifiers[group.id] || []
          return (
            <div key={group.id} className="space-y-3">
              <div className="flex justify-between items-end">
                <h4 className="font-bold text-pietra">{group.name}</h4>
                {group.isRequired && <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Obbligatorio</span>}
              </div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                {group.options.map(opt => {
                  const isSelected = selected.includes(opt.id)
                  return (
                    <label key={opt.id} className={cn("flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors", isSelected ? "border-amber-400 bg-aura-gold/10" : "border-white/[0.08] bg-navy-surface hover:border-aura-gold/30 hover:bg-white/[0.05]")}>
                      <div className="flex items-center gap-3">
                        <input 
                          type={group.multiSelect ? 'checkbox' : 'radio'}
                          name={`group-${group.id}`}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedModifiers(prev => {
                              const next = { ...prev }
                              if (group.multiSelect) {
                                const max = group.maxOptions || 99
                                if (isSelected) {
                                  next[group.id] = selected.filter(id => id !== opt.id)
                                } else if (selected.length < max) {
                                  next[group.id] = [...selected, opt.id]
                                }
                              } else {
                                next[group.id] = [opt.id]
                              }
                              return next
                            })
                          }}
                          className={cn("h-4 w-4 sm:h-5 sm:w-5 accent-aura-gold bg-navy-mid border-white/20", group.multiSelect ? "rounded" : "rounded-full")}
                        />
                        <span className={cn("font-medium text-sm", isSelected ? "text-aura-gold" : "text-pietra")}>{opt.name}</span>
                      </div>
                      {opt.price > 0 && <span className="text-sm font-bold text-aura-gold">+{formatCurrency(opt.price)}</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="shrink-0 p-4 border-t border-white/[0.08] bg-navy-mid pb-[max(1rem,env(safe-area-inset-bottom))] sticky bottom-0 z-10">
        <button 
          type="button"
          onClick={() => {
            for (const group of modifyingItem.modifierGroups || []) {
              const selectedCount = (selectedModifiers[group.id] || []).length
              const min = group.isRequired ? Math.max(1, group.minOptions) : group.minOptions
              if (selectedCount < min) {
                toast.error(`Seleziona almeno ${min} opzioni per ${group.name}`)
                return
              }
            }
            const allSelectedIds = Object.values(selectedModifiers).flat()
            const allSelectedNames = modifyingItem.modifierGroups?.flatMap(g => g.options.filter(o => allSelectedIds.includes(o.id)).map(o => o.name)) || []
            addToCart(modifyingItem, allSelectedIds, allSelectedNames)
          }}
          className="w-full bg-aura-gold text-white font-bold py-3.5 rounded-xl transition-colors hover:bg-aura-gold-light shadow-lg"
        >
          {t('orderModal.addFor', { defaultValue: 'Aggiungi' })} {formatCurrency(modifyingItem.price + getModifiersPrice(modifyingItem, Object.values(selectedModifiers).flat()))}
        </button>
      </div>
    </div>
  )

  /** Menu: categorie + griglia piatti */
  const menuPanel = modifyingItem ? modifierSelectionPanel : (
    <div className="flex h-full min-h-0 w-full flex-col bg-navy-elevated">
      <div className="flex min-h-0 flex-1">
        <div className="w-28 shrink-0 border-r border-white/[0.08] overflow-y-auto bg-navy-surface/50 py-2 sm:w-36">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'w-full px-3 py-2.5 text-left text-sm font-medium transition-colors',
                (selectedCategory || categories[0]?.id) === cat.id
                  ? 'border-r-2 border-amber-500 bg-aura-gold/10 text-aura-gold'
                  : 'text-fumo hover:bg-white/[0.05]',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 flex flex-col">
          <div className="shrink-0 p-3 pb-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-xs font-bold text-fumo uppercase shrink-0">{t('orderModal.course', { defaultValue: 'Portata' })}:</span>
              {[1, 2, 3, 4, 5].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCourse(c)}
                  className={cn(
                    'shrink-0 h-8 w-8 rounded-full text-xs font-bold transition-colors flex items-center justify-center',
                    selectedCourse === c
                      ? 'bg-aura-gold text-navy'
                      : 'bg-navy-surface text-fumo hover:bg-white/[0.05]',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              {(currentCategory?.items || []).filter(i => i.available).map(item => {
                const cartItems = cart.filter(c => c.menuItemId === item.id)
                const inCart = cartItems.length > 0
                const isSoldOut = item.soldOut || item.orderable === false
              return (
                <div
                  key={item.id}
                  role={isSoldOut ? undefined : 'button'}
                  tabIndex={isSoldOut ? undefined : 0}
                  onClick={() => !isSoldOut && handleItemClick(item)}
                  onKeyDown={e => { if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) handleItemClick(item) }}
                  className={cn(
                    'rounded-xl border-2 p-3 transition-all',
                    isSoldOut
                      ? 'cursor-not-allowed border-white/[0.08] bg-navy-surface/50 opacity-75'
                      : inCart
                        ? 'cursor-pointer border-amber-400 bg-aura-gold/10'
                        : 'cursor-pointer border-white/[0.08] bg-navy-surface hover:border-aura-gold/30 hover:bg-white/[0.05]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm font-semibold', isSoldOut ? 'text-fumo' : 'text-pietra')}>{item.name}</p>
                    {isSoldOut && (
                      <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-400">
                        {t('orderModal.soldOut')}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className={cn('text-base font-bold', isSoldOut ? 'text-fumo' : 'text-aura-gold')}>{formatCurrency(item.price)}</p>
                    {!isSoldOut && inCart && (
                      <div className="flex items-center gap-1.5 rounded-full bg-aura-gold px-2 py-0.5">
                        <button type="button" onClick={e => { e.stopPropagation(); removeFromCart(item.id, cartItems[0].course, cartItems[0].modifiers) }} className="text-white">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold text-white">{cartItems.reduce((s,c) => s + c.quantity, 0)}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); handleItemClick(item) }} className="text-white">
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
    </div>

    {!isDesktop && cartCount > 0 && tab === 'menu' && (
        <button
          type="button"
          onClick={() => setTab('order')}
          className="shrink-0 flex w-full items-center justify-between gap-3 border-t border-amber-600 bg-aura-gold px-4 py-4 text-white shadow-lg pb-[max(1rem,env(safe-area-inset-bottom))]"
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
      <div className="shrink-0 border-b border-white/[0.08] bg-navy-elevated p-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-pietra">{t('orderModal.cartTitle', { count: cartCount })}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          {cart.map((item, idx) => (
            <div key={`${item.menuItemId}-${item.course}-${idx}`} className="flex items-start gap-3">
              <div className="flex items-center gap-1 rounded-full border border-aura-gold/25 bg-aura-gold/10 px-2 py-0.5 mt-0.5">
                <button type="button" onClick={() => removeFromCart(item.menuItemId, item.course, item.modifiers)} aria-label="-">
                  <Minus className="h-3 w-3 text-aura-gold" />
                </button>
                <span className="text-xs font-bold text-pietra">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => {
                    const temp = selectedCourse;
                    setSelectedCourse(item.course);
                    addToCart({ id: item.menuItemId, name: item.name, price: item.basePrice, available: true, category: { name: '' } }, item.modifiers || [], item.modifierNames || []);
                    setSelectedCourse(temp);
                  }}
                  aria-label="+"
                >
                  <Plus className="h-3 w-3 text-aura-gold" />
                </button>
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <p className="truncate text-sm font-medium text-pietra">{item.name}</p>
                {(item.modifierNames && item.modifierNames.length > 0) && (
                  <p className="text-xs text-fumo leading-tight mt-0.5">{item.modifierNames.join(', ')}</p>
                )}
                <span className="text-[10px] text-aura-gold uppercase font-bold mt-1">{t('orderModal.course', { defaultValue: 'Portata' })} {item.course}</span>
              </div>
              <div className="shrink-0 mt-0.5">
                <p className="text-sm font-medium tabular-nums text-pietra">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-white/[0.08] bg-navy-elevated p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex justify-between text-sm font-bold text-pietra">
          <span>{t('orderModal.total')}</span>
          <span className="tabular-nums">{formatCurrency(cartTotal)}</span>
        </div>
        <button
          type="button"
          onClick={handleSendOrder}
          disabled={isSubmitting}
          className="w-full rounded-xl bg-aura-gold py-3.5 text-sm font-semibold text-white transition-colors hover:bg-aura-gold-light disabled:opacity-60"
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
            <span className="text-sm text-fumo">{t('orderModal.orderRef', { ref: activeOrder!.id.slice(-6).toUpperCase() })}</span>
            <span className="rounded-full border border-aura-gold/25 bg-aura-gold/10 px-3 py-1 text-xs font-medium text-aura-gold">
              {ORDER_STATUS_LABELS[activeOrder!.status]}
            </span>
          </div>

          <div className="space-y-3">
            {activeOrder!.items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-surface text-xs font-bold text-pietra">
                    {item.quantity}
                  </span>
                  <span className="truncate text-sm font-medium text-pietra">{item.menuItem.name}</span>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-pietra">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-lg font-bold text-pietra">
            {t('orderModal.orderTotal')}: {formatCurrency(activeOrder!.total)}
          </p>

          <CustomerPicker
            orderId={activeOrder!.id}
            currentCustomer={activeOrder!.customer}
            compact
            onLinked={() => {
              queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
            }}
          />

          {canPayOrder && (
            <button
              type="button"
              onClick={goToCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-aura-gold py-4 text-sm font-semibold text-white transition-colors hover:bg-aura-gold-light"
            >
              <Receipt className="h-5 w-5" />
              {t('orderModal.goToPayment')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setTab('menu')}
            className="w-full py-2 text-sm font-medium text-aura-gold transition-colors hover:text-aura-gold"
          >
            {t('orderModal.addMoreDishes')}
          </button>
        </div>
      </div>
    </>
  ) : null

  const orderEmptyContent = !showCart && !showCheckout && (isDesktop || tab === 'order') ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <ShoppingCart className="mb-3 h-12 w-12 text-fumo" />
      <p className="font-medium text-fumo">{t('orderModal.noOpenOrder')}</p>
      <button type="button" onClick={() => setTab('menu')} className="mt-3 text-sm font-medium text-aura-gold hover:underline">
        {t('orderModal.openMenuToOrder')}
      </button>
    </div>
  ) : null

  /** Pannello ordine / carrello / checkout */
  const orderPanel = (
    <div className="flex h-full min-h-0 w-full flex-col bg-navy-elevated lg:border-l lg:border-white/[0.08]">
      {cartContent}
      {checkoutContent}
      {orderEmptyContent}
    </div>
  )

  return (
    <ModalPortal onClose={onClose} overlayClassName="items-stretch justify-stretch p-0 sm:items-center sm:justify-center sm:p-4">
      <div
        className="saas-modal flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-navy-elevated sm:h-[85dvh] sm:max-h-[85dvh] sm:max-w-4xl sm:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header compatto: titolo + azioni + tab mobile in un solo blocco fisso */}
        <div className="sticky top-0 z-10 shrink-0 border-b border-white/[0.08] bg-navy-mid">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 sm:py-3 sm:pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-pietra sm:text-lg">
                {t('orderModal.title', { number: table.number })}
              </h2>
              <p className="text-xs text-fumo sm:text-sm">{t('orderModal.seats', { count: table.seats })}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {canTransferOrder && activeOrder && onStartTransfer && (
                <button
                  type="button"
                  onClick={() => onStartTransfer(tableId)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                >
                  <ArrowRightLeft className="h-4 w-4 shrink-0" />
                  {t('orderModal.transferActionShort')}
                </button>
              )}
              {isDesktop && tabButtons()}
              <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/[0.05]" aria-label={t('common.close')}>
                <X className="h-5 w-5 text-fumo" />
              </button>
            </div>
          </div>

          {!isDesktop && (
            <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2">
              {tab === 'order' ? (
                <button
                  type="button"
                  onClick={() => setTab('menu')}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-fumo hover:bg-white/[0.05]"
                  aria-label={t('orderModal.backToMenu')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              {tabButtons(true)}
            </div>
          )}
        </div>

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
    </ModalPortal>
  )
}
