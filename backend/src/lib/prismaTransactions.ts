import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/** Opzioni transazione ordini/magazzino — evita P2028 "Transaction not found" sotto carico. */
export const ORDER_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 25_000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const

  const TX_RETRYABLE = new Set(['P2028', 'P2034'])

export function isRetriableTransactionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TX_RETRYABLE.has(err.code)
  }
  if (err instanceof Error && (
    err.message.includes('Transaction not found')
    || err.message.includes('FISCAL_CHAIN_CONFLICT')
    || err.message.includes('could not serialize')
  )) {
    return true
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Transazione interattiva con retry su scadenza/race (P2028).
 * Usata per creazione ordini, righe e magazzino.
 */
export async function runOrderTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxWait?: number; timeout?: number } = ORDER_TX_OPTIONS,
): Promise<T> {
  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(fn, options)
    } catch (err) {
      lastError = err
      if (!isRetriableTransactionError(err) || attempt === maxAttempts - 1) {
        throw err
      }
      await sleep(75 * (attempt + 1))
    }
  }

  throw lastError
}
