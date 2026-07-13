import { lazy, Suspense, useEffect, useState } from 'react'
import { hasAnalyticsConsent, subscribeCookieConsent } from '../lib/cookieConsent'

const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })),
)
const SpeedInsights = lazy(() =>
  import('@vercel/speed-insights/react').then((m) => ({ default: m.SpeedInsights })),
)

/** Metriche terze parti — solo dopo consenso esplicito (ePrivacy). */
export default function DeferredMetrics() {
  const [allowed, setAllowed] = useState(() => hasAnalyticsConsent())

  useEffect(() => {
    return subscribeCookieConsent(() => setAllowed(hasAnalyticsConsent()))
  }, [])

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!allowed) {
      setReady(false)
      return
    }
    const run = () => setReady(true)
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 2500)
    return () => clearTimeout(t)
  }, [allowed])

  if (!allowed || !ready) return null

  return (
    <Suspense fallback={null}>
      <Analytics />
      <SpeedInsights />
    </Suspense>
  )
}
