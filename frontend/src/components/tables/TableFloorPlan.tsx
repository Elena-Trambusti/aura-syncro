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

  const isFree = table.status === 'FREE'
  const isOccupied = table.status === 'OCCUPIED'
  const isCleaning = table.status === 'CLEANING'

  const renderChairs = () => {
    const chairs = []
    const padding = isFree ? 2 : 12 // Distance from table edge
    const chairOpacity = isFree ? 'opacity-30' : 'opacity-100'
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
            className={cn("table-chair absolute rounded-full transition-all duration-500", chairOpacity)}
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
                'table-chair absolute rounded-sm transition-all duration-500',
                chairOpacity,
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

  const shapeClasses = 
    shape === 'ROUND' ? 'rounded-full' :
    'rounded-[24px]' // 2.5D smooth corners for square/rect

  const depthClasses = 'backdrop-blur-md bg-gradient-to-br from-[#1E232E]/90 to-[#0A0D14]/95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_-10px_rgba(0,0,0,0.8)] border border-white/5'

  return (
    <div className={cn('absolute transition-all duration-500', className)} style={style}>
      {/* 2.5D Ambient Glow */}
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-[30px] transition-all duration-1000 rounded-full',
          isOccupied ? 'bg-[#D4AF37]/50 w-[150%] h-[150%] animate-[pulse_4s_ease-in-out_infinite]' :
          isCleaning ? 'bg-[#1E3A8A]/50 w-[150%] h-[150%] animate-[pulse_4s_ease-in-out_infinite]' :
          'bg-transparent w-full h-full'
        )}
      />

      {/* Chairs Layer */}
      <div className="pointer-events-none absolute left-0 top-0 transition-all duration-500" style={{ width: w, height: h }}>
        {renderChairs()}
      </div>

      {/* 2.5D Table Surface */}
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabledInTransfer}
        style={{ width: w, height: h }}
        className={cn(
          'relative flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_20px_40px_-10px_rgba(0,0,0,0.9)]',
          depthClasses,
          shapeClasses,
          orderTotal && 'ring-1 ring-[#D4AF37]/40',
          transferRole === 'source' && 'ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
          transferRole === 'target' && 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer',
          transferRole === 'disabled' && 'opacity-40 grayscale cursor-not-allowed',
        )}
        aria-label={`Tavolo ${table.number}, ${seatsLabel(table.seats)}, ${statusLabel(table.status)}`}
      >
        {/* Inner Highlight for Glassmorphism */}
        <div className={cn('pointer-events-none absolute inset-0 rounded-inherit border border-white/5 bg-gradient-to-b from-white/10 to-transparent opacity-20', shapeClasses)} />
        
        <span className="relative z-10 text-xl font-bold tracking-tight text-[#E8C872] drop-shadow-md">T{table.number}</span>
        <span className="relative z-10 text-xs font-medium text-[#C5A059]/70">{table.seats}p</span>
        
        {table.status !== 'FREE' && (
          <span className={cn(
            'relative z-10 mt-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm',
            'border-[#D4AF37]/40 bg-[#1a1408]/80 text-[#E8C872] shadow-inner',
            table.status === 'CLEANING' && 'border-[#3b82f6]/40 bg-[#0f172a]/80 text-[#93c5fd]',
          )}>
            {statusLabel(table.status as TableStatus)}
          </span>
        )}
          {orderTotal && transferRole !== 'target' && (
            <span className="relative z-10 mt-1.5 text-xs font-semibold text-emerald-400 drop-shadow-sm">{orderTotal}</span>
          )}
          {reservationHint && !orderTotal && transferRole !== 'target' && (
            <span className="relative z-10 mt-1.5 max-w-[90%] truncate px-2 text-center text-[10px] font-semibold text-[#E8C872]/80">
              {reservationHint}
            </span>
          )}
          {transferHint && (
            <span className="relative z-10 mt-1.5 rounded-full border border-blue-500/30 bg-blue-900/40 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-200">
              {transferHint}
            </span>
          )}
        </button>
    </div>
  )
}

export const TABLE_LEGEND_DOT: Record<TableStatus, string> = {
  FREE: 'bg-[#8A9A7B]',
  OCCUPIED: 'bg-[#C5A059]',
  RESERVED: 'bg-[#C9A96E]',
  CLEANING: 'bg-[#7A9BB8]',
}

export const TABLE_STATUS_BADGE: Record<TableStatus, string> = {
  FREE: 'bg-[#0B0E14]/80 text-[#8A9A7B] border border-white/[0.08]',
  OCCUPIED: 'bg-[#0B0E14]/80 text-[#C5A059] border border-[#C5A059]/25',
  RESERVED: 'bg-[#0B0E14]/80 text-[#C9A96E] border border-[#C9A96E]/25',
  CLEANING: 'bg-[#0B0E14]/80 text-[#7A9BB8] border border-[#7A9BB8]/30',
}
