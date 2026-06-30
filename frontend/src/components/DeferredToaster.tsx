import { lazy, Suspense, useEffect, useState } from 'react'

const Toaster = lazy(() =>
  import('react-hot-toast').then((m) => ({ default: m.Toaster })),
)

export default function DeferredToaster() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const run = () => setReady(true)
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 1500)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1A1D26',
            color: '#F4F4F5',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
          success: { iconTheme: { primary: '#D4AF37', secondary: '#0B0E14' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#0B0E14' } },
        }}
      />
    </Suspense>
  )
}
