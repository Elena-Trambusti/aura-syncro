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
            // Rimuoviamo perspective per avere una vera proiezione Ortografica (Isometrica) perfetta!
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
  const isOccupied = table.status === 'OCCUPIED'
  const isReserved = table.status === 'RESERVED'
  const isCleaning = table.status === 'CLEANING'

  const shapeClasses = shape === 'ROUND' ? 'rounded-full' : 'rounded-[16px]'

  const tableZ = 40 // Altezza del tavolo dal pavimento
  const legWidth = 4
  const chairZ = 20 // Altezza della seduta
  const chairSize = 24

  const isHighlighted = isOccupied || isReserved
  const glowShadow = isHighlighted 
    ? 'drop-shadow-[0_0_30px_rgba(212,175,55,0.7)] shadow-[0_0_40px_rgba(212,175,55,0.5)]' 
    : 'shadow-[0_15px_30px_rgba(0,0,0,0.8)]'

  const borderColor = isOccupied ? 'border-[#D4AF37]' : isCleaning ? 'border-[#3b82f6]' : 'border-[#8A6D23]'

  const renderChairs = () => {
    const chairs = []
    const padding = 12

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
            className="absolute transition-all duration-500"
            style={{ 
              width: chairSize, height: chairSize, 
              left: `calc(50% + ${x}px - ${chairSize / 2}px)`, 
              top: `calc(50% + ${y}px - ${chairSize / 2}px)`, 
              transform: `rotateZ(${angle + Math.PI / 2}rad)`, 
              transformStyle: 'preserve-3d' 
            }}
          >
            {/* Gambe della sedia */}
            <div className="absolute left-[10%] top-[10%] bg-[#D4AF37] origin-bottom" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
            <div className="absolute right-[10%] top-[10%] bg-[#D4AF37] origin-bottom" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
            <div className="absolute left-[10%] bottom-[10%] bg-[#D4AF37] origin-bottom" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
            <div className="absolute right-[10%] bottom-[10%] bg-[#D4AF37] origin-bottom" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
            
            {/* Seduta (Rettangolo Minimalista) */}
            <div 
              className={cn("absolute inset-0 rounded-[6px] bg-[#121212] border border-[#D4AF37] shadow-lg")} 
              style={{ transform: `translateZ(${chairZ}px)` }} 
            />
          </div>
        )
      }
    } else {
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
              className="absolute transition-all duration-500"
              style={{ left, top, width: chairSize, height: chairSize, transform: `translate(-50%, -50%) rotateZ(${rotation}deg)`, transformStyle: 'preserve-3d' }}
            >
              {/* Gambe della sedia */}
              <div className="absolute left-[10%] top-[10%] bg-[#D4AF37] origin-bottom shadow-md" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
              <div className="absolute right-[10%] top-[10%] bg-[#D4AF37] origin-bottom shadow-md" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
              <div className="absolute left-[10%] bottom-[10%] bg-[#D4AF37] origin-bottom shadow-md" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
              <div className="absolute right-[10%] bottom-[10%] bg-[#D4AF37] origin-bottom shadow-md" style={{ width: 2, height: chairZ, transform: `rotateX(-90deg) translateZ(0)` }} />
              
              {/* Seduta Minimalista */}
              <div className={cn("absolute inset-0 rounded-[6px] bg-[#121212] border border-[#D4AF37] shadow-xl")} style={{ transform: `translateZ(${chairZ}px)` }} />
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

  // Posizioni delle 4 gambe del tavolo (se rotondo le mettiamo comunque a raggiera o quadrato inscritto)
  const legOffset = shape === 'ROUND' ? '20%' : '10%'

  return (
    <div 
      className={cn(
        'absolute transition-all duration-500 outline-none group', 
        className,
        !isDisabledInTransfer && 'cursor-pointer hover:scale-[1.05] hover:translate-z-[10px]',
        isDisabledInTransfer && 'opacity-40 grayscale cursor-not-allowed'
      )} 
      style={{ 
        ...style, 
        width: w, 
        height: h, 
        transformStyle: 'preserve-3d'
      }}
      role="button"
      tabIndex={0}
      onClick={!isDisabledInTransfer ? onClick : undefined}
      onKeyDown={(e) => { if (!isDisabledInTransfer && e.key === 'Enter') onClick() }}
    >
      
      {/* Dynamic Floor Glow */}
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-[40px] transition-all duration-1000 rounded-full',
          isOccupied ? 'bg-[#D4AF37]/50 w-[200%] h-[200%] animate-[pulse_3s_ease-in-out_infinite]' :
          isCleaning ? 'bg-[#3b82f6]/40 w-[200%] h-[200%] animate-[pulse_3s_ease-in-out_infinite]' :
          'bg-transparent'
        )}
        style={{ transform: 'translateZ(-1px)' }}
      />

      {/* Chairs */}
      <div className="pointer-events-none absolute inset-0 transition-all duration-500" style={{ transformStyle: 'preserve-3d' }}>
        {renderChairs()}
      </div>

      {/* LE GAMBE DEL TAVOLO (Verticali in 3D) */}
      <div className="pointer-events-none absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute bg-gradient-to-t from-[#8B6508] to-[#D4AF37] origin-bottom" style={{ left: legOffset, top: legOffset, width: legWidth, height: tableZ, transform: `rotateX(-90deg) translateZ(0)`, boxShadow: '0 5px 15px rgba(0,0,0,0.8)' }} />
        <div className="absolute bg-gradient-to-t from-[#8B6508] to-[#D4AF37] origin-bottom" style={{ right: legOffset, top: legOffset, width: legWidth, height: tableZ, transform: `rotateX(-90deg) translateZ(0)`, boxShadow: '0 5px 15px rgba(0,0,0,0.8)' }} />
        <div className="absolute bg-gradient-to-t from-[#8B6508] to-[#D4AF37] origin-bottom" style={{ left: legOffset, bottom: legOffset, width: legWidth, height: tableZ, transform: `rotateX(-90deg) translateZ(0)`, boxShadow: '0 5px 15px rgba(0,0,0,0.8)' }} />
        <div className="absolute bg-gradient-to-t from-[#8B6508] to-[#D4AF37] origin-bottom" style={{ right: legOffset, bottom: legOffset, width: legWidth, height: tableZ, transform: `rotateX(-90deg) translateZ(0)`, boxShadow: '0 5px 15px rgba(0,0,0,0.8)' }} />
      </div>

      {/* IL PIANO DEL TAVOLO (Marmo nero con bordo dorato) */}
      <div 
        className={cn(
          'pointer-events-none absolute inset-0 bg-[#121212] border-2 transition-all duration-500', 
          shapeClasses,
          borderColor,
          glowShadow
        )} 
        style={{ 
          transform: `translateZ(${tableZ}px)`,
          // Texture marmo scuro leggera
          backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #121212 100%)',
        }} 
      />

      {/* Floating Counter-Rotated Text UI */}
      {/* 5. Floating, Counter-Rotated Text UI (Direct Sibling) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 flex flex-col items-center justify-center"
        style={{
          // Posizionato esattamente al centro, ruota sul proprio centro per evitare disallineamenti
          transform: `translate(-50%, -50%) translateZ(${tableZ + 60}px) rotateZ(${- (table.rotation || 0)}deg) rotateZ(45deg) rotateX(-60deg)`,
          transformOrigin: 'center center',
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased'
        }}
      >
        <div className="flex flex-col items-center justify-center transition-transform duration-500 group-hover:scale-110">
          
          {/* Luxury Typography Layout */}
          <div className="flex flex-col items-center justify-center">
            
            {/* Table Number */}
            <span className={cn(
              "text-4xl font-black tracking-tighter leading-none mb-1",
              isOccupied 
                ? "text-white drop-shadow-[0_2px_10px_rgba(255,255,255,1)]" 
                : "text-[#D4AF37] drop-shadow-[0_2px_10px_rgba(212,175,55,1)]"
            )}
            style={{ fontFamily: 'var(--font-display), serif' }}
            >
              T{table.number}
            </span>
            
            {/* PAX Indicator */}
            <span className="text-[10px] font-bold text-white/90 bg-black/80 px-2 py-0.5 rounded border border-white/20 uppercase tracking-[0.25em] mb-2 shadow-lg">
              {seatsLabel(table.seats)}
            </span>

            {/* Status & Information Stack */}
            <div className="flex flex-col gap-2 items-center w-full">
              
              {/* Status Pill (Solid, no blur to prevent 3D pixelation) */}
              {table.status !== 'FREE' && (
                <div className={cn(
                  'rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_8px_16px_rgba(0,0,0,0.9)] border',
                  isOccupied ? 'border-[#D4AF37] bg-black/95 text-[#D4AF37]' : 'border-[#3b82f6] bg-[#0f172a]/95 text-[#93c5fd]',
                )}>
                  {statusLabel(table.status as TableStatus)}
                </div>
              )}
              
              {/* Price / Order Total */}
              {orderTotal && transferRole !== 'target' && (
                <div className="text-[13px] font-bold tracking-wide text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] bg-black/95 px-3 py-0.5 rounded-full border border-emerald-500/50 shadow-xl">
                  {orderTotal}
                </div>
              )}
              
              {/* Reservation Hint */}
              {reservationHint && !orderTotal && transferRole !== 'target' && (
                <div className="text-[10px] font-medium tracking-wide text-[#E8C872] drop-shadow-[0_2px_4px_rgba(0,0,0,1)] bg-black/95 px-3 py-0.5 rounded-full border border-[#D4AF37]/50 shadow-xl max-w-[140px] truncate text-center">
                  {reservationHint}
                </div>
              )}
              
              {/* Transfer Hint */}
              {transferHint && (
                <div className="rounded-full border border-blue-500/50 bg-blue-900/95 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-100 shadow-[0_8px_16px_rgba(0,0,0,0.9)]">
                  {transferHint}
                </div>
              )}
            </div>
          </div>
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
