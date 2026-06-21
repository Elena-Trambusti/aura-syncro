import { BellRing, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePushNotifications } from '../../hooks/usePushNotifications'

interface PwaNotificationBannerProps {
  enabled: boolean
}

export default function PwaNotificationBanner({ enabled }: PwaNotificationBannerProps) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, enablePush } = usePushNotifications(enabled)

  if (!enabled || !supported || permission === 'denied' || subscribed) return null

  return (
    <div className="pwa-notification-banner mx-0 mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <BellRing className="h-4 w-4 text-amber-700" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{t('pwa.pushBannerTitle')}</p>
          <p className="text-xs text-slate-600 mt-0.5">{t('pwa.pushBannerDesc')}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void enablePush()}
        className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
      >
        {t('pwa.enablePush')}
      </button>
    </div>
  )
}

/** Compact install hint — dismissible */
export function PwaInstallHint() {
  const { t } = useTranslation()

  if (typeof window === 'undefined') return null
  const dismissed = localStorage.getItem('pwa-install-hint-dismissed') === '1'
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  if (dismissed || isStandalone) return null

  return (
    <div className="pwa-install-hint mb-4 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm lg:hidden">
      <p className="text-slate-600">{t('pwa.installHint')}</p>
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => localStorage.setItem('pwa-install-hint-dismissed', '1')}
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
