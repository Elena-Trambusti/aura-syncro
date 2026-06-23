import * as Tooltip from '@radix-ui/react-tooltip'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ReservationsHelpTooltip() {
  const { t } = useTranslation()

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
            aria-label={t('reservations.howItWorksTitle')}
          >
            <Info className="h-4 w-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            align="start"
            sideOffset={8}
            className="z-50 max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-md"
          >
            <p className="font-semibold text-slate-900">{t('reservations.howItWorksTitle')}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
              <li>{t('reservations.howItWorksBookings')}</li>
              <li>{t('reservations.howItWorksWaitlist')}</li>
              <li>{t('reservations.howItWorksPublic')}</li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">{t('reservations.workflowHint')}</p>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
