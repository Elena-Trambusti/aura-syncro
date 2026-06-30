import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const LandingBelowFold = lazy(() => import('./LandingBelowFold'))

/** Carica le sezioni sotto la piega solo quando l'utente si avvicina (meno JS e CLS iniziali). */
export default function LandingBelowFoldLoader() {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const node = anchorRef.current
    if (!node || shouldLoad) return

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '320px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <div ref={anchorRef} className="min-h-[1px]">
      {shouldLoad ? (
        <Suspense fallback={<div className="h-24" aria-hidden />}>
          <LandingBelowFold />
        </Suspense>
      ) : null}
    </div>
  )
}
