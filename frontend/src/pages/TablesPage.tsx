import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { TABLE_STATUS_LABELS, formatCurrency, formatTime } from '../lib/utils'
import { ui } from '../lib/ui'
import { RefreshCw, Plus, Edit2, Trash2, Settings2, X, CheckCircle2, Users, CalendarCheck, Sparkles } from 'lucide-react'
import { toast } from '@/lib/toast'
import OrderModal from '../components/orders/OrderModal'
import GlassModal from '../components/ui/GlassModal'
import TableFloorPlan, { TABLE_STATUS_BADGE, TABLE_LEGEND_DOT, type FloorTable, type TableStatus } from '../components/tables/TableFloorPlan'
import FloorPlanEditor from '../components/tables/FloorPlanEditor'
import AreaManagerModal from '../components/tables/AreaManagerModal'
import { cn } from '../lib/utils'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { useRealtimeTables } from '../hooks/useRealtimeInvalidation'
import { useSocketStatus } from '../hooks/useSocketStatus'
import { useRole } from '../hooks/useRole'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useShowQuerySkeleton } from '../hooks/useShowQuerySkeleton'
import KpiStatCard from '../components/ui/KpiStatCard'
import FilterPills from '../components/ui/FilterPills'
import { findActiveTableOrder } from '../lib/orderSession'
import { numericFieldFrom, numericInputProps, numericToNumber, type NumericField } from '../lib/numericInput'

interface MenuItem { id: string; name: string; price: number; available: boolean; category: { name: string } }
interface OrderItem { id: string; menuItem: MenuItem; quantity: number; unitPrice: number; status: string; notes?: string }
interface TableReservation {
  id: string
  guestName: string
  covers: number
  date: string
  duration: number
  status: string
}
interface Order { id: string; status: string; total: number; subtotal: number; tax: number; items: OrderItem[]; createdAt: string }
interface Table extends FloorTable {
  orders: Order[]
  reservations?: TableReservation[]
}

type TableFormData = { number: number; seats: number; area: string }
type TableFormState = { number: NumericField; seats: NumericField; area: string }

const STAT_ACCENTS = [
  { key: 'free' as const, status: 'FREE' as TableStatus, accent: 'sage' as const, icon: CheckCircle2 },
  { key: 'occupied' as const, status: 'OCCUPIED' as TableStatus, accent: 'gold-satin' as const, icon: Users },
  { key: 'reserved' as const, status: 'RESERVED' as TableStatus, accent: 'amber-soft' as const, icon: CalendarCheck },
  { key: 'cleaning' as const, status: 'CLEANING' as TableStatus, accent: 'sapphire' as const, icon: Sparkles },
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
  const [form, setForm] = useState<TableFormState>({
    number: numericFieldFrom(table?.number, ''),
    seats: numericFieldFrom(table?.seats, ''),
    area: table?.area || defaultArea,
  })

  const handleSave = () => {
    const number = numericToNumber(form.number, 0)
    const seats = numericToNumber(form.seats, 0)
    if (number < 1 || seats < 1) {
      return
    }
    onSave({ number, seats, area: form.area })
  }

  const canSave =
    numericToNumber(form.number, 0) >= 1 && numericToNumber(form.seats, 0) >= 1

  return (
    <GlassModal onClose={onCancel} maxWidth="md">
      <h3 className={ui.modalTitle}>{table ? t('tables.editTable') : t('tables.newTable')}</h3>
        <div className="space-y-4">
          <div>
            <label className={ui.label}>{t('tables.tableNumber')} *</label>
            <input
              {...numericInputProps(form.number, v => setForm(f => ({ ...f, number: v })), 'int')}
              min={1}
              className={ui.input}
              placeholder={t('tables.tableNumberPlaceholder')}
            />
          </div>
          <div>
            <label className={ui.label}>{t('common.seats')} *</label>
            <input
              {...numericInputProps(form.seats, v => setForm(f => ({ ...f, seats: v })), 'int')}
              min={1}
              max={20}
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
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t('common.save')}
          </button>
        </div>
    </GlassModal>
  )
}

export default function TablesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const canManageTables = can('tables.manage')
  const canTransferOrder = can('orders.items')
  const canCreateOrder = can('orders.create')
  useRealtimeTables()
  const socketConnected = useSocketStatus()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [seatedCustomerId, setSeatedCustomerId] = useState<string | null>(null)
  const [transferSourceId, setTransferSourceId] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [showAreaManager, setShowAreaManager] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const allAreasKey = t('common.allAreas')
  const [filterArea, setFilterArea] = useState(allAreasKey)
  const [reservedTable, setReservedTable] = useState<Table | null>(null)

  const { data: tablesData, isLoading, isError, isFetching, refetch } = useQuery<Table[]>({
    queryKey: tq(tk, 'tables'),
    queryFn: () => api.get<Table[]>('/tables').then(r => r.data),
    refetchInterval: socketConnected ? false : 15_000,
  })
  const showTablesSkeleton = useShowQuerySkeleton(isLoading, tablesData !== undefined)
  const tables = tablesData ?? []

  const defaultArea = t('common.area')

  const createTable = useMutation({
    mutationFn: (data: TableFormData) => api.post('/tables', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      setEditingTable(null)
      toast.success(t('tables.saved'))
    },
    onError: () => {
      toast.error(t('common.saveError', { defaultValue: 'Operazione non riuscita' }))
    },
  })

  const updateTable = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TableFormData }) => api.put(`/tables/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      setEditingTable(null)
      toast.success(t('tables.saved'))
    },
    onError: () => {
      toast.error(t('common.saveError', { defaultValue: 'Operazione non riuscita' }))
    },
  })

  const deleteTable = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      toast.success(t('tables.deleted'))
    },
    onError: () => {
      toast.error(t('common.deleteError', { defaultValue: 'Impossibile eliminare il tavolo' }))
    },
  })

  const seatReservation = useMutation({
    mutationFn: ({ reservationId, tableId }: { reservationId: string; tableId: string }) =>
      api.post<{ customer?: { id: string }; customerId?: string }>(
        `/reservations/${reservationId}/confirm`,
        { tableId },
      ).then(r => r.data),
    onSuccess: (reservation, { reservationId }) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reservations') })
      const table = reservedTable ?? tables.find(tbl => tbl.reservations?.some(r => r.id === reservationId))
      setReservedTable(null)
      setSeatedCustomerId(reservation?.customer?.id ?? reservation?.customerId ?? null)
      if (table && canCreateOrder) {
        setSelectedTableId(table.id)
        setShowOrderModal(true)
      }
      toast.success(t('tables.reservationSeated'))
    },
    onError: () => {
      toast.error(t('common.saveError', { defaultValue: 'Operazione non riuscita' }))
    },
  })

  const markTableFree = useMutation({
    mutationFn: (id: string) => api.patch(`/tables/${id}/status`, { status: 'FREE' }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      const table = tables.find(tbl => tbl.id === id)
      toast.success(t('tables.tableReady', { number: table?.number ?? '' }))
    },
    onError: (err: { response?: { data?: { code?: string } } }) => {
      if (err.response?.data?.code === 'TABLE_HAS_ACTIVE_ORDER') {
        toast.error(t('tables.cannotFreeActiveOrder', { defaultValue: 'Impossibile liberare: ordine o conto ancora aperti' }))
        return
      }
      toast.error(t('common.saveError', { defaultValue: 'Operazione non riuscita' }))
    },
  })

  const transferOrder = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.post(`/tables/${sourceId}/transfer`, { targetTableId: targetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'kitchen', 'orders') })
      setTransferSourceId(null)
      toast.success(t('orderModal.transferSuccess'))
    },
    onError: (err: { response?: { data?: { code?: string } } }) => {
      const code = err.response?.data?.code
      if (code === 'TABLE_TRANSFER_TARGET_UNAVAILABLE' || code === 'TABLE_TRANSFER_TARGET_OCCUPIED') {
        toast.error(t('orderModal.transferTargetUnavailable'))
        return
      }
      toast.error(t('orderModal.transferError'))
    },
  })

  const allAreasRaw = Array.from(new Set(tables.map(tbl => tbl.area || defaultArea).filter(Boolean)))
  const areas = [allAreasKey, ...allAreasRaw]
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

  const getActiveOrder = (table: Table) => findActiveTableOrder(table.orders)

  const transferSourceTable = transferSourceId
    ? tables.find(tbl => tbl.id === transferSourceId)
    : undefined

  const floorPlanTables = (transferSourceId ? tables : filtered).map(tbl => ({
    ...tbl,
    upcomingReservation: tbl.reservations?.[0] ?? null,
  }))

  const getReservationLabel = (table: FloorTable) => {
    const res = table.upcomingReservation
    if (!res) return null
    return `${res.guestName} · ${formatTime(res.date)}`
  }

  const handleStartTransfer = (sourceId: string) => {
    const hasFreeTarget = tables.some(tbl => tbl.id !== sourceId && tbl.status === 'FREE')
    if (!hasFreeTarget) {
      toast.error(t('orderModal.transferNoTargets'))
      return
    }
    setShowOrderModal(false)
    setSelectedTableId(null)
    setTransferSourceId(sourceId)
    setFilterArea(allAreasKey)
  }

  const handleTransferTarget = (target: FloorTable) => {
    if (!transferSourceId || target.status !== 'FREE' || target.id === transferSourceId) return
    transferOrder.mutate({ sourceId: transferSourceId, targetId: target.id })
  }

  const requestCleaningConfirm = async (table: FloorTable) => {
    const confirmed = await toast.confirm({
      title: t('tables.confirmCleaningTitle'),
      description: t('tables.confirmCleaningDescription', { number: table.number }),
      confirmLabel: t('tables.confirmCleaningConfirm'),
      cancelLabel: t('common.cancel'),
      variant: 'cleaning',
      badge: table.number,
      eyebrow: t('tables.cleaning'),
    })
    if (confirmed) markTableFree.mutate(table.id)
  }

  const handleTableClick = (table: FloorTable) => {
    if (transferSourceId) return
    if (table.status === 'CLEANING') {
      void requestCleaningConfirm(table)
      return
    }
    const fullTable = tables.find(tbl => tbl.id === table.id)
    if (table.status === 'RESERVED' && fullTable?.reservations?.[0]) {
      setReservedTable(fullTable)
      return
    }
    const activeOrder = fullTable ? findActiveTableOrder(fullTable.orders) : undefined
    if (!activeOrder && !canCreateOrder) {
      toast.error(t('tables.noOrderPermission', { defaultValue: 'Non hai permesso di aprire nuove comande su questo tavolo' }))
      return
    }
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
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('tables.title')}
        subtitle={t('tables.subtitle')}
        actions={(
          <>
            {canManageTables && (
              <button
                type="button"
                onClick={() => {
                  setShowManage(v => {
                    const next = !v
                    if (next) {
                      requestAnimationFrame(() => {
                        document.getElementById('tables-manage-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      })
                    }
                    return next
                  })
                  setEditingTable(null)
                }}
                className={cn(
                  'flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors sm:w-auto',
                  showManage ? 'bg-aura-gold/15 text-aura-gold border border-aura-gold/30' : 'saas-chip text-fumo hover:bg-white/5 hover:text-pietra',
                )}
              >
                <Settings2 className="h-4 w-4" />
                {t('tables.manageSection')}
              </button>
            )}
            {canManageTables && (
              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C5A059]/55 bg-[#0B0E14]/90 px-4 py-2.5 text-sm font-semibold text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.12)] transition-all hover:border-[#C5A059]/75 hover:bg-[#12151C] hover:shadow-[0_0_28px_rgba(197,160,89,0.2)] sm:w-auto"
              >
                <Edit2 className="h-4 w-4" />
                {t('tables.editLayout', { defaultValue: 'Editor Layout' })}
              </button>
            )}
            <button
              type="button"
              disabled={isFetching}
              onClick={() => {
                void refetch().then(() => toast.success(t('tables.refreshed', { defaultValue: 'Tavoli aggiornati' })))
              }}
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium saas-chip text-fumo transition-colors hover:bg-white/5 hover:text-pietra disabled:opacity-60 sm:w-auto"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {t('common.refresh')}
            </button>
          </>
        )}
      />

      {canManageTables && showManage && (
        <section id="tables-manage-panel" className="saas-card space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-pietra">{t('tables.manageSection')}</h2>
              <p className="mt-0.5 text-sm text-fumo">{t('tables.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAreaManager(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-pietra hover:bg-white/10"
              >
                {t('tables.manageAreas')}
              </button>
              <button
                type="button"
                onClick={() => setEditingTable({} as Table)}
                className="flex items-center justify-center gap-2 rounded-xl bg-aura-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-aura-gold-light shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                <Plus className="h-4 w-4" />
                {t('tables.newTable')}
              </button>
            </div>
          </div>

          <div className={ui.tableWrap}>
            <table className="w-full text-sm">
              <thead>
                <tr className={ui.tableHeadBg}>
                  <th className={`${ui.tableHead} px-3 py-2 text-left`}>{t('tables.tableNumber')}</th>
                  <th className={`${ui.tableHead} px-3 py-2 text-left`}>{t('common.seats')}</th>
                  <th className={`${ui.tableHead} px-3 py-2 text-left`}>{t('common.area')}</th>
                  <th className={`${ui.tableHead} px-3 py-2 text-left`}>{t('common.status')}</th>
                  <th className={`${ui.tableHead} px-3 py-2 text-right`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tables.map(table => (
                  <tr key={table.id} className={ui.tableRow}>
                    <td className="px-3 py-2.5 font-medium text-pietra">T{table.number}</td>
                    <td className="px-3 py-2.5 text-fumo">{table.seats}</td>
                    <td className="px-3 py-2.5 text-fumo">{table.area || defaultArea}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TABLE_STATUS_BADGE[table.status as TableStatus])}>
                        {TABLE_STATUS_LABELS[table.status as TableStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setEditingTable(table)} className="rounded-lg p-2 text-fumo hover:bg-white/5 hover:text-aura-gold transition-colors" title={t('common.edit')}>
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await toast.confirm({
                              title: t('tables.confirmDeleteTitle', { defaultValue: 'Elimina tavolo' }),
                              description: t('tables.confirmDelete'),
                              confirmLabel: t('common.delete'),
                              cancelLabel: t('common.cancel'),
                            })
                            if (confirmed) deleteTable.mutate(table.id)
                          }}
                          className="rounded-lg p-2 text-fumo hover:bg-red-500/10 hover:text-red-400"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {STAT_ACCENTS.map(({ key, accent, icon: Icon }) => (
          <KpiStatCard
            key={key}
            label={statLabels[key]}
            value={stats[key]}
            icon={Icon}
            accent={accent}
            luxuryCounters
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <FilterPills
          filters={areas.map(area => ({ key: area, label: area }))}
          active={filterArea}
          onChange={setFilterArea}
        />

        <div className="flex items-center gap-3 flex-wrap">
          {STAT_ACCENTS.map(({ status }) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-fumo">
              <span className={cn('w-2 h-2 rounded-full', TABLE_LEGEND_DOT[status])} />
              {TABLE_STATUS_LABELS[status]}
            </div>
          ))}
        </div>
      </div>

      {isError ? (
        <QueryErrorBanner />
      ) : showTablesSkeleton ? (
        <PageSkeleton variant="cards" count={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('tables.emptyTitle')}
          description={t('tables.emptyHint')}
          action={canManageTables ? (
            <button
              type="button"
              onClick={() => { setShowManage(true); setEditingTable({} as Table) }}
              className="inline-flex items-center gap-2 bg-aura-gold hover:bg-aura-gold text-navy font-semibold px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t('tables.emptyAction')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className={cn(transferSourceId && 'rounded-xl ring-4 ring-amber-300 ring-offset-2')}>
        <TableFloorPlan
          tables={floorPlanTables}
          statusLabel={status => TABLE_STATUS_LABELS[status]}
          seatsLabel={n => `${n} ${t('common.seats')}`}
          onTableClick={handleTableClick}
          transferSourceId={transferSourceId}
          onTransferTargetClick={handleTransferTarget}
          transferSourceLabel={t('tables.transferFromHere')}
          transferTargetLabel={t('tables.transferTapHere')}
          activeOrderTotal={id => {
            const table = tables.find(tbl => tbl.id === id)
            const order = table ? getActiveOrder(table) : null
            return order ? formatCurrency(order.total) : null
          }}
          reservationLabel={getReservationLabel}
        />
        </div>
      )}

      {filtered.some(tbl => tbl.status === 'CLEANING') && (
        <div className="saas-card p-4">
          <p className="text-xs font-medium text-fumo uppercase tracking-wider mb-3">{t('tables.needsCleaning')}</p>
          <div className="flex flex-wrap gap-2">
            {filtered.filter(tbl => tbl.status === 'CLEANING').map(table => (
              <button
                key={table.id}
                type="button"
                onClick={() => { void requestCleaningConfirm(table) }}
                disabled={markTableFree.isPending}
                className="rounded-lg border border-[#7A9BB8]/30 bg-[#0B0E14]/80 px-3 py-2 text-xs font-semibold text-[#7A9BB8] transition-colors hover:border-[#8A9A7B]/40 hover:bg-[#8A9A7B]/10 hover:text-[#8A9A7B] disabled:opacity-50"
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

      {reservedTable?.reservations?.[0] && (
        <GlassModal onClose={() => setReservedTable(null)} maxWidth="md">
          <h3 className={ui.modalTitle}>{t('tables.reservedTitle', { number: reservedTable.number })}</h3>
            <div className="space-y-3 text-sm text-fumo">
              <p className="text-base font-semibold text-pietra">{reservedTable.reservations[0].guestName}</p>
              <p>{formatTime(reservedTable.reservations[0].date)} · {reservedTable.reservations[0].covers} {t('common.seats')}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => seatReservation.mutate({
                  reservationId: reservedTable.reservations![0].id,
                  tableId: reservedTable.id,
                })}
                disabled={seatReservation.isPending}
                className={`w-full py-2.5 ${ui.btnPrimary} text-sm`}
              >
                {t('tables.seatAndOpenOrder')}
              </button>
              <button type="button" onClick={() => setReservedTable(null)} className={`w-full py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}>
                {t('common.close')}
              </button>
            </div>
        </GlassModal>
      )}

      {showOrderModal && selectedTableId && (
        <OrderModal
          tableId={selectedTableId}
          prefillCustomerId={seatedCustomerId}
          onClose={() => { setShowOrderModal(false); setSelectedTableId(null); setSeatedCustomerId(null) }}
          onStartTransfer={canTransferOrder ? handleStartTransfer : undefined}
        />
      )}

      {transferSourceId && transferSourceTable && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-aura-gold/30 bg-navy/95 backdrop-blur-xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <p className="text-center text-sm font-semibold text-aura-gold leading-snug">
            {t('tables.transferModeBanner', { number: transferSourceTable.number })}
          </p>
          <p className="text-center text-xs text-fumo mt-1">
            {t('tables.transferModeHint')}
          </p>
          <button
            type="button"
            onClick={() => setTransferSourceId(null)}
            disabled={transferOrder.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-3.5 text-sm font-bold text-pietra transition-colors disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            {t('tables.transferCancel')}
          </button>
        </div>
      )}

      {isEditorOpen && (
        <FloorPlanEditor
          tables={tables}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      {showAreaManager && (
        <AreaManagerModal
          areas={allAreasRaw}
          onClose={() => setShowAreaManager(false)}
        />
      )}
    </ExecutivePageShell>
  )
}
