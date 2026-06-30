import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import AuraIcon from '@/components/ui/AuraIcon'
import {
  AuraDialog,
  AuraDialogBody,
  AuraDialogFooter,
  AuraDialogTitle,
} from '@/components/ui/AuraDialog'

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
    <AuraDialog
      onClose={onCancel}
      maxWidth="md"
      hideClose
      className="border-[#C5A059]/25 shadow-[0_24px_64px_rgba(0,0,0,0.65),0_0_0_1px_rgba(197,160,89,0.08)]"
    >
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#7A9BB8]/30 bg-[#0B0E14]/90 text-[#7A9BB8]">
        <AuraIcon icon={Sparkles} size="lg" className="text-[#7A9BB8]" />
      </div>

      <AuraDialogTitle className="font-display text-xl font-medium tracking-tight text-[#F4F0E6]">
        {t('tables.confirmCleaningTitle')}
      </AuraDialogTitle>
      <AuraDialogBody>
        <p className="text-sm leading-relaxed text-slate-300">
          {t('tables.confirmCleaningDescription', { number: tableNumber })}
        </p>
      </AuraDialogBody>

      <AuraDialogFooter>
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
          className={cn(
            'rounded-xl border border-[#C5A059]/45 bg-[#0B0E14] px-5 py-2.5 text-sm font-semibold text-[#C5A059]',
            'shadow-[0_0_20px_rgba(197,160,89,0.15)] transition-all hover:border-[#C5A059]/65 hover:bg-[#12151C] hover:shadow-[0_0_28px_rgba(197,160,89,0.22)] disabled:opacity-60',
          )}
        >
          {t('tables.confirmCleaningConfirm')}
        </button>
      </AuraDialogFooter>
    </AuraDialog>
  )
}
