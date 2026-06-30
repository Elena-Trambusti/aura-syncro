import { lazy, Suspense, useEffect, useState } from 'react'

const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })),
)
const SpeedInsights = lazy(() =>
  import('@vercel/speed-insights/react').then((m) => ({ default: m.SpeedInsights })),
)

/** Metriche terze parti caricate dopo il first paint (non nel percorso critico). */
export default function DeferredMetrics() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const run = () => setReady(true)
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 2500)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <Analytics />
      <SpeedInsights />
    </Suspense>
  )
}
