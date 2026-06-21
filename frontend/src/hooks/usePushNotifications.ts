import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  getPushPermission,
  isPushSupported,
  subscribeToPushNotifications,
} from '../lib/pushNotifications'

export function usePushNotifications(enabled: boolean) {
  const { t } = useTranslation()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!enabled || !isPushSupported()) return
    void getPushPermission().then(setPermission)
  }, [enabled])

  const enablePush = useCallback(async () => {
    try {
      const ok = await subscribeToPushNotifications()
      const next = await getPushPermission()
      setPermission(next)
      setSubscribed(ok)
      if (ok) toast.success(t('pwa.pushEnabled'))
      else if (next === 'denied') toast.error(t('pwa.pushDenied'))
      return ok
    } catch {
      toast.error(t('pwa.pushError'))
      return false
    }
  }, [t])

  useEffect(() => {
    if (!enabled || !isPushSupported() || permission !== 'granted') return
    void subscribeToPushNotifications()
      .then(ok => setSubscribed(ok))
      .catch(() => setSubscribed(false))
  }, [enabled, permission])

  return {
    supported: isPushSupported(),
    permission,
    subscribed,
    enablePush,
  }
}
