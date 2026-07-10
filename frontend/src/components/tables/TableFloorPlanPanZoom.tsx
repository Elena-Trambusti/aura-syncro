import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { cn } from '../../lib/utils'
import { shouldForceListView } from '../../lib/tableFilters'

interface TableFloorPlanPanZoomProps {
  children: ReactNode
  tableCount: number
  onForceListView?: () => void
  className?: string
}

const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const FIT_SCALE_BOOST = 1.18

export default function TableFloorPlanPanZoom({
  children,
  tableCount,
  onForceListView,
  className,
}: TableFloorPlanPanZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const gestureRef = useRef<{
    mode: 'pan' | 'pinch' | null
    startX: number
    startY: number
    startTx: number
    startTy: number
    startDist: number
    startScale: number
  }>({ mode: null, startX: 0, startY: 0, startTx: 0, startTy: 0, startDist: 0, startScale: 1 })

  const fitToContainer = useCallback(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    const cw = container.clientWidth
    const ch = container.clientHeight
    const contentW = content.scrollWidth
    const contentH = content.scrollHeight
    if (!contentW || !contentH) return

    if (shouldForceListView(cw, tableCount)) {
      onForceListView?.()
      return
    }

    const padding = 16
    const scale = Math.min(
      (cw - padding * 2) / contentW,
      (ch - padding * 2) / contentH,
      1,
    )
    const fitted = Math.max(MIN_SCALE, scale)
    const boosted = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitted * FIT_SCALE_BOOST))
    const x = (cw - contentW * boosted) / 2
    const y = (ch - contentH * boosted) / 2
    setTransform({ scale: boosted, x, y })
  }, [onForceListView, tableCount])

  useEffect(() => {
    fitToContainer()
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => fitToContainer())
    ro.observe(container)
    return () => ro.disconnect()
  }, [fitToContainer, children])

  const clampTransform = useCallback((scale: number, x: number, y: number) => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return { scale, x, y }

    const cw = container.clientWidth
    const ch = container.clientHeight
    const contentW = content.scrollWidth * scale
    const contentH = content.scrollHeight * scale

    const minX = Math.min(0, cw - contentW)
    const minY = Math.min(0, ch - contentH)
    const maxX = Math.max(0, (cw - contentW) / 2)
    const maxY = Math.max(0, (ch - contentH) / 2)

    return {
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)),
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    }
  }, [])

  const dist = (touches: { length: number; 0?: Touch; 1?: Touch }) => {
    if (touches.length < 2 || !touches[0] || !touches[1]) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      gestureRef.current = {
        mode: 'pan',
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTx: transform.x,
        startTy: transform.y,
        startDist: 0,
        startScale: transform.scale,
      }
    } else if (e.touches.length === 2) {
      gestureRef.current = {
        mode: 'pinch',
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        startTx: transform.x,
        startTy: transform.y,
        startDist: dist(e.touches),
        startScale: transform.scale,
      }
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    const g = gestureRef.current
    if (!g.mode) return
    e.preventDefault()

    if (g.mode === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startX
      const dy = e.touches[0].clientY - g.startY
      setTransform(prev => clampTransform(prev.scale, g.startTx + dx, g.startTy + dy))
    } else if (g.mode === 'pinch' && e.touches.length === 2 && g.startDist > 0) {
      const newDist = dist(e.touches)
      const scaleFactor = newDist / g.startDist
      const newScale = g.startScale * scaleFactor
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const dx = midX - g.startX
      const dy = midY - g.startY
      setTransform(() => clampTransform(newScale, g.startTx + dx, g.startTy + dy))
    }
  }

  const onTouchEnd = () => {
    gestureRef.current.mode = null
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden rounded-xl bg-[#020202] touch-none',
        'h-[min(82dvh,calc(100dvh-220px))]',
        className,
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        ref={contentRef}
        className="origin-top-left will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
