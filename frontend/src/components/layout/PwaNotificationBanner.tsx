import { BellRing, Download, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { usePwaInstall } from '../../hooks/usePwaInstall'

interface PwaNotificationBannerProps {
  enabled: boolean
}

export default function PwaNotificationBanner({ enabled }: PwaNotificationBannerProps) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, ready, enablePush } = usePushNotifications(enabled)
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('pwa-push-banner-dismissed') === '1',
  )

  if (!enabled || !ready || !supported || permission === 'denied' || subscribed || dismissed) return null

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
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void enablePush()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
        >
          {t('pwa.enablePush')}
        </button>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => {
            localStorage.setItem('pwa-push-banner-dismissed', '1')
            setDismissed(true)
          }}
          className="rounded-lg p-2 text-slate-400 hover:bg-amber-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** Banner installazione PWA — visibile su mobile/tablet finché l'app non è installata */
export function PwaInstallHint() {
  const { t } = useTranslation()
  const { canInstall, isStandalone, install } = usePwaInstall()
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('pwa-install-hint-dismissed') === '1',
  )

  if (dismissed || isStandalone) return null

  const handleInstall = async () => {
    if (!canInstall) return
    const ok = await install()
    if (ok) toast.success(t('pwa.installSuccess'))
  }

  return (
    <div className="pwa-install-hint mb-4 flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:hidden">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{t('pwa.installTitle')}</p>
        <p className="text-xs text-slate-600 mt-0.5">{t('pwa.installHint')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canInstall && (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            <Download className="h-4 w-4" />
            {t('pwa.installApp')}
          </button>
        )}
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => {
            localStorage.setItem('pwa-install-hint-dismissed', '1')
            setDismissed(true)
          }}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
