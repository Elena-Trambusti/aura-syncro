import { CountryCode, FiscalRegion, TaxRegion } from '@prisma/client'

/** Punto di ingresso unificato: country + fiscal_region del tenant */
export type TenantFiscalIdentity = {
  country: CountryCode
  fiscalRegion: FiscalRegion
  taxRegion: TaxRegion
}

export const FISCAL_REGION_GENESIS = 'GENESIS'

const TAX_TO_FISCAL: Record<TaxRegion, FiscalRegion> = {
  IT_MAIN: 'ITALIA',
  ES_PENINSULA: 'SPAGNA_PENINSULA',
  ES_CANARIAS: 'ISOLE_CANARIE',
}

const FISCAL_TO_TAX: Record<FiscalRegion, TaxRegion> = {
  ITALIA: 'IT_MAIN',
  SPAGNA_PENINSULA: 'ES_PENINSULA',
  ISOLE_CANARIE: 'ES_CANARIAS',
}

const FISCAL_TO_COUNTRY: Record<FiscalRegion, CountryCode> = {
  ITALIA: 'IT',
  SPAGNA_PENINSULA: 'ES',
  ISOLE_CANARIE: 'ES',
}

export function taxRegionToFiscalRegion(taxRegion: TaxRegion): FiscalRegion {
  return TAX_TO_FISCAL[taxRegion]
}

export function fiscalRegionToTaxRegion(fiscalRegion: FiscalRegion): TaxRegion {
  return FISCAL_TO_TAX[fiscalRegion]
}

export function fiscalRegionToCountry(fiscalRegion: FiscalRegion): CountryCode {
  return FISCAL_TO_COUNTRY[fiscalRegion]
}

export function resolveFiscalRegion(
  country: CountryCode,
  taxRegion?: TaxRegion | null,
  fiscalRegion?: FiscalRegion | null,
): FiscalRegion {
  if (fiscalRegion) return fiscalRegion
  if (taxRegion) return taxRegionToFiscalRegion(taxRegion)
  return country === 'ES' ? 'SPAGNA_PENINSULA' : 'ITALIA'
}

export function resolveTenantFiscalIdentity(input: {
  countryCode?: CountryCode | null
  taxRegion?: TaxRegion | null
  fiscalRegion?: FiscalRegion | null
}): TenantFiscalIdentity {
  const country = input.countryCode ?? 'IT'
  const fiscalRegion = resolveFiscalRegion(country, input.taxRegion, input.fiscalRegion)
  return {
    country: fiscalRegionToCountry(fiscalRegion),
    fiscalRegion,
    taxRegion: fiscalRegionToTaxRegion(fiscalRegion),
  }
}

/** Aliquote IVA/IGIC ammesse per regime ristorazione */
export const ALLOWED_TAX_RATES: Record<FiscalRegion, readonly number[]> = {
  ITALIA: [4, 10, 22],
  SPAGNA_PENINSULA: [10, 21],
  ISOLE_CANARIE: [7, 13.5, 20],
}

export const DEFAULT_TAX_RATE: Record<FiscalRegion, number> = {
  ITALIA: 10,
  SPAGNA_PENINSULA: 10,
  ISOLE_CANARIE: 7,
}

export function validateTaxRateForRegion(fiscalRegion: FiscalRegion, rate: number): number {
  const allowed = ALLOWED_TAX_RATES[fiscalRegion]
  if (!allowed.includes(rate)) {
    throw new Error(`INVALID_TAX_RATE:${fiscalRegion}:${rate}`)
  }
  return rate
}

/** Risolve aliquota con fallback al default regime se legacy/non valida */
export function resolveTaxRateForRegion(fiscalRegion: FiscalRegion, rate?: number | null): number {
  const candidate = rate != null && rate > 0 ? rate : defaultTaxRateForFiscalRegion(fiscalRegion)
  const allowed = ALLOWED_TAX_RATES[fiscalRegion]
  return allowed.includes(candidate) ? candidate : defaultTaxRateForFiscalRegion(fiscalRegion)
}

export function defaultTaxRateForFiscalRegion(fiscalRegion: FiscalRegion): number {
  return DEFAULT_TAX_RATE[fiscalRegion]
}

export function isSpainFiscalRegion(fiscalRegion: FiscalRegion): boolean {
  return fiscalRegion === 'SPAGNA_PENINSULA' || fiscalRegion === 'ISOLE_CANARIE'
}

export function isItalyFiscalRegion(fiscalRegion: FiscalRegion): boolean {
  return fiscalRegion === 'ITALIA'
}
