import type { TFunction } from 'i18next'

export type CountryCode = 'IT' | 'ES'
export type TaxRegion = 'IT_MAIN' | 'ES_CANARIAS' | 'ES_PENINSULA'

export interface FiscalRegime {
  countryCode: CountryCode
  taxRegion: TaxRegion
  taxRate: number
  taxName: string
  defaultLocale: string
  timezone?: string
  taxId?: string | null
}

export const DEFAULT_FISCAL_REGIME: FiscalRegime = {
  countryCode: 'IT',
  taxRegion: 'IT_MAIN',
  taxRate: 10,
  taxName: 'IVA',
  defaultLocale: 'it',
}

export const TAX_NAME_BY_REGION: Record<TaxRegion, string> = {
  IT_MAIN: 'IVA',
  ES_CANARIAS: 'IGIC',
  ES_PENINSULA: 'IVA',
}

export function fiscalRegimePrefix(taxRegion: TaxRegion): string {
  return `reportFiscal.byRegime.${taxRegion}`
}

export function tRegime(
  t: TFunction,
  taxRegion: TaxRegion,
  key: string,
  options?: Record<string, unknown>,
): string {
  return t(`${fiscalRegimePrefix(taxRegion)}.${key}`, options)
}

export const REGION_DEFAULT_TAX_RATE: Record<TaxRegion, number> = {
  IT_MAIN: 10,
  ES_CANARIAS: 7,
  ES_PENINSULA: 10,
}

export function defaultTaxRateForRegion(taxRegion: TaxRegion): number {
  return REGION_DEFAULT_TAX_RATE[taxRegion]
}

export const ALLOWED_TAX_RATES: Record<TaxRegion, readonly number[]> = {
  IT_MAIN: [4, 10, 22],
  ES_CANARIAS: [7, 13.5, 20],
  ES_PENINSULA: [10, 21],
}

/** Valida che l'aliquota sia ammessa per la regione fiscale. */
export function isTaxRateAllowed(taxRegion: TaxRegion, rate: number): boolean {
  return ALLOWED_TAX_RATES[taxRegion].includes(rate)
}

export function normalizeTaxRateForRegion(taxRegion: TaxRegion, rate: number): number {
  if (isTaxRateAllowed(taxRegion, rate)) return rate
  return defaultTaxRateForRegion(taxRegion)
}

/** Paese DB associato a una regione fiscale (registrazione / impostazioni). */
export function countryCodeFromTaxRegion(taxRegion: TaxRegion): CountryCode {
  return taxRegion.startsWith('ES_') ? 'ES' : 'IT'
}

export function resolveFiscalRegime(
  source?: Partial<FiscalRegime> | null,
): FiscalRegime {
  if (!source?.taxRegion) {
    if (source?.countryCode === 'ES') {
      return {
        countryCode: 'ES',
        taxRegion: 'ES_PENINSULA',
        taxRate: defaultTaxRateForRegion('ES_PENINSULA'),
        taxName: TAX_NAME_BY_REGION.ES_PENINSULA,
        defaultLocale: source.defaultLocale ?? 'es',
        timezone: source.timezone,
        taxId: source.taxId ?? null,
      }
    }
    return DEFAULT_FISCAL_REGIME
  }

  const taxRegion = source.taxRegion
  const defaultLocale =
    source.defaultLocale
    ?? (taxRegion.startsWith('ES_') ? 'es' : taxRegion === 'IT_MAIN' ? 'it' : DEFAULT_FISCAL_REGIME.defaultLocale)

  return {
    countryCode: source.countryCode ?? countryCodeFromTaxRegion(taxRegion),
    taxRegion,
    taxRate: source.taxRate ?? defaultTaxRateForRegion(taxRegion),
    taxName: source.taxName ?? TAX_NAME_BY_REGION[taxRegion],
    defaultLocale,
    timezone: source.timezone,
    taxId: source.taxId ?? null,
  }
}

export function computeCartTax(grossAmount: number, taxRate: number) {
  const rate = taxRate / 100
  const taxableBase = Math.round((grossAmount / (1 + rate)) * 100) / 100
  const tax = Math.round((grossAmount - taxableBase) * 100) / 100
  return { tax, total: Math.round(grossAmount * 100) / 100 }
}
