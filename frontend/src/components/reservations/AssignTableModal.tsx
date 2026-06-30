import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatTime, cn } from '../../lib/utils'
import { Loader2, X, Users } from 'lucide-react'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import { toast } from '@/lib/toast'

interface AvailableTable {
  id: string
  number: number
  seats: number
  area?: string | null
  status: string
  suitable: boolean
}

interface AssignTableModalProps {
  reservation: {
    id: string
    guestName: string
    covers: number
    date: string
  }
  onSuccess: () => void
  onCancel: () => void
}

export default function AssignTableModal({ reservation, onSuccess, onCancel }: AssignTableModalProps) {
  const { t } = useTranslation()
  const tk = useTenantQueryKey()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  const { data: tables = [], isLoading } = useQuery<AvailableTable[]>({
    queryKey: tq(tk, 'reservation-available-tables', reservation.id),
    queryFn: () => api.get(`/reservations/${reservation.id}/available-tables`).then(r => r.data),
  })

  const confirm = useMutation({
    mutationFn: (tableId: string) =>
      api.post(`/reservations/${reservation.id}/confirm`, { tableId }),
    onSuccess: () => {
      toast.success(t('reservations.tableAssigned'))
      onSuccess()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error ?? t('reservations.tableAssignError'))
    },
  })

  const suitableTables = tables.filter(tbl => tbl.suitable)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-xl premium-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-pietra">{t('reservations.assignTableTitle')}</h3>
            <p className="mt-1 text-sm text-fumo">
              {reservation.guestName} · {formatTime(reservation.date)} · {reservation.covers} {t('reservations.guests')}
            </p>
            <p className="mt-0.5 text-xs text-fumo">{t('reservations.freeTablesHint')}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 text-fumo hover:bg-white/[0.05]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : suitableTables.length === 0 ? (
          <p className="py-8 text-center text-sm text-fumo">{t('reservations.noTablesAvailable')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {suitableTables.map(table => (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedTableId(table.id)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  selectedTableId === table.id
                    ? 'border-amber-500 bg-aura-gold/10 ring-2 ring-amber-200'
                    : 'border-white/[0.08] bg-navy-surface hover:border-aura-gold/30 hover:bg-aura-gold/10',
                )}
              >
                <p className="font-bold text-pietra">T{table.number}</p>
                <p className="flex items-center gap-1 text-xs text-fumo mt-0.5">
                  <Users className="h-3 w-3" />
                  {table.seats} {t('common.seats')}
                </p>
                {table.area && (
                  <p className="text-[10px] text-fumo mt-1 truncate">{table.area}</p>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => selectedTableId && confirm.mutate(selectedTableId)}
            disabled={!selectedTableId || confirm.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:opacity-60"
          >
            {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('reservations.confirmSeat')}
          </button>
        </div>
      </div>
    </div>
  )
}
