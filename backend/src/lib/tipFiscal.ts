import { CountryCode, TaxRegion } from '@prisma/client'
import { resolveRevenueAmount, resolveTipAmount, resolveOrderTotal } from './fiscalAmounts'
import { roundMoney } from './taxEngine'

/**
 * Mance / propinas — regole fiscali per nazione.
 *
 * Principio architetturale: l'imposta (IVA/IGIC) si calcola SOLO su subtotal
 * in taxEngine.computeOrderTax. Le mance entrano esclusivamente al momento del
 * pagamento via computePaymentSplit e non aumentano mai base imponibile o tax.
 */

export type OrderAmounts = {
  revenueAmount: number | null
  total: number
  subtotal: number
  tax: number
  tipAmount?: number | null
}

export type PaymentSplit = {
  revenueAmount: number
  tipAmount: number
  total: number
  paidAt: Date
}

/** Split al pagamento: ricavo ristorante (cibo+imposta) + mancia esente. */
export function computePaymentSplit(
  order: OrderAmounts,
  tipAmountInput?: number,
): PaymentSplit {
  const revenueAmount = roundMoney(resolveRevenueAmount(order))
  const tipAmount = roundMoney(Math.max(0, Number(tipAmountInput) || 0))
  const total = roundMoney(revenueAmount + tipAmount)
  return { revenueAmount, tipAmount, total, paidAt: new Date() }
}

export type FiscalTransactionRow = {
  fecha: Date
  orderId: string
  baseImponible: number
  tax: number
  revenueAmount: number
  tipAmount: number
  total: number
  paymentMethod?: string | null
}

export function buildFiscalTransactionRow(order: {
  id: string
  paidAt: Date | null
  createdAt: Date
  subtotal: number
  tax: number
  revenueAmount: number | null
  tipAmount?: number | null
  total: number
  paymentMethod?: string | null
}, paidAt: Date): FiscalTransactionRow {
  const revenueAmount = roundMoney(resolveRevenueAmount(order))
  const tipAmount = roundMoney(resolveTipAmount(order.tipAmount))
  return {
    fecha: paidAt,
    orderId: order.id,
    baseImponible: roundMoney(order.subtotal),
    tax: roundMoney(order.tax),
    revenueAmount,
    tipAmount,
    total: roundMoney(resolveOrderTotal(order)),
    paymentMethod: order.paymentMethod ?? null,
  }
}

const TRACKED_TIP_METHODS = new Set(['CASH', 'CARD', 'DIGITAL', 'STRIPE'])

/** IT: mance tracciate via POS/app (per imposta sostitutiva 5% dipendenti). */
export function sumElectronicTips(
  rows: Array<{ tipAmount: number; paymentMethod?: string | null }>,
): number {
  return roundMoney(
    rows.reduce((sum, r) => {
      if (r.tipAmount <= 0) return sum
      if (r.paymentMethod && !TRACKED_TIP_METHODS.has(r.paymentMethod)) return sum
      return sum + r.tipAmount
    }, 0),
  )
}

export type FiscalSummary = {
  totalFacturadoNeto: number
  totalPropinas: number
  totalConciliacion: number
  transactionCount: number
  /** Solo IT — registro mance elettroniche tracciate (POS/app). */
  electronicTipsTotal?: number
  tipTaxStatus: 'EXEMPT_IGIC' | 'EXEMPT_IVA' | 'EXEMPT_IT'
}

export function buildFiscalSummary(
  rows: FiscalTransactionRow[],
  taxRegion: TaxRegion,
): FiscalSummary {
  const totalFacturadoNeto = roundMoney(rows.reduce((s, r) => s + r.revenueAmount, 0))
  const totalPropinas = roundMoney(rows.reduce((s, r) => s + r.tipAmount, 0))
  const totalConciliacion = roundMoney(rows.reduce((s, r) => s + r.total, 0))

  const tipTaxStatus =
    taxRegion === 'ES_CANARIAS'
      ? 'EXEMPT_IGIC'
      : taxRegion === 'ES_PENINSULA'
        ? 'EXEMPT_IVA'
        : 'EXEMPT_IT'

  const summary: FiscalSummary = {
    totalFacturadoNeto,
    totalPropinas,
    totalConciliacion,
    transactionCount: rows.length,
    tipTaxStatus,
  }

  if (taxRegion === 'IT_MAIN') {
    summary.electronicTipsTotal = sumElectronicTips(rows)
  }

  return summary
}

/** Verifica invariante: tax calcolata solo su subtotal, mai su mancia. */
export function assertTipNeverTaxed(subtotal: number, tax: number, tipAmount: number): boolean {
  const foodTotal = roundMoney(subtotal + tax)
  return tipAmount >= 0 && foodTotal >= subtotal
}

export function countryFromRegion(taxRegion: TaxRegion): CountryCode {
  return taxRegion.startsWith('ES') ? 'ES' : 'IT'
}
