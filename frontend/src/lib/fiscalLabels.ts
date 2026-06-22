import type { TFunction } from 'i18next'
import type { FiscalReportData } from './fiscalPdf'
import { getFiscalIntlLocale } from '../i18n'
import { fiscalRegimePrefix, type TaxRegion } from './fiscalRegime'

export interface FiscalPdfLabels {
  title: (restaurant: string) => string
  taxId: string
  taxIdPending: string
  address: string
  period: string
  generated: string
  taxRateLine?: string
  headers: string[]
  summaryNet: string
  summaryTips: string
  summaryElectronicTips?: string
  summaryReconciliation: string
  footer: (count: number) => string
  legalDisclaimer: string
  complianceNotice?: string
  tipsSectionTitle?: string
  noDataExport: string
  filenamePrefix: string
  locale: string
  includePaymentMethod: boolean
  includeIntegrityHash: boolean
  paymentMethodHeader?: string
  integrityHashHeader?: string
}

export function buildFiscalPdfLabels(
  t: TFunction,
  taxRegion: TaxRegion,
  defaultLocale?: string | null,
  taxRate?: number,
): FiscalPdfLabels {
  const prefix = fiscalRegimePrefix(taxRegion)
  const includePaymentMethod = taxRegion === 'IT_MAIN'
  const includeIntegrityHash = taxRegion !== 'IT_MAIN'
  return {
    title: (restaurant: string) => t(`${prefix}.pdf.title`, { restaurant }),
    taxId: t(`${prefix}.pdf.taxId`),
    taxIdPending: t(`${prefix}.pdf.taxIdPending`),
    address: t(`${prefix}.pdf.address`),
    period: t(`${prefix}.pdf.period`),
    generated: t(`${prefix}.pdf.generated`),
    taxRateLine: taxRate != null
      ? t(`${prefix}.taxLine`, { taxName: t(`${prefix}.table.tax`), rate: taxRate })
      : undefined,
    headers: [
      t(`${prefix}.table.date`),
      t(`${prefix}.table.orderId`),
      t(`${prefix}.table.taxableBase`),
      t(`${prefix}.table.tax`),
      t(`${prefix}.table.restaurantTotal`),
      t(`${prefix}.table.tip`),
      t(`${prefix}.table.collectedTotal`),
      ...(includePaymentMethod ? [t(`${prefix}.table.paymentMethod`)] : []),
      ...(includeIntegrityHash ? [t(`${prefix}.pdf.integrityHash`, { defaultValue: 'Hash VeriFactu' })] : []),
    ],
    summaryNet: t(`${prefix}.pdf.summaryNet`),
    summaryTips: t(`${prefix}.pdf.summaryTips`),
    summaryElectronicTips: t(`${prefix}.pdf.summaryElectronicTips`, { defaultValue: '' }) || undefined,
    summaryReconciliation: t(`${prefix}.pdf.summaryReconciliation`),
    footer: (count: number) => t(`${prefix}.pdf.footer`, { count }),
    legalDisclaimer: t(`${prefix}.pdf.legalDisclaimer`, {
      defaultValue: t('reportFiscal.legalDisclaimer'),
    }),
    complianceNotice: t(`${prefix}.pdf.complianceNotice`, { defaultValue: '' }) || undefined,
    tipsSectionTitle: taxRegion === 'IT_MAIN'
      ? (t(`${prefix}.pdf.tipsSectionTitle`, { defaultValue: '' }) || undefined)
      : undefined,
    noDataExport: t('reportFiscal.noData'),
    filenamePrefix: t(`${prefix}.pdf.filenamePrefix`),
    locale: getFiscalIntlLocale(defaultLocale),
    includePaymentMethod,
    includeIntegrityHash,
    paymentMethodHeader: includePaymentMethod ? t(`${prefix}.table.paymentMethod`) : undefined,
    integrityHashHeader: includeIntegrityHash
      ? t(`${prefix}.pdf.integrityHash`, { defaultValue: 'Hash VeriFactu' })
      : undefined,
  }
}

export type { FiscalReportData }
