import type { TFunction } from 'i18next'
import type { FiscalReportData } from './fiscalPdf'
import { getIntlLocale } from '../i18n'
import { fiscalRegimePrefix, type TaxRegion } from './fiscalRegime'

export interface FiscalPdfLabels {
  title: (restaurant: string) => string
  taxId: string
  taxIdPending: string
  address: string
  period: string
  generated: string
  headers: string[]
  summaryNet: string
  summaryTips: string
  summaryElectronicTips?: string
  summaryReconciliation: string
  footer: (count: number) => string
  filenamePrefix: string
  locale: string
}

export function buildFiscalPdfLabels(t: TFunction, taxRegion: TaxRegion): FiscalPdfLabels {
  const prefix = fiscalRegimePrefix(taxRegion)
  return {
    title: (restaurant: string) => t(`${prefix}.pdf.title`, { restaurant }),
    taxId: t(`${prefix}.pdf.taxId`),
    taxIdPending: t(`${prefix}.pdf.taxIdPending`),
    address: t(`${prefix}.pdf.address`),
    period: t(`${prefix}.pdf.period`),
    generated: t(`${prefix}.pdf.generated`),
    headers: [
      t(`${prefix}.table.date`),
      t(`${prefix}.table.orderId`),
      t(`${prefix}.table.taxableBase`),
      t(`${prefix}.table.tax`),
      t(`${prefix}.table.restaurantTotal`),
      t(`${prefix}.table.tip`),
      t(`${prefix}.table.collectedTotal`),
    ],
    summaryNet: t(`${prefix}.pdf.summaryNet`),
    summaryTips: t(`${prefix}.pdf.summaryTips`),
    summaryElectronicTips: t(`${prefix}.pdf.summaryElectronicTips`, { defaultValue: '' }) || undefined,
    summaryReconciliation: t(`${prefix}.pdf.summaryReconciliation`),
    footer: (count: number) => t(`${prefix}.pdf.footer`, { count }),
    filenamePrefix: t(`${prefix}.pdf.filenamePrefix`),
    locale: getIntlLocale(),
  }
}

export type { FiscalReportData }
