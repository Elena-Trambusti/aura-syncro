import { memo, useMemo } from 'react'
import { Users } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  TABLE_STATUS_BADGE,
  TABLE_LEGEND_DOT,
  getTableTransferRole,
  type FloorTable,
  type TableStatus,
} from './TableFloorPlan'

export interface TableMobileGridProps {
  tables: FloorTable[]
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  onTableClick?: (table: FloorTable) => void
  activeOrderTotal?: (tableId: string) => string | null
  reservationLabel?: (table: FloorTable) => string | null
  transferSourceId?: string | null
  onTransferTargetClick?: (table: FloorTable) => void
  transferSourceLabel?: string
  transferTargetLabel?: string
}

const STATUS_ACCENT: Record<TableStatus, string> = {
  FREE: 'border-l-[#8A9A7B]',
  OCCUPIED: 'border-l-[#C5A059]',
  RESERVED: 'border-l-[#C9A96E]',
  CLEANING: 'border-l-[#7A9BB8]',
}

function tablePrefix(shape: string) {
  if (shape === 'BAR_STOOL') return 'B'
  if (shape === 'BOOTH') return 'G'
  return 'T'
}

const TableMobileCard = memo(function TableMobileCard({
  table,
  statusLabel,
  seatsLabel,
  orderTotal,
  reservationHint,
  transferRole,
  transferHint,
  onClick,
  disabled,
}: {
  table: FloorTable
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  orderTotal: string | null
  reservationHint: string | null
  transferRole: ReturnType<typeof getTableTransferRole>
  transferHint?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const status = table.status as TableStatus
  const isSource = transferRole === 'source'
  const isTarget = transferRole === 'target'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'saas-card flex min-h-[7.5rem] w-full flex-col border-l-4 p-3 text-left transition-colors touch-manipulation',
        STATUS_ACCENT[status],
        isSource && 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-[#020202]',
        isTarget && 'border-amber-400/50 bg-amber-500/[0.06] active:bg-amber-500/10',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled && !isTarget && 'active:bg-white/[0.04]',
      )}
      aria-label={`${tablePrefix(table.shape)}${table.number}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums text-pietra">
          {tablePrefix(table.shape)}{table.number}
        </span>
        <span className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', TABLE_LEGEND_DOT[status])} />
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-fumo">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{seatsLabel(table.seats)}</span>
      </div>

      <div className="mt-auto space-y-1.5 pt-3">
        {transferHint ? (
          <span className="inline-flex rounded-full border border-blue-400/50 bg-blue-950/80 px-2 py-0.5 text-[10px] font-semibold text-blue-100">
            {transferHint}
          </span>
        ) : (
          <>
            {status !== 'FREE' && (
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', TABLE_STATUS_BADGE[status])}>
                {statusLabel(status)}
              </span>
            )}
            {orderTotal && !isTarget && (
              <p className="text-sm font-bold tabular-nums text-[#F5E6A3]">{orderTotal}</p>
            )}
            {reservationHint && !orderTotal && (
              <p className="truncate text-[11px] font-medium text-[#E8C872]">{reservationHint}</p>
            )}
          </>
        )}
      </div>
    </button>
  )
})

export default function TableMobileGrid({
  tables,
  statusLabel,
  seatsLabel,
  onTableClick,
  activeOrderTotal,
  reservationLabel,
  transferSourceId,
  onTransferTargetClick,
  transferSourceLabel,
  transferTargetLabel,
}: TableMobileGridProps) {
  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => a.number - b.number),
    [tables],
  )

  const inTransferMode = Boolean(transferSourceId)

  const handleClick = (table: FloorTable) => {
    if (inTransferMode && transferSourceId) {
      const role = getTableTransferRole(table, transferSourceId)
      if (role === 'target') onTransferTargetClick?.(table)
      return
    }
    onTableClick?.(table)
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {sortedTables.map(table => {
        const transferRole = getTableTransferRole(table, transferSourceId)
        const disabled = inTransferMode && transferRole === 'disabled'
        const transferHint =
          transferRole === 'source' ? transferSourceLabel
            : transferRole === 'target' ? transferTargetLabel
              : undefined

        return (
          <TableMobileCard
            key={table.id}
            table={table}
            statusLabel={statusLabel}
            seatsLabel={seatsLabel}
            orderTotal={activeOrderTotal?.(table.id) ?? null}
            reservationHint={reservationLabel?.(table) ?? null}
            transferRole={transferRole}
            transferHint={transferHint}
            disabled={disabled}
            onClick={() => handleClick(table)}
          />
        )
      })}
    </div>
  )
}
