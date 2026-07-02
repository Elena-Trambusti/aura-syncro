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
      const availableWidth = width - 32
      setScale(availableWidth < 1400 ? availableWidth / 1400 : 1)
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
    <div ref={containerRef} className="relative w-full overflow-hidden bg-[#020202]">
      <div className="flex justify-center p-4 sm:p-6" style={{ minHeight: (900 * scale) + 48 }}>
        <div
          className="origin-top transition-transform duration-300 flex justify-center"
          style={{ 
            transform: `scale(${scale}) translateY(5%)`,
            perspective: '3000px' 
          }}
        >
          <div 
            className="table-floor-premium relative h-[800px] w-[1000px] transition-all duration-1000"
            style={{ 
              transform: 'rotateX(60deg) rotateZ(-45deg)',
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Floor Base */}
            <div className="table-floor-premium__texture absolute inset-0 bg-[#080604] border border-[#D4AF37]/30 shadow-[0_0_100px_rgba(212,175,55,0.15)] rounded-2xl overflow-hidden [transform:translateZ(-1px)]">
               {/* Grid */}
               <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
               {/* Ambient Glows */}
               <div className="absolute top-0 left-0 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.2),transparent_50%)]" />
               <div className="absolute bottom-0 right-0 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_bottom_right,rgba(212,175,55,0.15),transparent_50%)]" />
            </div>

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
                  style={{ 
                    left: `${table.posX}%`, 
                    top: `${table.posY}%`, 
                    transform: `rotateZ(${table.rotation || 0}deg) translateZ(1px)`,
                    transformStyle: 'preserve-3d'
                  }}
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
    const padding = isFree ? 2 : 12
    const chairOpacity = isFree ? 'opacity-40' : 'opacity-100'
    const chairSize = 24
    
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
            className={cn("table-chair absolute transition-all duration-500", chairOpacity)}
            style={{ 
              width: chairSize, 
              height: chairSize, 
              left: `calc(50% + ${x}px - ${chairSize / 2}px)`, 
              top: `calc(50% + ${y}px - ${chairSize / 2}px)`,
              transform: `rotateZ(${angle + Math.PI/2}rad)`,
              transformStyle: 'preserve-3d'
            }}
          >
             <div className="absolute inset-0 rounded-[8px] bg-[#5c4917]" style={{ transform: 'translateZ(-2px)' }} />
             <div className="absolute inset-0 rounded-[8px] bg-[#5c4917]" style={{ transform: 'translateZ(-4px)' }} />
             <div className="absolute inset-0 rounded-[8px] bg-[#5c4917]" style={{ transform: 'translateZ(-6px)' }} />
             <div className="absolute inset-0 rounded-[8px] bg-gradient-to-br from-[#C5A059] to-[#9A7B28] shadow-[0_5px_15px_rgba(0,0,0,0.5)]" />
          </div>
        )
      }
    } else if (shape === 'RECTANGLE' || shape === 'SQUARE') {
      let topCount = 0, bottomCount = 0, leftCount = 0, rightCount = 0;
      if (table.seats === 2) { leftCount = 1; rightCount = 1; }
      else if (table.seats === 4) { topCount = 2; bottomCount = 2; }
      else if (table.seats === 6) { topCount = 2; bottomCount = 2; leftCount = 1; rightCount = 1; }
      else if (table.seats >= 8) { topCount = Math.floor((table.seats - 2) / 2); bottomCount = Math.ceil((table.seats - 2) / 2); leftCount = 1; rightCount = 1; }
      else { topCount = Math.ceil(table.seats / 2); bottomCount = Math.floor(table.seats / 2); }

      const addChairRow = (count: number, side: 'top' | 'bottom' | 'left' | 'right') => {
        for (let i = 0; i < count; i++) {
          const percent = ((i + 1) / (count + 1)) * 100;
          let left, top, rotation;
          if (side === 'top') { left = `${percent}%`; top = `-${padding}px`; rotation = 0; }
          else if (side === 'bottom') { left = `${percent}%`; top = `calc(100% + ${padding}px)`; rotation = 180; }
          else if (side === 'left') { left = `-${padding}px`; top = `${percent}%`; rotation = -90; }
          else { left = `calc(100% + ${padding}px)`; top = `${percent}%`; rotation = 90; }

          chairs.push(
            <div
              key={`chair-${side}-${i}`}
              className={cn(
                'table-chair absolute transition-all duration-500',
                chairOpacity,
              )}
              style={{ 
                left, 
                top, 
                width: 24,
                height: 24,
                transform: `translate(-50%, -50%) rotateZ(${rotation}deg)`,
                transformStyle: 'preserve-3d'
              }}
            >
               <div className="absolute inset-0 rounded-[6px] bg-[#5c4917]" style={{ transform: 'translateZ(-2px)' }} />
               <div className="absolute inset-0 rounded-[6px] bg-[#5c4917]" style={{ transform: 'translateZ(-4px)' }} />
               <div className="absolute inset-0 rounded-[6px] bg-[#5c4917]" style={{ transform: 'translateZ(-6px)' }} />
               <div className="absolute inset-0 rounded-[6px] bg-gradient-to-br from-[#C5A059] to-[#9A7B28] shadow-[0_5px_15px_rgba(0,0,0,0.5)]" />
            </div>
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
    'rounded-[20px]'

  const isThick = !isFree
  const baseColor = isOccupied ? 'bg-[#8A6D23]' : isCleaning ? 'bg-[#1e3a8a]' : 'bg-[#5c4917]'
  const topSurfaceColor = isOccupied 
    ? 'bg-gradient-to-br from-[#E8C872] to-[#D4AF37] border-t border-l border-[#FFF9ED]/50'
    : isCleaning
    ? 'bg-gradient-to-br from-[#3b82f6] to-[#1e40af] border-t border-l border-white/50'
    : 'bg-gradient-to-br from-[#1a1408] to-[#0f0c08] border border-[#D4AF37]/30'

  return (
    <div className={cn('absolute transition-all duration-500', className)} style={{ ...style, transformStyle: 'preserve-3d' }}>
      {/* Floor Ambient Glow */}
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-[30px] transition-all duration-1000 rounded-full',
          isOccupied ? 'bg-[#D4AF37]/40 w-[180%] h-[180%] animate-[pulse_4s_ease-in-out_infinite]' :
          isCleaning ? 'bg-[#3b82f6]/40 w-[180%] h-[180%] animate-[pulse_4s_ease-in-out_infinite]' :
          'bg-[#D4AF37]/10 w-[140%] h-[140%]'
        )}
      />

      {/* Chairs Layer */}
      <div className="pointer-events-none absolute left-0 top-0 transition-all duration-500 [transform-style:preserve-3d]" style={{ width: w, height: h }}>
        {renderChairs()}
      </div>

      {/* Table 3D Assembly */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        style={{ 
          width: w, 
          height: h,
          transform: `translateZ(${isThick ? '20px' : '10px'})`,
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'relative flex flex-col items-center justify-center transition-all duration-300 outline-none',
          !isDisabledInTransfer && 'hover:translate-z-[30px] cursor-pointer',
          orderTotal && 'ring-2 ring-white/60 ring-offset-4 ring-offset-transparent',
          transferRole === 'source' && 'ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent',
          transferRole === 'target' && 'ring-4 ring-emerald-400 cursor-pointer ring-offset-4 ring-offset-transparent',
          transferRole === 'disabled' && 'opacity-40 grayscale cursor-not-allowed',
        )}
        aria-label={`Tavolo ${table.number}, ${seatsLabel(table.seats)}, ${statusLabel(table.status)}`}
      >
        {/* Table Thickness (Voxels) */}
        <div className={cn('pointer-events-none absolute inset-0', shapeClasses, baseColor)} style={{ transform: 'translateZ(-4px)' }} />
        <div className={cn('pointer-events-none absolute inset-0', shapeClasses, baseColor)} style={{ transform: 'translateZ(-8px)' }} />
        <div className={cn('pointer-events-none absolute inset-0', shapeClasses, baseColor)} style={{ transform: 'translateZ(-12px)' }} />
        <div className={cn('pointer-events-none absolute inset-0', shapeClasses, baseColor)} style={{ transform: 'translateZ(-16px)' }} />
        <div className={cn('pointer-events-none absolute inset-0 shadow-[0_15px_40px_rgba(0,0,0,0.8)]', shapeClasses, baseColor)} style={{ transform: 'translateZ(-20px)' }} />

        {/* Top Surface */}
        <div className={cn('pointer-events-none absolute inset-0', shapeClasses, topSurfaceColor)} />
        
        {/* Text Container - Floating & Counter Rotated */}
        <div 
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          style={{ 
             transform: `translateZ(5px) rotateZ(${- (table.rotation || 0)}deg) rotateZ(45deg) rotateX(-60deg)`,
             transformOrigin: 'center center'
          }}
        >
          <span className="text-3xl font-black tracking-tight text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)]">T{table.number}</span>
          <span className="text-xs font-bold text-white bg-black/80 px-2 py-0.5 rounded-full mt-1 border border-white/20 backdrop-blur-md shadow-lg">{table.seats} PAX</span>
          
          {table.status !== 'FREE' && (
            <span className={cn(
              'mt-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm shadow-xl',
              'border-[#D4AF37]/60 bg-[#1a1408]/90 text-[#E8C872]',
              table.status === 'CLEANING' && 'border-[#3b82f6]/60 bg-[#0f172a]/90 text-[#93c5fd]',
            )}>
              {statusLabel(table.status as TableStatus)}
            </span>
          )}
          {orderTotal && transferRole !== 'target' && (
             <span className="mt-1 text-sm font-black text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/80 px-2 py-0.5 rounded-full border border-emerald-500/30">{orderTotal}</span>
          )}
          {reservationHint && !orderTotal && transferRole !== 'target' && (
             <span className="mt-1 max-w-[90%] truncate px-2 text-center text-[10px] font-bold text-[#E8C872] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/80 rounded-full border border-[#D4AF37]/30">
               {reservationHint}
             </span>
          )}
          {transferHint && (
             <span className="mt-1 rounded-full border border-blue-500/50 bg-blue-900/80 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-100 shadow-xl">
               {transferHint}
             </span>
          )}
        </div>
      </div>
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
