import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import { HardwareSettings } from '@/components/hardware/HardwareSettings'

export default function HardwareSettingsPage() {
  const { t } = useTranslation()

  return (
    <ExecutivePageShell>
      <ExecutivePageHeader
        title={t('settings.hardwareTitle')}
        subtitle={t('settings.hardwareSubtitle')}
        actions={(
          <Link
            to="/impostazioni"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-navy-surface/60 px-3 py-2 text-xs font-semibold text-fumo transition-colors hover:bg-white/[0.05] hover:text-pietra"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('settings.hardwareBack')}
          </Link>
        )}
      />
      <HardwareSettings />
    </ExecutivePageShell>
  )
}
