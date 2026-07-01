import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertTableCanBeSetFree, TABLE_HAS_ACTIVE_ORDER } from './tableReleaseGuard'

describe('tableReleaseGuard', () => {
  it('throws TABLE_HAS_ACTIVE_ORDER when orders are open', () => {
    assert.throws(
      () => assertTableCanBeSetFree(2),
      (err: unknown) => (err as { code?: string }).code === TABLE_HAS_ACTIVE_ORDER,
    )
  })
})
