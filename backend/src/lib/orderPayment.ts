import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { buildFiscalTransactionRow, computePaymentSplit, type FiscalTransactionRow } from './tipFiscal'
import { loadRestaurantFiscalConfig, type FiscalConfig } from './taxEngine'
import { appendFiscalChainLink } from './fiscal/fiscalIntegrityChain'
import { releaseTableAfterPaymentTx } from './orderSession'
import { toMoney, moneyNumber } from './money'
import { runOrderTransaction } from './prismaTransactions'

export interface FinalizePaymentInput {
  orderId: string
  restaurantId: string
  tipAmount?: number
  tipWaiterId?: string
  executorUserId?: string
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
  updatedTable?: { id: string; number: number; status: string } | null
}

export type PrecomputedOrderTotals = {
  subtotal: number
  tax: number
  total: number
  discountAmount: number
  revenueAmount: number
  taxRateApplied: number
}

export { computePaymentSplit }

const TIP_ELIGIBLE_ROLES = ['WAITER', 'MANAGER', 'OWNER', 'HOST', 'BARTENDER'] as const

const paymentOrderInclude = {
  table: { select: { id: true, number: true, status: true } },
  items: {
    include: { menuItem: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

export async function resolveTipWaiterId(
  restaurantId: string,
  tipWaiterId?: string,
  executorUserId?: string,
  executorRole?: string,
  orderWaiterId?: string | null,
): Promise<string | undefined> {
  if (!tipWaiterId) return undefined

  if (executorRole && ['WAITER', 'BARTENDER'].includes(executorRole)) {
    const allowedTipWaiterId = orderWaiterId || executorUserId
    if (tipWaiterId !== allowedTipWaiterId) {
      throw new Error('UNAUTHORIZED_TIP_ASSIGNMENT')
    }
  }

  const waiter = await prisma.user.findFirst({
    where: {
      id: tipWaiterId,
      restaurantId,
      active: true,
      role: { in: [...TIP_ELIGIBLE_ROLES] },
    },
    select: { id: true },
  })
  if (!waiter) {
    throw new Error('INVALID_TIP_WAITER')
  }
  return waiter.id
}

function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`
}

export type FinalizePaymentOptions = {
  splitBreakdown?: SplitBreakdown
  serveItemsOnPayment?: boolean
  /** Totali sconto già calcolati prima della transazione (evita doppio round-trip). */
  precomputedTotals?: PrecomputedOrderTotals
  fiscalConfig?: FiscalConfig
}

/**
 * Fast path incasso POS: una sola transazione atomica per stato essenziale.
 * Magazzino, documento fiscale numerato e Aruba SDI → paymentSideEffects (background).
 */
export async function finalizeOrderPayment(
  input: FinalizePaymentInput,
  options?: FinalizePaymentOptions,
): Promise<FinalizePaymentResult & { updatedOrder: Prisma.OrderGetPayload<{ include: typeof paymentOrderInclude }> }> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    include: { items: { include: { menuItem: true } } },
  })

  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.status === 'PAID') throw new Error('ORDER_ALREADY_PAID')
  if (order.status === 'CANCELLED') throw new Error('ORDER_CANCELLED')

  const fiscal = options?.fiscalConfig ?? await loadRestaurantFiscalConfig(input.restaurantId)
  const serveItems = options?.serveItemsOnPayment !== false
  const precomputed = options?.precomputedTotals

  const split = computePaymentSplit(
    precomputed
      ? {
          ...order,
          subtotal: toMoney(precomputed.subtotal),
          tax: toMoney(precomputed.tax),
          total: toMoney(precomputed.total),
          revenueAmount: toMoney(precomputed.revenueAmount),
        }
      : order,
    input.tipAmount,
    fiscal,
  )
  const transactionId = generateTransactionId()
  const paidAt = split.paidAt

  const { paidOrder, updatedTable } = await runOrderTransaction(async tx => {
    if (precomputed) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: toMoney(precomputed.subtotal),
          tax: toMoney(precomputed.tax),
          total: toMoney(precomputed.total),
          discount: toMoney(precomputed.discountAmount),
          taxRateApplied: precomputed.taxRateApplied,
          revenueAmount: toMoney(precomputed.revenueAmount),
        },
      })
    }

    if (serveItems) {
      await tx.orderItem.updateMany({
        where: {
          orderId: order.id,
          status: { notIn: ['CANCELLED', 'SERVED'] },
        },
        data: { status: 'SERVED' },
      })
    }

    const lock = await tx.order.updateMany({
      where: { id: order.id, status: { notIn: ['PAID', 'CANCELLED'] } },
      data: { status: 'PAID' },
    })
    if (lock.count === 0) {
      const current = await tx.order.findFirst({
        where: { id: order.id },
        select: { status: true },
      })
      if (current?.status === 'CANCELLED') throw new Error('ORDER_CANCELLED')
      throw new Error('ORDER_ALREADY_PAID')
    }

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
        revenueAmount: toMoney(split.revenueAmount),
        tipAmount: toMoney(split.tipAmount),
        tipWaiterId: input.tipWaiterId,
        total: toMoney(split.total),
        taxRateApplied: order.taxRateApplied ?? fiscal.taxRate,
        fiscalRegionSnapshot: fiscal.fiscalRegion,
        fiscalIntegrityHash: chainLink.integrityHash,
        fiscalPrevHash: chainLink.prevHash,
        fiscalClosedAt: chainLink.closedAt,
      },
      include: paymentOrderInclude,
    })

    if (input.paymentMethod === 'CASH') {
      const due = cashRegisterDueAtFinalize(moneyNumber(split.total), moneyNumber(order.collectedAmount))
      if (due > 0) {
        const openSession = await tx.cashRegisterSession.findFirst({
          where: { restaurantId: input.restaurantId, status: 'OPEN' },
        })
        if (!openSession) throw new Error('CASH_SESSION_REQUIRED')
        const resolvedUserId = input.executorUserId || order.waiterId
        if (!resolvedUserId) throw new Error('CASH_USER_REQUIRED')

        await tx.cashTransaction.create({
          data: {
            sessionId: openSession.id,
            userId: resolvedUserId,
            type: 'SALE',
            amount: toMoney(due),
            reason: moneyNumber(order.collectedAmount) > 0
              ? `Saldo contanti Ordine #${order.id.slice(-6).toUpperCase()}`
              : `Incasso contanti Ordine #${order.id.slice(-6).toUpperCase()}`,
            orderId: order.id,
          },
        })
      }
    }

    let tableUpdate: Awaited<ReturnType<typeof releaseTableAfterPaymentTx>> = null
    if (serveItems && order.tableId) {
      tableUpdate = await releaseTableAfterPaymentTx(
        tx,
        order.tableId,
        input.restaurantId,
        order.id,
      )
    }

    return { paidOrder: paid, updatedTable: tableUpdate }
  })

  const fiscalRow = buildFiscalTransactionRow(paidOrder, paidAt, paidOrder.taxRateApplied)

  return {
    revenueAmount: split.revenueAmount,
    tipAmount: split.tipAmount,
    total: split.total,
    paidAt,
    transactionId,
    fiscalRow,
    splitBreakdown: options?.splitBreakdown,
    updatedTable: updatedTable
      ? { id: updatedTable.id, number: updatedTable.number, status: updatedTable.status }
      : null,
    updatedOrder: paidOrder,
  }
}

export async function decrementInventoryForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
): Promise<void> {
  const { deductInventoryForOrderBatched } = await import('./inventoryDeduction')
  await deductInventoryForOrderBatched(tx, orderId, restaurantId)
}

/** Importo da registrare in cassa al finalize (0 se split già incassato). */
export function cashRegisterDueAtFinalize(total: number, priorCollected: number): number {
  const due = moneyNumber(total) - moneyNumber(priorCollected)
  return due > 0.009 ? Math.round(due * 100) / 100 : 0
}

/** Calcola ripartizione split (solo presentazione — un solo incasso fiscale) */
export function computeSplitBreakdown(
  items: Array<{ id: string; quantity: number; unitPrice: number; modifierTotal?: number }>,
  totalWithTip: number,
  config: {
    mode: 'equal' | 'by_items'
    guestCount: number
    assignments?: Array<{ itemId: string; guestIndex: number }>
  },
): SplitBreakdown {
  const guestCount = Math.max(1, config.guestCount)
  const lineGross = (item: { quantity: number; unitPrice: number }) =>
    item.quantity * item.unitPrice
  const lineTotal = (id: string) => {
    const item = items.find(i => i.id === id)
    return item ? lineGross(item) : 0
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
        subtotal: items.reduce((s, it) => s + lineGross(it), 0),
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
    guests[idx].subtotal += lineGross(item)
  }

  const foodTotal = items.reduce((s, it) => s + lineGross(it), 0)
  for (let i = 0; i < guests.length; i++) {
    const g = guests[i]
    g.share = foodTotal > 0
      ? Math.round((g.subtotal / foodTotal) * totalWithTip * 100) / 100
      : Math.round((totalWithTip / guestCount) * 100) / 100
  }
  if (guests.length > 0) {
    const sumShares = guests.slice(0, -1).reduce((s, g) => s + g.share, 0)
    guests[guests.length - 1].share = Math.round((totalWithTip - sumShares) * 100) / 100
  }

  return { mode: 'by_items', guestCount, guests }
}

export { releaseTableIfSessionComplete as releaseTableIfEmpty } from './orderSession'
