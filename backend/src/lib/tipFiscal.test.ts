import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderTax } from './taxEngine'
import { resolveRevenueAmount } from './fiscalAmounts'
import {
  assertTipNeverTaxed,
  buildFiscalSummary,
  buildFiscalTransactionRow,
  computePaymentSplit,
  sumElectronicTips,
} from './tipFiscal'

describe('tipFiscal', () => {
  const foodOrder = { subtotal: 100, tax: 10, total: 110, revenueAmount: 110, tipAmount: 0 }

  it('computeOrderTax never includes tips in tax base', () => {
    const { subtotal, tax, total } = computeOrderTax(100, 10)
    assert.equal(total, 110)
    assert.equal(assertTipNeverTaxed(subtotal, tax, 15), true)
    assert.equal(tax, 10)
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
    assert.equal(summary.electronicTipsTotal, 17)
    assert.equal(summary.tipTaxStatus, 'EXEMPT_IT')
  })

  it('sumElectronicTips excludes untracked payment methods', () => {
    const total = sumElectronicTips([
      { tipAmount: 10, paymentMethod: 'CARD' },
      { tipAmount: 5, paymentMethod: 'VOUCHER' },
    ])
    assert.equal(total, 10)
  })

  it('resolveRevenueAmount subtracts tip from legacy total', () => {
    const legacy = { subtotal: 0, tax: 0, total: 125, revenueAmount: null, tipAmount: 25 }
    assert.equal(resolveRevenueAmount(legacy), 100)
  })
})
