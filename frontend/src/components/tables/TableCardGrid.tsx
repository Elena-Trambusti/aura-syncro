import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn, formatCurrency, formatTime } from '../../lib/utils'
import { findActiveTableOrder } from '../../lib/orderSession'
import { isTableBillStage } from '../../lib/tableFilters'
import { TABLE_STATUS_BADGE, TABLE_LEGEND_DOT, type FloorTable, type TableStatus } from './TableFloorPlan'

export interface TableCardItem extends FloorTable {
  orders?: Array<{ id: string; status: string; total: number; createdAt: string; items?: Array<{ status: string }> }>
  reservations?: Array<{ guestName: string; date: string; covers: number }>
}

interface TableCardGridProps {
  tables: TableCardItem[]
  statusLabel: (status: TableStatus) => string
  onTableClick: (table: TableCardItem) => void
  transferSourceId?: string | null
  className?: string
}

function useElapsedMinutes(since: string | undefined): number | null {
  const [minutes, setMinutes] = useState<number | null>(null)
  useEffect(() => {
    if (!since) {
      setMinutes(null)
      return
    }
    const tick = () => {
      const diff = Date.now() - new Date(since).getTime()
      setMinutes(Math.max(0, Math.floor(diff / 60_000)))
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [since])
  return minutes
}

function TableCard({
  table,
  statusLabel,
  onClick,
  isTransferTarget,
  isTransferSource,
}: {
  table: TableCardItem
  statusLabel: (status: TableStatus) => string
  onClick: () => void
  isTransferTarget?: boolean
  isTransferSource?: boolean
}) {
  const { t } = useTranslation()
  const activeOrder = findActiveTableOrder(table.orders)
  const elapsed = useElapsedMinutes(activeOrder?.createdAt)
  const isBill = isTableBillStage(table)
  const reservation = table.reservations?.[0] ?? table.upcomingReservation
  const prefix = table.shape === 'BAR_STOOL' ? 'B' : table.shape === 'BOOTH' ? 'G' : 'T'

  const metaLine = (() => {
    if (isTransferSource) return t('tables.transferFromHere')
    if (isTransferTarget) return t('tables.transferTapHere')
    if (activeOrder && elapsed != null) {
      return t('tables.mobile.elapsed', { minutes: elapsed })
    }
    if (reservation) {
      return `${formatTime(reservation.date)} · ${reservation.covers} ${t('common.seats')}`
    }
    return null
  })()

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[88px] min-w-0 flex-col rounded-xl border bg-[#0B0E14] p-3 text-left touch-manipulation transition-colors',
        'border-white/[0.08] active:scale-[0.98]',
        isTransferSource && 'border-aura-gold/50 ring-2 ring-aura-gold/30',
        isTransferTarget && 'border-emerald-400/50 ring-2 ring-emerald-400/25',
        table.status === 'OCCUPIED' && !isBill && 'border-[#C5A059]/25',
        isBill && 'border-amber-400/40',
        table.status === 'RESERVED' && 'border-[#C9A96E]/25',
        table.status === 'CLEANING' && 'border-[#7A9BB8]/30',
      )}
      aria-label={`${prefix}${table.number}, ${statusLabel(table.status)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight text-pietra sm:text-lg">
            {prefix}{table.number}
          </p>
          <p className="mt-0.5 text-sm text-slate-300">
            {table.seats} {t('common.seats')}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', TABLE_STATUS_BADGE[table.status])}>
          {isBill ? t('tables.mobile.bill') : statusLabel(table.status)}
        </span>
      </div>

      {(metaLine || activeOrder) && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
          {metaLine && (
            <span className="truncate text-sm text-slate-400">{metaLine}</span>
          )}
          {activeOrder && (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[#F5E6A3]">
              {formatCurrency(activeOrder.total)}
            </span>
          )}
        </div>
      )}

      <span className={cn('mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500', !metaLine && !activeOrder && 'mt-auto')}>
        <span className={cn('h-2 w-2 rounded-full', TABLE_LEGEND_DOT[table.status])} />
        {table.area}
      </span>
    </button>
  )
}

export default function TableCardGrid({
  tables,
  statusLabel,
  onTableClick,
  transferSourceId,
  className,
}: TableCardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3',
        className,
      )}
    >
      {tables.map(table => {
        const isTransferSource = transferSourceId === table.id
        const isTransferTarget = Boolean(
          transferSourceId && table.id !== transferSourceId && table.status === 'FREE',
        )
        return (
          <TableCard
            key={table.id}
            table={table}
            statusLabel={statusLabel}
            onClick={() => onTableClick(table)}
            isTransferSource={isTransferSource}
            isTransferTarget={isTransferTarget}
          />
        )
      })}
    </div>
  )
}
