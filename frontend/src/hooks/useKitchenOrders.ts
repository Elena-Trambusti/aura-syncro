import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { api } from '../lib/api'
import { getSocket, ensureSocketConnected, isSocketConnected } from '../lib/socket'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import {
  type KitchenOrder,
  applyOptimisticDismiss,
  applyOptimisticItemStatus,
  applyOptimisticOrderReady,
  filterKitchenOrders,
  itemActionKey,
  mergeKitchenOrder,
  orderActionKey,
} from '../lib/kitchenOrders'

const SOCKET_FALLBACK_REFETCH_MS = 30_000

export function useKitchenOrders() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const queryKey = tq(tk, 'kitchen', 'orders')

  const inFlightRef = useRef(new Set<string>())
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set())

  const { data: orders = [], isError, isLoading } = useQuery<KitchenOrder[]>({
    queryKey,
    queryFn: () =>
      api.get('/orders/active').then(r => filterKitchenOrders(r.data as KitchenOrder[])),
    staleTime: 30_000,
    refetchInterval: () => (isSocketConnected() ? 60_000 : SOCKET_FALLBACK_REFETCH_MS),
  })

  const patchCache = useCallback(
    (updater: (prev: KitchenOrder[]) => KitchenOrder[]) => {
      queryClient.setQueryData<KitchenOrder[]>(queryKey, prev => updater(prev ?? []))
    },
    [queryClient, queryKey],
  )

  const mergeServerOrder = useCallback(
    (updated: KitchenOrder) => {
      patchCache(prev => mergeKitchenOrder(prev, updated))
    },
    [patchCache],
  )

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    // Always apply remote socket updates; optimistic local patches merge separately.
    const onNewOrder = (order: KitchenOrder) => {
      patchCache(prev => mergeKitchenOrder(prev, order))
    }

    const onOrderUpdated = (order: KitchenOrder) => {
      patchCache(prev => mergeKitchenOrder(prev, order))
    }

    const onReconnect = () => {
      void queryClient.invalidateQueries({ queryKey })
    }

    void ensureSocketConnected()
      .then((s) => {
        if (cancelled) return
        socket = s
        s.on('order:created', onNewOrder)
        s.on('order:updated', onOrderUpdated)
        s.on('connect', onReconnect)
      })
      .catch(() => { /* polling fallback */ })

    return () => {
      cancelled = true
      if (!socket) return
      socket.off('order:created', onNewOrder)
      socket.off('order:updated', onOrderUpdated)
      socket.off('connect', onReconnect)
    }
  }, [patchCache, queryClient, queryKey])

  const trackAction = useCallback((key: string) => {
    inFlightRef.current.add(key)
    setPendingKeys(prev => new Set(prev).add(key))
  }, [])

  const releaseAction = useCallback((key: string) => {
    inFlightRef.current.delete(key)
    setPendingKeys(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const assertNotInFlight = (key: string) => {
    if (inFlightRef.current.has(key)) {
      throw Object.assign(new Error('DUPLICATE_ACTION'), { code: 'DUPLICATE_ACTION' })
    }
  }

  const isDuplicateAction = (err: unknown) =>
    (err as { code?: string })?.code === 'DUPLICATE_ACTION'

  const updateItemStatus = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      status,
      units,
    }: {
      orderId: string
      itemId: string
      status: string
      units?: number
    }) =>
      api
        .patch(`/orders/${orderId}/items/${itemId}/status`, { status, units })
        .then(r => r.data as KitchenOrder),
    onMutate: async vars => {
      const key = itemActionKey(vars.orderId, vars.itemId, vars.status, vars.units)
      assertNotInFlight(key)

      trackAction(key)

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKey)

      patchCache(prev =>
        applyOptimisticItemStatus(prev, vars.orderId, vars.itemId, vars.status, vars.units),
      )

      return { previous, key }
    },
    onError: (err, _vars, ctx) => {
      if (isDuplicateAction(err)) return
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      toast.error(t('kitchen.dishUpdateError'))
    },
    onSuccess: (updated) => {
      mergeServerOrder(updated)
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if (ctx?.key) releaseAction(ctx.key)
    },
  })

  const orderReady = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/orders/${orderId}/status`, { status: 'READY' }).then(r => r.data as KitchenOrder),
    onMutate: async orderId => {
      const key = orderActionKey(orderId, 'ready')
      assertNotInFlight(key)

      trackAction(key)

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKey)
      patchCache(prev => applyOptimisticOrderReady(prev, orderId))
      return { previous, key }
    },
    onError: (err, _orderId, ctx) => {
      if (isDuplicateAction(err)) return
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      toast.error(t('kitchen.orderReadyError'))
    },
    onSuccess: (updated) => {
      mergeServerOrder(updated)
      toast.success(t('kitchen.orderReady'))
    },
    onSettled: (_data, _err, _orderId, ctx) => {
      if (ctx?.key) releaseAction(ctx.key)
    },
  })

  const dismissOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/orders/${orderId}/status`, { status: 'SERVED' }).then(r => r.data as KitchenOrder),
    onMutate: async orderId => {
      const key = orderActionKey(orderId, 'dismiss')
      assertNotInFlight(key)

      trackAction(key)

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKey)
      patchCache(prev => applyOptimisticDismiss(prev, orderId))
      return { previous, key }
    },
    onError: (err, _orderId, ctx) => {
      if (isDuplicateAction(err)) return
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      toast.error(t('kitchen.orderDismissError'))
    },
    onSuccess: (updated) => {
      mergeServerOrder(updated)
      toast.success(t('kitchen.orderDismissed'))
    },
    onSettled: (_data, _err, _orderId, ctx) => {
      if (ctx?.key) releaseAction(ctx.key)
    },
  })

  const handleItemStatusChange = useCallback(
    (orderId: string, itemId: string, status: string, units?: number) => {
      updateItemStatus.mutate({ orderId, itemId, status, units })
    },
    [updateItemStatus],
  )

  const handleOrderReady = useCallback(
    (orderId: string) => {
      orderReady.mutate(orderId)
    },
    [orderReady],
  )

  const handleDismiss = useCallback(
    (orderId: string) => {
      dismissOrder.mutate(orderId)
    },
    [dismissOrder],
  )

  const isItemBusy = useCallback(
    (orderId: string, itemId: string) => {
      const prefix = `${orderId}:${itemId}:`
      for (const key of pendingKeys) {
        if (key.startsWith(prefix)) return true
      }
      return false
    },
    [pendingKeys],
  )

  const isOrderBusy = useCallback(
    (orderId: string) => {
      for (const key of pendingKeys) {
        if (key.startsWith(`${orderId}:`)) return true
      }
      return false
    },
    [pendingKeys],
  )

  return {
    orders,
    isError,
    isLoading,
    handleItemStatusChange,
    handleOrderReady,
    handleDismiss,
    isItemBusy,
    isOrderBusy,
  }
}
