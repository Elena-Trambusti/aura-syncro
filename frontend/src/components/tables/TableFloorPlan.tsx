import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import type { FloorPlanLayoutV1, FloorPlanZoneLabel as ZoneLabelType } from '../../lib/floorPlanLayout'
import { EMPTY_FLOOR_PLAN_LAYOUT, FLOOR_CANVAS_H, FLOOR_CANVAS_W } from '../../lib/floorPlanLayout'
import FloorPlanWall from './FloorPlanWall'
import FloorPlanZonePathLayer from './FloorPlanZonePathLayer'

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
export type TableShape = 'SQUARE' | 'ROUND' | 'RECTANGLE' | 'BAR_STOOL' | 'BOOTH'

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

export function tableSize(seats: number, shape: string) {
  if (shape === 'BAR_STOOL') return { w: 40, h: 40 }
  if (shape === 'BOOTH') return { w: 130, h: 72 }
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

export interface TableFloorPlanProps {
  tables: FloorTable[]
  floorLayout?: FloorPlanLayoutV1
  statusLabel: (status: TableStatus) => string
  seatsLabel: (n: number) => string
  onTableClick?: (table: FloorTable) => void
  onTableHover?: (table: FloorTable) => void
  activeOrderTotal?: (tableId: string) => string | null
  reservationLabel?: (table: FloorTable) => string | null
  transferSourceId?: string | null
  onTransferTargetClick?: (table: FloorTable) => void
  transferSourceLabel?: string
  transferTargetLabel?: string
  interactive?: boolean
  className?: string
  embedded?: boolean
}

import { MARBLE_BG_WEBP } from '../../lib/brand'

const MARBLE_BG = MARBLE_BG_WEBP
export const TABLE_TOP_Z = 48
export const FLOOR_ROT_X_DEG = 58
export const FLOOR_ROT_Z_DEG = -45
export const FLOOR_W = FLOOR_CANVAS_W
export const FLOOR_H = FLOOR_CANVAS_H

type LabelPosition = { x: number; y: number }

function positionsEqual(a: Record<string, LabelPosition>, b: Record<string, LabelPosition>) {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every(k => a[k]?.x === b[k]?.x && a[k]?.y === b[k]?.y)
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

export default function TableFloorPlan({
  tables,
  floorLayout = EMPTY_FLOOR_PLAN_LAYOUT,
  statusLabel,
  seatsLabel,
  onTableClick,
  onTableHover,
  activeOrderTotal,
  reservationLabel,
  transferSourceId,
  onTransferTargetClick,
  transferSourceLabel,
  transferTargetLabel,
  interactive = true,
  className,
  embedded = false,
}: TableFloorPlanProps) {
  const { t } = useTranslation()
  const inTransferMode = Boolean(transferSourceId)

  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [labelPositions, setLabelPositions] = useState<Record<string, LabelPosition>>({})
  const [zoneLabelPositions, setZoneLabelPositions] = useState<Record<string, LabelPosition>>({})
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false)
  const activeFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef<{ tableId: string; at: number } | null>(null)

  const fallbackLabelPositions = useMemo(() => {
    const next: Record<string, LabelPosition> = {}
    for (const table of tables) {
      next[table.id] = {
        x: (table.posX / 100) * FLOOR_W,
        y: (table.posY / 100) * FLOOR_H,
      }
    }
    return next
  }, [tables])

  const effectiveLabelPositions = useMemo(
    () => ({ ...fallbackLabelPositions, ...labelPositions }),
    [fallbackLabelPositions, labelPositions],
  )

  useEffect(() => () => {
    if (activeFlashTimeoutRef.current) clearTimeout(activeFlashTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQueries = [
      window.matchMedia('(max-width: 900px)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    ]
    const sync = () => setLowPerformanceMode(mediaQueries.some(query => query.matches))
    sync()
    for (const query of mediaQueries) query.addEventListener('change', sync)
    return () => {
      for (const query of mediaQueries) query.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    if (embedded || !containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      const availableWidth = width - 32
      setScale(availableWidth < 1400 ? availableWidth / 1400 : 1)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [embedded])

  const measureLabels = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return

    const sceneRect = scene.getBoundingClientRect()
    const nextTables: Record<string, LabelPosition> = {}
    const nextZones: Record<string, LabelPosition> = {}

    scene.querySelectorAll<HTMLElement>('[data-table-top]').forEach(el => {
      const id = el.dataset.tableId
      if (!id) return
      const rect = el.getBoundingClientRect()
      const scaleX = sceneRect.width / FLOOR_W
      const scaleY = sceneRect.height / FLOOR_H
      if (scaleX <= 0 || scaleY <= 0) return
      nextTables[id] = {
        x: (rect.left + rect.width / 2 - sceneRect.left) / scaleX,
        y: (rect.top + rect.height / 2 - sceneRect.top) / scaleY,
      }
    })

    scene.querySelectorAll<HTMLElement>('[data-zone-label]').forEach(el => {
      const id = el.dataset.zoneLabelId
      if (!id) return
      const rect = el.getBoundingClientRect()
      const scaleX = sceneRect.width / FLOOR_W
      const scaleY = sceneRect.height / FLOOR_H
      if (scaleX <= 0 || scaleY <= 0) return
      nextZones[id] = {
        x: (rect.left + rect.width / 2 - sceneRect.left) / scaleX,
        y: (rect.top + rect.height / 2 - sceneRect.top) / scaleY,
      }
    })

    setLabelPositions(prev => (positionsEqual(prev, nextTables) ? prev : nextTables))
    setZoneLabelPositions(prev => (positionsEqual(prev, nextZones) ? prev : nextZones))
  }, [])

  useLayoutEffect(() => {
    measureLabels()
    const raf = requestAnimationFrame(measureLabels)
    return () => cancelAnimationFrame(raf)
  }, [tables, floorLayout, scale, measureLabels])

  useEffect(() => {
    const scene = sceneRef.current
    const container = containerRef.current
    if (!scene) return

    const observer = new ResizeObserver(() => measureLabels())
    observer.observe(scene)
    if (container) observer.observe(container)
    window.addEventListener('resize', measureLabels)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measureLabels)
    }
  }, [measureLabels])

  const handleTableHoverEnd = () => {
    setHoveredTableId(null)
  }

  const flashTableActive = useCallback((tableId: string) => {
    if (activeFlashTimeoutRef.current) clearTimeout(activeFlashTimeoutRef.current)
    setActiveTableId(tableId)
    setHoveredTableId(tableId)
    activeFlashTimeoutRef.current = setTimeout(() => {
      setActiveTableId(null)
      activeFlashTimeoutRef.current = null
    }, 650)
  }, [])

  const handleTableClick = (table: FloorTable) => {
    if (!interactive || !onTableClick) return

    const now = Date.now()
    const last = lastTapRef.current
    if (last?.tableId === table.id && now - last.at < 350) return
    lastTapRef.current = { tableId: table.id, at: now }

    flashTableActive(table.id)

    if (inTransferMode && transferSourceId) {
      const role = getTableTransferRole(table, transferSourceId)
      if (role === 'target') onTransferTargetClick?.(table)
      return
    }
    onTableClick(table)
  }

  /** Hit target invisibili — sempre attivi su mobile/desktop per tap affidabile al primo tocco */
  const useScreenHits = interactive && tables.length > 0

  const handleTableHoverStart = (tableId: string) => {
    setHoveredTableId(tableId)
    const table = tables.find(tbl => tbl.id === tableId)
    if (table) onTableHover?.(table)
  }

  const renderLite = lowPerformanceMode || tables.length >= 18

  const sceneContent = (
    <div
      ref={sceneRef}
      className={cn('relative', className)}
      style={{ width: FLOOR_W, height: FLOOR_H }}
    >
      <div
        className="table-floor-premium absolute inset-0"
        style={{
          transform: `rotateX(${FLOOR_ROT_X_DEG}deg) rotateZ(${FLOOR_ROT_Z_DEG}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="table-floor-premium__texture absolute inset-0 overflow-hidden rounded-2xl border border-[#D4AF37]/30 shadow-[0_0_100px_rgba(212,175,55,0.15)] [transform:translateZ(-1px)]">
          <img src={MARBLE_BG} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/30" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="absolute top-0 left-0 h-[150%] w-[150%] bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.2),transparent_50%)]" />
          <div className="absolute bottom-0 right-0 h-[150%] w-[150%] bg-[radial-gradient(ellipse_at_bottom_right,rgba(212,175,55,0.15),transparent_50%)]" />
        </div>

        {floorLayout.walls.map(wall => (
          <FloorPlanWall key={wall.id} wall={wall} />
        ))}

        <FloorPlanZonePathLayer paths={floorLayout.zonePaths ?? []} />

        {floorLayout.zoneLabels.map(zl => (
          <div
            key={zl.id}
            data-zone-label
            data-zone-label-id={zl.id}
            className="pointer-events-none absolute h-px w-px"
            style={{
              left: `${zl.x}%`,
              top: `${zl.y}%`,
              transform: 'translate(-50%, -50%) translateZ(4px)',
            }}
          />
        ))}

        {tables.map(table => {
          const transferRole = getTableTransferRole(table, transferSourceId)
          return (
            <TableTile
              key={table.id}
              table={table}
              isDisabledInTransfer={transferRole === 'disabled'}
              isHovered={hoveredTableId === table.id}
              isActive={activeTableId === table.id}
              renderLite={renderLite}
              onActivate={() => flashTableActive(table.id)}
              onClick={() => handleTableClick(table)}
              interactive={interactive && !useScreenHits}
              className="absolute"
              style={{
                left: `${table.posX}%`,
                top: `${table.posY}%`,
                transform: `rotateZ(${table.rotation || 0}deg) translateZ(1px)`,
                transformStyle: 'preserve-3d',
              }}
            />
          )
        })}
      </div>

      {useScreenHits && (
        <div className="absolute inset-0 z-[34]">
          {tables.map(table => {
            const pos = effectiveLabelPositions[table.id]
            if (!pos) return null
            const transferRole = getTableTransferRole(table, transferSourceId)
            if (inTransferMode && transferRole === 'disabled') return null
            const { w, h } = tableSize(table.seats, table.shape || 'SQUARE')
            const hitW = Math.max(104, w + 36)
            const hitH = Math.max(112, h + 64)
            return (
              <button
                key={`hit-${table.id}`}
                type="button"
                className={cn(
                  'absolute cursor-pointer touch-manipulation border-0 bg-transparent p-0',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]/50 focus-visible:outline-offset-2',
                )}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: hitW,
                  height: hitH,
                  transform: 'translate(-50%, -42%)',
                }}
                onPointerEnter={() => handleTableHoverStart(table.id)}
                onPointerLeave={handleTableHoverEnd}
                onPointerUp={e => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return
                  handleTableClick(table)
                }}
                aria-label={`Tavolo ${table.number}`}
              />
            )
          })}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
        {floorLayout.zoneLabels.map(zl => {
          const pos = zoneLabelPositions[zl.id]
          if (!pos) return null
          return (
            <div
              key={`zone-${zl.id}`}
              className="absolute"
              style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
            >
              <span
                className={cn(
                  'floor-plan-zone-label',
                  zl.variant === 'staff' && 'floor-plan-zone-label--staff',
                  zl.variant === 'area' && 'floor-plan-zone-label--area',
                )}
              >
                {resolveZoneLabelText(zl, t)}
              </span>
            </div>
          )
        })}

        {tables.map(table => {
          const pos = effectiveLabelPositions[table.id]
          if (!pos) return null
          const { w } = tableSize(table.seats, table.shape || 'SQUARE')
          const isCompactTable = w <= 125
          const transferRole = getTableTransferRole(table, transferSourceId)
          const seatsWord = seatsLabel(table.seats).replace(/^\d+\s*/, '').toUpperCase()

          return (
            <div
              key={`label-${table.id}`}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, calc(-100% - 14px))',
              }}
            >
              <TableLabelPill
                table={table}
                statusLabel={statusLabel}
                seatsWord={seatsWord}
                orderTotal={activeOrderTotal?.(table.id) ?? null}
                reservationHint={reservationLabel?.(table) ?? null}
                transferRole={transferRole}
                transferHint={
                  transferRole === 'source' ? transferSourceLabel
                    : transferRole === 'target' ? transferTargetLabel
                      : undefined
                }
                isCompactTable={isCompactTable}
                isHovered={hoveredTableId === table.id}
                isActive={activeTableId === table.id}
              />
            </div>
          )
        })}
      </div>
    </div>
  )

  if (embedded) {
    return sceneContent
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-[#020202]">
      <div className="flex justify-center p-4 sm:p-6" style={{ minHeight: (900 * scale) + 48 }}>
        <div
          className="origin-top flex justify-center"
          style={{
            transform: `scale(${scale}) translateY(5%)`,
            perspective: '1400px',
            perspectiveOrigin: '50% 38%',
          }}
        >
          {sceneContent}
        </div>
      </div>
    </div>
  )
}

const TableLabelPill = memo(function TableLabelPill({
  table, statusLabel, seatsWord, orderTotal, reservationHint, transferRole, transferHint, isCompactTable, isHovered, isActive,
}: {
  table: FloorTable
  statusLabel: (status: TableStatus) => string
  seatsWord: string
  orderTotal: string | null
  reservationHint?: string | null
  transferRole?: TableTransferRole | null
  transferHint?: string
  isCompactTable: boolean
  isHovered?: boolean
  isActive?: boolean
}) {
  const isOccupied = table.status === 'OCCUPIED'
  const isCleaning = table.status === 'CLEANING'
  const prefix = table.shape === 'BAR_STOOL' ? 'B' : table.shape === 'BOOTH' ? 'G' : 'T'

  return (
    <div className={cn(
      'table-label-pill',
      isCompactTable && 'table-label-pill--compact',
      isActive && 'table-label-pill--active',
      !isActive && isHovered && 'table-label-pill--hover',
    )}>
      <span className="table-label-pill__number">{prefix}{table.number}</span>
      <span className="table-label-pill__seats">{table.seats} {seatsWord}</span>
      {(table.status !== 'FREE' || orderTotal || reservationHint || transferHint) && (
        <div className="table-label-pill__meta">
          {table.status !== 'FREE' && (
            <span className={cn(
              'table-label-pill__badge',
              isOccupied ? 'border-[#D4AF37]/70 text-[#F5E6A3] bg-black/80' :
              isCleaning ? 'border-[#3b82f6]/70 text-[#93c5fd] bg-[#0f172a]/90' :
              'border-[#C9A96E]/70 text-[#E8C872] bg-black/80',
            )}>
              {statusLabel(table.status)}
            </span>
          )}
          {orderTotal && transferRole !== 'target' && (
            <span className="table-label-pill__total">{orderTotal}</span>
          )}
          {reservationHint && !orderTotal && transferRole !== 'target' && (
            <span className="max-w-[130px] truncate text-[10px] font-medium text-[#F5E6A3]">{reservationHint}</span>
          )}
          {transferHint && (
            <span className="table-label-pill__badge border-blue-400/60 text-blue-100 bg-blue-950/90">{transferHint}</span>
          )}
        </div>
      )}
    </div>
  )
})

const TableTile = memo(function TableTile({
  table, isDisabledInTransfer, isHovered, isActive, renderLite, onActivate, onClick, interactive, style, className,
}: {
  table: FloorTable
  isDisabledInTransfer: boolean
  isHovered?: boolean
  isActive?: boolean
  renderLite: boolean
  onActivate?: () => void
  onClick: () => void
  interactive?: boolean
  style?: React.CSSProperties
  className?: string
}) {
  const shape = (table.shape || 'SQUARE') as TableShape
  const { w, h } = tableSize(table.seats, shape)
  const isOccupied = table.status === 'OCCUPIED'
  const isReserved = table.status === 'RESERVED'
  const isCleaning = table.status === 'CLEANING'
  const isBarStool = shape === 'BAR_STOOL'
  const isBooth = shape === 'BOOTH'

  const borderShapeClasses =
    shape === 'ROUND' || isBarStool ? 'rounded-full' : isBooth ? 'rounded-[12px]' : 'rounded-[16px]'
  const surfaceShapeClasses =
    shape === 'ROUND' || isBarStool ? 'rounded-full' : isBooth ? 'rounded-[10px]' : 'rounded-[13px]'
  const surfaceClipClass =
    shape === 'ROUND' || isBarStool ? 'table-luxury-surface--round' : 'table-luxury-surface--square'

  const tableZ = isBarStool ? 36 : TABLE_TOP_Z
  const tableThickness = isBarStool ? 8 : 10
  const legWidth = isBarStool ? 4 : 6
  const chairZ = 22
  const chairSize = isBarStool ? 0 : 26

  const borderLuxuryClass =
    isOccupied || isReserved ? 'table-luxury-border--occupied' :
    isCleaning ? 'table-luxury-border--cleaning' : 'table-luxury-border--free'

  const statusGlowClass =
    isOccupied || isReserved ? 'table-luxury-ambient-glow--occupied' :
    isCleaning ? 'table-luxury-ambient-glow--cleaning' : 'table-luxury-ambient-glow--free'

  const legOffset = shape === 'ROUND' || isBarStool ? '22%' : '10%'
  const legShadow = '0 6px 16px rgba(20, 15, 10, 0.8)'
  const marbleSrc = MARBLE_BG

  const renderTableLeg = (pos: { left?: string; right?: string; top?: string; bottom?: string }) => (
    <div
      className="absolute origin-bottom bg-gradient-to-t from-[#5a4205] via-[#a67c0a] to-[#e8c872] transition-all duration-[600ms] ease-in-out"
      style={{
        ...pos, width: legWidth, height: tableZ - tableThickness,
        transform: 'rotateX(-90deg) translateZ(0)', boxShadow: legShadow, borderRadius: 1,
      }}
    />
  )

  const renderChairLeg = (props: { left?: string; right?: string; top?: string; bottom?: string }) => (
    <div
      className="absolute origin-bottom bg-gradient-to-t from-[#5a4205] to-[#c9a227]"
      style={{ ...props, width: 2, height: chairZ, transform: 'rotateX(-90deg) translateZ(0)', boxShadow: legShadow }}
    />
  )

  const renderTableEdges = () => {
    if (shape === 'ROUND' || isBarStool) return null
    const edgeStyle = (origin: string, rotate: string, pos: CSSProperties): CSSProperties => ({
      ...pos, transformOrigin: origin, transform: rotate,
    })
    return (
      <div className="pointer-events-none absolute inset-0" style={{ transform: `translateZ(${tableZ - tableThickness}px)`, transformStyle: 'preserve-3d' }}>
        <div className="table-3d-edge absolute bottom-0 left-[7%] right-[7%]" style={edgeStyle('bottom', 'rotateX(-90deg)', { height: tableThickness })} />
        <div className="table-3d-edge absolute top-0 left-[7%] right-[7%]" style={edgeStyle('top', 'rotateX(90deg)', { height: tableThickness })} />
        <div className="table-3d-edge absolute left-0 top-[7%] bottom-[7%]" style={edgeStyle('left', 'rotateY(-90deg)', { width: tableThickness })} />
        <div className="table-3d-edge absolute right-0 top-[7%] bottom-[7%]" style={edgeStyle('right', 'rotateY(90deg)', { width: tableThickness })} />
      </div>
    )
  }

  const renderChairs = () => {
    if (renderLite) return null
    if (isBarStool || chairSize === 0) return null
    const chairs: React.ReactNode[] = []
    const padding = 12

    if (shape === 'ROUND') {
      const radius = (w / 2) + padding
      const angleStep = (2 * Math.PI) / table.seats
      for (let i = 0; i < table.seats; i++) {
        const angle = i * angleStep - Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        chairs.push(
          <div key={`chair-${i}`} className="absolute transition-all duration-500" style={{
            width: chairSize, height: chairSize,
            left: `calc(50% + ${x}px - ${chairSize / 2}px)`,
            top: `calc(50% + ${y}px - ${chairSize / 2}px)`,
            transformStyle: 'preserve-3d',
          }}>
            {renderChairLeg({ left: '12%', top: '12%' })}
            {renderChairLeg({ right: '12%', top: '12%' })}
            {renderChairLeg({ left: '12%', bottom: '12%' })}
            {renderChairLeg({ right: '12%', bottom: '12%' })}
            <div className={cn('absolute inset-0 rounded-[6px] border border-[#D4AF37]/55 bg-gradient-to-b from-[#1e1a14] to-[#0a0a0a] shadow-[0_4px_12px_rgba(20,15,10,0.75)]')}
              style={{ transform: `translateZ(${chairZ}px) rotateZ(${angle + Math.PI / 2}rad)` }} />
          </div>
        )
      }
    } else {
      let topCount = 0, bottomCount = 0, leftCount = 0, rightCount = 0
      if (isBooth) {
        bottomCount = Math.min(table.seats, 4)
      } else if (table.seats === 2) { leftCount = 1; rightCount = 1 }
      else if (table.seats === 4) { topCount = 2; bottomCount = 2 }
      else if (table.seats === 6) { topCount = 2; bottomCount = 2; leftCount = 1; rightCount = 1 }
      else if (table.seats >= 8) { topCount = Math.floor((table.seats - 2) / 2); bottomCount = Math.ceil((table.seats - 2) / 2); leftCount = 1; rightCount = 1 }
      else { topCount = Math.ceil(table.seats / 2); bottomCount = Math.floor(table.seats / 2) }

      const addChairRow = (count: number, side: 'top' | 'bottom' | 'left' | 'right') => {
        for (let i = 0; i < count; i++) {
          const percent = ((i + 1) / (count + 1)) * 100
          let left: string, top: string, rotation: number
          if (side === 'top') { left = `${percent}%`; top = `-${padding}px`; rotation = 0 }
          else if (side === 'bottom') { left = `${percent}%`; top = `calc(100% + ${padding}px)`; rotation = 180 }
          else if (side === 'left') { left = `-${padding}px`; top = `${percent}%`; rotation = -90 }
          else { left = `calc(100% + ${padding}px)`; top = `${percent}%`; rotation = 90 }
          chairs.push(
            <div key={`chair-${side}-${i}`} className="absolute transition-all duration-500"
              style={{ left, top, width: chairSize, height: chairSize, transform: 'translate(-50%, -50%)', transformStyle: 'preserve-3d' }}>
              {renderChairLeg({ left: '12%', top: '12%' })}
              {renderChairLeg({ right: '12%', top: '12%' })}
              {renderChairLeg({ left: '12%', bottom: '12%' })}
              {renderChairLeg({ right: '12%', bottom: '12%' })}
              <div className={cn('absolute inset-0 rounded-[6px] border border-[#D4AF37]/55 bg-gradient-to-b from-[#1e1a14] to-[#0a0a0a] shadow-[0_4px_12px_rgba(20,15,10,0.75)]')}
                style={{ transform: `translateZ(${chairZ}px) rotateZ(${rotation}deg)` }} />
            </div>
          )
        }
      }
      addChairRow(topCount, 'top')
      addChairRow(bottomCount, 'bottom')
      addChairRow(leftCount, 'left')
      addChairRow(rightCount, 'right')
    }
    return chairs
  }

  return (
    <div
      className={cn(
        'table-3d-group absolute outline-none',
        className,
        interactive && !isDisabledInTransfer && 'cursor-pointer touch-manipulation',
        isDisabledInTransfer && 'opacity-40 grayscale cursor-not-allowed',
        isHovered && 'table-3d-group--hover',
        isActive && 'table-3d-group--active',
      )}
      style={{ ...style, width: w, height: h, transformStyle: 'preserve-3d' }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive && !isDisabledInTransfer ? onClick : undefined}
      onKeyDown={(e) => { if (interactive && !isDisabledInTransfer && e.key === 'Enter') onClick() }}
      onMouseDown={interactive && !isDisabledInTransfer ? onActivate : undefined}
    >
      <div className="table-3d-body">
        <div className="table-3d-contact-shadow" />
        {!renderLite && (
          <>
            <div className="table-luxury-ambient-glow table-luxury-ambient-glow--base pointer-events-none absolute left-1/2 top-1/2 blur-[32px] rounded-full"
              style={{ transform: 'translate(-50%, -50%) translateZ(0)' }} />
            <div className={cn('table-luxury-ambient-glow pointer-events-none absolute left-1/2 top-1/2 blur-[36px] rounded-full opacity-80', statusGlowClass)}
              style={{ transform: 'translate(-50%, -50%) translateZ(0)' }} />
          </>
        )}
        <div className="pointer-events-none absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>{renderChairs()}</div>
        {!isBarStool && (
          <div className="pointer-events-none absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {renderTableLeg({ left: legOffset, top: legOffset })}
            {renderTableLeg({ right: legOffset, top: legOffset })}
            {renderTableLeg({ left: legOffset, bottom: legOffset })}
            {renderTableLeg({ right: legOffset, bottom: legOffset })}
          </div>
        )}
        {isBarStool && (
          <div className="pointer-events-none absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)', transformStyle: 'preserve-3d' }}>
            {renderTableLeg({ left: '50%' })}
          </div>
        )}
        {renderTableEdges()}
        <div className={cn('table-luxury-top-face pointer-events-none absolute inset-0', borderShapeClasses)}
          style={{ transform: `translateZ(${tableZ}px)` }}>
          <div className={cn('table-luxury-border h-full w-full p-[3px] transition-all duration-[600ms] ease-in-out', borderShapeClasses, borderLuxuryClass)}>
            <div
              data-table-top
              data-table-id={table.id}
              className={cn('table-luxury-surface table-luxury-surface--light h-full w-full', surfaceShapeClasses, surfaceClipClass)}
            >
              <img src={marbleSrc} alt="" aria-hidden draggable={false} className="table-luxury-surface__marble table-luxury-surface__marble--light" />
              <div className="table-luxury-surface__veil table-luxury-surface__veil--light" />
              <div className="table-luxury-surface__specular" />
              <div
                className={cn(
                  'table-luxury-surface__highlight',
                  (isHovered || isActive) && 'table-luxury-surface__highlight--visible',
                  isActive && 'table-luxury-surface__highlight--active',
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

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
