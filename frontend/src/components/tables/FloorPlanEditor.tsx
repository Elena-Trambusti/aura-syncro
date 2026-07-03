import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, UtensilsCrossed, RotateCw, MousePointer2, BrickWall, Tag, Trash2, Eye, Pencil, ZoomIn, ZoomOut, Plus, Map, Edit2,
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

function resolveEditorAreas(layout: FloorPlanLayoutV1, tables: FloorTable[], defaultArea: string): string[] {
  const fromTables = tables.map(tbl => tbl.area || defaultArea).filter(Boolean)
  const fromLayout = layout.areas ?? []
  return Array.from(new Set([defaultArea, ...fromTables, ...fromLayout])).sort((a, b) =>
    a.localeCompare(b, 'it'),
  )
}

function fitCanvasSize(shellWidth: number, shellHeight: number) {
  if (shellWidth <= 0 || shellHeight <= 0) return { width: 0, height: 0 }
  const aspect = FLOOR_CANVAS_W / FLOOR_CANVAS_H
  let width = Math.min(shellWidth, 1000)
  let height = width / aspect
  if (height > shellHeight) {
    height = shellHeight
    width = height * aspect
  }
  return { width: Math.round(width), height: Math.round(height) }
}

export default function FloorPlanEditor({ tables, initialLayout, onClose }: FloorPlanEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const defaultArea = t('common.area', { defaultValue: 'Sala' })

  const [tab, setTab] = useState<EditorTab>('edit')
  const [tool, setTool] = useState<EditorTool>('select')
  const [floorLayout, setFloorLayout] = useState<FloorPlanLayoutV1>(initialLayout ?? EMPTY_FLOOR_PLAN_LAYOUT)
  const [wallDraft, setWallDraft] = useState<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<Selectable>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [activeArea, setActiveArea] = useState(defaultArea)

  const editorAreas = resolveEditorAreas(floorLayout, tables, defaultArea)

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
  const shellRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const update = () => {
      const { width, height } = shell.getBoundingClientRect()
      setCanvasSize(fitCanvasSize(width, height))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [tab])

  useEffect(() => {
    if (!editorAreas.includes(activeArea)) {
      setActiveArea(editorAreas[0] ?? defaultArea)
    }
  }, [activeArea, defaultArea, editorAreas])

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

  const handleCanvasClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || canvasW === 0) return
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
      const text = await toast.prompt({
        title: t('tables.editor.labelTitle', { defaultValue: 'Etichetta zona' }),
        description: t('tables.editor.labelPrompt', { defaultValue: 'Inserisci il testo da mostrare sulla mappa' }),
        defaultValue: 'ZONE',
        placeholder: 'ZONE',
        confirmLabel: t('common.confirm'),
        cancelLabel: t('common.cancel'),
      })
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
    if (canvasW === 0) return
    let posX = (d.x / canvasW) * 100
    let posY = (d.y / canvasH) * 100
    posX = Math.max(0, Math.min(100, posX))
    posY = Math.max(0, Math.min(100, posY))
    setTableLayout(prev => prev.map(tbl => tbl.id === id ? { ...tbl, posX, posY } : tbl))
  }

  const handleRotate = (id: string, currentRotation: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setTableLayout(prev => prev.map(tbl => tbl.id === id ? { ...tbl, rotation: (currentRotation + 45) % 360 } : tbl))
  }

  const loadTemplate = async () => {
    const confirmed = await toast.confirm({
      title: t('tables.editor.loadTemplateTitle', { defaultValue: 'Carica template' }),
      description: t('tables.editor.loadTemplateConfirm', { defaultValue: 'Caricare il template Obsidian Room? Sovrascrive muri e etichette.' }),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    })
    if (!confirmed) return
    setFloorLayout(OBSIDIAN_ROOM_TEMPLATE)
    setWallDraft(null)
    setSelected(null)
  }

  const handleAddArea = async () => {
    const name = await toast.prompt({
      title: t('tables.editor.addArea', { defaultValue: 'Nuova zona' }),
      description: t('tables.editor.newAreaPrompt', { defaultValue: 'Nome zona (es. Terrazza, Piano 2, Dehors)' }),
      defaultValue: '',
      placeholder: t('tables.editor.newAreaPlaceholder', { defaultValue: 'Es. Terrazza, Piano 2…' }),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    })
    if (!name?.trim()) return
    const trimmed = name.trim()
    if (editorAreas.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(t('tables.editor.areaExists', { defaultValue: 'Questa zona esiste già' }))
      setActiveArea(editorAreas.find(a => a.toLowerCase() === trimmed.toLowerCase()) ?? trimmed)
      return
    }
    setFloorLayout(prev => ({
      ...prev,
      areas: Array.from(new Set([...(prev.areas ?? []), trimmed])),
    }))
    setActiveArea(trimmed)
    toast.success(t('tables.editor.areaAdded', { defaultValue: 'Zona aggiunta — assegna i tavoli da Gestione tavoli' }))
  }

  const handleRenameArea = async (area: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const newName = await toast.prompt({
      title: t('tables.editor.renameArea', { defaultValue: 'Rinomina zona' }),
      description: t('tables.editor.renameAreaHint', {
        defaultValue: 'Il nuovo nome verrà applicato a tutti i tavoli di questa zona.',
      }),
      defaultValue: area,
      confirmLabel: t('common.save'),
      cancelLabel: t('common.cancel'),
    })
    if (!newName?.trim() || newName.trim() === area) return
    const trimmed = newName.trim()
    if (editorAreas.some(a => a !== area && a.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(t('tables.editor.areaExists', { defaultValue: 'Questa zona esiste già' }))
      return
    }

    const inArea = tableLayout.filter(tbl => (tbl.area || defaultArea) === area)
    try {
      if (inArea.length > 0) {
        const oldNames = new Set<string | null>()
        for (const tbl of inArea) {
          oldNames.add(tbl.area ?? null)
        }
        for (const oldName of oldNames) {
          await api.patch('/tables/area', { oldName, newName: trimmed })
        }
        setTableLayout(prev => prev.map(tbl =>
          (tbl.area || defaultArea) === area ? { ...tbl, area: trimmed } : tbl,
        ))
      }
      setFloorLayout(prev => ({
        ...prev,
        areas: Array.from(new Set((prev.areas ?? []).map(a => (a === area ? trimmed : a)))),
      }))
      if (activeArea === area) setActiveArea(trimmed)
      toast.success(t('tables.editor.areaRenamed', { defaultValue: 'Zona rinominata' }))
    } catch (err) {
      toast.error(resolveToastApiError(t, err, 'common.error'))
    }
  }

  const statusLabel = useCallback((s: FloorTable['status']) => t(`tables.${s.toLowerCase()}`, { defaultValue: s }), [t])
  const seatsLabel = useCallback((n: number) => t('common.seatsCount', { count: n, defaultValue: `${n} posti` }), [t])

  const visibleTables = tableLayout.filter(tbl => (tbl.area || defaultArea) === activeArea)
  const canvasW = canvasSize.width > 0 ? canvasSize.width : 800
  const canvasH = canvasSize.height > 0 ? canvasSize.height : 640
  const scaleX = canvasW / FLOOR_CANVAS_W

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
          <button type="button" onClick={() => { void loadTemplate() }} className="rounded-lg border border-[#D4AF37]/25 px-3 py-1.5 text-xs font-medium text-[#E8C872] hover:bg-[#D4AF37]/10">
            {t('tables.editor.loadTemplate', { defaultValue: 'Template demo' })}
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
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
            <Map className="h-4 w-4 text-[#D4AF37]" />
            {editorAreas.map(area => (
              <div key={area} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveArea(area)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    activeArea === area
                      ? 'bg-[#D4AF37] text-black'
                      : 'border border-white/10 text-slate-400 hover:bg-white/5',
                  )}
                >
                  {area}
                </button>
                <button
                  type="button"
                  onClick={e => { void handleRenameArea(area, e) }}
                  className="rounded-full border border-white/10 p-1 text-slate-500 hover:border-[#D4AF37]/35 hover:text-[#E8C872]"
                  aria-label={t('tables.editor.renameArea', { defaultValue: 'Rinomina zona' })}
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { void handleAddArea() }}
              className="flex items-center gap-1 rounded-full border border-dashed border-[#D4AF37]/40 px-3 py-1 text-xs font-medium text-[#E8C872] hover:bg-[#D4AF37]/10"
            >
              <Plus className="h-3 w-3" />
              {t('tables.editor.addArea', { defaultValue: 'Nuova zona' })}
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            <TableFloorPlan
              tables={visibleTables}
              floorLayout={floorLayout}
              statusLabel={statusLabel}
              seatsLabel={seatsLabel}
              interactive={false}
            />
          </div>
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
            <div className="mt-2 w-full border-t border-white/10 pt-3">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Map className="h-3 w-3" />
                {t('tables.editor.areasTitle', { defaultValue: 'Zone / piani' })}
              </p>
              <div className="flex flex-col gap-1">
                {editorAreas.map(area => (
                  <div key={area} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveArea(area)}
                      className={cn(
                        'min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors',
                        activeArea === area
                          ? 'bg-[#D4AF37]/20 text-[#F0E6D2] ring-1 ring-[#D4AF37]/40'
                          : 'text-slate-400 hover:bg-white/5',
                      )}
                    >
                      <span className="block truncate">{area}</span>
                    </button>
                    <button
                      type="button"
                      onClick={e => { void handleRenameArea(area, e) }}
                      className="shrink-0 rounded-lg border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-[#D4AF37]/35 hover:bg-[#D4AF37]/10 hover:text-[#E8C872]"
                      aria-label={t('tables.editor.renameArea', { defaultValue: 'Rinomina zona' })}
                      title={t('tables.editor.renameArea', { defaultValue: 'Rinomina zona' })}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => { void handleAddArea() }}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-[#D4AF37]/35 px-2 py-1.5 text-xs font-medium text-[#E8C872] hover:bg-[#D4AF37]/10"
                >
                  <Plus className="h-3 w-3" />
                  {t('tables.editor.addArea', { defaultValue: 'Nuova zona' })}
                </button>
              </div>
            </div>
          </div>

          <div
            ref={shellRef}
            className="flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2"
          >
            <div
              className="relative shrink-0"
              style={{
                width: canvasW,
                height: canvasH,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
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
                style={{ width: canvasW, height: canvasH }}
                onClick={e => { void handleCanvasClick(e) }}
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

                {visibleTables.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
                    <p className="max-w-xs text-sm text-slate-500">
                      {t('tables.editor.noTablesInArea', {
                        defaultValue: 'Nessun tavolo in questa zona. Aggiungine uno da Gestione tavoli impostando l’area «{{area}}».',
                        area: activeArea,
                      })}
                    </p>
                  </div>
                )}

                {visibleTables.map(table => {
                  const rot = table.rotation || 0
                  const size = tableSize(table.seats, table.shape || 'SQUARE')
                  const editorW = (size.w / FLOOR_CANVAS_W) * canvasW
                  const editorH = (size.h / FLOOR_CANVAS_H) * canvasH

                  return (
                    <Rnd
                      key={table.id}
                      bounds="parent"
                      position={{
                        x: (table.posX / 100) * canvasW,
                        y: (table.posY / 100) * canvasH,
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

      <div className="shrink-0 border-t border-[#D4AF37]/25 bg-[#080808]/98 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saveAll.isPending}
            className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => saveAll.mutate()}
            disabled={saveAll.isPending}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all hover:bg-[#E8C872] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveAll.isPending
              ? t('common.saving', { defaultValue: 'Salvataggio…' })
              : t('tables.saveLayout', { defaultValue: 'Salva layout' })}
          </button>
        </div>
      </div>
    </div>
  )
}
