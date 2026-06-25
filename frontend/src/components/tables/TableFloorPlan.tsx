import { useEffect, useRef, useState } from 'react'
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
    return seats >= 6 ? { w: 180, h: 110 } : { w: 160, h: 100 }
  }
  const size = seats <= 2 ? 110 : seats <= 4 ? 125 : 140
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
  
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      // Riferimento 1000px. Se lo schermo è più piccolo, calcola la scala.
      // Lasciamo un piccolo margine per non schiacciarlo sui bordi.
      const availableWidth = width - 32 // 32px per i padding
      setScale(availableWidth < 1000 ? availableWidth / 1000 : 1)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleTileClick = (table: FloorTable) => {
    if (inTransferMode && transferSourceId) {
      const role = getTableTransferRole(table, transferSourceId)
      if (role === 'target') onTransferTargetClick?.(table)
      return
    }
    onTableClick(table)
  }
  return (
    <div ref={containerRef} className="w-full overflow-hidden saas-floor bg-navy-mid/30">
      <div className="p-4 sm:p-6" style={{ height: (800 * scale) + 48 }}>
        <div 
          className="origin-top-left transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
        >
          <div
            className="relative w-[1000px] h-[800px] bg-[#0f111a] rounded-2xl border border-white/10 shadow-xl overflow-hidden"
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
      <span className="text-base font-bold leading-none">T{table.number}</span>
      <span className="text-xs opacity-80 leading-none">{table.seats}p</span>
      {table.status !== 'FREE' && (
        <span className={cn(
          'text-[10px] font-bold uppercase leading-none mt-1 px-2 py-1 rounded-full',
          table.status === 'CLEANING' && 'bg-blue-600/90 text-white',
          table.status === 'OCCUPIED' && 'bg-amber-600/90 text-white',
          table.status === 'RESERVED' && 'bg-aura-gold/90 text-white',
        )}>
          {statusLabel(table.status as TableStatus)}
        </span>
      )}
      {orderTotal && transferRole !== 'target' && (
        <span className="text-xs font-bold leading-none mt-1">{orderTotal}</span>
      )}
      {reservationHint && !orderTotal && transferRole !== 'target' && (
        <span className="text-xs font-semibold leading-tight mt-1 text-center px-1.5 drop-shadow-md">{reservationHint}</span>
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
