import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

/** Invalida tutte le query tenant-scoped al cambio ristorante o regime fiscale */
export function invalidateTenantQueries(tenantKey: string) {
  queryClient.invalidateQueries({ queryKey: [tenantKey] })
}
