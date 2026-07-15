import { describe, expect, it } from 'vitest'
import { assertExternalPosNativeConfirmed } from '../../backend/src/lib/posFinalizeGuard'

describe('assertExternalPosNativeConfirmed', () => {
  it('allows cash regardless of mode', () => {
    expect(assertExternalPosNativeConfirmed('EXTERNAL', 'CASH', false)).toEqual({ ok: true })
  })

  it('blocks EXTERNAL card without native confirmation', () => {
    const result = assertExternalPosNativeConfirmed('EXTERNAL', 'CARD', false)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('EXTERNAL_POS_TABLET_REQUIRED')
    }
  })

  it('allows EXTERNAL card with native confirmation and terminal ref', () => {
    expect(assertExternalPosNativeConfirmed('EXTERNAL', 'CARD', true, 'TX-1234')).toEqual({ ok: true })
  })

  it('blocks EXTERNAL card with confirmation but missing terminal ref', () => {
    const result = assertExternalPosNativeConfirmed('EXTERNAL', 'CARD', true, 'ab')
    expect(result.ok).toBe(false)
  })

  it('allows SIMULATION card without native confirmation', () => {
    expect(assertExternalPosNativeConfirmed('SIMULATION', 'CARD', false)).toEqual({ ok: true })
  })
})
