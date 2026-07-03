import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { formatTime, cn } from '@/lib/utils'
import { Loader2, Users } from 'lucide-react'
import { useTenantQueryKey } from '@/contexts/AuthContext'
import { tq } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import { formatApiError } from '@/lib/formatApiError'
import {
  AuraDialog,
  AuraDialogBody,
  AuraDialogDescription,
  AuraDialogFooter,
  AuraDialogHeader,
} from '@/components/ui/AuraDialog'

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
      toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'reservations.tableAssignError'))
    },
  })

  const suitableTables = tables.filter(tbl => tbl.suitable)

  return (
    <AuraDialog onClose={onCancel} maxWidth="lg" hideClose skipBuiltInA11y>
      <AuraDialogHeader
        onClose={onCancel}
        title={t('reservations.assignTableTitle')}
        description={`${reservation.guestName} · ${formatTime(reservation.date)} · ${reservation.covers} ${t('reservations.guests')}`}
      />
      <AuraDialogDescription className="mb-4 -mt-2 text-xs">
        {t('reservations.freeTablesHint')}
      </AuraDialogDescription>

      <AuraDialogBody>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-aura-gold" />
          </div>
        ) : suitableTables.length === 0 ? (
          <p className="py-8 text-center text-sm text-fumo">{t('reservations.noTablesAvailable')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suitableTables.map(table => (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedTableId(table.id)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  selectedTableId === table.id
                    ? 'border-aura-gold bg-aura-gold/10 ring-2 ring-aura-gold/30'
                    : 'border-white/[0.08] bg-navy-surface hover:border-aura-gold/30 hover:bg-aura-gold/10',
                )}
              >
                <p className="font-bold text-pietra">T{table.number}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-fumo">
                  <Users className="h-3 w-3" />
                  {table.seats} {t('common.seats')}
                </p>
                {table.area && (
                  <p className="mt-1 truncate text-[10px] text-fumo">{table.area}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </AuraDialogBody>

      <AuraDialogFooter className="mt-6 flex gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => selectedTableId && confirm.mutate(selectedTableId)}
          disabled={!selectedTableId || confirm.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-navy hover:bg-aura-gold-light disabled:opacity-60"
        >
          {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('reservations.confirmSeat')}
        </button>
      </AuraDialogFooter>
    </AuraDialog>
  )
}
