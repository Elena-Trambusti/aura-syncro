import { useEffect, useRef, useState } from 'react'
// Unused Box import removed
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
    <div ref={containerRef} className="relative w-full overflow-hidden bg-navy-mid/30">

      <div className="flex justify-center p-4 sm:p-6" style={{ minHeight: (800 * scale) + 48 }}>
        <div
          className="origin-top transition-transform duration-300"
          style={{ transform: `scale(${scale})` }}
        >
          <div className="table-floor-premium relative h-[800px] w-[1000px]">
            <div className="table-floor-premium__texture absolute inset-0 opacity-80" />
            <div className="table-floor-premium__vignette pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/10 blur-[110px]" />

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
  const glowClass =
    orderTotal ? 'table-tile-glow--order'
    : table.status === 'FREE' ? 'table-tile-glow--free'
    : table.status === 'OCCUPIED' ? 'table-tile-glow--occupied'
    : table.status === 'RESERVED' ? 'table-tile-glow--reserved'
    : 'table-tile-glow--cleaning'

  const renderChairs = () => {
    const chairs = []
    const padding = 12 // Distance from table edge
    const chairSize = 20
    
    if (shape === 'ROUND') {
      const radius = (w / 2) + padding
      const angleStep = (2 * Math.PI) / table.seats
      for (let i = 0; i < table.seats; i++) {
        const angle = i * angleStep - Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        chairs.push(
          <div
            key={`chair-${i}`}
            className="table-chair absolute rounded-full"
            style={{ width: chairSize, height: chairSize, left: `calc(50% + ${x}px - ${chairSize / 2}px)`, top: `calc(50% + ${y}px - ${chairSize / 2}px)` }}
          />
        )
      }
    } else if (shape === 'RECTANGLE' || shape === 'SQUARE') {
      // Simplistic chair placement for rect/square: top/bottom and sides
      // Unused vars removed
      // If table seats is even e.g. 4 -> 2 top, 2 bottom.
      // If table seats is 6 -> 2 top, 2 bottom, 1 left, 1 right.
      
      let topCount = 0, bottomCount = 0, leftCount = 0, rightCount = 0;
      if (table.seats === 2) { leftCount = 1; rightCount = 1; }
      else if (table.seats === 4) { topCount = 2; bottomCount = 2; }
      else if (table.seats === 6) { topCount = 2; bottomCount = 2; leftCount = 1; rightCount = 1; }
      else if (table.seats >= 8) { topCount = Math.floor((table.seats - 2) / 2); bottomCount = Math.ceil((table.seats - 2) / 2); leftCount = 1; rightCount = 1; }
      else { topCount = Math.ceil(table.seats / 2); bottomCount = Math.floor(table.seats / 2); }

      const addChairRow = (count: number, side: 'top' | 'bottom' | 'left' | 'right') => {
        for (let i = 0; i < count; i++) {
          const percent = ((i + 1) / (count + 1)) * 100;
          let left, top;
          if (side === 'top') { left = `${percent}%`; top = `-${padding}px`; }
          else if (side === 'bottom') { left = `${percent}%`; top = `calc(100% + ${padding}px)`; }
          else if (side === 'left') { left = `-${padding}px`; top = `${percent}%`; }
          else { left = `calc(100% + ${padding}px)`; top = `${percent}%`; }

          chairs.push(
            <div
              key={`chair-${side}-${i}`}
              className={cn(
                'table-chair absolute rounded-sm',
                side === 'left' || side === 'right' ? 'h-6 w-3.5' : 'h-3.5 w-6',
              )}
              style={{ left, top, transform: 'translate(-50%, -50%)' }}
            />
          )
        }
      }

      addChairRow(topCount, 'top')
      addChairRow(bottomCount, 'bottom')
      addChairRow(leftCount, 'left')
      addChairRow(rightCount, 'right')
    }
    return chairs;
  }

  return (
    <div className={cn('absolute', className)} style={style}>
      <div
        className={cn(
          'table-tile-glow pointer-events-none absolute left-0 top-0',
          glowClass,
          shape === 'ROUND' && 'rounded-full',
        )}
        style={{ width: w, height: h }}
      />

      <div className="pointer-events-none absolute left-0 top-0" style={{ width: w, height: h }}>
        {renderChairs()}
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={isDisabledInTransfer}
        style={{ width: w, height: h }}
        className={cn(
          'table-tile table-tile--static',
          STATUS_CLASS[table.status],
          orderTotal && 'table-tile--has-order',
          shape === 'ROUND' && 'rounded-full',
          transferRole === 'source' && 'table-tile--transfer-source',
          transferRole === 'target' && 'table-tile--transfer-target',
          transferRole === 'disabled' && 'table-tile--transfer-disabled',
        )}
        aria-label={`Tavolo ${table.number}, ${seatsLabel(table.seats)}, ${statusLabel(table.status)}`}
      >
        <span className="relative z-10 text-base font-bold leading-none text-[#E8C872] drop-shadow-md">T{table.number}</span>
        <span className="relative z-10 text-xs leading-none text-[#C5A059]/80">{table.seats}p</span>
        {table.status !== 'FREE' && (
          <span className={cn(
            'relative z-10 mt-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase leading-none',
            'border-[#D4AF37]/40 bg-[#1a1408]/90 text-[#E8C872]',
            table.status === 'CLEANING' && 'border-[#D4AF37]/25 text-[#C5A059]/70',
          )}>
            {statusLabel(table.status as TableStatus)}
          </span>
        )}
          {orderTotal && transferRole !== 'target' && (
            <span className="table-tile__total relative z-10">{orderTotal}</span>
          )}
          {reservationHint && !orderTotal && transferRole !== 'target' && (
            <span className="relative z-10 mt-1 max-w-[92%] truncate px-1.5 text-center text-xs font-semibold leading-tight text-[#E8C872]/90 drop-shadow-md">
              {reservationHint}
            </span>
          )}
          {transferHint && (
            <span className="relative z-10 mt-0.5 rounded-full border border-[#D4AF37]/30 bg-[#1a1408]/95 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-[#E8C872] shadow-md">
              {transferHint}
            </span>
          )}
        </button>
    </div>
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
