import { CountryCode, TaxRegion } from '@prisma/client'
import type { FiscalConfig, TipTaxTreatment } from './taxEngine'
import { computeOrderTaxForRegime, getTipTaxTreatment, roundMoney, scorporoTaxFromGross } from './taxEngine'
import { resolveRevenueAmount, resolveTipAmount, resolveOrderTotal } from './fiscalAmounts'
import type { FiscalTransactionRow } from './fiscal/fiscalReportTypes'

export type { FiscalSummary, FiscalTransactionRow } from './fiscal/fiscalReportTypes'
export { buildFiscalSummary } from './fiscal/strategies'

/** * Mance / propinas — regole fiscali per nazione.
 *
 * Principio architetturale: l'imposta (IVA/IGIC) si scorpora dal prezzo lordo menu
 * in taxEngine.computeOrderTax (IVA inclusa). Le mance entrano esclusivamente al momento del
 * pagamento via computePaymentSplit e non aumentano mai base imponibile o tax.
 */

import type { MoneyInput } from './money'
import { moneyNumber } from './money'

export type OrderAmounts = {
  revenueAmount: MoneyInput | null
  total: MoneyInput
  subtotal: MoneyInput
  tax: MoneyInput
  tipAmount?: MoneyInput | null
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

export function buildFiscalTransactionRow(order: {
  id: string
  paidAt: Date | null
  createdAt: Date
  subtotal: MoneyInput
  tax: MoneyInput
  taxRateApplied?: number | null
  revenueAmount: MoneyInput | null
  tipAmount?: MoneyInput | null
  total: MoneyInput
  discount?: MoneyInput | number | null
  paymentMethod?: string | null
  fiscalIntegrityHash?: string | null
  fiscalPrevHash?: string | null
}, paidAt: Date, fallbackTaxRate?: number | null): FiscalTransactionRow {
  const revenueAmount = roundMoney(resolveRevenueAmount(order))
  const tipAmount = roundMoney(resolveTipAmount(order.tipAmount))
  const taxRate = order.taxRateApplied != null && order.taxRateApplied > 0
    ? order.taxRateApplied
    : (fallbackTaxRate != null && fallbackTaxRate > 0 ? fallbackTaxRate : null)
  const foodGross = roundMoney(moneyNumber(order.subtotal) + moneyNumber(order.tax))
  const discount = moneyNumber(order.discount)
  const useRevenueSplit = discount > 0 || Math.abs(foodGross - revenueAmount) > 0.02
  if (useRevenueSplit && taxRate == null) {
    throw new Error('MISSING_TAX_RATE_FOR_FISCAL_ROW')
  }
  const baseImponible = useRevenueSplit
    ? scorporoTaxFromGross(revenueAmount, taxRate!).subtotal
    : roundMoney(moneyNumber(order.subtotal))
  const tax = useRevenueSplit
    ? scorporoTaxFromGross(revenueAmount, taxRate!).tax
    : roundMoney(moneyNumber(order.tax))
  return {
    fecha: paidAt,
    orderId: order.id,
    baseImponible,
    tax,
    taxRateApplied: taxRate,
    revenueAmount,
    tipAmount,
    total: roundMoney(resolveOrderTotal(order)),
    paymentMethod: order.paymentMethod ?? null,
    fiscalIntegrityHash: order.fiscalIntegrityHash ?? null,
    fiscalPrevHash: order.fiscalPrevHash ?? null,
  }
}

/** Verifica invariante: tax calcolata solo su subtotal piatti, mai su mancia. */export function assertTipNeverTaxed(subtotal: number, tax: number, tipAmount: number): boolean {
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
