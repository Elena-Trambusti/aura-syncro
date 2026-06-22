import type { Prisma, Table } from '@prisma/client'
import { prisma } from './prisma'
import { buildFiscalTransactionRow, computePaymentSplit, type FiscalTransactionRow } from './tipFiscal'
import { loadRestaurantFiscalConfig } from './taxEngine'
import { appendFiscalChainLink } from './fiscal/fiscalIntegrityChain'
import { applyPostPaymentEffects } from './postPayment'
import { issueInvoiceForOrder, snapshotOrderBillingFromCustomer } from './fiscalInvoice'
import { decrementInventoryForUnpaidItems } from './inventoryDeduction'

export interface FinalizePaymentInput {
  orderId: string
  restaurantId: string
  tipAmount?: number
  /** Metodo di incasso effettivo (registrato nel Libro Fiscale) */
  paymentMethod: 'CASH' | 'CARD' | 'STRIPE' | 'VOUCHER' | 'DIGITAL'
}

export interface SplitBreakdownGuest {
  guestIndex: number
  label: string
  itemIds: string[]
  subtotal: number
  share: number
}

export interface SplitBreakdown {
  mode: 'equal' | 'by_items'
  guestCount: number
  guests: SplitBreakdownGuest[]
}

export interface FinalizePaymentResult {
  revenueAmount: number
  tipAmount: number
  total: number
  paidAt: Date
  transactionId: string
  fiscalRow: FiscalTransactionRow
  splitBreakdown?: SplitBreakdown
}

export { computePaymentSplit }

function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`
}

/**
 * Chiude la comanda: ordine PAID, piatti attivi → SERVED, totali allineati al Libro Fiscale.
 */
export async function finalizeOrderPayment(
  input: FinalizePaymentInput,
  options?: { splitBreakdown?: SplitBreakdown },
): Promise<FinalizePaymentResult> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    include: { items: { include: { menuItem: true } } },
  })

  if (!order) {
    throw new Error('ORDER_NOT_FOUND')
  }
  if (order.status === 'PAID') {
    throw new Error('ORDER_ALREADY_PAID')
  }
  if (order.status === 'CANCELLED') {
    throw new Error('ORDER_CANCELLED')
  }

  const fiscal = await loadRestaurantFiscalConfig(input.restaurantId)
  const split = computePaymentSplit(order, input.tipAmount, fiscal)
  const transactionId = generateTransactionId()
  const paidAt = split.paidAt

  const updatedOrder = await prisma.$transaction(async tx => {
    await tx.orderItem.updateMany({
      where: {
        orderId: order.id,
        status: { notIn: ['CANCELLED', 'SERVED'] },
      },
      data: { status: 'SERVED' },
    })

    const chainLink = await appendFiscalChainLink(tx, input.restaurantId, {
      orderId: order.id,
      closedAt: paidAt,
      customerTotal: split.total,
    })

    const paid = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentMethod: input.paymentMethod,
        paidAt,
        revenueAmount: split.revenueAmount,
        tipAmount: split.tipAmount,
        total: split.total,
        taxRateApplied: order.taxRateApplied ?? fiscal.taxRate,
        fiscalRegionSnapshot: fiscal.fiscalRegion,
        fiscalIntegrityHash: chainLink.integrityHash,
        fiscalPrevHash: chainLink.prevHash,
        fiscalClosedAt: chainLink.closedAt,
      },
      include: {
        table: true,
        items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    await snapshotOrderBillingFromCustomer(tx, order.id, order.customerId)
    await issueInvoiceForOrder(tx, order.id, input.restaurantId, paidAt)

    await decrementInventoryForUnpaidItems(tx, order.id, input.restaurantId)
    return paid
  })

  const fiscalRow = buildFiscalTransactionRow(updatedOrder, paidAt)

  await applyPostPaymentEffects(order.id, input.restaurantId)

  return {
    revenueAmount: split.revenueAmount,
    tipAmount: split.tipAmount,
    total: split.total,
    paidAt,
    transactionId,
    fiscalRow,
    splitBreakdown: options?.splitBreakdown,
  }
}

export async function decrementInventoryForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
): Promise<void> {
  await decrementInventoryForUnpaidItems(tx, orderId, restaurantId)
}

export async function releaseTableIfEmpty(tableId: string | null | undefined): Promise<Table | null> {
  if (!tableId) return null
  const activeOrders = await prisma.order.count({
    where: {
      tableId,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
  })
  if (activeOrders === 0) {
    return prisma.table.update({
      where: { id: tableId },
      data: { status: 'CLEANING' },
    })
  }
  return null
}

/** Calcola ripartizione split (solo presentazione — un solo incasso fiscale) */
export function computeSplitBreakdown(
  items: Array<{ id: string; quantity: number; unitPrice: number }>,
  totalWithTip: number,
  config: {
    mode: 'equal' | 'by_items'
    guestCount: number
    assignments?: Array<{ itemId: string; guestIndex: number }>
  },
): SplitBreakdown {
  const guestCount = Math.max(1, config.guestCount)
  const lineTotal = (id: string) => {
    const item = items.find(i => i.id === id)
    return item ? item.quantity * item.unitPrice : 0
  }

  if (config.mode === 'equal') {
    const share = Math.round((totalWithTip / guestCount) * 100) / 100
    return {
      mode: 'equal',
      guestCount,
      guests: Array.from({ length: guestCount }, (_, i) => ({
        guestIndex: i,
        label: `Guest ${i + 1}`,
        itemIds: items.map(it => it.id),
        subtotal: items.reduce((s, it) => s + it.quantity * it.unitPrice, 0),
        share: i === guestCount - 1
          ? Math.round((totalWithTip - share * (guestCount - 1)) * 100) / 100
          : share,
      })),
    }
  }

  const assignmentMap = new Map<string, number>()
  for (const a of config.assignments ?? []) {
    assignmentMap.set(a.itemId, a.guestIndex)
  }

  const guests: SplitBreakdownGuest[] = Array.from({ length: guestCount }, (_, i) => ({
    guestIndex: i,
    label: `Guest ${i + 1}`,
    itemIds: [],
    subtotal: 0,
    share: 0,
  }))

  for (const item of items) {
    const gi = assignmentMap.get(item.id) ?? 0
    const idx = Math.min(Math.max(0, gi), guestCount - 1)
    guests[idx].itemIds.push(item.id)
    guests[idx].subtotal += item.quantity * item.unitPrice
  }

  const foodTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  for (const g of guests) {
    g.share = foodTotal > 0
      ? Math.round((g.subtotal / foodTotal) * totalWithTip * 100) / 100
      : Math.round((totalWithTip / guestCount) * 100) / 100
  }

  return { mode: 'by_items', guestCount, guests }
}
