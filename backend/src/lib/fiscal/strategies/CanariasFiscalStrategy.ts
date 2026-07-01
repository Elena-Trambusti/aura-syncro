import type { FiscalConfig } from '../../taxEngine'
import type { FiscalSummary, FiscalTransactionRow } from '../fiscalReportTypes'
import { BaseFiscalStrategy } from './baseFiscalStrategy'
import type {
  CheckoutTipPolicy,
  FiscalComplianceProfile,
  FiscalPdfExportOptions,
  FiscalReportLabels,
} from './types'

export class CanariasFiscalStrategy extends BaseFiscalStrategy {
  readonly fiscalRegion = 'ISOLE_CANARIE' as const
  readonly taxRegion = 'ES_CANARIAS' as const

  getTipTreatment() {
    return 'EXEMPT_IGIC' as const
  }

  protected shouldTrackElectronicTips() {
    return false
  }

  getComplianceProfile(config: FiscalConfig): FiscalComplianceProfile {
    return {
      operativeRegime: 'ES_CANARIAS',
      fiscalRegion: 'ISOLE_CANARIE',
      taxRegion: 'ES_CANARIAS',
      taxName: 'IGIC',
      defaultTaxRate: config.taxRate,
      documentType: 'FACTURA_SIMPLIFICADA',
      invoiceSeriesPrefix: 'T-',
      verifactuEnabled: true,
      integrityChainRequired: true,
      tipPolicyMessageKey: 'fiscal.tipPolicy.esCanarias',
    }
  }

  getReportLabels(taxRate: number): FiscalReportLabels {
    return {
      netRevenueSub: `Sujeto a impuesto IGIC (${taxRate}%)`,
      tipsLabel: 'Total Propinas Personal',
      tipsSub: 'Exentas de IGIC · Reparto IRPF ordinario entre empleados',
      tipsSectionTitle: 'Reparto de propinas (exentas de IGIC — IRPF ordinario)',
      taxColumnName: 'IGIC',
      complianceNotice:
        'Cada transacción incluye hash SHA-256 encadenado (inalterabilidad VeriFactu / Ley Antifraude 11/2021).',
      legalDisclaimer:
        'Libro registro interno conforme a la predisposición VeriFactu. No sustituye la facturación oficial AEAT.',
    }
  }

  getCheckoutTipPolicy(): CheckoutTipPolicy {
    return {
      treatment: 'EXEMPT_IGIC',
      messageKey: 'fiscal.tipPolicy.esCanarias',
      message: 'La propina no está sujeta a IGIC y se registra para la repartición entre empleados (IRPF ordinario).',
    }
  }

  resolveInvoicePrefix(settingsPrefix?: string | null): string {
    const p = settingsPrefix?.trim().toUpperCase()
    if (p && p.startsWith('T')) return p
    return p || 'T-'
  }

  getPdfExportOptions(): FiscalPdfExportOptions {
    return {
      includePaymentMethod: false,
      includeIntegrityHash: true,
      tipsSection: true,
    }
  }

  buildReportSummary(rows: FiscalTransactionRow[]): FiscalSummary {
    const base = this.sumRows(rows)
    const totalPropinas = base.totalPropinas

    return {
      ...base,
      tipTaxStatus: 'EXEMPT_IGIC',
      tipsDistribution: {
        totalTracked: totalPropinas,
        exemptFromTax: 'IGIC',
        legalBasis: 'Propinas exentas de IGIC — sujetas a reparto y retención IRPF ordinario del personal',
        trackedMethods: [],
      },
    }
  }
}
