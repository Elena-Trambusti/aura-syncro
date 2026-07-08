import { useRef } from 'react'
import {
  useMutation,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'

export type InstantMutationContext<TSnapshot> = {
  skipped?: true
  previous?: TSnapshot
  actionKey?: string
}

type BaseOptions<TData, TError, TVariables, TSnapshot> = UseMutationOptions<
  TData,
  TError,
  TVariables,
  InstantMutationContext<TSnapshot>
>

export type UseInstantMutationOptions<TData, TError, TVariables, TSnapshot> = Omit<
  BaseOptions<TData, TError, TVariables, TSnapshot>,
  'onMutate'
> & {
  /** Side-effect immediato al tap (chiudi modal, toast, …) — non attende la rete */
  onInstant?: (variables: TVariables) => void | Promise<void>
  actionKey?: (variables: TVariables) => string
  onOptimistic?: (variables: TVariables) => TSnapshot | undefined | Promise<TSnapshot | undefined>
  onRollback?: (snapshot: TSnapshot, variables: TVariables) => void
  invalidateKeys?: readonly QueryKey[]
}

/**
 * Wrapper React Query con dedup in-flight, optimistic UI e rollback automatico.
 */
export function useInstantMutation<TData, TError, TVariables, TSnapshot = unknown>(
  options: UseInstantMutationOptions<TData, TError, TVariables, TSnapshot>,
): UseMutationResult<TData, TError, TVariables, InstantMutationContext<TSnapshot>> {
  const inFlightRef = useRef(new Set<string>())
  const {
    actionKey,
    onInstant,
    onOptimistic,
    onRollback,
    onError,
    onSettled,
    ...rest
  } = options

  return useMutation({
    ...rest,
    onMutate: async variables => {
      const key = actionKey?.(variables)
      if (key && inFlightRef.current.has(key)) {
        return { skipped: true as const, actionKey: key }
      }
      if (key) inFlightRef.current.add(key)

      await onInstant?.(variables)
      const previous = onOptimistic ? await onOptimistic(variables) : undefined

      return { previous, actionKey: key }
    },
    onError: (error, variables, context, mutation) => {
      if (!context?.skipped && context?.previous !== undefined && onRollback) {
        onRollback(context.previous, variables)
      }
      onError?.(error, variables, context, mutation)
    },
    onSettled: (data, error, variables, context, mutation) => {
      if (context?.actionKey) inFlightRef.current.delete(context.actionKey)
      onSettled?.(data, error, variables, context, mutation)
    },
  })
}
