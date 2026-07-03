import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Edit2, Map, Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { toast } from '@/lib/toast'
import { resolveToastApiError } from '../../lib/formatApiError'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import { ui } from '../../lib/ui'
import GlassModal from '../ui/GlassModal'
import AuraIcon from '../ui/AuraIcon'
import type { FloorPlanLayoutV1 } from '../../lib/floorPlanLayout'
import { EMPTY_FLOOR_PLAN_LAYOUT } from '../../lib/floorPlanLayout'

interface AreaManagerModalProps {
  areas: string[]
  floorLayout?: FloorPlanLayoutV1
  onClose: () => void
}

export default function AreaManagerModal({ areas, floorLayout = EMPTY_FLOOR_PLAN_LAYOUT, onClose }: AreaManagerModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newAreaName, setNewAreaName] = useState('')

  const renameArea = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string | null; newName: string }) =>
      api.patch('/tables/area', { oldName, newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      toast.success(t('common.saved', { defaultValue: 'Salvato con successo' }))
      setEditingArea(null)
    },
    onError: (err: unknown) => {
      toast.error(resolveToastApiError(t, err, 'common.error'))
    },
  })

  const addArea = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim()
      const nextAreas = Array.from(new Set([...(floorLayout.areas ?? []), trimmed]))
      return api.patch('/tables/floor-layout', { ...floorLayout, areas: nextAreas })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'floor-layout') })
      toast.success(t('tables.editor.areaAdded', { defaultValue: 'Zona aggiunta' }))
      setNewAreaName('')
    },
    onError: (err: unknown) => {
      toast.error(resolveToastApiError(t, err, 'common.error'))
    },
  })

  const handleSave = (oldName: string | null) => {
    if (!newName.trim()) return
    renameArea.mutate({ oldName, newName: newName.trim() })
  }

  const handleAddArea = () => {
    const trimmed = newAreaName.trim()
    if (!trimmed) return
    if (areas.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(t('tables.editor.areaExists', { defaultValue: 'Questa zona esiste già' }))
      return
    }
    addArea.mutate(trimmed)
  }

  return (
    <GlassModal onClose={onClose} maxWidth="lg">
      <div className="mb-6 flex items-center justify-between">
        <h3 className={ui.modalTitle}>
          <AuraIcon icon={Map} size="lg" className="mr-2 inline text-aura-gold" />
          {t('tables.areaManagerTitle', { defaultValue: 'Gestione Zone' })}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-fumo transition-colors hover:bg-white/10 hover:text-white"
        >
          <AuraIcon icon={X} size="lg" />
        </button>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-fumo">
        {t('tables.areaManagerHint', {
          defaultValue:
            'Crea zone come Terrazza o Piano 2, poi assegna i tavoli dall’editor o da Nuovo tavolo. Rinomina una zona per spostare tutti i tavoli associati.',
        })}
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newAreaName}
          onChange={e => setNewAreaName(e.target.value)}
          placeholder={t('tables.editor.newAreaPlaceholder', { defaultValue: 'Es. Terrazza, Piano 2…' })}
          className={ui.input + ' flex-1'}
          onKeyDown={e => { if (e.key === 'Enter') handleAddArea() }}
        />
        <button
          type="button"
          onClick={handleAddArea}
          disabled={!newAreaName.trim() || addArea.isPending}
          className="flex items-center gap-2 rounded-xl bg-aura-gold px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('tables.editor.addArea', { defaultValue: 'Nuova zona' })}
        </button>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
        {areas.length === 0 ? (
          <p className="text-sm text-fumo">{t('tables.editor.noAreasYet', { defaultValue: 'Nessuna zona ancora — aggiungine una sopra.' })}</p>
        ) : null}
        {areas.map(area => (
          <div
            key={area || 'default'}
            className="aura-glass group flex items-center justify-between rounded-xl p-3"
          >
            {editingArea === area ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className={ui.input + ' flex-1'}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleSave(area || null)}
                  disabled={!newName.trim() || renameArea.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-aura-gold px-3 py-2 text-xs font-semibold text-navy hover:bg-aura-gold-light disabled:opacity-50"
                >
                  <AuraIcon icon={Save} size="sm" />
                  {t('common.save')}
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium text-pietra">{area || t('tables.defaultArea', { defaultValue: 'Sala principale' })}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingArea(area)
                    setNewName(area || '')
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-fumo transition-colors hover:border-aura-gold/30 hover:bg-white/10 hover:text-aura-gold"
                >
                  <AuraIcon icon={Edit2} size="sm" />
                  {t('common.edit', { defaultValue: 'Modifica' })}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </GlassModal>
  )
}
