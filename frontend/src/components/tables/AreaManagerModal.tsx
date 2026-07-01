import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Edit2, Map } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { toast } from '@/lib/toast'
import { resolveToastApiError } from '../../lib/formatApiError'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import { ui } from '../../lib/ui'
import GlassModal from '../ui/GlassModal'
import AuraIcon from '../ui/AuraIcon'

interface AreaManagerModalProps {
  areas: string[]
  onClose: () => void
}

export default function AreaManagerModal({ areas, onClose }: AreaManagerModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

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

  const handleSave = (oldName: string | null) => {
    if (!newName.trim()) return
    renameArea.mutate({ oldName, newName: newName.trim() })
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
            'Le zone vengono generate automaticamente in base ai tavoli presenti. Rinomina una zona per spostare tutti i tavoli associati.',
        })}
      </p>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
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
                  className="rounded-lg bg-aura-gold/20 p-2 text-aura-gold hover:bg-aura-gold/30"
                >
                  <AuraIcon icon={Save} size="md" />
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
                  className="rounded-lg p-2 text-fumo opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-aura-gold"
                >
                  <AuraIcon icon={Edit2} size="md" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </GlassModal>
  )
}
