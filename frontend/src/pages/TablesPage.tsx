import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { TABLE_STATUS_LABELS, formatCurrency } from '../lib/utils'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import OrderModal from '../components/orders/OrderModal'
import TableFloorPlan, { TABLE_STATUS_BADGE, TABLE_LEGEND_DOT, type FloorTable, type TableStatus } from '../components/tables/TableFloorPlan'
import { cn } from '../lib/utils'

interface MenuItem { id: string; name: string; price: number; available: boolean; category: { name: string } }
interface OrderItem { id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string; notes?: string }
interface Order { id: string; status: string; total: number; subtotal: number; tax: number; items: OrderItem[]; createdAt: string }
interface Table extends FloorTable {
  orders: Order[]
}

const STAT_ACCENTS = [
  { key: 'free' as const, status: 'FREE' as TableStatus, accent: 'glass-stat-accent-emerald' },
  { key: 'occupied' as const, status: 'OCCUPIED' as TableStatus, accent: 'glass-stat-accent-red' },
  { key: 'reserved' as const, status: 'RESERVED' as TableStatus, accent: 'glass-stat-accent-amber' },
  { key: 'cleaning' as const, status: 'CLEANING' as TableStatus, accent: 'glass-stat-accent-blue' },
]

export default function TablesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const allAreasKey = t('common.allAreas')
  const [filterArea, setFilterArea] = useState(allAreasKey)

  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data),
    refetchInterval: 15_000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tables/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  })

  const defaultArea = t('common.area')
  const areas = [allAreasKey, ...Array.from(new Set(tables.map(tbl => tbl.area || defaultArea).filter(Boolean)))]
  const filtered = filterArea === allAreasKey ? tables : tables.filter(tbl => (tbl.area || defaultArea) === filterArea)

  const stats = {
    free: tables.filter(tbl => tbl.status === 'FREE').length,
    occupied: tables.filter(tbl => tbl.status === 'OCCUPIED').length,
    reserved: tables.filter(tbl => tbl.status === 'RESERVED').length,
    cleaning: tables.filter(tbl => tbl.status === 'CLEANING').length,
  }

  const statLabels: Record<typeof STAT_ACCENTS[number]['key'], string> = {
    free: t('tables.free'),
    occupied: t('tables.occupied'),
    reserved: t('tables.reserved'),
    cleaning: t('tables.cleaning'),
  }

  const getActiveOrder = (table: Table) => table.orders?.find(o => !['PAID', 'CANCELLED'].includes(o.status))

  const handleTableClick = (table: FloorTable) => {
    const full = tables.find(tbl => tbl.id === table.id)
    if (full) {
      setSelectedTable(full)
      setShowOrderModal(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="aura-page-header">
        <div>
          <h1 className="aura-page-title">{t('tables.title')}</h1>
          <p className="aura-page-subtitle">{t('tables.subtitle')}</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['tables'] })}
          className="flex items-center justify-center gap-2 px-4 py-2 glass-chip rounded-xl text-sm font-medium text-stone-300 hover:bg-white/[0.06] transition-colors w-full sm:w-auto shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_ACCENTS.map(({ key, status, accent }) => (
          <div key={key} className={cn('glass-stat p-4 pl-5', accent)}>
            <p className="text-2xl font-bold text-stone-100 tabular-nums">{stats[key]}</p>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mt-0.5">{statLabels[key]}</p>
            <span className={cn('inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium', TABLE_STATUS_BADGE[status])}>
              {TABLE_STATUS_LABELS[status]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {areas.map(area => (
            <button
              key={area}
              type="button"
              onClick={() => setFilterArea(area)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                filterArea === area
                  ? 'bg-amber-600/90 text-stone-950 shadow-md shadow-amber-900/30'
                  : 'glass-chip text-stone-300 hover:bg-white/[0.06]',
              )}
            >
              {area}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {STAT_ACCENTS.map(({ status }) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className={cn('w-2 h-2 rounded-full', TABLE_LEGEND_DOT[status])} />
              {TABLE_STATUS_LABELS[status]}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-floor flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-stone-500 text-sm">
          {t('common.noResults')}
        </div>
      ) : (
        <TableFloorPlan
          tables={filtered}
          statusLabel={status => TABLE_STATUS_LABELS[status]}
          seatsLabel={n => `${n} ${t('common.seats')}`}
          onTableClick={handleTableClick}
          activeOrderTotal={id => {
            const table = tables.find(tbl => tbl.id === id)
            const order = table ? getActiveOrder(table) : null
            return order ? formatCurrency(order.total) : null
          }}
        />
      )}

      {filtered.some(tbl => tbl.status === 'CLEANING') && (
        <div className="glass-card p-4 flex flex-wrap gap-2">
          {filtered.filter(tbl => tbl.status === 'CLEANING').map(table => (
            <button
              key={table.id}
              type="button"
              onClick={() => {
                updateStatus.mutate({ id: table.id, status: 'FREE' })
                toast.success(t('tables.tableReady', { number: table.number }))
              }}
              className="glass-chip px-3 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
            >
              T{table.number} — {t('tables.markFree')}
            </button>
          ))}
        </div>
      )}

      {showOrderModal && selectedTable && (
        <OrderModal
          table={selectedTable}
          onClose={() => { setShowOrderModal(false); setSelectedTable(null) }}
        />
      )}
    </div>
  )
}
