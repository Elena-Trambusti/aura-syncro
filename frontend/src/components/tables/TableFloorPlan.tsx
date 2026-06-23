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

function computeBounds(tables: FloorTable[]) {
  if (tables.length === 0) return { minX: 0, minY: 0, width: 520, height: 300 }

  const xs = tables.map(t => t.posX)
  const ys = tables.map(t => t.posY)
  const pad = 56
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const maxX = Math.max(...xs) + pad + 80
  const maxY = Math.max(...ys) + pad + 80

  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 320),
    height: Math.max(maxY - minY, 240),
  }
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
  const bounds = computeBounds(tables)
  const hasLayout = tables.some(t => t.posX > 0 || t.posY > 0)

  if (!hasLayout) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {tables.map(table => (
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
            className="table-tile--static"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="saas-floor p-4 sm:p-6 overflow-x-auto">
      <div
        className="relative mx-auto"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          aspectRatio: `${bounds.width} / ${bounds.height}`,
          minHeight: 240,
        }}
      >
        {tables.map(table => {
          const left = ((table.posX - bounds.minX) / bounds.width) * 100
          const top = ((table.posY - bounds.minY) / bounds.height) * 100
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
              style={{ left: `${left}%`, top: `${top}%` }}
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
          table.status === 'RESERVED' && 'bg-amber-500/90 text-white',
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
  FREE: 'bg-emerald-500',
  OCCUPIED: 'bg-amber-500',
  RESERVED: 'bg-amber-400',
  CLEANING: 'bg-blue-500',
}

export const TABLE_STATUS_BADGE: Record<TableStatus, string> = {
  FREE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  OCCUPIED: 'bg-amber-50 text-amber-700 border border-amber-200',
  RESERVED: 'bg-amber-50 text-amber-700 border border-amber-200',
  CLEANING: 'bg-blue-50 text-blue-700 border border-blue-200',
}
