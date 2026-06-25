import { cn } from '../../lib/utils'

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
export type TableShape = 'SQUARE' | 'ROUND' | 'RECTANGLE'

export interface TableReservationPreview {
  id: string
  guestName: string
  covers: number
  date: string
  status: string
}

export interface FloorTable {
  id: string
  number: number
  name?: string
  seats: number
  status: TableStatus
  posX: number
  posY: number
  shape: string
  rotation?: number
  area?: string
  upcomingReservation?: TableReservationPreview | null
}

const STATUS_CLASS: Record<TableStatus, string> = {
  FREE: 'table-tile--free',
  OCCUPIED: 'table-tile--occupied',
  RESERVED: 'table-tile--reserved',
  CLEANING: 'table-tile--cleaning',
}

function tableSize(seats: number, shape: string) {
  if (shape === 'RECTANGLE') {
    return seats >= 6 ? { w: 112, h: 64 } : { w: 96, h: 56 }
  }
  const size = seats <= 2 ? 64 : seats <= 4 ? 76 : 88
  return { w: size, h: size }
}



export type TableTransferRole = 'source' | 'target' | 'disabled'

export function getTableTransferRole(
  table: FloorTable,
  sourceTableId: string | null | undefined,
): TableTransferRole | null {
  if (!sourceTableId) return null
  if (table.id === sourceTableId) return 'source'
  if (table.status === 'FREE') return 'target'
  return 'disabled'
}

interface TableFloorPlanProps {
  tables: FloorTable[]
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  onTableClick: (table: FloorTable) => void
  activeOrderTotal?: (tableId: string) => string | null
  reservationLabel?: (table: FloorTable) => string | null
  transferSourceId?: string | null
  onTransferTargetClick?: (table: FloorTable) => void
  transferSourceLabel?: string
  transferTargetLabel?: string
}

export default function TableFloorPlan({
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
}: TableFloorPlanProps) {
  const inTransferMode = Boolean(transferSourceId)

  const handleTileClick = (table: FloorTable) => {
    if (inTransferMode && transferSourceId) {
      const role = getTableTransferRole(table, transferSourceId)
      if (role === 'target') onTransferTargetClick?.(table)
      return
    }
    onTableClick(table)
  }
  return (
    <div className="saas-floor p-4 sm:p-6 overflow-x-auto">
      <div
        className="relative mx-auto bg-[#0f111a] rounded-2xl border border-white/10 shadow-xl overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          aspectRatio: '16/9',
          minHeight: 400,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        
        {tables.map(table => {
          return (
            <TableTile
              key={table.id}
              table={table}
              statusLabel={statusLabel}
              seatsLabel={seatsLabel}
              orderTotal={activeOrderTotal?.(table.id) ?? null}
              reservationHint={reservationLabel?.(table) ?? null}
              transferRole={getTableTransferRole(table, transferSourceId)}
              transferHint={
                getTableTransferRole(table, transferSourceId) === 'source'
                  ? transferSourceLabel
                  : getTableTransferRole(table, transferSourceId) === 'target'
                    ? transferTargetLabel
                    : undefined
              }
              onClick={() => handleTileClick(table)}
              className="absolute"
              style={{ left: `${table.posX}%`, top: `${table.posY}%`, transform: `rotate(${table.rotation || 0}deg)` }}
            />
          )
        })}
      </div>
    </div>
  )
}

function TableTile({
  table,
  statusLabel,
  seatsLabel,
  orderTotal,
  reservationHint,
  transferRole,
  transferHint,
  onClick,
  style,
  className,
}: {
  table: FloorTable
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  orderTotal: string | null
  reservationHint?: string | null
  transferRole?: TableTransferRole | null
  transferHint?: string
  onClick: () => void
  style?: React.CSSProperties
  className?: string
}) {
  const shape = (table.shape || 'SQUARE') as TableShape
  const { w, h } = tableSize(table.seats, shape)

  const isDisabledInTransfer = transferRole === 'disabled'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabledInTransfer}
      style={{ width: w, height: h, ...style }}
      className={cn(
        'table-tile',
        STATUS_CLASS[table.status],
        shape === 'ROUND' && 'rounded-full',
        transferRole === 'source' && 'table-tile--transfer-source',
        transferRole === 'target' && 'table-tile--transfer-target',
        transferRole === 'disabled' && 'table-tile--transfer-disabled',
        className,
      )}
      aria-label={`Tavolo ${table.number}, ${seatsLabel(table.seats)}, ${statusLabel(table.status)}`}
    >
      <span className="text-sm font-bold leading-none">T{table.number}</span>
      <span className="text-[10px] opacity-80 leading-none">{table.seats}p</span>
      {table.status !== 'FREE' && (
        <span className={cn(
          'text-[9px] font-semibold uppercase leading-none mt-0.5 px-1.5 py-0.5 rounded-full',
          table.status === 'CLEANING' && 'bg-blue-600/90 text-white',
          table.status === 'OCCUPIED' && 'bg-amber-600/90 text-white',
          table.status === 'RESERVED' && 'bg-aura-gold/90 text-white',
        )}>
          {statusLabel(table.status as TableStatus)}
        </span>
      )}
      {orderTotal && transferRole !== 'target' && (
        <span className="text-[10px] font-semibold leading-none mt-0.5">{orderTotal}</span>
      )}
      {reservationHint && !orderTotal && transferRole !== 'target' && (
        <span className="text-[9px] font-medium leading-tight mt-0.5 text-center px-1 line-clamp-2">{reservationHint}</span>
      )}
      {transferHint && (
        <span className="text-[9px] font-bold uppercase leading-none mt-0.5 px-1.5 py-0.5 rounded-full bg-slate-900 text-white">
          {transferHint}
        </span>
      )}
    </button>
  )
}

export const TABLE_LEGEND_DOT: Record<TableStatus, string> = {
  FREE: 'bg-emerald-500/100',
  OCCUPIED: 'bg-aura-gold',
  RESERVED: 'bg-amber-400',
  CLEANING: 'bg-blue-500/100',
}

export const TABLE_STATUS_BADGE: Record<TableStatus, string> = {
  FREE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
  OCCUPIED: 'bg-aura-gold/10 text-aura-gold border border-aura-gold/25',
  RESERVED: 'bg-aura-gold/10 text-aura-gold border border-aura-gold/25',
  CLEANING: 'bg-blue-500/10 text-blue-400 border border-blue-500/25',
}
