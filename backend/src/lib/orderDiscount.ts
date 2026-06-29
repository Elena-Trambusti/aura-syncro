import { prisma } from './prisma'
import { computeTaxForExistingOrder, computeTaxForRestaurant } from './orderTax'

export type DiscountSource = 'LOYALTY' | 'CAMPAIGN' | 'NONE'

export interface ResolvedDiscount {
  source: DiscountSource
  discountPct: number
  discountAmount: number
  campaignId?: string
  tierName?: string
}

/** Loyalty tier discount for a customer */
export async function resolveLoyaltyDiscount(
  restaurantId: string,
  customerId: string | null | undefined,
): Promise<ResolvedDiscount> {
  if (!customerId) {
    return { source: 'NONE', discountPct: 0, discountAmount: 0 }
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    include: { loyaltyTier: true },
  })
  const pct = customer?.loyaltyTier?.discountPct ?? 0
  if (pct <= 0) {
    return { source: 'NONE', discountPct: 0, discountAmount: 0 }
  }

  return {
    source: 'LOYALTY',
    discountPct: pct,
    discountAmount: 0,
    tierName: customer?.loyaltyTier?.name,
  }
}

/** Marketing campaign code discount */
export async function resolveCampaignDiscount(
  restaurantId: string,
  code: string | null | undefined,
): Promise<ResolvedDiscount> {
  if (!code?.trim()) {
    return { source: 'NONE', discountPct: 0, discountAmount: 0 }
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      restaurantId,
      discountCode: code.trim().toUpperCase(),
      status: { in: ['SENT'] },
      discountPct: { gt: 0 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!campaign?.discountPct) {
    return { source: 'NONE', discountPct: 0, discountAmount: 0 }
  }

  return {
    source: 'CAMPAIGN',
    discountPct: campaign.discountPct,
    discountAmount: 0,
    campaignId: campaign.id,
  }
}

/** Pick the better discount (higher %) — loyalty vs campaign, not stacked */
export function pickBestDiscount(
  loyalty: ResolvedDiscount,
  campaign: ResolvedDiscount,
): ResolvedDiscount {
  if (campaign.discountPct > loyalty.discountPct) return campaign
  if (loyalty.discountPct > 0) return loyalty
  return { source: 'NONE', discountPct: 0, discountAmount: 0 }
}

/** Recalculate order totals with optional discount % on gross menu total */
export async function computeOrderTotalsWithDiscount(
  restaurantId: string,
  grossTotal: number,
  discountPct: number,
  existingTaxRate?: number | null,
) {
  const discountAmount = Math.round(grossTotal * (discountPct / 100) * 100) / 100
  const discountedGross = Math.max(0, Math.round((grossTotal - discountAmount) * 100) / 100)

  const taxResult = existingTaxRate != null && existingTaxRate > 0
    ? await computeTaxForExistingOrder({ restaurantId, taxRateApplied: existingTaxRate }, discountedGross)
    : await computeTaxForRestaurant(restaurantId, discountedGross)

  return {
    grossTotal,
    discountAmount,
    discountPct,
    ...taxResult,
    revenueAmount: taxResult.total,
  }
}

/** Validate discount options without persisting (for checkout preview). */
export async function validateOrderDiscountOptions(
  orderId: string,
  restaurantId: string,
  options: { applyLoyalty?: boolean; discountCode?: string },
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { status: true, customerId: true },
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (['PAID', 'CANCELLED'].includes(order.status)) throw new Error('ORDER_CLOSED')

  if (options.discountCode) {
    const campaign = await resolveCampaignDiscount(restaurantId, options.discountCode)
    if (campaign.discountPct <= 0) throw new Error('INVALID_DISCOUNT_CODE')
    return
  }
  // applyLoyalty senza tier attivo: nessuno sconto da applicare (non è un errore al checkout)
  if (options.applyLoyalty && order.customerId) {
    await resolveLoyaltyDiscount(restaurantId, order.customerId)
  }
}

export async function resolveDiscountForOrder(
  restaurantId: string,
  order: { customerId: string | null; taxRateApplied: number | null; items: { status: string; unitPrice: number; quantity: number }[] },
  options: { applyLoyalty?: boolean; discountCode?: string },
) {
  const activeItems = order.items.filter(i => i.status !== 'CANCELLED')
  const grossTotal = activeItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  let discount = { source: 'NONE' as DiscountSource, discountPct: 0, discountAmount: 0 }
  if (options.discountCode) {
    const campaign = await resolveCampaignDiscount(restaurantId, options.discountCode)
    if (campaign.discountPct > 0) discount = campaign
    else throw new Error('INVALID_DISCOUNT_CODE')
  } else if (options.applyLoyalty !== false && order.customerId) {
    const loyalty = await resolveLoyaltyDiscount(restaurantId, order.customerId)
    if (loyalty.discountPct > 0) discount = loyalty
  }

  const totals = await computeOrderTotalsWithDiscount(
    restaurantId,
    grossTotal,
    discount.discountPct,
    order.taxRateApplied,
  )

  return { discount, totals }
}

/** Apply discount to an existing order and persist */
export async function applyDiscountToOrder(
  orderId: string,
  restaurantId: string,
  options: {
    applyLoyalty?: boolean
    discountCode?: string
  },
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { items: true },
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (['PAID', 'CANCELLED'].includes(order.status)) throw new Error('ORDER_CLOSED')

  const { totals } = await resolveDiscountForOrder(restaurantId, order, options)

  return prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      discount: totals.discountAmount,
      taxRateApplied: totals.taxRateApplied,
      revenueAmount: totals.revenueAmount,
    },
    include: {
      table: true,
      customer: { select: { id: true, name: true, loyaltyTier: true } },
      items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' } },
    },
  })
}
