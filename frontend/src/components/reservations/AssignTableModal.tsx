import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatTime, cn } from '../../lib/utils'
import { Loader2, X, Users } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  const { data: tables = [], isLoading } = useQuery<AvailableTable[]>({
    queryKey: ['reservation-available-tables', reservation.id],
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
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t('reservations.assignTableTitle')}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {reservation.guestName} · {formatTime(reservation.date)} · {reservation.covers} {t('reservations.guests')}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : suitableTables.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('reservations.noTablesAvailable')}</p>
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
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                    : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50',
                )}
              >
                <p className="font-bold text-slate-900">T{table.number}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <Users className="h-3 w-3" />
                  {table.seats} {t('common.seats')}
                </p>
                {table.area && (
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{table.area}</p>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => selectedTableId && confirm.mutate(selectedTableId)}
            disabled={!selectedTableId || confirm.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('reservations.confirmWithTable')}
          </button>
        </div>
      </div>
    </div>
  )
}
