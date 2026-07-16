import type { Prisma } from '@prisma/client'
import type { SplitBreakdown } from './orderPayment'
import {
  applyGuestSplitPayment,
  assertSplitSharesSumToTotal,
  createSplitLedger,
  getRemainingTotal,
  isSplitFullyCollected,
  type SplitPaymentLedger,
} from './splitSettlement'
import { moneyNumber, toMoney } from './money'
import { prisma } from './prisma'
import { runOrderTransaction } from './prismaTransactions'
import { getIdempotentResponse } from './apiIdempotency'
import { orderPaymentFinalizeLockKey } from './paymentLockKeys'

export type SplitGuestPaymentInput = {
  orderId: string
  restaurantId: string
  breakdown: SplitBreakdown
  guestIndex: number
  amount: number
  /** Totale checkout (ordine + mancia) — deve coincidere con la somma delle quote split */
  checkoutTotal: number
  executorUserId?: string
  settlementMethod: 'CASH' | 'CARD'
}

export type SplitGuestPaymentResult = {
  ledger: SplitPaymentLedger
  remaining: number
  fullyCollected: boolean
  collectedAmount: number
}

export function ledgerFromOrderState(
  breakdown: SplitBreakdown,
  orderTotal: number,
  splitPaidGuestIndexes: number[],
): SplitPaymentLedger {
  let ledger = createSplitLedger(breakdown, orderTotal)
  for (const guestIndex of [...splitPaidGuestIndexes].sort((a, b) => a - b)) {
    const share = breakdown.guests[guestIndex]?.share ?? 0
    ledger = applyGuestSplitPayment(ledger, guestIndex, share)
  }
  return ledger
}

/**
 * Registra incasso parziale di una quota split.
 * Condizionale su splitPaidGuestIndexes per evitare doppio SALE sotto concorrenza.
 */
export async function recordSplitGuestPayment(
  input: SplitGuestPaymentInput,
): Promise<SplitGuestPaymentResult> {
  if (input.settlementMethod !== 'CASH') {
    throw new Error('SPLIT_INCREMENTAL_CASH_ONLY')
  }

  const finalizeLock = await getIdempotentResponse(
    input.restaurantId,
    orderPaymentFinalizeLockKey(input.orderId),
    'PAYMENT_FINALIZE',
  )
  if (finalizeLock?.statusCode === 202 || finalizeLock?.statusCode === 402) {
    throw new Error('PAYMENT_IN_PROGRESS')
  }

  return runOrderTransaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, restaurantId: input.restaurantId },
      select: {
        id: true,
        status: true,
        total: true,
        tipAmount: true,
        collectedAmount: true,
        splitPaidGuestIndexes: true,
      },
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (order.status === 'PAID') throw new Error('ORDER_ALREADY_PAID')
    if (order.status === 'CANCELLED') throw new Error('ORDER_CANCELLED')

    if (order.splitPaidGuestIndexes.includes(input.guestIndex)) {
      throw new Error('GUEST_ALREADY_PAID')
    }

    const ledgerTotal = input.checkoutTotal
    assertSplitSharesSumToTotal(input.breakdown, ledgerTotal)

    let ledger = ledgerFromOrderState(
      input.breakdown,
      ledgerTotal,
      order.splitPaidGuestIndexes,
    )

    // Congela tip + quote: i guest già pagati devono ricostruire collectedAmount
    if (order.splitPaidGuestIndexes.length > 0) {
      const impliedCollected = ledgerTotal - getRemainingTotal(ledger)
      if (Math.abs(impliedCollected - moneyNumber(order.collectedAmount)) > 0.009) {
        throw new Error('SPLIT_CONFIG_CHANGED')
      }
      const frozenTip = moneyNumber(order.tipAmount)
      const expectedCheckout = moneyNumber(order.total) + frozenTip
      if (Math.abs(expectedCheckout - ledgerTotal) > 0.009) {
        throw new Error('SPLIT_CONFIG_CHANGED')
      }
    }

    ledger = applyGuestSplitPayment(ledger, input.guestIndex, input.amount)

    const newCollected = getRemainingTotal(ledger) === 0
      ? ledgerTotal
      : moneyNumber(order.collectedAmount) + input.amount
    const paidGuests = [...new Set([...order.splitPaidGuestIndexes, input.guestIndex])].sort((a, b) => a - b)

    const tipToPersist = order.splitPaidGuestIndexes.length === 0
      ? Math.max(0, ledgerTotal - moneyNumber(order.total))
      : moneyNumber(order.tipAmount)

    const updated = await tx.order.updateMany({
      where: {
        id: order.id,
        restaurantId: input.restaurantId,
        status: { notIn: ['PAID', 'CANCELLED'] },
        NOT: { splitPaidGuestIndexes: { has: input.guestIndex } },
      },
      data: {
        collectedAmount: toMoney(newCollected),
        splitPaidGuestIndexes: paidGuests,
        tipAmount: toMoney(tipToPersist),
      },
    })
    if (updated.count === 0) {
      throw new Error('GUEST_ALREADY_PAID')
    }

    const openSession = await tx.cashRegisterSession.findFirst({
      where: { restaurantId: input.restaurantId, status: 'OPEN' },
    })
    if (!openSession) throw new Error('CASH_SESSION_REQUIRED')
    if (!input.executorUserId) throw new Error('CASH_USER_REQUIRED')

    await tx.cashTransaction.create({
      data: {
        sessionId: openSession.id,
        userId: input.executorUserId,
        type: 'SALE',
        amount: toMoney(input.amount),
        reason: `Split ospite ${input.guestIndex + 1} — Ordine #${order.id.slice(-6).toUpperCase()}`,
        orderId: order.id,
      },
    })

    return {
      ledger,
      remaining: getRemainingTotal(ledger),
      fullyCollected: isSplitFullyCollected(ledger),
      collectedAmount: newCollected,
    }
  })
}
