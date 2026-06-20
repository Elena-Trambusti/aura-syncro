/** Resolve revenueAmount with legacy fallback (pre-migration orders may have 0/null). */
export function resolveRevenueAmount(order: {
  revenueAmount: number | null
  total: number
  subtotal: number
  tax: number
  tipAmount?: number | null
}): number {
  if (order.revenueAmount != null && order.revenueAmount > 0) {
    return order.revenueAmount
  }
  const foodTotal = order.subtotal + order.tax
  if (foodTotal > 0) return foodTotal
  const tip = order.tipAmount ?? 0
  return Math.max(0, (order.total ?? 0) - tip)
}

export function resolveTipAmount(tipAmount: number | null | undefined): number {
  return tipAmount ?? 0
}

export function resolveOrderTotal(order: {
  total: number
  revenueAmount: number | null
  subtotal: number
  tax: number
  tipAmount?: number | null
}): number {
  if (order.total != null && order.total > 0) return order.total
  return resolveRevenueAmount(order) + resolveTipAmount(order.tipAmount)
}
