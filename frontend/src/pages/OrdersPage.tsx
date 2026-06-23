import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatCurrency, formatDateTime } from '../lib/utils'
import { printReceipt, downloadOrdersPdf } from '../lib/export'
import { Clock, ChefHat, CheckCircle2, XCircle, Printer, Download } from 'lucide-react'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { useRole } from '../hooks/useRole'
import { useRealtimeOrders } from '../hooks/useRealtimeInvalidation'
import toast from 'react-hot-toast'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'
import FilterPills from '../components/ui/FilterPills'

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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { restaurant } = useAuth()
  const tk = useTenantQueryKey()
  const { canSetOrderStatus, can } = useRole()
  const [filter, setFilter] = useState<string>('active')

  useRealtimeOrders()

  const { data: orders = [], isLoading, isError } = useQuery<Order[]>({
    queryKey: tq(tk, 'orders', filter),
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
      queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      toast.success(t('orders.statusUpdated'))
    },
  })

  const filters = [
    { key: 'active', label: t('orders.filterActive'), count: filter === 'active' ? orders.length : undefined },
    { key: 'today', label: t('orders.filterToday') },
    { key: 'PREPARING', label: t('orders.filterKitchen') },
    { key: 'READY', label: t('orders.filterReady') },
  ]

  const pdfHeaders = [
    t('orders.csvHeaders.id'),
    t('orders.csvHeaders.table'),
    t('orders.csvHeaders.type'),
    t('orders.csvHeaders.status'),
    t('orders.csvHeaders.total'),
    t('orders.csvHeaders.date'),
  ]

  const filterLabels: Record<string, string> = {
    active: t('orders.filterActive'),
    today: t('orders.filterToday'),
    PREPARING: t('orders.filterKitchen'),
    READY: t('orders.filterReady'),
  }

  const handleExportPdf = () => {
    if (isLoading || orders.length === 0) {
      toast.error(t('orders.exportEmpty', { defaultValue: 'Nessun ordine da esportare per il filtro selezionato' }))
      return
    }
    downloadOrdersPdf({
      filename: `ordini-${filter}-${new Date().toISOString().split('T')[0]}.pdf`,
      title: t('orders.title'),
      subtitle: `${filterLabels[filter] ?? filter} · ${orders.length} ${t('orders.exportCount', { defaultValue: 'ordini' })}`,
      headers: pdfHeaders,
      rows: orders.map((o: Order) => [
        o.id.slice(-6).toUpperCase(),
        o.table?.number ? `${t('common.table')} ${o.table.number}` : t('common.takeaway'),
        o.type,
        ORDER_STATUS_LABELS[o.status] || o.status,
        o.total.toFixed(2),
        formatDateTime(o.createdAt),
      ]),
    })
    toast.success(t('orders.exportPdfDone', { defaultValue: 'PDF ordini scaricato' }))
  }

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        actions={(
          <button
            type="button"
            disabled={isLoading || orders.length === 0}
            onClick={handleExportPdf}
            className="aura-btn-ghost flex w-full shrink-0 items-center justify-center gap-1.5 disabled:opacity-50 sm:w-auto"
          >
            <Download className="w-4 h-4" />
            {t('orders.exportPdf', { defaultValue: 'Esporta PDF' })}
          </button>
        )}
      />

      <FilterPills filters={filters} active={filter} onChange={setFilter} />

      {isLoading ? (
        <PageSkeleton variant="cards" count={6} />
      ) : isError ? (
        <QueryErrorBanner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map(order => (
            <div key={order.id} className="aura-order-card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-pietra">
                      {order.table ? `${t('common.table')} ${order.table.number}` : t('common.takeaway')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-fumo">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(order.createdAt)}
                    {order.waiter && <span className="ml-2">· {order.waiter.name}</span>}
                  </div>
                </div>
                <span className="text-lg font-bold text-pietra">{formatCurrency(order.total)}</span>
              </div>

              <div className="space-y-1 mb-4">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-navy-surface rounded-full flex items-center justify-center text-xs font-bold text-fumo">
                      {item.quantity}
                    </span>
                    <span className="text-fumo flex-1">{item.menuItem.name}</span>
                    <span className="text-fumo">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                {STATUS_FLOW[order.status] && canSetOrderStatus(STATUS_FLOW[order.status]) && (
                  <button
                    onClick={() => updateStatus.mutate({ id: order.id, status: STATUS_FLOW[order.status] })}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-aura-gold hover:bg-aura-gold text-navy font-semibold text-xs font-semibold py-2 rounded-lg transition-colors"
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    {ORDER_STATUS_LABELS[STATUS_FLOW[order.status]]}
                  </button>
                )}
                {can('orders.cancel') && !['PAID', 'CANCELLED'].includes(order.status) && (
                  <button
                    onClick={() => updateStatus.mutate({ id: order.id, status: 'CANCELLED' })}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-fumo hover:text-red-500 transition-colors"
                    title={t('orders.cancel')}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {order.status === 'PAID' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {t('common.paid')}
                    </div>
                    <button
                      onClick={() => printReceipt(order, restaurant?.name || t('common.restaurant'))}
                      className="p-1.5 hover:bg-white/[0.05] rounded-lg text-fumo hover:text-fumo transition-colors"
                      title={t('common.printReceipt')}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <EmptyState
              className="col-span-full"
              icon={ChefHat}
              title={t('orders.noOrders')}
            />
          )}
        </div>
      )}
    </ExecutivePageShell>
  )
}
