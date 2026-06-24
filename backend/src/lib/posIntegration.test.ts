import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { serializePosStatusForCheckout } from './posIntegration'
import type { RestaurantPosConfig } from './posIntegration'

describe('posIntegration', () => {
  it('PENDING_SETUP is simulated and not configured', () => {
    const config: RestaurantPosConfig = {
      mode: 'PENDING_SETUP',
      providerLabel: null,
      terminalId: null,
      merchantId: null,
      setupNotes: null,
      configuredAt: null,
      isCardChargeSimulated: true,
      usesExternalFiscalDevice: false,
      legalReceiptSource: 'pending',
    }
    const status = serializePosStatusForCheckout(config)
    assert.equal(status.configured, false)
    assert.equal(status.isCardChargeSimulated, true)
    assert.equal(status.legalReceiptSource, 'pending')
  })

  it('EXTERNAL uses restaurant fiscal device', () => {
    const config: RestaurantPosConfig = {
      mode: 'EXTERNAL',
      providerLabel: 'Nexi',
      terminalId: 'TPV-1',
      merchantId: null,
      setupNotes: null,
      configuredAt: new Date(),
      isCardChargeSimulated: true,
      usesExternalFiscalDevice: true,
      legalReceiptSource: 'external_device',
    }
    const status = serializePosStatusForCheckout(config)
    assert.equal(status.configured, true)
    assert.equal(status.usesExternalFiscalDevice, true)
    assert.equal(status.providerLabel, 'Nexi')
  })

  it('STRIPE_TERMINAL expects real card charge', () => {
    const config: RestaurantPosConfig = {
      mode: 'STRIPE_TERMINAL',
      providerLabel: 'Stripe Terminal',
      terminalId: 'tmr_xxx',
      merchantId: null,
      setupNotes: null,
      configuredAt: new Date(),
      isCardChargeSimulated: false,
      usesExternalFiscalDevice: false,
      legalReceiptSource: 'stripe_terminal',
    }
    const status = serializePosStatusForCheckout(config)
    assert.equal(status.isCardChargeSimulated, false)
  })
})
