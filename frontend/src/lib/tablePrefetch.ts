import type { QueryClient } from '@tanstack/react-query'
import { api } from './api'
import { tq } from './queryKeys'

const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'])

interface TableWithOrders {
  id: string
  orders?: { id: string; status: string }[]
}

export function prefetchTableOrderData(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  table: TableWithOrders,
): void {
  if (!tenantKey) return
  const activeOrder = table.orders?.find(o => ACTIVE_ORDER_STATUSES.has(o.status))
  if (!activeOrder) return

  void queryClient.prefetchQuery({
    queryKey: tq(tenantKey, 'orders', activeOrder.id),
    queryFn: () => api.get(`/orders/${activeOrder.id}`).then(r => r.data),
    staleTime: 30_000,
  })

  void queryClient.prefetchQuery({
    queryKey: tq(tenantKey, 'checkout', activeOrder.id),
    queryFn: () => api.get(`/payments/checkout/${activeOrder.id}`).then(r => r.data),
    staleTime: 60_000,
  })
}
