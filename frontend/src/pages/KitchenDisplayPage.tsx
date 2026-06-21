import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { getSocket, connectSocket } from '../lib/socket'
import { ChefHat, Clock, CheckCircle2, Flame, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

interface OrderItem {
  id: string
  menuItem: { name: string; preparationTime?: number }
  quantity: number
  status: string
  notes?: string
}

interface Order {
  id: string
  status: string
  type: string
  createdAt: string
  table?: { number: number }
  items: OrderItem[]
  notes?: string
}

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-400',
  PREPARING: 'bg-orange-400',
  READY: 'bg-emerald-400',
  SERVED: 'bg-slate-400',
}

function useElapsedMinutes(createdAt: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const calc = () => setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [createdAt])
  return elapsed
}

function nextItemStatus(status: string): string | null {
  if (status === 'PENDING') return 'PREPARING'
  if (status === 'PREPARING') return 'READY'
  return null
}

function OrderCard({ order, onItemStatusChange, onOrderReady }: {
  order: Order
  onItemStatusChange: (orderId: string, itemId: string, status: string) => void
  onOrderReady: (orderId: string) => void
}) {
  const elapsed = useElapsedMinutes(order.createdAt)
  const isUrgent = elapsed >= 15
  const pendingItems = order.items.filter(i => !['READY', 'SERVED', 'CANCELLED'].includes(i.status))
  const allReady = order.items.every(i => ['READY', 'SERVED', 'CANCELLED'].includes(i.status))

  return (
    <div className={`rounded-2xl border-2 flex flex-col overflow-hidden transition-all ${
      isUrgent ? 'border-red-500 shadow-red-200 shadow-lg' :
      order.status === 'PREPARING' ? 'border-orange-400' : 'border-slate-700'
    } bg-slate-800`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isUrgent ? 'bg-red-600' : order.status === 'PREPARING' ? 'bg-amber-600' : 'bg-slate-700'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-white">
            {order.table ? `T${order.table.number}` : order.type === 'TAKEAWAY' ? '🥡' : '🛵'}
          </span>
          <div>
            <span className="text-xs font-medium text-white/80">
              {order.type === 'DINE_IN' ? 'Sala' : order.type === 'TAKEAWAY' ? 'Asporto' : 'Delivery'}
            </span>
            <p className="text-xs text-white/60">#{order.id.slice(-4).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUrgent && <Flame className="w-5 h-5 text-white animate-pulse" />}
          <div className={`flex items-center gap-1 text-sm font-bold ${isUrgent ? 'text-white' : 'text-white/90'}`}>
            <Clock className="w-4 h-4" />
            {elapsed}m
          </div>
        </div>
      </div>

      {/* Piatti */}
      <div className="flex-1 p-3 space-y-2">
        {order.items.map(item => (
          <div
            key={item.id}
            onClick={() => {
              const next = nextItemStatus(item.status)
              if (next) onItemStatusChange(order.id, item.id, next)
            }}
            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
              item.status === 'READY' ? 'bg-emerald-900/40 opacity-70' :
              item.status === 'SERVED' ? 'bg-slate-700/40 opacity-50' :
              'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ITEM_STATUS_COLORS[item.status] || 'bg-slate-400'}`} />
            <span className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
              {item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${item.status === 'READY' ? 'text-emerald-400 line-through' : 'text-white'}`}>
                {item.menuItem.name}
              </p>
              {item.notes && <p className="text-xs text-yellow-400 mt-0.5">⚠ {item.notes}</p>}
            </div>
            {item.menuItem.preparationTime && (
              <span className="text-xs text-stone-500">{item.menuItem.preparationTime}m</span>
            )}
            {(item.status === 'PENDING' || item.status === 'PREPARING') && (
              <CheckCircle2 className="w-4 h-4 text-stone-500 hover:text-emerald-400 transition-colors" />
            )}
          </div>
        ))}
        {order.notes && (
          <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700/40 rounded-lg">
            <p className="text-xs text-yellow-400">📝 {order.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3">
        {allReady ? (
          <div className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl">
            <CheckCircle2 className="w-4 h-4" />
            Tutto Pronto!
          </div>
        ) : (
          <button
            onClick={() => onOrderReady(order.id)}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
          >
            Segna Tutto Pronto
          </button>
        )}
        <p className="text-center text-xs text-stone-400 mt-1">
          {pendingItems.length} di {order.items.length} da preparare
        </p>
      </div>
    </div>
  )
}

export default function KitchenDisplayPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const [time, setTime] = useState(new Date())
  const [newOrderAlert, setNewOrderAlert] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: tq(tk, 'kitchen', 'orders'),
    queryFn: () => api.get('/orders/active').then(r =>
      r.data.filter((o: Order) => !['PAID', 'CANCELLED', 'SERVED'].includes(o.status))
    ),
    refetchInterval: 8000,
  })

  const refreshKitchen = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: tq(tk, 'kitchen', 'orders') })
  }, [queryClient, tk])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) connectSocket(token)
  }, [])

  // WebSocket per aggiornamenti real-time
  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const onNewOrder = (order: Order) => {
      refreshKitchen()
      if (order.status === 'PENDING' || order.status === 'CONFIRMED') {
        setNewOrderAlert(true)
        toast('🔔 Nuovo ordine!', {
          style: { background: '#c9a227', color: '#fff', fontWeight: 'bold' },
          duration: 4000,
        })
        setTimeout(() => setNewOrderAlert(false), 3000)
      }
    }
    const onOrderUpdated = () => refreshKitchen()

    socket.on('order:created', onNewOrder)
    socket.on('order:updated', onOrderUpdated)
    return () => {
      socket.off('order:created', onNewOrder)
      socket.off('order:updated', onOrderUpdated)
    }
  }, [refreshKitchen])

  const updateItemStatus = useMutation({
    mutationFn: ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) =>
      api.patch(`/orders/${orderId}/items/${itemId}/status`, { status }).then(r => r.data as Order),
    onSuccess: (updatedOrder: Order) => {
      queryClient.setQueryData<Order[]>(['kitchen', 'orders'], prev =>
        prev?.map(o => o.id === updatedOrder.id ? updatedOrder : o) ?? prev,
      )
      refreshKitchen()
    },
    onError: () => toast.error(t('kitchen.dishUpdateError')),
  })

  const orderReady = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/orders/${orderId}/status`, { status: 'READY' }).then(r => r.data as Order),
    onSuccess: (updatedOrder: Order) => {
      queryClient.setQueryData<Order[]>(['kitchen', 'orders'], prev =>
        prev?.map(o => o.id === updatedOrder.id ? updatedOrder : o) ?? prev,
      )
      refreshKitchen()
      toast.success(t('kitchen.orderReady'))
    },
    onError: () => toast.error(t('kitchen.orderReadyError')),
  })

  const pending = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED')
  const preparing = orders.filter(o => o.status === 'PREPARING')
  const ready = orders.filter(o => o.status === 'READY')

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900 text-white">
      {/* Header KDS — flex-wrap su tablet per non tagliare orologio e contatori */}
      <header className={`shrink-0 border-b border-slate-700 px-4 py-3 transition-colors sm:px-6 ${newOrderAlert ? 'bg-orange-600' : 'bg-slate-800'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 gap-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-white">CUCINA</h1>
              <p className="text-xs text-stone-500">Kitchen Display System</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 md:gap-6">
            {/* Contatori */}
            <div className="flex items-center gap-3 sm:gap-4">
              {[
                { label: 'In attesa', count: pending.length, color: 'text-yellow-400' },
                { label: 'Preparando', count: preparing.length, color: 'text-orange-400' },
                { label: 'Pronti', count: ready.length, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-black sm:text-2xl ${s.color}`}>{s.count}</p>
                  <p className="text-[10px] text-stone-500 sm:text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-xl font-bold text-white sm:text-2xl">
                {time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[10px] text-stone-500 sm:text-xs">
                {time.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>

            <a
              href="/"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-stone-500 transition-colors hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Colonne KDS — stack su mobile/tablet, 3 colonne da lg */}
      <div className="min-h-0 flex-1 grid grid-cols-1 divide-y divide-slate-700 overflow-y-auto lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:overflow-hidden">
        {/* Colonna IN ATTESA */}
        <div className="flex min-h-[280px] flex-col lg:min-h-0 lg:overflow-hidden">
          <div className="px-4 py-2.5 bg-yellow-500/10 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-yellow-400 uppercase tracking-wider">
                In Attesa ({pending.length})
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {pending.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onItemStatusChange={(oId, iId, status) => updateItemStatus.mutate({ orderId: oId, itemId: iId, status })}
                onOrderReady={id => orderReady.mutate(id)}
              />
            ))}
            {pending.length === 0 && (
              <div className="flex flex-col items-center py-12 text-stone-300">
                <ChefHat className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Nessun ordine in attesa</p>
              </div>
            )}
          </div>
        </div>

        {/* Colonna IN PREPARAZIONE */}
        <div className="flex min-h-[280px] flex-col lg:min-h-0 lg:overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-600/10 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">
                In Preparazione ({preparing.length})
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {preparing.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onItemStatusChange={(oId, iId, status) => updateItemStatus.mutate({ orderId: oId, itemId: iId, status })}
                onOrderReady={id => orderReady.mutate(id)}
              />
            ))}
            {preparing.length === 0 && (
              <div className="flex flex-col items-center py-12 text-stone-300">
                <Flame className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Nessun ordine in preparazione</p>
              </div>
            )}
          </div>
        </div>

        {/* Colonna PRONTI */}
        <div className="flex min-h-[280px] flex-col lg:min-h-0 lg:overflow-hidden">
          <div className="px-4 py-2.5 bg-emerald-950/400/10 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                Pronti ({ready.length})
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {ready.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onItemStatusChange={(oId, iId, status) => updateItemStatus.mutate({ orderId: oId, itemId: iId, status })}
                onOrderReady={id => orderReady.mutate(id)}
              />
            ))}
            {ready.length === 0 && (
              <div className="flex flex-col items-center py-12 text-stone-300">
                <CheckCircle2 className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Nessun ordine pronto</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer con istruzioni */}
      <footer className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 bg-slate-800 px-4 py-2 sm:px-6">
        <p className="min-w-0 text-xs text-stone-400">
          Clicca su un piatto per avanzare lo stato (In attesa → In prep. → Pronto) · "Segna Tutto Pronto" completa l'ordine
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-stone-400 sm:gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-yellow-400 rounded-full" />In attesa</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-orange-400 rounded-full" />In prep.</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full" />Pronto</span>
        </div>
      </footer>
    </div>
  )
}
