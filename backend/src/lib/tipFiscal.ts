import { CountryCode, TaxRegion } from '@prisma/client'
import type { FiscalConfig, TipTaxTreatment } from './taxEngine'
import { computeOrderTaxForRegime, getTipTaxTreatment, roundMoney } from './taxEngine'
import { resolveRevenueAmount, resolveTipAmount, resolveOrderTotal } from './fiscalAmounts'

/**
 * Mance / propinas — regole fiscali per nazione.
 *
 * Principio architetturale: l'imposta (IVA/IGIC) si scorpora dal prezzo lordo menu
 * in taxEngine.computeOrderTax (IVA inclusa). Le mance entrano esclusivamente al momento del
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
  tipTaxTreatment?: TipTaxTreatment
}

/** Split al pagamento: ricavo ristorante (cibo+imposta) + mancia esente per regime. */
export function computePaymentSplit(
  order: OrderAmounts,
  tipAmountInput?: number,
  config?: FiscalConfig,
): PaymentSplit {
  const revenueAmount = roundMoney(resolveRevenueAmount(order))
  const tipAmount = roundMoney(Math.max(0, Number(tipAmountInput) || 0))
  const total = roundMoney(revenueAmount + tipAmount)
  const tipTaxTreatment = config ? getTipTaxTreatment(config.taxRegion) : undefined

  return {
    revenueAmount,
    tipAmount,
    total,
    paidAt: new Date(),
    tipTaxTreatment,
  }
}

/** Importi per POS: la mancia non entra nella base imponibile (evita tassazione su tutto). */
export type PosPaymentAmounts = {
  taxableChargeAmount: number
  tipChargeAmount: number
  totalCustomerAmount: number
  tipTaxTreatment: TipTaxTreatment
  baseImponible: number
  tax: number
  taxName: string
}

export function computePosPaymentAmounts(
  config: FiscalConfig,
  order: OrderAmounts,
  tipAmountInput?: number,
): PosPaymentAmounts {
  const split = computePaymentSplit(order, tipAmountInput, config)
  const foodTax = computeOrderTaxForRegime(config, split.revenueAmount, 0)

  return {
    taxableChargeAmount: split.revenueAmount,
    tipChargeAmount: split.tipAmount,
    totalCustomerAmount: split.total,
    tipTaxTreatment: getTipTaxTreatment(config.taxRegion),
    baseImponible: foodTax.subtotal,
    tax: foodTax.tax,
    taxName: config.taxName,
  }
}

export type FiscalTransactionRow = {
  fecha: Date
  orderId: string
  baseImponible: number
  tax: number
  taxRateApplied: number | null
  revenueAmount: number
  tipAmount: number
  total: number
  paymentMethod?: string | null
  fiscalIntegrityHash?: string | null
  fiscalPrevHash?: string | null
}

export function buildFiscalTransactionRow(order: {
  id: string
  paidAt: Date | null
  createdAt: Date
  subtotal: number
  tax: number
  taxRateApplied?: number | null
  revenueAmount: number | null
  tipAmount?: number | null
  total: number
  paymentMethod?: string | null
  fiscalIntegrityHash?: string | null
  fiscalPrevHash?: string | null
}, paidAt: Date): FiscalTransactionRow {
  const revenueAmount = roundMoney(resolveRevenueAmount(order))
  const tipAmount = roundMoney(resolveTipAmount(order.tipAmount))
  return {
    fecha: paidAt,
    orderId: order.id,
    baseImponible: roundMoney(order.subtotal),
    tax: roundMoney(order.tax),
    taxRateApplied: order.taxRateApplied ?? null,
    revenueAmount,
    tipAmount,
    total: roundMoney(resolveOrderTotal(order)),
    paymentMethod: order.paymentMethod ?? null,
    fiscalIntegrityHash: order.fiscalIntegrityHash ?? null,
    fiscalPrevHash: order.fiscalPrevHash ?? null,
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

/** Verifica invariante: tax calcolata solo su subtotal piatti, mai su mancia. */
export function assertTipNeverTaxed(subtotal: number, tax: number, tipAmount: number): boolean {
  const foodTotal = roundMoney(subtotal + tax)
  return tipAmount >= 0 && foodTotal >= subtotal
}

/** La mancia non deve aumentare base imponibile né imposta rispetto al solo cibo. */
export function assertTipExcludedFromFiscalBase(
  config: FiscalConfig,
  grossFoodAmount: number,
  tipAmount: number,
): boolean {
  const withoutTip = computeOrderTaxForRegime(config, grossFoodAmount, 0)
  const withTip = computeOrderTaxForRegime(config, grossFoodAmount, tipAmount)
  return (
    withoutTip.subtotal === withTip.subtotal
    && withoutTip.tax === withTip.tax
    && withoutTip.total === withTip.taxableGross
    && withTip.customerTotal === roundMoney(withoutTip.total + tipAmount)
  )
}

export function countryFromRegion(taxRegion: TaxRegion): CountryCode {
  return taxRegion.startsWith('ES') ? 'ES' : 'IT'
}
