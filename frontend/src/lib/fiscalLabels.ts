import type { TFunction } from 'i18next'
import type { FiscalReportData } from './fiscalPdf'
import { getIntlLocale } from '../i18n'

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
  summaryReconciliation: string
  footer: (count: number) => string
  filenamePrefix: string
  locale: string
}

export function buildFiscalPdfLabels(t: TFunction): FiscalPdfLabels {
  return {
    title: (restaurant: string) => t('reportFiscal.pdf.title', { restaurant }),
    taxId: t('reportFiscal.pdf.taxId'),
    taxIdPending: t('reportFiscal.pdf.taxIdPending'),
    address: t('reportFiscal.pdf.address'),
    period: t('reportFiscal.pdf.period'),
    generated: t('reportFiscal.pdf.generated'),
    headers: [
      t('reportFiscal.table.date'),
      t('reportFiscal.table.orderId'),
      t('reportFiscal.table.taxableBase'),
      t('reportFiscal.table.tax'),
      t('reportFiscal.table.restaurantTotal'),
      t('reportFiscal.table.tip'),
      t('reportFiscal.table.collectedTotal'),
    ],
    summaryNet: t('reportFiscal.pdf.summaryNet'),
    summaryTips: t('reportFiscal.pdf.summaryTips'),
    summaryReconciliation: t('reportFiscal.pdf.summaryReconciliation'),
    footer: (count: number) => t('reportFiscal.pdf.footer', { count }),
    filenamePrefix: t('reportFiscal.pdf.filenamePrefix'),
    locale: getIntlLocale(),
  }
}

export type { FiscalReportData }
