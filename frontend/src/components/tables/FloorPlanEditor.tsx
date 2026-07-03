import { useCallback, useEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, UtensilsCrossed, RotateCw, MousePointer2, BrickWall, Tag, Trash2, Eye, Pencil, ZoomIn, ZoomOut,
} from 'lucide-react'
import type { FloorTable } from './TableFloorPlan'
import TableFloorPlan, { tableSize } from './TableFloorPlan'
import { api } from '../../lib/api'
import { toast } from '@/lib/toast'
import { resolveToastApiError } from '../../lib/formatApiError'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import { cn } from '../../lib/utils'
import type { FloorPlanLayoutV1, FloorPlanWall, FloorPlanZoneLabel } from '../../lib/floorPlanLayout'
import { EMPTY_FLOOR_PLAN_LAYOUT, FLOOR_CANVAS_H, FLOOR_CANVAS_W, wallSegmentMetrics } from '../../lib/floorPlanLayout'
import { OBSIDIAN_ROOM_TEMPLATE } from '../../lib/floorPlanTemplates'

type EditorTool = 'select' | 'wall' | 'label' | 'delete'
type EditorTab = 'edit' | 'preview'
type Selectable =
  | { kind: 'wall'; id: string }
  | { kind: 'label'; id: string }
  | { kind: 'table'; id: string }
  | null

interface FloorPlanEditorProps {
  tables: FloorTable[]
  initialLayout?: FloorPlanLayoutV1
  onClose: () => void
}

function pctFromEvent(e: React.MouseEvent<HTMLDivElement>, rect: DOMRect) {
  const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
  return { x, y }
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export default function FloorPlanEditor({ tables, initialLayout, onClose }: FloorPlanEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()

  const [tab, setTab] = useState<EditorTab>('edit')
  const [tool, setTool] = useState<EditorTool>('select')
  const [floorLayout, setFloorLayout] = useState<FloorPlanLayoutV1>(initialLayout ?? EMPTY_FLOOR_PLAN_LAYOUT)
  const [wallDraft, setWallDraft] = useState<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<Selectable>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const [tableLayout, setTableLayout] = useState<FloorTable[]>(() => {
    let unplaced = 0
    return tables.map(tbl => {
      const px = Number(tbl.posX) || 0
      const py = Number(tbl.posY) || 0
      if (px === 0 && py === 0) {
        const posX = 2 + (unplaced % 6) * 12
        const posY = 2 + Math.floor(unplaced / 6) * 15
        unplaced++
        return { ...tbl, posX, posY, rotation: tbl.rotation || 0 }
      }
      return { ...tbl, posX: px, posY: py, rotation: tbl.rotation || 0 }
    })
  })

  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!canvasRef.current) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ width, height })
    })
    observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [])

  const saveAll = useMutation({
    mutationFn: async () => {
      const positions = tableLayout.map(tbl => ({
        id: tbl.id,
        posX: tbl.posX,
        posY: tbl.posY,
        rotation: tbl.rotation || 0,
      }))
      await Promise.all([
        api.patch('/tables/positions', positions),
        api.patch('/tables/floor-layout', floorLayout),
      ])
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: tq(tk, 'tables') }),
        queryClient.refetchQueries({ queryKey: tq(tk, 'floor-layout') }),
      ])
      toast.success(t('tables.layoutSaved', { defaultValue: 'Layout salvato con successo!' }))
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(resolveToastApiError(t, err, 'common.error'))
    },
  })

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || canvasSize.width === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const pt = pctFromEvent(e, rect)

    if (tool === 'wall') {
      if (!wallDraft) {
        setWallDraft(pt)
        return
      }
      const wall: FloorPlanWall = {
        id: newId('w'),
        x1: wallDraft.x,
        y1: wallDraft.y,
        x2: pt.x,
        y2: pt.y,
        thickness: 1.2,
        height: 24,
      }
      setFloorLayout(prev => ({ ...prev, walls: [...prev.walls, wall] }))
      setWallDraft(null)
      setSelected({ kind: 'wall', id: wall.id })
      return
    }

    if (tool === 'label') {
      const text = window.prompt(t('tables.editor.labelPrompt', { defaultValue: 'Testo etichetta zona' }), 'ZONE')
      if (!text?.trim()) return
      const label: FloorPlanZoneLabel = {
        id: newId('zl'),
        text: text.trim().toUpperCase(),
        x: pt.x,
        y: pt.y,
        variant: 'area',
      }
      setFloorLayout(prev => ({ ...prev, zoneLabels: [...prev.zoneLabels, label] }))
      setSelected({ kind: 'label', id: label.id })
      return
    }

    if (tool === 'delete' && selected) {
      if (selected.kind === 'wall') {
        setFloorLayout(prev => ({ ...prev, walls: prev.walls.filter(w => w.id !== selected.id) }))
      } else if (selected.kind === 'label') {
        setFloorLayout(prev => ({ ...prev, zoneLabels: prev.zoneLabels.filter(z => z.id !== selected.id) }))
      }
      setSelected(null)
      return
    }

    setSelected(null)
  }

  const handleDragStop = (id: string, d: { x: number; y: number }) => {
    if (canvasSize.width === 0) return
    let posX = (d.x / canvasSize.width) * 100
    let posY = (d.y / canvasSize.height) * 100
    posX = Math.max(0, Math.min(100, posX))
    posY = Math.max(0, Math.min(100, posY))
    setTableLayout(prev => prev.map(tbl => tbl.id === id ? { ...tbl, posX, posY } : tbl))
  }

  const handleRotate = (id: string, currentRotation: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setTableLayout(prev => prev.map(tbl => tbl.id === id ? { ...tbl, rotation: (currentRotation + 45) % 360 } : tbl))
  }

  const loadTemplate = () => {
    if (!window.confirm(t('tables.editor.loadTemplateConfirm', { defaultValue: 'Caricare il template Obsidian Room? Sovrascrive muri e etichette.' }))) return
    setFloorLayout(OBSIDIAN_ROOM_TEMPLATE)
    setWallDraft(null)
    setSelected(null)
  }

  const statusLabel = useCallback((s: FloorTable['status']) => t(`tables.${s.toLowerCase()}`, { defaultValue: s }), [t])
  const seatsLabel = useCallback((n: number) => t('common.seatsCount', { count: n, defaultValue: `${n} posti` }), [t])

  const scaleX = canvasSize.width / FLOOR_CANVAS_W

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#020202]/98 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[#D4AF37]/15 px-4 py-3 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#F0E6D2] sm:text-xl">
            <UtensilsCrossed className="h-5 w-5 text-[#D4AF37]" />
            {t('tables.editor.title', { defaultValue: 'Editor Layout 2.5D' })}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('tables.editor.subtitle', { defaultValue: 'Muri, zone e tavoli — salvataggio per il tuo ristorante' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={loadTemplate} className="rounded-lg border border-[#D4AF37]/25 px-3 py-1.5 text-xs font-medium text-[#E8C872] hover:bg-[#D4AF37]/10">
            {t('tables.editor.loadTemplate', { defaultValue: 'Template demo' })}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-white/5">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => saveAll.mutate()}
            disabled={saveAll.isPending}
            className="flex items-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {t('tables.saveLayout', { defaultValue: 'Salva Layout' })}
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/10 px-4">
        <button type="button" onClick={() => setTab('edit')} className={cn('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', tab === 'edit' ? 'border-[#D4AF37] text-[#F0E6D2]' : 'border-transparent text-slate-500')}>
          <Pencil className="h-4 w-4" />
          {t('tables.editor.tabEdit', { defaultValue: 'Modifica' })}
        </button>
        <button type="button" onClick={() => setTab('preview')} className={cn('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', tab === 'preview' ? 'border-[#D4AF37] text-[#F0E6D2]' : 'border-transparent text-slate-500')}>
          <Eye className="h-4 w-4" />
          {t('tables.editor.tabPreview', { defaultValue: 'Anteprima 3D' })}
        </button>
      </div>

      {tab === 'preview' ? (
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <TableFloorPlan
            tables={tableLayout}
            floorLayout={floorLayout}
            statusLabel={statusLabel}
            seatsLabel={seatsLabel}
            interactive={false}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 lg:flex-row">
          <div className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-48 lg:flex-col">
            {([
              ['select', MousePointer2, t('tables.editor.toolSelect', { defaultValue: 'Seleziona' })],
              ['wall', BrickWall, t('tables.editor.toolWall', { defaultValue: 'Muro' })],
              ['label', Tag, t('tables.editor.toolLabel', { defaultValue: 'Etichetta' })],
              ['delete', Trash2, t('tables.editor.toolDelete', { defaultValue: 'Elimina' })],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTool(id); setWallDraft(null) }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  tool === id ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F0E6D2]' : 'border-white/10 text-slate-400 hover:bg-white/5',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <div className="mt-2 flex gap-1">
              <button type="button" onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5" aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5" aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="rounded-lg border border-white/10 px-2 text-xs text-slate-500">
                {Math.round(zoom * 100)}%
              </button>
            </div>
            {wallDraft && (
              <p className="text-xs text-[#E8C872]">{t('tables.editor.wallHint', { defaultValue: 'Clicca il secondo punto del muro' })}</p>
            )}
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2">
            <div
              className="relative max-h-full max-w-full"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
              onMouseDown={e => {
                if (e.button === 1 || (e.button === 0 && e.altKey)) {
                  const start = { x: e.clientX - pan.x, y: e.clientY - pan.y }
                  const onMove = (ev: MouseEvent) => setPan({ x: ev.clientX - start.x, y: ev.clientY - start.y })
                  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                }
              }}
            >
              <div
                ref={canvasRef}
                className="relative cursor-crosshair overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-[#0a0a0e]"
                style={{ width: 'min(100%, 1000px)', aspectRatio: `${FLOOR_CANVAS_W}/${FLOOR_CANVAS_H}` }}
                onClick={handleCanvasClick}
              >
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox={`0 0 ${FLOOR_CANVAS_W} ${FLOOR_CANVAS_H}`} preserveAspectRatio="none">
                  {(floorLayout.zonePaths ?? []).map(path => (
                    <polyline
                      key={path.id}
                      fill="none"
                      stroke="rgba(212,175,55,0.45)"
                      strokeWidth={2}
                      points={path.points.map(p => `${(p.x / 100) * FLOOR_CANVAS_W},${(p.y / 100) * FLOOR_CANVAS_H}`).join(' ')}
                    />
                  ))}
                  {floorLayout.walls.map(wall => {
                    const m = wallSegmentMetrics(wall)
                    const selectedWall = selected?.kind === 'wall' && selected.id === wall.id
                    return (
                      <line
                        key={wall.id}
                        x1={m.x1}
                        y1={m.y1}
                        x2={m.x1 + m.length * Math.cos((m.angleDeg * Math.PI) / 180)}
                        y2={m.y1 + m.length * Math.sin((m.angleDeg * Math.PI) / 180)}
                        stroke={selectedWall ? '#F5E6A3' : 'rgba(212,175,55,0.75)'}
                        strokeWidth={Math.max(3, m.thicknessPx * scaleX)}
                        strokeLinecap="round"
                        className="pointer-events-auto cursor-pointer"
                        onClick={e => { e.stopPropagation(); setSelected({ kind: 'wall', id: wall.id }); setTool('select') }}
                      />
                    )
                  })}
                  {wallDraft && (
                    <circle cx={(wallDraft.x / 100) * FLOOR_CANVAS_W} cy={(wallDraft.y / 100) * FLOOR_CANVAS_H} r={6} fill="#D4AF37" />
                  )}
                </svg>

                {floorLayout.zoneLabels.map(zl => (
                  <button
                    key={zl.id}
                    type="button"
                    className={cn(
                      'absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-widest',
                      selected?.kind === 'label' && selected.id === zl.id ? 'bg-[#D4AF37]/30 text-[#F5E6A3] ring-1 ring-[#D4AF37]' : 'bg-black/70 text-[#E8C872]/80',
                    )}
                    style={{ left: `${zl.x}%`, top: `${zl.y}%` }}
                    onClick={e => { e.stopPropagation(); setSelected({ kind: 'label', id: zl.id }); setTool('select') }}
                  >
                    {zl.text}
                  </button>
                ))}

                {tableLayout.map(table => {
                  const rot = table.rotation || 0
                  const size = tableSize(table.seats, table.shape || 'SQUARE')
                  const editorW = (size.w / FLOOR_CANVAS_W) * canvasSize.width
                  const editorH = (size.h / FLOOR_CANVAS_H) * canvasSize.height
                  if (canvasSize.width === 0) return null

                  return (
                    <Rnd
                      key={table.id}
                      bounds="parent"
                      position={{
                        x: (table.posX / 100) * canvasSize.width,
                        y: (table.posY / 100) * canvasSize.height,
                      }}
                      size={{ width: editorW, height: editorH }}
                      enableResizing={false}
                      onDragStop={(_, d) => handleDragStop(table.id, d)}
                      className="group z-10"
                      style={{ position: 'absolute' }}
                      onMouseDown={e => { e.stopPropagation(); setSelected({ kind: 'table', id: table.id }) }}
                    >
                      <div style={{ transform: `rotate(${rot}deg)`, width: '100%', height: '100%', position: 'relative' }} className="cursor-grab active:cursor-grabbing">
                        <div className={cn(
                          'flex h-full w-full flex-col items-center justify-center border-2 border-[#D4AF37]/50 bg-[#1a1814]/90 shadow-lg',
                          table.shape === 'ROUND' || table.shape === 'BAR_STOOL' ? 'rounded-full' : 'rounded-lg',
                          selected?.kind === 'table' && selected.id === table.id && 'ring-2 ring-[#F5E6A3]',
                        )}>
                          <span className="text-xs font-bold text-[#F5E6A3]">T{table.number}</span>
                          <span className="text-[9px] text-slate-400">{table.seats}p</span>
                        </div>
                        <button
                          type="button"
                          onClick={e => handleRotate(table.id, rot, e)}
                          className="absolute -right-2 -top-2 z-[100] flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#0a0a0e] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#D4AF37] hover:text-black"
                        >
                          <RotateCw className="h-3 w-3" />
                        </button>
                      </div>
                    </Rnd>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
