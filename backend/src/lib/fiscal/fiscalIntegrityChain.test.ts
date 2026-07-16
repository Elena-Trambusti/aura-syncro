import { buildFiscalChainLink, computeFiscalIntegrityHash, verifyFiscalChainSequence } from './fiscalIntegrityChain'
import assert from 'node:assert/strict'

const t0 = new Date('2026-06-22T12:00:00.000Z')
const t1 = new Date('2026-06-22T13:00:00.000Z')

const link1 = buildFiscalChainLink({
  orderId: 'ord_1',
  closedAt: t0,
  customerTotal: 55.5,
  prevHash: 'GENESIS',
})

assert.equal(link1.prevHash, 'GENESIS')
assert.equal(link1.integrityHash.length, 64)

const link2 = buildFiscalChainLink({
  orderId: 'ord_2',
  closedAt: t1,
  customerTotal: 30,
  prevHash: link1.integrityHash,
})

const audit = verifyFiscalChainSequence([
  {
    id: 'ord_1',
    fiscalClosedAt: t0,
    total: 55.5,
    fiscalPrevHash: 'GENESIS',
    fiscalIntegrityHash: link1.integrityHash,
    paidAt: t0,
  },
  {
    id: 'ord_2',
    fiscalClosedAt: t1,
    total: 30,
    fiscalPrevHash: link1.integrityHash,
    fiscalIntegrityHash: link2.integrityHash,
    paidAt: t1,
  },
])

assert.equal(audit.valid, true)

const missingHashAudit = verifyFiscalChainSequence([
  {
    id: 'ord_missing',
    fiscalClosedAt: null,
    total: 10,
    fiscalPrevHash: null,
    fiscalIntegrityHash: null,
    paidAt: t0,
  },
])
assert.equal(missingHashAudit.valid, false)
assert.equal(missingHashAudit.reason, 'MISSING_INTEGRITY_HASH')

const tampered = computeFiscalIntegrityHash({
  orderId: 'ord_1',
  closedAt: t0,
  customerTotal: 99,
  prevHash: 'GENESIS',
})
assert.notEqual(tampered, link1.integrityHash)

console.log('fiscalIntegrityChain.test.ts OK')
