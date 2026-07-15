import { describe, expect, it } from 'vitest'
import { assertExternalPosNativeConfirmed } from '../../backend/src/lib/posFinalizeGuard'

describe('pos-checkout parity with finalize EXTERNAL guard', () => {
  it('blocks EXTERNAL card without native confirmation (same as finalize)', () => {
    const result = assertExternalPosNativeConfirmed('EXTERNAL', 'CARD', false)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('EXTERNAL_POS_TABLET_REQUIRED')
  })

  it('allows CASH on EXTERNAL without native confirmation', () => {
    expect(assertExternalPosNativeConfirmed('EXTERNAL', 'CASH', false)).toEqual({ ok: true })
  })
})
