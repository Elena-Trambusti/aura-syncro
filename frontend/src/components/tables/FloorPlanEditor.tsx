import { useState, useRef, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { useTranslation } from 'react-i18next'
import { Save, UtensilsCrossed, RotateCw } from 'lucide-react'
import type { FloorTable } from './TableFloorPlan'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'

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

  const getTableGlow = (status: string) => {
    switch (status) {
      case 'OCCUPIED':
        return 'ring-2 ring-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.4)] bg-navy-mid'
      case 'CLEANING':
        return 'ring-2 ring-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse bg-navy-mid'
      case 'FREE':
      default:
        return 'ring-1 ring-aura-gold/40 shadow-inner bg-navy-elevated/80'
    }
  }

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
            {/* Griglia Blueprint */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          
          {layout.map(table => {
            const rot = table.rotation || 0
            const size = getTableSize(table.seats, table.shape || 'SQUARE')
            
            if (containerSize.width === 0) return null;

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
                <div 
                  className={`w-full h-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-md transition-shadow duration-300 ${getTableGlow(table.status)} ${table.shape === 'ROUND' ? 'rounded-full' : 'rounded-xl'}`}
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  <div className="flex flex-col items-center pointer-events-none">
                    <span className="text-base font-display font-bold text-white/90 drop-shadow-md">
                      {table.name || table.number}
                    </span>
                    <span className="text-[10px] font-semibold text-fumo">
                      {table.seats}p
                    </span>
                  </div>
                </div>
                
                {/* Rotate Handle */}
                <button 
                  onClick={(e) => handleRotate(table.id, rot, e)}
                  className="absolute -top-3 -right-3 w-7 h-7 bg-navy border border-aura-gold/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-aura-gold hover:text-navy cursor-pointer z-10"
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
