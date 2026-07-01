import { lazy, Suspense, useEffect, useState } from 'react'

const Toaster = lazy(() =>
  import('sonner').then((m) => ({ default: m.Toaster })),
)

/** Toaster Sonner — micro-notifiche satin dark, angolo schermo, non invasive. */
export default function AuraSonner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const run = () => setReady(true)
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 1200)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <Toaster
        position="top-right"
        expand={false}
        richColors={false}
        closeButton
        visibleToasts={4}
        gap={10}
        offset={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))', right: '0.75rem' }}
        toastOptions={{
          unstyled: true,
          duration: 3200,
          classNames: {
            toast: 'aura-sonner-toast',
            title: 'aura-sonner-toast__title',
            description: 'aura-sonner-toast__desc',
            closeButton: 'aura-sonner-toast__close',
            actionButton: 'aura-sonner-toast__action',
            cancelButton: 'aura-sonner-toast__cancel',
            success: 'aura-sonner-toast--success',
            error: 'aura-sonner-toast--error',
            warning: 'aura-sonner-toast--warning',
            info: 'aura-sonner-toast--info',
          },
        }}
      />
    </Suspense>
  )
}
