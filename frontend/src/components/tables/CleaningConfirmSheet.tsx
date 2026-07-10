import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import MobileBottomSheet from '../ui/MobileBottomSheet'
import type { FloorTable } from '../tables/TableFloorPlan'

interface CleaningConfirmSheetProps {
  table: FloorTable
  onClose: () => void
  onConfirm: () => void
  isPending?: boolean
}

export default function CleaningConfirmSheet({
  table,
  onClose,
  onConfirm,
  isPending = false,
}: CleaningConfirmSheetProps) {
  const { t } = useTranslation()
  const prefix = table.shape === 'BAR_STOOL' ? 'B' : table.shape === 'BOOTH' ? 'G' : 'T'

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title={t('tables.confirmCleaningTitle')}
      description={t('tables.confirmCleaningDescription', { number: table.number })}
      titleId={`cleaning-confirm-${table.id}`}
      footer={(
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-aura-gold py-3.5 text-base font-semibold text-navy transition-colors hover:bg-aura-gold-light disabled:opacity-60"
          >
            <Sparkles className="h-5 w-5 shrink-0" />
            {t('tables.confirmCleaningConfirm')}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl border border-white/10 bg-white/5 py-3.5 text-base font-medium text-pietra transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
        </>
      )}
    >
      <div className="flex items-center gap-4 rounded-xl border border-[#7A9BB8]/30 bg-[#7A9BB8]/10 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#7A9BB8]/40 bg-[#0B0E14] text-lg font-bold text-[#7A9BB8]">
          {prefix}{table.number}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7A9BB8]">
            {t('tables.cleaning')}
          </p>
          <p className="mt-1 text-sm text-fumo">
            {table.seats} {t('common.seats')}
            {table.area ? ` · ${table.area}` : ''}
          </p>
        </div>
      </div>
    </MobileBottomSheet>
  )
}
