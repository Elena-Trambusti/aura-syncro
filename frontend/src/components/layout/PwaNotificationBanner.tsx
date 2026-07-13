import { BellRing, Download, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { usePwaInstall } from '../../hooks/usePwaInstall'
import { isInstalledAppShell } from '../../lib/standaloneApp'
import { useMediaQuery, TABLE_MOBILE_LAYOUT_QUERY } from '../../hooks/useMediaQuery'

interface PwaNotificationBannerProps {
  enabled: boolean
}

export default function PwaNotificationBanner({ enabled }: PwaNotificationBannerProps) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, enablePush } = usePushNotifications(enabled)
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('pwa-push-banner-dismissed') === '1',
  )

  if (!enabled || !supported || permission === 'denied' || subscribed || dismissed) return null

  return (
    <div className="pwa-notification-banner mx-0 flex flex-col gap-3 rounded-xl border border-aura-gold/25 bg-aura-gold/10 px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between lg:mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <BellRing className="h-4 w-4 text-aura-gold" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-pietra">{t('pwa.pushBannerTitle')}</p>
          <p className="text-xs text-fumo mt-0.5">{t('pwa.pushBannerDesc')}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void enablePush()}
          className="rounded-lg bg-aura-gold px-4 py-2 text-sm font-semibold text-white hover:bg-aura-gold-light transition-colors"
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
          className="rounded-lg p-2 text-fumo hover:bg-amber-100 hover:text-fumo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** Banner installazione PWA — solo su mobile/tablet nel browser, non su desktop */
export function PwaInstallHint() {
  const { t } = useTranslation()
  const { canInstall, isStandalone, install } = usePwaInstall()
  const isMobileBrowser = useMediaQuery(TABLE_MOBILE_LAYOUT_QUERY)
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('pwa-install-hint-dismissed') === '1',
  )

  if (dismissed || isStandalone || isInstalledAppShell() || !isMobileBrowser) return null

  const handleInstall = async () => {
    if (!canInstall) return
    const ok = await install()
    if (ok) toast.success(t('pwa.installSuccess'))
  }

  return (
    <div className="pwa-install-hint flex flex-col gap-3 rounded-xl border border-aura-gold/25/80 bg-navy-elevated px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-pietra">{t('pwa.installTitle')}</p>
        <p className="text-xs text-fumo mt-0.5">{t('pwa.installHint')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canInstall && (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-aura-gold px-3 py-2 text-sm font-semibold text-white hover:bg-aura-gold-light transition-colors"
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
          className="rounded-lg p-2 text-fumo hover:bg-white/[0.05] hover:text-fumo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
