import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import ModalPortal from '../ModalPortal'
import AuraIcon from '../ui/AuraIcon'
import { ui } from '../../lib/ui'

interface TableCleaningConfirmModalProps {
  tableNumber: number
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export default function TableCleaningConfirmModal({
  tableNumber,
  onConfirm,
  onCancel,
  isPending = false,
}: TableCleaningConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <ModalPortal onClose={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-cleaning-modal-title"
        className={cn('w-full max-w-md p-6 sm:p-8', ui.glassModal, 'border-[#C5A059]/25 shadow-[0_24px_64px_rgba(0,0,0,0.65),0_0_0_1px_rgba(197,160,89,0.08)]')}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#7A9BB8]/30 bg-[#0B0E14]/90 text-[#7A9BB8]">
          <AuraIcon icon={Sparkles} size="lg" className="text-[#7A9BB8]" />
        </div>

        <h3
          id="table-cleaning-modal-title"
          className="font-display text-xl font-medium tracking-tight text-[#F4F0E6]"
        >
          {t('tables.confirmCleaningTitle')}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {t('tables.confirmCleaningDescription', { number: tableNumber })}
        </p>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-xl border border-[#C5A059]/45 bg-[#0B0E14] px-5 py-2.5 text-sm font-semibold text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.15)] transition-all hover:border-[#C5A059]/65 hover:bg-[#12151C] hover:shadow-[0_0_28px_rgba(197,160,89,0.22)] disabled:opacity-60"
          >
            {t('tables.confirmCleaningConfirm')}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}
