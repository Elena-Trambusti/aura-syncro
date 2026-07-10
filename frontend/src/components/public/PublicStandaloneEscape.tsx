import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isStandaloneApp } from '../../lib/standaloneApp'

/** Barra "Torna all'app" quando menu/prenotazioni sono aperti dentro PWA o APK (senza browser chrome). */
export default function PublicStandaloneEscape() {
  const { t } = useTranslation()

  if (!isStandaloneApp()) return null

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.replace('/dashboard')
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-start p-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
      <button
        type="button"
        onClick={handleBack}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-navy-surface/95 px-3 py-2 text-xs font-semibold text-pietra shadow-lg backdrop-blur-md transition-colors hover:bg-navy-elevated"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t('pwa.backToApp')}
      </button>
    </div>
  )
}
