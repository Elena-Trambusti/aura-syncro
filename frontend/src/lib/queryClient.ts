import { QueryClient } from '@tanstack/react-query'
import type { TaxRegion } from './fiscalRegime'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

/** Invalida cache tenant-scoped al cambio ristorante o regime fiscale */
export function invalidateTenantQueries(restaurantId: string, taxRegion?: TaxRegion) {
  queryClient.invalidateQueries({ queryKey: ['reports', 'fiscal', restaurantId] })
  queryClient.invalidateQueries({ queryKey: ['reports'] })
  queryClient.invalidateQueries({ queryKey: ['analytics'] })
  queryClient.invalidateQueries({ queryKey: ['orders'] })
  queryClient.invalidateQueries({ queryKey: ['tables'] })
  queryClient.invalidateQueries({ queryKey: ['inventory'] })
  queryClient.invalidateQueries({ queryKey: ['ai'] })
  if (taxRegion) {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] })
  }
}
