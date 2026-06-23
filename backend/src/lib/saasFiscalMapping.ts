import type { StripeCustomerPayload, StripeInvoicePayload } from './stripeTypes'

/** Natura IVA per operazioni non soggette / export (modificabile via env) */
export const SAAS_VAT_NATURE_EXPORT = process.env.ARUBA_FE_VAT_NATURE_EXPORT?.trim() || 'N2.1'
export const SAAS_VAT_NATURE_CANARY = process.env.ARUBA_FE_VAT_NATURE_CANARY?.trim() || 'N3.2'
export const SAAS_IT_VAT_RATE = 0.22
export const SAAS_CANARY_SDI_CODE = 'XXXXXXX'

export type SaasBillingAddress = {
  line1: string
  line2?: string
  city: string
  postalCode: string
  province?: string
  country: string
}

export type SaasCustomerFiscalProfile = {
  legalName: string
  vatNumber: string
  sdiRecipientCode?: string
  pec?: string
  address: SaasBillingAddress
  isCanaryIslands?: boolean
  email?: string
}

export type SaasFiscalRegime = 'IT_DOMESTIC' | 'ES_CANARY_EXPORT' | 'FOREIGN_EXPORT'

export type SaasMappedInvoice = {
  regime: SaasFiscalRegime
  netAmount: number
  taxAmount: number
  grossAmount: number
  taxRate: number
  vatNature?: string
  sdiRecipientCode: string
  pec?: string
  recipientCodeType: 'SDI' | 'PEC'
}

export class SaasFiscalDataError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'SaasFiscalDataError'
  }
}

function readMeta(customer: StripeCustomerPayload, ...keys: string[]): string | undefined {
  const meta = customer.metadata ?? {}
  for (const key of keys) {
    const value = meta[key]?.trim()
    if (value) return value
  }
  return undefined
}

function normalizeCountry(value?: string | null): string {
  return (value ?? 'IT').trim().toUpperCase().slice(0, 2)
}

function normalizeVat(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** Canarie: CAP 35xxx / 38xxx oppure flag custom is_canary_islands */
export function isCanaryIslands(profile: SaasCustomerFiscalProfile): boolean {
  if (profile.isCanaryIslands === true) return true
  if (profile.address.country !== 'ES') return false
  const zip = profile.address.postalCode.trim()
  return zip.startsWith('35') || zip.startsWith('38')
}

export function extractSaasCustomerFiscalProfile(
  customer: StripeCustomerPayload,
  invoice?: StripeInvoicePayload,
): SaasCustomerFiscalProfile {
  const invoiceAddress = invoice?.customer_address
  const customerAddress = customer.address

  const line1 = readMeta(customer, 'billing_line1', 'address_line1')
    ?? invoiceAddress?.line1
    ?? customerAddress?.line1
    ?? ''

  const city = readMeta(customer, 'billing_city', 'address_city')
    ?? invoiceAddress?.city
    ?? customerAddress?.city
    ?? ''

  const postalCode = readMeta(customer, 'billing_postal_code', 'address_postal_code')
    ?? invoiceAddress?.postal_code
    ?? customerAddress?.postal_code
    ?? ''

  const province = readMeta(customer, 'billing_province', 'address_state')
    ?? invoiceAddress?.state
    ?? customerAddress?.state
    ?? undefined

  const country = normalizeCountry(
    readMeta(customer, 'billing_country', 'address_country')
    ?? invoiceAddress?.country
    ?? customerAddress?.country,
  )

  const legalName = readMeta(customer, 'legal_name', 'billing_legal_name', 'company_name')
    ?? customer.name
    ?? ''

  const taxIdFromStripe = customer.tax_ids?.data?.[0]?.value
  const vatNumber = normalizeVat(
    readMeta(customer, 'vat_number', 'billing_tax_id', 'partita_iva', 'tax_id')
    ?? taxIdFromStripe
    ?? '',
  )

  const sdiRecipientCode = readMeta(customer, 'sdi_code', 'billing_sdi_code', 'codice_destinatario')?.toUpperCase()
  const pec = readMeta(customer, 'pec', 'billing_pec')?.toLowerCase()
  const isCanaryIslands = readMeta(customer, 'is_canary_islands') === 'true'

  const profile: SaasCustomerFiscalProfile = {
    legalName: legalName.trim(),
    vatNumber,
    sdiRecipientCode,
    pec,
    isCanaryIslands,
    email: customer.email ?? undefined,
    address: {
      line1: line1.trim(),
      line2: invoiceAddress?.line2 ?? customerAddress?.line2 ?? undefined,
      city: city.trim(),
      postalCode: postalCode.trim(),
      province: province?.trim(),
      country,
    },
  }

  validateSaasCustomerFiscalProfile(profile)
  return profile
}

export function validateSaasCustomerFiscalProfile(profile: SaasCustomerFiscalProfile): void {
  const missing: string[] = []
  if (!profile.legalName) missing.push('legalName')
  if (!profile.vatNumber) missing.push('vatNumber')
  if (!profile.address.line1) missing.push('address.line1')
  if (!profile.address.city) missing.push('address.city')
  if (!profile.address.postalCode) missing.push('address.postalCode')
  if (!profile.address.country) missing.push('address.country')

  if (missing.length > 0) {
    throw new SaasFiscalDataError(
      `Dati fiscali cliente incompleti: ${missing.join(', ')}`,
      'SAAS_FISCAL_DATA_INCOMPLETE',
    )
  }

  if (profile.address.country === 'IT') {
    if (!profile.sdiRecipientCode && !profile.pec) {
      throw new SaasFiscalDataError(
        'Cliente IT: richiesto Codice Destinatario SDI o PEC',
        'SAAS_FISCAL_SDI_OR_PEC_REQUIRED',
      )
    }
    if (profile.sdiRecipientCode && profile.sdiRecipientCode.length !== 7) {
      throw new SaasFiscalDataError(
        'Codice Destinatario SDI deve essere di 7 caratteri',
        'SAAS_FISCAL_SDI_INVALID',
      )
    }
  }
}

/**
 * Branching fiscale Italia vs Canarie vs estero.
 * Canarie: IVA 0%, Natura export, SDI = XXXXXXX.
 */
export function mapSaasInvoiceFiscalData(
  profile: SaasCustomerFiscalProfile,
  invoice: StripeInvoicePayload,
): SaasMappedInvoice {
  const grossAmount = (invoice.amount_paid ?? invoice.total ?? 0) / 100
  const stripeTax = (invoice.tax ?? 0) / 100
  const stripeSubtotal = (invoice.subtotal_excluding_tax ?? invoice.subtotal ?? 0) / 100

  if (profile.address.country === 'IT') {
    let netAmount: number
    let taxAmount: number

    if (stripeTax > 0) {
      netAmount = stripeSubtotal
      taxAmount = stripeTax
    } else {
      netAmount = grossAmount / (1 + SAAS_IT_VAT_RATE)
      taxAmount = grossAmount - netAmount
    }

    const sdi = profile.sdiRecipientCode?.toUpperCase()
    const usePec = !sdi && !!profile.pec

    return {
      regime: 'IT_DOMESTIC',
      netAmount: roundMoney(netAmount),
      taxAmount: roundMoney(taxAmount),
      grossAmount: roundMoney(grossAmount),
      taxRate: SAAS_IT_VAT_RATE,
      sdiRecipientCode: sdi ?? profile.pec ?? '0000000',
      pec: usePec ? profile.pec : undefined,
      recipientCodeType: usePec ? 'PEC' : 'SDI',
    }
  }

  if (isCanaryIslands(profile)) {
    return {
      regime: 'ES_CANARY_EXPORT',
      netAmount: roundMoney(grossAmount),
      taxAmount: 0,
      grossAmount: roundMoney(grossAmount),
      taxRate: 0,
      vatNature: SAAS_VAT_NATURE_CANARY,
      sdiRecipientCode: SAAS_CANARY_SDI_CODE,
      recipientCodeType: 'SDI',
    }
  }

  return {
    regime: 'FOREIGN_EXPORT',
    netAmount: roundMoney(grossAmount),
    taxAmount: 0,
    grossAmount: roundMoney(grossAmount),
    taxRate: 0,
    vatNature: SAAS_VAT_NATURE_EXPORT,
    sdiRecipientCode: SAAS_CANARY_SDI_CODE,
    recipientCodeType: 'SDI',
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
