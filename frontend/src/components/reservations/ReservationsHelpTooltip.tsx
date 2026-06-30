import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuraTooltip } from '@/components/ui/AuraTooltip'

export default function ReservationsHelpTooltip() {
  const { t } = useTranslation()

  return (
    <AuraTooltip
      side="bottom"
      align="start"
      contentClassName="max-w-sm p-4 text-sm"
      content={(
        <>
          <p className="font-semibold text-pietra">{t('reservations.howItWorksTitle')}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
            <li>{t('reservations.howItWorksBookings')}</li>
            <li>{t('reservations.howItWorksWaitlist')}</li>
            <li>{t('reservations.howItWorksPublic')}</li>
          </ul>
          <p className="mt-2 text-xs text-fumo">{t('reservations.workflowHint')}</p>
        </>
      )}
    >
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg premium-card text-fumo hover:border-aura-gold/30 hover:text-aura-gold"
        aria-label={t('reservations.howItWorksTitle')}
      >
        <Info className="h-4 w-4" />
      </button>
    </AuraTooltip>
  )
}
