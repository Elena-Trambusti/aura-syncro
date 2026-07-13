import { lazy, Suspense, useEffect, useState } from 'react'
import { getCookieConsent } from '../../lib/cookieConsent'

const CookieBanner = lazy(() =>
  import('./CookieBanner').then((m) => ({ default: m.CookieBanner })),
)

/** Cookie banner su tutte le route finché non è registrato un consenso. */
export default function DeferredCookieBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getCookieConsent()) return

    const run = () => setReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = globalThis.setTimeout(run, 1500)
    return () => globalThis.clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <CookieBanner />
    </Suspense>
  )
}
