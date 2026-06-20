import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TABLE_STATUS_LABELS, TABLE_STATUS_COLORS, formatCurrency } from '../lib/utils'
import { Users, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import OrderModal from '../components/orders/OrderModal'

interface MenuItem { id: string; name: string; price: number; available: boolean; category: { name: string } }
interface OrderItem { id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string; notes?: string }
interface Order { id: string; status: string; total: number; subtotal: number; tax: number; items: OrderItem[]; createdAt: string }
interface Table {
  id: string; number: number; name?: string; seats: number
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
  posX: number; posY: number; shape: string; area?: string
  orders: Order[]
}

export default function TablesPage() {
  const queryClient = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [filterArea, setFilterArea] = useState('Tutti')

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

  const areas = ['Tutti', ...Array.from(new Set(tables.map(t => t.area || 'Sala').filter(Boolean)))]
  const filtered = filterArea === 'Tutti' ? tables : tables.filter(t => (t.area || 'Sala') === filterArea)

  const stats = {
    free: tables.filter(t => t.status === 'FREE').length,
    occupied: tables.filter(t => t.status === 'OCCUPIED').length,
    reserved: tables.filter(t => t.status === 'RESERVED').length,
    cleaning: tables.filter(t => t.status === 'CLEANING').length,
  }

  const getActiveOrder = (table: Table) => table.orders?.find(o => !['PAID', 'CANCELLED'].includes(o.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Tavoli & POS</h1>
          <p className="text-stone-400 text-sm mt-1">Gestione tavoli e presa comande</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['tables'] })}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900/55 border border-stone-700/50 rounded-xl text-sm font-medium text-stone-300 hover:bg-stone-900/30 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Aggiorna
        </button>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Liberi', count: stats.free, color: 'bg-emerald-950/40 text-emerald-700 border-emerald-200' },
          { label: 'Occupati', count: stats.occupied, color: 'bg-red-950/40 text-red-700 border-red-200' },
          { label: 'Prenotati', count: stats.reserved, color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Pulizia', count: stats.cleaning, color: 'bg-blue-950/40 text-blue-700 border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 border ${s.color} text-center`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtro area */}
      <div className="flex gap-2 flex-wrap">
        {areas.map(area => (
          <button
            key={area}
            onClick={() => setFilterArea(area)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterArea === area ? 'bg-amber-600 text-white' : 'bg-stone-900/55 border border-stone-700/50 text-stone-300 hover:bg-stone-900/30'}`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Griglia Tavoli */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(table => {
            const activeOrder = getActiveOrder(table)
            return (
              <div
                key={table.id}
                onClick={() => { setSelectedTable(table); setShowOrderModal(true) }}
                className="bg-stone-900/55 rounded-2xl p-4 border-2 cursor-pointer hover:shadow-md transition-all group"
                style={{
                  borderColor: table.status === 'FREE' ? '#10b981' :
                    table.status === 'OCCUPIED' ? '#ef4444' :
                    table.status === 'RESERVED' ? '#f59e0b' : '#3b82f6',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold text-stone-100">T{table.number}</p>
                    {table.name && <p className="text-xs text-stone-500">{table.name}</p>}
                  </div>
                  <div className={`w-3 h-3 rounded-full ${TABLE_STATUS_COLORS[table.status]}`} />
                </div>

                <div className="flex items-center gap-1 text-xs text-stone-400 mb-2">
                  <Users className="w-3 h-3" />
                  <span>{table.seats} posti</span>
                </div>

                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${table.status === 'FREE' ? 'bg-emerald-950/50 text-emerald-400' :
                    table.status === 'OCCUPIED' ? 'bg-red-100 text-red-700' :
                    table.status === 'RESERVED' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'}`}
                >
                  {TABLE_STATUS_LABELS[table.status]}
                </span>

                {activeOrder && (
                  <div className="mt-3 pt-3 border-t border-stone-800/50">
                    <p className="text-xs text-stone-400">{activeOrder.items.length} pietanze</p>
                    <p className="text-sm font-bold text-stone-100">{formatCurrency(activeOrder.total)}</p>
                  </div>
                )}

                {table.status === 'CLEANING' && (
                  <button
                    onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: table.id, status: 'FREE' }); toast.success(`Tavolo ${table.number} pronto`) }}
                    className="mt-3 w-full text-xs bg-stone-800/50 hover:bg-emerald-100 hover:text-emerald-700 text-stone-300 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Segna Libero
                  </button>
                )}
              </div>
            )
          })}
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
