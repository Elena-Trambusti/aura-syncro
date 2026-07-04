import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildFiscalConfig, computeOrderTax, computeOrderTaxForRegime } from './taxEngine'
import { resolveRevenueAmount } from './fiscalAmounts'
import {
  assertTipExcludedFromFiscalBase,
  assertTipNeverTaxed,
  buildFiscalSummary,
  buildFiscalTransactionRow,
  computePaymentSplit,
  computePosPaymentAmounts,
} from './tipFiscal'
import { sumElectronicTips } from './fiscal/tipTracking'

describe('tipFiscal', () => {
  const foodOrder = { subtotal: 100, tax: 10, total: 110, revenueAmount: 110, tipAmount: 0 }

  it('computeOrderTax never includes tips in tax base', () => {
    const { subtotal, tax, total } = computeOrderTax(110, 10)
    assert.equal(total, 110)
    assert.equal(subtotal, 100)
    assert.equal(assertTipNeverTaxed(subtotal, tax, 15), true)
    assert.equal(tax, 10)
  })

  it('Test A — Ordine Italia con mancia: imponibile fiscale esclude la mancia', () => {
    const config = buildFiscalConfig({ countryCode: 'IT', taxRegion: 'IT_MAIN', taxRate: 10 })
    const grossFood = 110
    const tip = 20

    const regime = computeOrderTaxForRegime(config, grossFood, tip)
    assert.equal(regime.subtotal, 100)
    assert.equal(regime.tax, 10)
    assert.equal(regime.taxableGross, 110)
    assert.equal(regime.tipAmount, 20)
    assert.equal(regime.customerTotal, 130)
    assert.equal(regime.tipTaxTreatment, 'EXEMPT_IT')
    assert.equal(regime.electronicTipTracked, true)
    assert.equal(assertTipExcludedFromFiscalBase(config, grossFood, tip), true)

    const split = computePaymentSplit(foodOrder, tip, config)
    assert.equal(split.revenueAmount, 110)
    assert.equal(split.tipAmount, 20)
    assert.equal(split.total, 130)

    const pos = computePosPaymentAmounts(config, foodOrder, tip)
    assert.equal(pos.taxableChargeAmount, 110)
    assert.equal(pos.tipChargeAmount, 20)
    assert.equal(pos.baseImponible, 100)
    assert.equal(pos.tax, 10)
    assert.equal(pos.tipTaxTreatment, 'EXEMPT_IT')

    const row = buildFiscalTransactionRow(
      {
        ...foodOrder,
        id: 'it-tip',
        tipAmount: tip,
        total: 130,
        revenueAmount: 110,
        paidAt: new Date(),
        createdAt: new Date(),
        paymentMethod: 'CARD',
      },
      new Date(),
    )
    assert.equal(row.baseImponible, 100)
    assert.equal(row.tax, 10)
    assert.equal(row.revenueAmount, 110)
    assert.equal(row.tipAmount, 20)
    assert.equal(row.total, 130)
  })

  it('Test B — Ordine Isole Canarie con mancia: IGIC solo sui piatti', () => {
    const config = buildFiscalConfig({ countryCode: 'ES', taxRegion: 'ES_CANARIAS', taxRate: 7 })
    const canariasOrder = { subtotal: 100, tax: 7, total: 107, revenueAmount: 107, tipAmount: 0 }
    const tip = 15

    const regime = computeOrderTaxForRegime(config, 107, tip)
    assert.equal(regime.subtotal, 100)
    assert.equal(regime.tax, 7)
    assert.equal(regime.tipTaxTreatment, 'EXEMPT_IGIC')
    assert.equal(regime.customerTotal, 122)
    assert.equal(assertTipExcludedFromFiscalBase(config, 107, tip), true)

    const pos = computePosPaymentAmounts(config, canariasOrder, tip)
    assert.equal(pos.taxableChargeAmount, 107)
    assert.equal(pos.tipChargeAmount, 15)
    assert.equal(pos.tax, 7)
    assert.equal(pos.tipTaxTreatment, 'EXEMPT_IGIC')
    assert.notEqual(pos.totalCustomerAmount, pos.taxableChargeAmount)

    const row = buildFiscalTransactionRow(
      {
        id: 'es-can-tip',
        subtotal: 100,
        tax: 7,
        revenueAmount: 107,
        tipAmount: tip,
        total: 122,
        paidAt: new Date(),
        createdAt: new Date(),
        paymentMethod: 'CARD',
      },
      new Date(),
    )
    assert.equal(row.baseImponible, 100)
    assert.equal(row.tax, 7)
    assert.equal(row.tipAmount, 15)
    assert.equal(row.tax + row.tipAmount, 22)
    assert.equal(row.revenueAmount + row.tipAmount, row.total)
  })

  it('computePaymentSplit isolates tip from restaurant revenue (ES/IT)', () => {
    const split = computePaymentSplit(foodOrder, 20)
    assert.equal(split.revenueAmount, 110)
    assert.equal(split.tipAmount, 20)
    assert.equal(split.total, 130)
  })

  it('computePaymentSplit handles legacy revenueAmount=0 via resolveRevenueAmount', () => {
    const legacy = { subtotal: 50, tax: 5, total: 55, revenueAmount: 0, tipAmount: 0 }
    const split = computePaymentSplit(legacy, 10)
    assert.equal(split.revenueAmount, 55)
    assert.equal(split.tipAmount, 10)
    assert.equal(split.total, 65)
  })

  it('buildFiscalTransactionRow keeps tip out of taxable base', () => {
    const row = buildFiscalTransactionRow(
      { ...foodOrder, id: 'ord1', paidAt: new Date(), createdAt: new Date(), paymentMethod: 'CARD' },
      new Date(),
    )
    assert.equal(row.baseImponible, 100)
    assert.equal(row.tax, 10)
    assert.equal(row.revenueAmount, 110)
    assert.equal(row.tipAmount, 0)
    assert.equal(row.total, 110)
  })

  it('buildFiscalSummary separates net invoiced from tips for Spain', () => {
    const rows = [
      buildFiscalTransactionRow(
        { id: 'a', subtotal: 100, tax: 7, revenueAmount: 107, tipAmount: 15, total: 122, paidAt: new Date(), createdAt: new Date(), paymentMethod: 'CARD' },
        new Date(),
      ),
    ]
    const summary = buildFiscalSummary(rows, 'ES_CANARIAS')
    assert.equal(summary.totalFacturadoNeto, 107)
    assert.equal(summary.totalPropinas, 15)
    assert.equal(summary.totalConciliacion, 122)
    assert.equal(summary.tipTaxStatus, 'EXEMPT_IGIC')
    assert.equal(summary.electronicTipsTotal, undefined)
  })

  it('buildFiscalSummary adds electronicTipsTotal for Italy', () => {
    const rows = [
      buildFiscalTransactionRow(
        { id: 'b', subtotal: 80, tax: 8, revenueAmount: 88, tipAmount: 12, total: 100, paidAt: new Date(), createdAt: new Date(), paymentMethod: 'CARD' },
        new Date(),
      ),
      buildFiscalTransactionRow(
        { id: 'c', subtotal: 40, tax: 4, revenueAmount: 44, tipAmount: 5, total: 49, paidAt: new Date(), createdAt: new Date(), paymentMethod: 'CASH' },
        new Date(),
      ),
    ]
    const summary = buildFiscalSummary(rows, 'IT_MAIN')
    assert.equal(summary.electronicTipsTotal, 12)
    assert.equal(summary.tipTaxStatus, 'EXEMPT_IT')
  })

  it('sumElectronicTips excludes untracked payment methods', () => {
    const total = sumElectronicTips([
      { tipAmount: 10, paymentMethod: 'CARD' },
      { tipAmount: 5, paymentMethod: 'VOUCHER' },
      { tipAmount: 8, paymentMethod: 'CASH' },
    ])
    assert.equal(total, 10)
  })

  it('resolveRevenueAmount subtracts tip from legacy total', () => {
    const legacy = { subtotal: 0, tax: 0, total: 125, revenueAmount: null, tipAmount: 25 }
    assert.equal(resolveRevenueAmount(legacy), 100)
  })
})
