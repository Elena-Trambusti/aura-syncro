import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  getPushPermission,
  hasActivePushSubscription,
  isPushSupported,
  PushSubscribeError,
  subscribeToPushNotifications,
} from '../lib/pushNotifications'

export function usePushNotifications(enabled: boolean) {
  const { t } = useTranslation()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled || !isPushSupported()) {
      setReady(true)
      return
    }
    void (async () => {
      const perm = await getPushPermission()
      setPermission(perm)
      if (perm === 'granted') {
        setSubscribed(await hasActivePushSubscription())
      }
      setReady(true)
    })()
  }, [enabled])

  const enablePush = useCallback(async () => {
    try {
      const ok = await subscribeToPushNotifications()
      const next = await getPushPermission()
      setPermission(next)
      setSubscribed(ok)
      if (ok) toast.success(t('pwa.pushEnabled'))
      return ok
    } catch (err) {
      console.error('[push] enablePush error:', err)
      if (err instanceof PushSubscribeError) {
        if (err.code === 'denied') {
          toast.error(t('pwa.pushDenied'))
        } else if (err.code === 'no_vapid') {
          toast.error(t('pwa.pushNoVapid'))
        } else if (err.code === 'no_sw') {
          toast.error(t('pwa.pushNoSw'))
        } else {
          toast.error(err.message)
        }
      } else {
        toast.error(t('pwa.pushError'))
      }
      return false
    }
  }, [t])

  useEffect(() => {
    if (!enabled || !ready || !isPushSupported() || permission !== 'granted' || subscribed) return
    void subscribeToPushNotifications()
      .then(ok => setSubscribed(ok))
      .catch(err => {
        console.warn('[push] auto-subscribe skipped:', err)
        setSubscribed(false)
      })
  }, [enabled, ready, permission, subscribed])

  return {
    supported: isPushSupported(),
    permission,
    subscribed,
    ready,
    enablePush,
  }
}
