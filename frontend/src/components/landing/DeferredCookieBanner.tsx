import { lazy, Suspense, useEffect, useState } from 'react'
import { isPublicAppRoute } from '../../lib/publicRoutes'

const CookieBanner = lazy(() =>
  import('./CookieBanner').then((m) => ({ default: m.CookieBanner })),
)

/** Cookie banner — dopo idle per non impattare LCP mobile. */
export default function DeferredCookieBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isPublicAppRoute(window.location.pathname)) return
    if (localStorage.getItem('aura-cookie-consent')) return

    const run = () => setReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = globalThis.setTimeout(run, 3500)
    return () => globalThis.clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <CookieBanner />
    </Suspense>
  )
}
