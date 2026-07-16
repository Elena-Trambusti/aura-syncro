import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { FISCAL_REGION_GENESIS } from './fiscalRegion'

export type FiscalChainInput = {
  orderId: string
  closedAt: Date
  /** Totale incassato dal cliente (piatti + mancia) */
  customerTotal: number
  prevHash: string
}

export type FiscalChainLink = {
  integrityHash: string
  prevHash: string
  closedAt: Date
}

/**
 * Catena SHA-256 inalterabile (predisposizione VeriFactu / Ley Antifraude 11/2021).
 * Concatena: orderId | ISO timestamp | totale | hash precedente
 */
export function computeFiscalIntegrityHash(input: FiscalChainInput): string {
  const payload = [
    input.orderId,
    input.closedAt.toISOString(),
    input.customerTotal.toFixed(2),
    input.prevHash,
  ].join('|')

  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function buildFiscalChainLink(
  input: FiscalChainInput,
): FiscalChainLink {
  const prevHash = input.prevHash || FISCAL_REGION_GENESIS
  const integrityHash = computeFiscalIntegrityHash({ ...input, prevHash })
  return { integrityHash, prevHash, closedAt: input.closedAt }
}

/** Verifica integrità di un record rispetto alla catena */
export function verifyFiscalChainLink(link: {
  orderId: string
  closedAt: Date
  customerTotal: number
  fiscalPrevHash: string | null
  fiscalIntegrityHash: string | null
}): boolean {
  if (!link.fiscalIntegrityHash) return false
  const expected = computeFiscalIntegrityHash({
    orderId: link.orderId,
    closedAt: link.closedAt,
    customerTotal: link.customerTotal,
    prevHash: link.fiscalPrevHash ?? FISCAL_REGION_GENESIS,
  })
  return expected === link.fiscalIntegrityHash
}

export type FiscalChainTx = Prisma.TransactionClient

/**
 * Risolve il prevHash e aggiorna lo stato catena del tenant in transazione atomica.
 */
export async function appendFiscalChainLink(
  tx: FiscalChainTx,
  restaurantId: string,
  input: Omit<FiscalChainInput, 'prevHash'>,
): Promise<FiscalChainLink> {
  const state = await tx.fiscalChainState.upsert({
    where: { restaurantId },
    create: { restaurantId, lastHash: FISCAL_REGION_GENESIS },
    update: {},
  })

  const link = buildFiscalChainLink({
    ...input,
    prevHash: state.lastHash,
  })

  const advanced = await tx.fiscalChainState.updateMany({
    where: { restaurantId, lastHash: state.lastHash },
    data: {
      lastHash: link.integrityHash,
      lastOrderId: input.orderId,
    },
  })
  if (advanced.count === 0) {
    throw new Error('FISCAL_CHAIN_CONFLICT')
  }

  return link
}

/** Verifica che l'intera catena del periodo sia coerente (audit ispezione) */
export function verifyFiscalChainSequence(
  orders: Array<{
    id: string
    fiscalClosedAt: Date | null
    total: number
    fiscalPrevHash: string | null
    fiscalIntegrityHash: string | null
    paidAt: Date | null
  }>,
  options?: { initialExpectedPrev?: string | null },
): { valid: boolean; brokenAtOrderId?: string; reason?: string } {
  const fiscalOrders = orders.filter(o => o.fiscalClosedAt ?? o.paidAt)

  for (const order of fiscalOrders) {
    if (!order.fiscalIntegrityHash) {
      return {
        valid: false,
        brokenAtOrderId: order.id,
        reason: 'MISSING_INTEGRITY_HASH',
      }
    }
  }

  const sorted = [...fiscalOrders]
    .filter(o => o.fiscalIntegrityHash && (o.fiscalClosedAt ?? o.paidAt))
    .sort((a, b) => {
      const ta = (a.fiscalClosedAt ?? a.paidAt)!.getTime()
      const tb = (b.fiscalClosedAt ?? b.paidAt)!.getTime()
      return ta - tb
    })

  let expectedPrev = options?.initialExpectedPrev ?? FISCAL_REGION_GENESIS
  for (const order of sorted) {
    if (order.fiscalPrevHash !== expectedPrev) {
      return { valid: false, brokenAtOrderId: order.id }
    }
    const closedAt = order.fiscalClosedAt ?? order.paidAt!
    const ok = verifyFiscalChainLink({
      orderId: order.id,
      closedAt,
      customerTotal: order.total,
      fiscalPrevHash: order.fiscalPrevHash,
      fiscalIntegrityHash: order.fiscalIntegrityHash,
    })
    if (!ok) {
      return { valid: false, brokenAtOrderId: order.id }
    }
    expectedPrev = order.fiscalIntegrityHash!
  }

  return { valid: true }
}
