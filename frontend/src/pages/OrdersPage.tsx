import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatCurrency, formatDateTime } from '../lib/utils'
import { printReceipt, downloadCSV } from '../lib/export'
import { Clock, ChefHat, CheckCircle2, XCircle, Printer, Download } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

interface OrderItem {
  id: string
  menuItem: { id: string; name: string }
  quantity: number
  unitPrice: number
  status: string
  notes?: string
}

interface Order {
  id: string
  status: string
  type: string
  total: number
  subtotal: number
  tax: number
  notes?: string
  createdAt: string
  table?: { number: number }
  waiter?: { name: string }
  items: OrderItem[]
}

const STATUS_FLOW: Record<string, string> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: 'PAID',
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const { restaurant } = useAuth()
  const [filter, setFilter] = useState<string>('active')

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders', filter],
    queryFn: () => {
      if (filter === 'active') return api.get('/orders/active').then(r => r.data)
      if (filter === 'today') return api.get(`/orders?date=${new Date().toISOString().split('T')[0]}`).then(r => r.data)
      return api.get(`/orders?status=${filter}`).then(r => r.data)
    },
    refetchInterval: filter === 'active' ? 10_000 : undefined,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Stato aggiornato')
    },
  })

  const filters = [
    { key: 'active', label: 'Attivi', count: filter === 'active' ? orders.length : undefined },
    { key: 'today', label: 'Oggi' },
    { key: 'PREPARING', label: 'In cucina' },
    { key: 'READY', label: 'Pronti' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ordini</h1>
        <p className="text-slate-500 text-sm mt-1">Gestione e stato degli ordini</p>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            downloadCSV(
              `ordini-${new Date().toISOString().split('T')[0]}.csv`,
              ['ID', 'Tavolo', 'Tipo', 'Stato', 'Totale', 'Data'],
              orders.map((o: Order) => [
                o.id.slice(-6).toUpperCase(),
                o.table?.number || 'Asporto',
                o.type,
                ORDER_STATUS_LABELS[o.status] || o.status,
                o.total.toFixed(2),
                formatDateTime(o.createdAt),
              ])
            )
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Esporta CSV
        </button>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${filter === f.key ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={`text-xs px-1.5 rounded-full ${filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              {/* Header ordine */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      {order.table ? `Tavolo ${order.table.number}` : 'Asporto'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(order.createdAt)}
                    {order.waiter && <span className="ml-2">· {order.waiter.name}</span>}
                  </div>
                </div>
                <span className="text-lg font-bold text-slate-800">{formatCurrency(order.total)}</span>
              </div>

              {/* Piatti */}
              <div className="space-y-1 mb-4">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                      {item.quantity}
                    </span>
                    <span className="text-slate-700 flex-1">{item.menuItem.name}</span>
                    <span className="text-slate-500">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Azioni */}
              <div className="flex gap-2">
                {STATUS_FLOW[order.status] && (
                  <button
                    onClick={() => updateStatus.mutate({ id: order.id, status: STATUS_FLOW[order.status] })}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    {ORDER_STATUS_LABELS[STATUS_FLOW[order.status]]}
                  </button>
                )}
                {!['PAID', 'CANCELLED'].includes(order.status) && (
                  <button
                    onClick={() => updateStatus.mutate({ id: order.id, status: 'CANCELLED' })}
                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                    title="Annulla"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {order.status === 'PAID' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Pagato
                    </div>
                    <button
                      onClick={() => printReceipt(order, restaurant?.name || 'Ristorante')}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                      title="Stampa scontrino"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-16 text-slate-400">
              <ChefHat className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">Nessun ordine trovato</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
