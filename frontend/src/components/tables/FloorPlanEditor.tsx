import { useState, useRef, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { useTranslation } from 'react-i18next'
import { Save, UtensilsCrossed, RotateCw } from 'lucide-react'
import type { FloorTable } from './TableFloorPlan'
import { api } from '../../lib/api'
import { toast } from '@/lib/toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import { cn } from '../../lib/utils'

interface FloorPlanEditorProps {
  tables: FloorTable[]
  onClose: () => void
}

function getTableSize(seats: number, shape: string) {
  if (shape === 'RECTANGLE') {
    return seats >= 6 ? { width: 112, height: 64 } : { width: 96, height: 56 }
  }
  const size = seats <= 2 ? 64 : seats <= 4 ? 76 : 88
  return { width: size, height: size }
}

export default function FloorPlanEditor({ tables, onClose }: FloorPlanEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const [layout, setLayout] = useState<FloorTable[]>(() => {
    let unplaced = 0;
    return tables.map(t => {
      const px = Number(t.posX) || 0;
      const py = Number(t.posY) || 0;
      if (px === 0 && py === 0) {
        const posX = 2 + (unplaced % 6) * 12;
        const posY = 2 + Math.floor(unplaced / 6) * 15;
        unplaced++;
        return { ...t, posX, posY, rotation: t.rotation || 0 };
      }
      return { ...t, posX: px, posY: py, rotation: t.rotation || 0 };
    });
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const savePositions = useMutation({
    mutationFn: async (updatedTables: FloorTable[]) => {
      const payload = updatedTables.map(tbl => ({
        id: tbl.id,
        posX: tbl.posX,
        posY: tbl.posY,
        rotation: tbl.rotation || 0,
      }))
      console.log('--- SAVING POSITIONS ---')
      payload.forEach(t => console.log(`Table ${t.id} -> X: ${t.posX.toFixed(2)}%, Y: ${t.posY.toFixed(2)}%, Rot: ${t.rotation}°`))
      return api.patch('/tables/positions', payload)
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: tq(tk, 'tables') })
      toast.success(t('tables.layoutSaved', { defaultValue: 'Layout salvato con successo!' }))
      onClose()
    },
    onError: () => {
      toast.error(t('common.error'))
    }
  })


  const handleDragStop = (id: string, d: { x: number, y: number }) => {
    if (containerSize.width === 0) return
    let posX = (d.x / containerSize.width) * 100
    let posY = (d.y / containerSize.height) * 100
    
    // Clamp values to prevent tables from being dragged completely out of bounds
    posX = Math.max(0, Math.min(100, posX))
    posY = Math.max(0, Math.min(100, posY))
    
    setLayout(prev => prev.map(t => t.id === id ? { ...t, posX, posY } : t))
  }

  const handleResetLayout = () => {
    if (confirm('Vuoi davvero riordinare tutti i tavoli in alto a sinistra?')) {
      setLayout(prev => prev.map((t, i) => ({
        ...t,
        posX: 2 + (i % 6) * 12,
        posY: 2 + Math.floor(i / 6) * 15,
        rotation: 0
      })))
    }
  }

  const handleRotate = (id: string, currentRotation: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setLayout(prev => prev.map(t => t.id === id ? { ...t, rotation: (currentRotation + 45) % 360 } : t))
  }

  return (
    <div className="fixed inset-0 z-[100] bg-navy/95 backdrop-blur-xl flex flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-aura-gold" />
            Floor Plan Editor
          </h2>
          <p className="text-xs text-fumo mt-1">Trascina i tavoli per posizionarli. Clicca l'icona per ruotarli.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetLayout}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-aura-gold border border-aura-gold/30 hover:bg-aura-gold/10 transition-colors"
          >
            Riordina
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-pietra hover:bg-white/10 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => savePositions.mutate(layout)}
            disabled={savePositions.isPending}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-aura-gold text-navy text-sm font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {t('tables.saveLayout', { defaultValue: 'Salva Layout' })}
          </button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div className="flex-1 p-6 overflow-hidden flex gap-6">
        <div className="w-64 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-bold text-white mb-3">Tavoli in Sala</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {layout.map(table => (
                <div key={table.id} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5">
                  <span className="text-xs font-semibold text-pietra">Tavolo {table.number}</span>
                  <span className="text-[10px] text-fumo">{table.seats}p</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center bg-black/20 rounded-2xl p-4 overflow-hidden">
          <div 
            ref={containerRef}
            className="relative w-full bg-[#0f111a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ aspectRatio: '16/9', maxHeight: '100%' }}
          >
            {/* Sfondo Marmo/Lusso Scuro - Nessuna Griglia */}
            <div className="absolute inset-0 bg-[#0f111a]" />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.15) 0%, transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 10px)' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-aura-gold/10 rounded-full blur-[120px] pointer-events-none" />
          
          {layout.map(table => {
            const rot = table.rotation || 0
            const size = getTableSize(table.seats, table.shape || 'SQUARE')
            
            if (containerSize.width === 0) return null;

            const renderEditorChairs = () => {
              const chairs = []
              const padding = 12
              const chairSize = 20
              const shape = table.shape || 'SQUARE'
              
              if (shape === 'ROUND') {
                const radius = (size.width / 2) + padding
                const angleStep = (2 * Math.PI) / table.seats
                for (let i = 0; i < table.seats; i++) {
                  const angle = i * angleStep - Math.PI / 2
                  const x = Math.cos(angle) * radius
                  const y = Math.sin(angle) * radius
                  chairs.push(
                    <div key={`chair-${i}`} className="absolute rounded-full bg-white/10 shadow-inner border border-white/5 pointer-events-none" 
                         style={{ width: chairSize, height: chairSize, left: `calc(50% + ${x}px - ${chairSize/2}px)`, top: `calc(50% + ${y}px - ${chairSize/2}px)` }} />
                  )
                }
              } else {
                // Unused vars removed
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
                      <div key={`chair-${side}-${i}`} className={cn("absolute bg-white/10 shadow-inner border border-white/5 pointer-events-none", side === 'left' || side === 'right' ? 'w-[14px] h-[24px] rounded-sm' : 'w-[24px] h-[14px] rounded-sm')}
                           style={{ left, top, transform: 'translate(-50%, -50%)' }} />
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
              <Rnd
                key={table.id}
                bounds="parent"
                position={{
                  x: (table.posX / 100) * containerSize.width,
                  y: (table.posY / 100) * containerSize.height
                }}
                size={size}
                enableResizing={false}
                onDragStop={(_, d) => handleDragStop(table.id, d)}
                className="group"
                style={{ position: 'absolute' }}
              >
                <div style={{ transform: `rotate(${rot}deg)`, width: '100%', height: '100%', position: 'relative' }} className="cursor-grab active:cursor-grabbing">
                  {/* Chairs Layer */}
                  <div className="absolute inset-0 pointer-events-none">
                    {renderEditorChairs()}
                  </div>
                  
                  {/* Main Table Layer */}
                  <div 
                    className={cn(
                      "table-tile !relative !top-0 !left-0 !transform-none w-full h-full cursor-grab active:cursor-grabbing pointer-events-none",
                      table.status === 'FREE' ? 'table-tile--free' :
                      table.status === 'OCCUPIED' ? 'table-tile--occupied' :
                      table.status === 'CLEANING' ? 'table-tile--cleaning' : 'table-tile--reserved',
                      table.shape === 'ROUND' ? 'rounded-full' : 'rounded-xl'
                    )}
                  >
                    <div className="flex flex-col items-center pointer-events-none">
                      <span className="text-base font-display font-bold z-10 drop-shadow-md text-white">
                        {table.name || `T${table.number}`}
                      </span>
                      <span className="text-[10px] font-semibold text-white/80 z-10">
                        {table.seats}p
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Rotate Handle */}
                <button 
                  onClick={(e) => handleRotate(table.id, rot, e)}
                  className="absolute -top-3 -right-3 w-7 h-7 bg-navy border border-aura-gold/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-aura-gold hover:text-navy cursor-pointer z-[100]"

                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </Rnd>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}
