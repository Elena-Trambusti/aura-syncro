import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { isRetriableTransactionError } from './prismaTransactions'

describe('isRetriableTransactionError', () => {
  it('ritenta su P2028 Transaction not found', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Transaction API error: Transaction not found', {
      code: 'P2028',
      clientVersion: 'test',
    })
    assert.equal(isRetriableTransactionError(err), true)
  })

  it('ritenta su messaggio Transaction not found generico', () => {
    assert.equal(isRetriableTransactionError(new Error('Transaction not found')), true)
  })

  it('non ritenta su altri errori', () => {
    assert.equal(isRetriableTransactionError(new Error('INSUFFICIENT_STOCK')), false)
  })
})
