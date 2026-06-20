import { cn } from '../../lib/utils'

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
export type TableShape = 'SQUARE' | 'ROUND' | 'RECTANGLE'

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
}

const STATUS_CLASS: Record<TableStatus, string> = {
  FREE: 'table-glass--free',
  OCCUPIED: 'table-glass--occupied',
  RESERVED: 'table-glass--reserved',
  CLEANING: 'table-glass--cleaning',
}

const DOT_CLASS: Record<TableStatus, string> = {
  FREE: 'table-status-dot--free',
  OCCUPIED: 'table-status-dot--occupied',
  RESERVED: 'table-status-dot--reserved',
  CLEANING: 'table-status-dot--cleaning',
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

interface TableFloorPlanProps {
  tables: FloorTable[]
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  onTableClick: (table: FloorTable) => void
  activeOrderTotal?: (tableId: string) => string | null
}

export default function TableFloorPlan({
  tables,
  statusLabel,
  seatsLabel,
  onTableClick,
  activeOrderTotal,
}: TableFloorPlanProps) {
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
            onClick={() => onTableClick(table)}
            className="table-glass--static"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="glass-floor p-4 sm:p-6 overflow-x-auto">
      <div
        className="relative mx-auto"
        style={{
          width: '100%',
          maxWidth: bounds.width,
          aspectRatio: `${bounds.width} / ${bounds.height}`,
          minWidth: 320,
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
              onClick={() => onTableClick(table)}
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
  onClick,
  style,
  className,
}: {
  table: FloorTable
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  orderTotal: string | null
  onClick: () => void
  style?: React.CSSProperties
  className?: string
}) {
  const shape = (table.shape || 'SQUARE') as TableShape
  const { w, h } = tableSize(table.seats, shape)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: w, height: h, ...style }}
      className={cn(
        'table-glass',
        STATUS_CLASS[table.status],
        shape === 'ROUND' && 'rounded-full',
        shape === 'SQUARE' && 'rounded-xl',
        shape === 'RECTANGLE' && 'rounded-xl',
        className,
      )}
      aria-label={`Tavolo ${table.number}, ${seatsLabel(table.seats)}, ${statusLabel(table.status)}`}
    >
      <span className={cn('table-status-dot absolute top-2 right-2', DOT_CLASS[table.status])} />
      <span className="text-sm font-bold text-stone-100 leading-none">T{table.number}</span>
      <span className="text-[10px] text-stone-400 leading-none">{table.seats}p</span>
      {orderTotal && (
        <span className="text-[10px] font-semibold text-amber-400/90 leading-none mt-0.5">{orderTotal}</span>
      )}
    </button>
  )
}

export const TABLE_LEGEND_DOT: Record<TableStatus, string> = {
  FREE: 'bg-emerald-400',
  OCCUPIED: 'bg-red-400',
  RESERVED: 'bg-amber-400',
  CLEANING: 'bg-blue-400',
}

export const TABLE_STATUS_BADGE: Record<TableStatus, string> = {
  FREE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  OCCUPIED: 'bg-red-500/15 text-red-400 border border-red-500/25',
  RESERVED: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  CLEANING: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
}
