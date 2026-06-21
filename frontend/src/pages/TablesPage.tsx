import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { TABLE_STATUS_LABELS, formatCurrency } from '../lib/utils'
import { ui } from '../lib/ui'
import { RefreshCw, Plus, Edit2, Trash2, Settings2 } from 'lucide-react'
import toast from 'react-hot-toast'
import OrderModal from '../components/orders/OrderModal'
import ModalPortal from '../components/ModalPortal'
import TableFloorPlan, { TABLE_STATUS_BADGE, TABLE_LEGEND_DOT, type FloorTable, type TableStatus } from '../components/tables/TableFloorPlan'
import { cn } from '../lib/utils'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { useRealtimeTables } from '../hooks/useRealtimeInvalidation'
import { useRole } from '../hooks/useRole'

interface MenuItem { id: string; name: string; price: number; available: boolean; category: { name: string } }
interface OrderItem { id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string; notes?: string }
interface Order { id: string; status: string; total: number; subtotal: number; tax: number; items: OrderItem[]; createdAt: string }
interface Table extends FloorTable {
  orders: Order[]
}

type TableFormData = { number: number; seats: number; area: string }

const STAT_ACCENTS = [
  { key: 'free' as const, status: 'FREE' as TableStatus, accent: 'saas-stat-accent-emerald' },
  { key: 'occupied' as const, status: 'OCCUPIED' as TableStatus, accent: 'saas-stat-accent-amber' },
  { key: 'reserved' as const, status: 'RESERVED' as TableStatus, accent: 'saas-stat-accent-amber' },
  { key: 'cleaning' as const, status: 'CLEANING' as TableStatus, accent: 'saas-stat-accent-blue' },
]

function TableFormModal({
  table,
  defaultArea,
  onSave,
  onCancel,
}: {
  table?: Table
  defaultArea: string
  onSave: (data: TableFormData) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<TableFormData>({
    number: table?.number ?? 1,
    seats: table?.seats ?? 4,
    area: table?.area || defaultArea,
  })

  return (
    <ModalPortal onClose={onCancel}>
      <div className={ui.modal} onClick={e => e.stopPropagation()}>
        <h3 className={ui.modalTitle}>{table ? t('tables.editTable') : t('tables.newTable')}</h3>
        <div className="space-y-4">
          <div>
            <label className={ui.label}>{t('guestMenu.tableNumber')} *</label>
            <input
              type="number"
              min={1}
              value={form.number}
              onChange={e => setForm(f => ({ ...f, number: parseInt(e.target.value, 10) || 1 }))}
              className={ui.input}
              placeholder={t('guestMenu.tableNumberPlaceholder')}
            />
          </div>
          <div>
            <label className={ui.label}>{t('common.seats')} *</label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.seats}
              onChange={e => setForm(f => ({ ...f, seats: parseInt(e.target.value, 10) || 4 }))}
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label}>{t('common.area')}</label>
            <input
              value={form.area}
              onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
              className={ui.input}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} className={`flex-1 py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm`}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}

export default function TablesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const canManageTables = can('tables.manage')
  useRealtimeTables()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const allAreasKey = t('common.allAreas')
  const [filterArea, setFilterArea] = useState(allAreasKey)

  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: tq(tk, 'tables'),
    queryFn: () => api.get('/tables').then(r => r.data),
  })

  const defaultArea = t('common.area')

  const createTable = useMutation({
    mutationFn: (data: TableFormData) => api.post('/tables', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      setEditingTable(null)
      toast.success(t('tables.saved'))
    },
  })

  const updateTable = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TableFormData }) => api.put(`/tables/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      setEditingTable(null)
      toast.success(t('tables.saved'))
    },
  })

  const deleteTable = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      toast.success(t('tables.deleted'))
    },
  })

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
    setSelectedTableId(table.id)
    setShowOrderModal(true)
  }

  const handleSaveTable = (data: TableFormData) => {
    if (editingTable?.id) {
      updateTable.mutate({ id: editingTable.id, data })
    } else {
      createTable.mutate(data)
    }
  }

  return (
    <div className="pwa-mobile-page">
      <div className="aura-page-header">
        <div>
          <h1 className="aura-page-title">{t('tables.title')}</h1>
          <p className="aura-page-subtitle">{t('tables.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canManageTables && (
            <button
              type="button"
              onClick={() => { setShowManage(v => !v); setEditingTable(null) }}
              className="flex items-center justify-center gap-2 px-4 py-2 saas-chip rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors w-full sm:w-auto shrink-0"
            >
              <Settings2 className="w-4 h-4" />
              {t('tables.manageSection')}
            </button>
          )}
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })}
            className="flex items-center justify-center gap-2 px-4 py-2 saas-chip rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors w-full sm:w-auto shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      <div className="pwa-tables-stats">
        {STAT_ACCENTS.map(({ key, status, accent }) => (
          <div key={key} className={cn('saas-stat p-4 pl-5', accent)}>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats[key]}</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">{statLabels[key]}</p>
            <span className={cn('inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium', TABLE_STATUS_BADGE[status])}>
              {TABLE_STATUS_LABELS[status]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:overflow-visible">
          {areas.map(area => (
            <button
              key={area}
              type="button"
              onClick={() => setFilterArea(area)}
              className={cn(
                'px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0',
                filterArea === area
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                  : 'saas-chip text-slate-600 hover:bg-slate-50',
              )}
            >
              {area}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {STAT_ACCENTS.map(({ status }) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn('w-2 h-2 rounded-full', TABLE_LEGEND_DOT[status])} />
              {TABLE_STATUS_LABELS[status]}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="saas-floor flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="saas-card p-12 text-center space-y-4">
          <p className="text-base font-semibold text-slate-800">{t('tables.emptyTitle')}</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{t('tables.emptyHint')}</p>
          {canManageTables && (
            <button
              type="button"
              onClick={() => { setShowManage(true); setEditingTable({} as Table) }}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t('tables.emptyAction')}
            </button>
          )}
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

      {canManageTables && showManage && (
        <section className="saas-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('tables.manageSection')}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{t('tables.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingTable({} as Table)}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t('tables.newTable')}
            </button>
          </div>

          <div className={ui.tableWrap}>
            <table className="w-full text-sm">
              <thead>
                <tr className={ui.tableHeadBg}>
                  <th className={`${ui.tableHead} text-left py-2 px-3`}>{t('guestMenu.tableNumber')}</th>
                  <th className={`${ui.tableHead} text-left py-2 px-3`}>{t('common.seats')}</th>
                  <th className={`${ui.tableHead} text-left py-2 px-3`}>{t('common.area')}</th>
                  <th className={`${ui.tableHead} text-left py-2 px-3`}>{t('common.status')}</th>
                  <th className={`${ui.tableHead} text-right py-2 px-3`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tables.map(table => (
                  <tr key={table.id} className={ui.tableRow}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">T{table.number}</td>
                    <td className="py-2.5 px-3 text-slate-600">{table.seats}</td>
                    <td className="py-2.5 px-3 text-slate-600">{table.area || defaultArea}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TABLE_STATUS_BADGE[table.status as TableStatus])}>
                        {TABLE_STATUS_LABELS[table.status as TableStatus]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTable(table)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('tables.confirmDelete'))) deleteTable.mutate(table.id)
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg text-slate-600 hover:text-red-600"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {filtered.some(tbl => tbl.status === 'CLEANING') && (
        <div className="saas-card p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{t('tables.needsCleaning')}</p>
          <div className="flex flex-wrap gap-2">
            {filtered.filter(tbl => tbl.status === 'CLEANING').map(table => (
              <button
                key={table.id}
                type="button"
                onClick={() => {
                  setSelectedTableId(table.id)
                  setShowOrderModal(true)
                }}
                className="saas-chip px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
              >
                T{table.number} — {t('tables.markFree')}
              </button>
            ))}
          </div>
        </div>
      )}

      {editingTable && (
        <TableFormModal
          table={editingTable.id ? editingTable : undefined}
          defaultArea={defaultArea}
          onSave={handleSaveTable}
          onCancel={() => setEditingTable(null)}
        />
      )}

      {showOrderModal && selectedTableId && (
        <OrderModal
          tableId={selectedTableId}
          onClose={() => { setShowOrderModal(false); setSelectedTableId(null) }}
        />
      )}
    </div>
  )
}
