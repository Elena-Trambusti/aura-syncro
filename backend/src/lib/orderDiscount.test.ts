import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickBestDiscount } from './orderDiscount'

describe('orderDiscount', () => {
  it('picks higher discount between loyalty and campaign', () => {
    const loyalty = { source: 'LOYALTY' as const, discountPct: 5, discountAmount: 0 }
    const campaign = { source: 'CAMPAIGN' as const, discountPct: 10, discountAmount: 0, campaignId: 'c1' }
    const best = pickBestDiscount(loyalty, campaign)
    assert.equal(best.discountPct, 10)
    assert.equal(best.source, 'CAMPAIGN')
  })

  it('returns none when both zero', () => {
    const none = pickBestDiscount(
      { source: 'NONE', discountPct: 0, discountAmount: 0 },
      { source: 'NONE', discountPct: 0, discountAmount: 0 },
    )
    assert.equal(none.discountPct, 0)
    assert.equal(none.source, 'NONE')
  })
})
