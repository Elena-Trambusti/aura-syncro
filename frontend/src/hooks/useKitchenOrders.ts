import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { getSocket, connectSocket } from '../lib/socket'
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

const SOCKET_FALLBACK_REFETCH_MS = 120_000

export function useKitchenOrders() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const queryKey = tq(tk, 'kitchen', 'orders')

  const inFlightRef = useRef(new Set<string>())
  const pendingOrderIdsRef = useRef(new Set<string>())
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set())

  const { data: orders = [], isError, isLoading } = useQuery<KitchenOrder[]>({
    queryKey,
    queryFn: () =>
      api.get('/orders/active').then(r => filterKitchenOrders(r.data as KitchenOrder[])),
    staleTime: 30_000,
    refetchInterval: () => {
      const socket = getSocket()
      return socket.connected ? false : SOCKET_FALLBACK_REFETCH_MS
    },
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
    const token = localStorage.getItem('token')
    if (token) connectSocket(token)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const onNewOrder = (order: KitchenOrder) => {
      if (pendingOrderIdsRef.current.has(order.id)) return
      patchCache(prev => mergeKitchenOrder(prev, order))
    }

    const onOrderUpdated = (order: KitchenOrder) => {
      if (pendingOrderIdsRef.current.has(order.id)) return
      patchCache(prev => mergeKitchenOrder(prev, order))
    }

    socket.on('order:created', onNewOrder)
    socket.on('order:updated', onOrderUpdated)
    return () => {
      socket.off('order:created', onNewOrder)
      socket.off('order:updated', onOrderUpdated)
    }
  }, [patchCache])

  const trackAction = useCallback((key: string, orderId: string) => {
    inFlightRef.current.add(key)
    pendingOrderIdsRef.current.add(orderId)
    setPendingKeys(prev => new Set(prev).add(key))
  }, [])

  const releaseAction = useCallback((key: string, orderId?: string) => {
    inFlightRef.current.delete(key)
    if (orderId) pendingOrderIdsRef.current.delete(orderId)
    setPendingKeys(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

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
      if (inFlightRef.current.has(key)) return { skipped: true as const }

      trackAction(key, vars.orderId)

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKey)

      patchCache(prev =>
        applyOptimisticItemStatus(prev, vars.orderId, vars.itemId, vars.status, vars.units),
      )

      return { previous, key, orderId: vars.orderId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.skipped) return
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      toast.error(t('kitchen.dishUpdateError'))
    },
    onSuccess: (updated, _vars, ctx) => {
      if (ctx?.skipped) return
      mergeServerOrder(updated)
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if (!ctx || ctx.skipped) return
      releaseAction(ctx.key, ctx.orderId)
    },
  })

  const orderReady = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/orders/${orderId}/status`, { status: 'READY' }).then(r => r.data as KitchenOrder),
    onMutate: async orderId => {
      const key = orderActionKey(orderId, 'ready')
      if (inFlightRef.current.has(key)) return { skipped: true as const }

      trackAction(key, orderId)

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKey)
      patchCache(prev => applyOptimisticOrderReady(prev, orderId))
      return { previous, key, orderId }
    },
    onError: (_err, _orderId, ctx) => {
      if (ctx?.skipped) return
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      toast.error(t('kitchen.orderReadyError'))
    },
    onSuccess: (updated, _orderId, ctx) => {
      if (ctx?.skipped) return
      mergeServerOrder(updated)
      toast.success(t('kitchen.orderReady'))
    },
    onSettled: (_data, _err, orderId, ctx) => {
      if (!ctx || ctx.skipped) return
      releaseAction(ctx.key, orderId)
    },
  })

  const dismissOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/orders/${orderId}/status`, { status: 'SERVED' }).then(r => r.data as KitchenOrder),
    onMutate: async orderId => {
      const key = orderActionKey(orderId, 'dismiss')
      if (inFlightRef.current.has(key)) return { skipped: true as const }

      trackAction(key, orderId)

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKey)
      patchCache(prev => applyOptimisticDismiss(prev, orderId))
      return { previous, key, orderId }
    },
    onError: (_err, _orderId, ctx) => {
      if (ctx?.skipped) return
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      toast.error(t('kitchen.orderDismissError', { defaultValue: "Impossibile archiviare l'ordine" }))
    },
    onSuccess: (updated, _orderId, ctx) => {
      if (ctx?.skipped) return
      mergeServerOrder(updated)
      toast.success(
        t('kitchen.orderDismissed', { defaultValue: 'Ordine consegnato e rimosso dalla cucina' }),
      )
    },
    onSettled: (_data, _err, orderId, ctx) => {
      if (!ctx || ctx.skipped) return
      releaseAction(ctx.key, orderId)
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
