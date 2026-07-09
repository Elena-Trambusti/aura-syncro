import { memo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import type { FloorPlanLayoutV1, FloorPlanZoneLabel as ZoneLabelType } from '../../lib/floorPlanLayout'
import { EMPTY_FLOOR_PLAN_LAYOUT, FLOOR_CANVAS_H, FLOOR_CANVAS_W, wallSegmentMetrics } from '../../lib/floorPlanLayout'
import { MARBLE_BG_WEBP } from '../../lib/brand'
import {
  getTableTransferRole,
  type FloorTable,
  type TableShape,
  type TableStatus,
} from './TableFloorPlan'

export interface TableFloorPlanLiteProps {
  tables: FloorTable[]
  floorLayout?: FloorPlanLayoutV1
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

function tablePrefix(shape: string) {
  if (shape === 'BAR_STOOL') return 'B'
  if (shape === 'BOOTH') return 'G'
  return 'T'
}

/** Dimensioni compatte per mappa 2D mobile — stesse forme del layout, meno DOM */
function tableLiteSize(seats: number, shape: string) {
  if (shape === 'BAR_STOOL') return { w: 44, h: 44 }
  if (shape === 'BOOTH') return { w: 88, h: 48 }
  if (shape === 'RECTANGLE') {
    return seats >= 6 ? { w: 96, h: 56 } : { w: 80, h: 48 }
  }
  const size = seats <= 2 ? 52 : seats <= 4 ? 58 : 64
  return { w: size, h: size }
}

function resolveZoneLabelText(label: ZoneLabelType, t: (key: string, opts?: { defaultValue?: string }) => string) {
  if (label.textKey) {
    const translated = t(label.textKey, { defaultValue: label.text })
    const base = translated !== label.textKey ? translated : label.text
    if (label.variant === 'staff') {
      return `${base} | ${t('tables.zones.staffOnly', { defaultValue: 'STAFF ONLY' })}`
    }
    return base
  }
  return label.text
}

const STATUS_SURFACE: Record<TableStatus, string> = {
  FREE: 'border-[#8A9A7B]/80 bg-[#0B0E14]/95 text-[#C5D4BC]',
  OCCUPIED: 'border-[#C5A059] bg-[#C5A059]/12 text-[#F5E6A3]',
  RESERVED: 'border-[#C9A96E] bg-[#C9A96E]/12 text-[#E8C872]',
  CLEANING: 'border-[#7A9BB8] bg-[#7A9BB8]/12 text-[#B8D4E8]',
}

const LiteTableMarker = memo(function LiteTableMarker({
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
  onClick: () => void
  disabled: boolean
}) {
  const shape = (table.shape || 'SQUARE') as TableShape
  const { w, h } = tableLiteSize(table.seats, shape)
  const status = table.status as TableStatus
  const isRound = shape === 'ROUND' || shape === 'BAR_STOOL'
  const isSource = transferRole === 'source'
  const isTarget = transferRole === 'target'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'absolute flex flex-col items-center justify-center gap-0.5 border-2 px-1 py-1 text-center shadow-sm touch-manipulation transition-transform active:scale-[0.97]',
        isRound ? 'rounded-full' : 'rounded-xl',
        STATUS_SURFACE[status],
        isSource && 'z-20 ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0a0a0e]',
        isTarget && 'z-20 border-blue-400/80 bg-blue-950/40',
        disabled && 'pointer-events-none opacity-35',
      )}
      style={{
        left: `${table.posX}%`,
        top: `${table.posY}%`,
        width: w,
        height: h,
        minWidth: 44,
        minHeight: 44,
        transform: `translate(-50%, -50%) rotate(${table.rotation || 0}deg)`,
      }}
      aria-label={`${tablePrefix(shape)}${table.number}`}
    >
      <span className="text-sm font-bold leading-none tabular-nums">
        {tablePrefix(shape)}{table.number}
      </span>
      <span className="max-w-full truncate text-[9px] font-medium leading-tight opacity-90">
        {transferHint ?? seatsLabel(table.seats)}
      </span>
      {!transferHint && orderTotal && (
        <span className="max-w-full truncate text-[9px] font-bold leading-tight">{orderTotal}</span>
      )}
      {!transferHint && !orderTotal && reservationHint && (
        <span className="max-w-full truncate text-[8px] font-medium leading-tight opacity-90">{reservationHint}</span>
      )}
      {!transferHint && table.status !== 'FREE' && !orderTotal && !reservationHint && (
        <span className="max-w-full truncate text-[8px] font-semibold uppercase leading-tight opacity-80">
          {statusLabel(status)}
        </span>
      )}
    </button>
  )
})

export default function TableFloorPlanLite({
  tables,
  floorLayout = EMPTY_FLOOR_PLAN_LAYOUT,
  statusLabel,
  seatsLabel,
  onTableClick,
  activeOrderTotal,
  reservationLabel,
  transferSourceId,
  onTransferTargetClick,
  transferSourceLabel,
  transferTargetLabel,
}: TableFloorPlanLiteProps) {
  const { t } = useTranslation()
  const lastTapRef = useRef<{ tableId: string; at: number } | null>(null)
  const inTransferMode = Boolean(transferSourceId)

  const handleClick = useCallback((table: FloorTable) => {
    const now = Date.now()
    const last = lastTapRef.current
    if (last?.tableId === table.id && now - last.at < 350) return
    lastTapRef.current = { tableId: table.id, at: now }

    if (inTransferMode && transferSourceId) {
      const role = getTableTransferRole(table, transferSourceId)
      if (role === 'target') onTransferTargetClick?.(table)
      return
    }
    onTableClick?.(table)
  }, [inTransferMode, onTableClick, onTransferTargetClick, transferSourceId])

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-[#0a0a0e] shadow-sm">
      <div
        className="relative w-full bg-cover bg-center"
        style={{
          aspectRatio: `${FLOOR_CANVAS_W} / ${FLOOR_CANVAS_H}`,
          backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.35)), url(${MARBLE_BG_WEBP})`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${FLOOR_CANVAS_W} ${FLOOR_CANVAS_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {(floorLayout.zonePaths ?? []).map(path => (
            <polyline
              key={path.id}
              fill="none"
              stroke="rgba(212,175,55,0.35)"
              strokeWidth={2}
              points={path.points.map(p => `${(p.x / 100) * FLOOR_CANVAS_W},${(p.y / 100) * FLOOR_CANVAS_H}`).join(' ')}
            />
          ))}
          {floorLayout.walls.map(wall => {
            const m = wallSegmentMetrics(wall)
            const x2 = m.x1 + m.length * Math.cos((m.angleDeg * Math.PI) / 180)
            const y2 = m.y1 + m.length * Math.sin((m.angleDeg * Math.PI) / 180)
            return (
              <line
                key={wall.id}
                x1={m.x1}
                y1={m.y1}
                x2={x2}
                y2={y2}
                stroke="rgba(212,175,55,0.65)"
                strokeWidth={Math.max(3, m.thicknessPx)}
                strokeLinecap="round"
              />
            )
          })}
        </svg>

        {floorLayout.zoneLabels.map(zl => (
          <div
            key={zl.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E8C872]/70"
            style={{ left: `${zl.x}%`, top: `${zl.y}%` }}
          >
            {resolveZoneLabelText(zl, t)}
          </div>
        ))}

        {tables.map(table => {
          const transferRole = getTableTransferRole(table, transferSourceId)
          const disabled = inTransferMode && transferRole === 'disabled'
          const transferHint =
            transferRole === 'source' ? transferSourceLabel
              : transferRole === 'target' ? transferTargetLabel
                : undefined

          return (
            <LiteTableMarker
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
    </div>
  )
}
