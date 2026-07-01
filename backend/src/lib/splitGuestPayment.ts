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
 * Se tutte le quote sono saldate, il chiamante può procedere alla chiusura fiscale PAID.
 */
export async function recordSplitGuestPayment(
  input: SplitGuestPaymentInput,
): Promise<SplitGuestPaymentResult> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    select: {
      id: true,
      status: true,
      total: true,
      collectedAmount: true,
      splitPaidGuestIndexes: true,
    },
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.status === 'PAID') throw new Error('ORDER_ALREADY_PAID')
  if (order.status === 'CANCELLED') throw new Error('ORDER_CANCELLED')

  const ledgerTotal = input.checkoutTotal
  assertSplitSharesSumToTotal(input.breakdown, ledgerTotal)

  let ledger = ledgerFromOrderState(
    input.breakdown,
    ledgerTotal,
    order.splitPaidGuestIndexes,
  )
  ledger = applyGuestSplitPayment(ledger, input.guestIndex, input.amount)

  const newCollected = getRemainingTotal(ledger) === 0
    ? ledgerTotal
    : moneyNumber(order.collectedAmount) + input.amount
  const paidGuests = [...new Set([...order.splitPaidGuestIndexes, input.guestIndex])].sort((a, b) => a - b)

  await runOrderTransaction(async (tx: Prisma.TransactionClient) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        collectedAmount: toMoney(newCollected),
        splitPaidGuestIndexes: paidGuests,
      },
    })

    if (input.settlementMethod === 'CASH') {
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
    }
  })

  return {
    ledger,
    remaining: getRemainingTotal(ledger),
    fullyCollected: isSplitFullyCollected(ledger),
    collectedAmount: newCollected,
  }
}
