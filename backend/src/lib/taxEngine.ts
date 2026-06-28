import { CountryCode, FiscalRegion, TaxRegion } from '@prisma/client'
import { prisma } from './prisma'
import {
  defaultTaxRateForFiscalRegion,
  fiscalRegionToCountry,
  fiscalRegionToTaxRegion,
  resolveFiscalRegion,
  resolveTenantFiscalIdentity,
  resolveTaxRateForRegion,
  validateTaxRateForRegion,
  type TenantFiscalIdentity,
} from './fiscal/fiscalRegion'
import {
  getFiscalStrategyByTaxRegion,
  getFiscalStrategyFromConfig,
} from './fiscal/strategies'

export type { FiscalRegion, TenantFiscalIdentity }
export {
  resolveFiscalRegion,
  resolveTenantFiscalIdentity,
  resolveTaxRateForRegion,
  validateTaxRateForRegion,
  fiscalRegionToTaxRegion,
}

export interface FiscalConfig {
  countryCode: CountryCode
  taxRegion: TaxRegion
  fiscalRegion: FiscalRegion
  taxRate: number
  taxName: string
  defaultLocale: string
  timezone: string
}

/** Trattamento fiscale mance per regime (sempre esenti da IVA/IGIC sul conto). */
export type TipTaxTreatment = 'EXEMPT_IT' | 'EXEMPT_IGIC' | 'EXEMPT_IVA'

export type FoodTaxResult = {
  subtotal: number
  tax: number
  /** Totale lordo piatti (imponibile + imposta), senza mancia */
  total: number
  taxRateApplied: number
}

export type RegimeOrderTaxResult = FoodTaxResult & {
  /** Mancia aggiunta al pagamento — mai inclusa in subtotal/tax */
  tipAmount: number
  tipTaxTreatment: TipTaxTreatment
  /** Lordo soggetto a scorporo (solo piatti) */
  taxableGross: number
  /** Totale incassato dal cliente (piatti + mancia) */
  customerTotal: number
  /** IT: mancia elettronica tracciata per registro (POS/app) */
  electronicTipTracked: boolean
}

export interface RestaurantSettingsLike {
  countryCode?: CountryCode | null
  taxRegion?: TaxRegion | null
  fiscalRegion?: FiscalRegion | null
  taxRate?: number | null
  defaultLocale?: string | null
  taxId?: string | null
}

const REGION_META: Record<
  FiscalRegion,
  Omit<FiscalConfig, 'taxRate'> & { defaultTaxRate: number }
> = {
  ITALIA: {
    countryCode: 'IT',
    taxRegion: 'IT_MAIN',
    fiscalRegion: 'ITALIA',
    taxName: 'IVA',
    defaultLocale: 'it',
    timezone: 'Europe/Rome',
    defaultTaxRate: 10,
  },
  ISOLE_CANARIE: {
    countryCode: 'ES',
    taxRegion: 'ES_CANARIAS',
    fiscalRegion: 'ISOLE_CANARIE',
    taxName: 'IGIC',
    defaultLocale: 'es',
    timezone: 'Atlantic/Canary',
    defaultTaxRate: 7,
  },
  SPAGNA_PENINSULA: {
    countryCode: 'ES',
    taxRegion: 'ES_PENINSULA',
    fiscalRegion: 'SPAGNA_PENINSULA',
    taxName: 'IVA',
    defaultLocale: 'es',
    timezone: 'Europe/Madrid',
    defaultTaxRate: 10,
  },
}

export function resolveTaxRegion(
  countryCode: CountryCode,
  taxRegion?: TaxRegion | null,
): TaxRegion {
  const identity = resolveTenantFiscalIdentity({ countryCode, taxRegion })
  return identity.taxRegion
}

export function buildFiscalConfig(settings?: RestaurantSettingsLike | null): FiscalConfig {
  const identity = resolveTenantFiscalIdentity({
    countryCode: settings?.countryCode,
    taxRegion: settings?.taxRegion,
    fiscalRegion: settings?.fiscalRegion,
  })
  const meta = REGION_META[identity.fiscalRegion]
  const rawRate =
    settings?.taxRate != null && settings.taxRate > 0
      ? settings.taxRate
      : meta.defaultTaxRate
  const taxRate = resolveTaxRateForRegion(identity.fiscalRegion, rawRate)

  return {
    countryCode: meta.countryCode,
    taxRegion: meta.taxRegion,
    fiscalRegion: identity.fiscalRegion,
    taxRate,
    taxName: meta.taxName,
    defaultLocale: settings?.defaultLocale ?? meta.defaultLocale,
    timezone: meta.timezone,
  }
}

/**
 * Scorporo IVA/IGIC da prezzo lordo menu (IVA/IGIC inclusa).
 * @param grossFoodAmount Somma prezzi menu — NON includere mai la mancia.
 */
export function scorporoTaxFromGross(grossFoodAmount: number, taxRate: number): FoodTaxResult {
  const rate = taxRate / 100
  const taxableBase = roundMoney(grossFoodAmount / (1 + rate))
  const tax = roundMoney(grossFoodAmount - taxableBase)
  const total = roundMoney(grossFoodAmount)
  return { subtotal: taxableBase, tax, total, taxRateApplied: taxRate }
}

/**
 * Scorporo IVA/IGIC da prezzo lordo (menu IVA inclusa — obbligo ristorazione IT/ES).
 * @param grossAmount Somma prezzi menu (totale piatti, imposta inclusa). Non passare la mancia.
 */
export function computeOrderTax(grossAmount: number, taxRate: number): FoodTaxResult {
  return scorporoTaxFromGross(grossAmount, taxRate)
}

export function getTipTaxTreatment(taxRegion: TaxRegion): TipTaxTreatment {
  return getFiscalStrategyByTaxRegion(taxRegion).getTipTreatment()
}

export type OrderLineForTax = {
  quantity: number
  unitPrice: number
  /** Aliquota piatto; se assente usa default locale */
  taxRate?: number | null
}

/**
 * Scorporo multi-aliquota per riga (IT 4/10/22%, ES 10/21%, Canarie IGIC 7%).
 * Le mance NON entrano mai in questo calcolo.
 */
export function computeOrderTaxFromLines(
  config: FiscalConfig,
  lines: OrderLineForTax[],
): FoodTaxResult {
  if (lines.length === 0) {
    return scorporoTaxFromGross(0, config.taxRate)
  }

  let subtotal = 0
  let tax = 0
  let total = 0
  let dominantRate = config.taxRate
  let maxGross = 0

  for (const line of lines) {
    const gross = roundMoney(line.quantity * line.unitPrice)
    const rate = validateTaxRateForRegion(
      config.fiscalRegion,
      line.taxRate != null && line.taxRate > 0 ? line.taxRate : config.taxRate,
    )
    const part = scorporoTaxFromGross(gross, rate)
    subtotal = roundMoney(subtotal + part.subtotal)
    tax = roundMoney(tax + part.tax)
    total = roundMoney(total + part.total)
    if (gross > maxGross) {
      maxGross = gross
      dominantRate = rate
    }
  }

  // Penny adjustment: allinea subtotal+tax al totale arrotondato
  const roundedTotal = roundMoney(total)
  const drift = roundMoney(roundedTotal - roundMoney(subtotal + tax))
  if (drift !== 0 && lines.length > 0) {
    tax = roundMoney(tax + drift)
  }

  return { subtotal, tax, total: roundedTotal, taxRateApplied: dominantRate }
}

/**
 * Calcolo fiscale per regime ristorante: scorporo sui soli piatti, mancia sempre esclusa.
 */
export function computeOrderTaxForRegime(
  config: FiscalConfig,
  grossFoodAmount: number,
  tipAmount = 0,
): RegimeOrderTaxResult {
  return getFiscalStrategyFromConfig(config).computeRegimeOrderTax(
    config,
    grossFoodAmount,
    tipAmount,
  )
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function fiscalConfigPayload(config: FiscalConfig, taxId?: string | null) {
  const strategy = getFiscalStrategyFromConfig(config)
  const profile = strategy.getComplianceProfile(config)
  return {
    country: config.countryCode,
    countryCode: config.countryCode,
    fiscalRegion: config.fiscalRegion,
    operativeRegime: profile.operativeRegime,
    taxRegion: config.taxRegion,
    taxRate: config.taxRate,
    taxName: config.taxName,
    defaultLocale: config.defaultLocale,
    timezone: config.timezone,
    taxId: taxId ?? null,
    complianceProfile: profile,
  }
}

export function settingsForRegistration(countryCode: CountryCode, taxRegion?: TaxRegion | null) {
  const identity = resolveTenantFiscalIdentity({ countryCode, taxRegion })
  const config = buildFiscalConfig({
    countryCode: identity.country,
    taxRegion: identity.taxRegion,
    fiscalRegion: identity.fiscalRegion,
  })
  return {
    countryCode: config.countryCode,
    taxRegion: config.taxRegion,
    fiscalRegion: config.fiscalRegion,
    defaultLocale: config.defaultLocale,
    taxRate: config.taxRate,
  }
}

export async function loadRestaurantFiscalConfig(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  if (!restaurant) {
    throw new Error('Ristorante non trovato')
  }
  const config = buildFiscalConfig(restaurant.settings)
  return {
    ...config,
    taxId: restaurant.settings?.taxId ?? null,
  }
}
