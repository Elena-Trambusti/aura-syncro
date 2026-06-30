import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import { isPublicAppRoute } from '../lib/publicRoutes'

const PERSIST_OPTIONS = { maxAge: 1000 * 60 * 60 * 24 } as const

/**
 * Landing pubblica: solo QueryClient (niente IndexedDB nel bundle critico).
 * App autenticata: persistenza React Query caricata dopo il bootstrap.
 */
export default function AppProviders({ children }: { children: ReactNode }) {
  const isPublicLanding =
    typeof window !== 'undefined' && isPublicAppRoute(window.location.pathname)

  const [PersistProvider, setPersistProvider] = useState<ComponentType<{ children: ReactNode }> | null>(null)

  useEffect(() => {
    if (isPublicLanding) return
    let cancelled = false
    void Promise.all([
      import('@tanstack/react-query-persist-client'),
      import('../lib/queryClient'),
    ]).then(([{ PersistQueryClientProvider }, { idbPersister }]) => {
      if (cancelled) return
      setPersistProvider(() => function Provider({ children: inner }: { children: ReactNode }) {
        return (
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: idbPersister, ...PERSIST_OPTIONS }}
          >
            {inner}
          </PersistQueryClientProvider>
        )
      })
    })
    return () => {
      cancelled = true
    }
  }, [isPublicLanding])

  if (isPublicLanding || !PersistProvider) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return <PersistProvider>{children}</PersistProvider>
}
