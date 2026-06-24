import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { Search, User, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import toast from 'react-hot-toast'

export interface CustomerOption {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  loyaltyPoints?: number
  loyaltyTier?: { name: string; discountPct: number; color?: string } | null
}

interface CustomerPickerProps {
  orderId: string
  currentCustomer?: CustomerOption | null
  onLinked?: (customer: CustomerOption | null) => void
  compact?: boolean
}

export default function CustomerPicker({
  orderId,
  currentCustomer,
  onLinked,
  compact = false,
}: CustomerPickerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 280)
    return () => window.clearTimeout(id)
  }, [query])

  const { data: results = [], isFetching } = useQuery<CustomerOption[]>({
    queryKey: tq(tk, 'orders', 'customer-search', debounced),
    queryFn: () => api.get(`/orders/customers/search?q=${encodeURIComponent(debounced)}`).then(r => r.data),
    enabled: debounced.length >= 2,
  })

  const linkCustomer = useMutation({
    mutationFn: (customerId: string | null) =>
      api.patch(`/orders/${orderId}/customer`, { customerId }).then(r => r.data),
    onSuccess: (order: { customer?: CustomerOption | null }) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'checkout', orderId) })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
      onLinked?.(order.customer ?? null)
      setQuery('')
      toast.success(t('checkout.customerLinked'))
    },
    onError: () => toast.error(t('checkout.customerLinkError')),
  })

  const selected = currentCustomer

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-navy-surface/40 p-4', compact && 'p-3')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-pietra">
          <User className="h-4 w-4 text-aura-gold" aria-hidden />
          {t('checkout.customerTitle')}
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => linkCustomer.mutate(null)}
            disabled={linkCustomer.isPending}
            className="text-xs font-medium text-fumo hover:text-red-400"
          >
            {t('checkout.customerRemove')}
          </button>
        )}
      </div>

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-pietra">{selected.name}</p>
            {selected.loyaltyTier && selected.loyaltyTier.discountPct > 0 && (
              <p className="text-xs text-emerald-300">
                {t('checkout.loyaltyTierBadge', {
                  tier: selected.loyaltyTier.name,
                  pct: selected.loyaltyTier.discountPct,
                })}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fumo" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('checkout.customerSearchPlaceholder')}
              className="saas-input w-full py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
          {debounced.length >= 2 && (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/[0.08] bg-navy-elevated">
              {isFetching && (
                <li className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-fumo">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </li>
              )}
              {!isFetching && results.length === 0 && (
                <li className="px-3 py-3 text-xs text-fumo">{t('checkout.customerNoResults')}</li>
              )}
              {results.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => linkCustomer.mutate(c.id)}
                    disabled={linkCustomer.isPending}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/[0.04]"
                  >
                    <span className="font-medium text-pietra">{c.name}</span>
                    {c.loyaltyTier && c.loyaltyTier.discountPct > 0 && (
                      <span className="shrink-0 text-xs text-emerald-400">
                        −{c.loyaltyTier.discountPct}%
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
