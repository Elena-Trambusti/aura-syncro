import { prisma } from './prisma'
import { stripe } from './stripe'
import type { StripeCustomerPayload, StripeInvoicePayload } from './stripeTypes'
import {
  extractSaasCustomerFiscalProfile,
  mapSaasInvoiceFiscalData,
  SaasFiscalDataError,
  type SaasCustomerFiscalProfile,
  type SaasMappedInvoice,
} from './saasFiscalMapping'
import { buildSaasFatturaPaXml, loadSaasIssuerProfile } from './saasFatturaPaXml'
import { ArubaInvoiceService } from './arubaInvoiceService'

export type InvoicePaidResult =
  | { processed: false; reason: string }
  | { processed: true; stripeInvoiceId: string; status: 'sent' | 'failed' | 'skipped_duplicate'; retryable?: boolean }

function isLikelyPlaceholder(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('test') ||
    normalized.includes('example.com') ||
    normalized.includes('placeholder') ||
    normalized === 'it12345678901' ||
    normalized === '12345678901'
  )
}

function hasTestFiscalData(profile: SaasCustomerFiscalProfile): boolean {
  return (
    isLikelyPlaceholder(profile.legalName) ||
    isLikelyPlaceholder(profile.vatNumber) ||
    isLikelyPlaceholder(profile.email) ||
    isLikelyPlaceholder(profile.sdiRecipientCode) ||
    isLikelyPlaceholder(profile.pec)
  )
}

function isSdiValidationFailure(code?: string, message?: string): boolean {
  const text = `${code ?? ''} ${message ?? ''}`.toLowerCase()
  return (
    text.includes('sdi') ||
    text.includes('codice destinatario') ||
    text.includes('destinatario') ||
    text.includes('pec') ||
    text.includes('partita iva') ||
    text.includes('nif')
  )
}

function isSaasPlatformInvoice(invoice: StripeInvoicePayload): boolean {
  if (invoice.metadata?.source === 'restaurant_pos') return false
  if (invoice.metadata?.orderId) return false
  if (invoice.metadata?.reservationId) return false
  return !!(invoice.subscription || invoice.metadata?.restaurantId || invoice.metadata?.plan)
}

async function resolveRestaurantId(invoice: StripeInvoicePayload): Promise<string | null> {
  if (invoice.metadata?.restaurantId) return invoice.metadata.restaurantId

  const subId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id

  if (subId) {
    const settings = await prisma.restaurantSettings.findFirst({
      where: { stripeSubscriptionId: subId },
      select: { restaurantId: true },
    })
    if (settings) return settings.restaurantId

    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      if (sub.metadata?.restaurantId) return sub.metadata.restaurantId
    } catch {
      // subscription non recuperabile
    }
  }

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (customerId) {
    const settings = await prisma.restaurantSettings.findFirst({
      where: { stripeCustomerId: customerId },
      select: { restaurantId: true },
    })
    if (settings) return settings.restaurantId
  }

  return null
}

async function claimSaasInvoiceForProcessing(params: {
  restaurantId: string | null
  stripeInvoiceId: string
  stripeCustomerId: string
  stripeEventId: string
  profile: SaasCustomerFiscalProfile
  mapped: SaasMappedInvoice
}): Promise<boolean> {
  const existing = await prisma.saasElectronicInvoice.findUnique({
    where: { stripeInvoiceId: params.stripeInvoiceId },
    select: { status: true },
  })

  if (existing?.status === 'sent' || existing?.status === 'pending') {
    return false
  }

  if (!existing) {
    try {
      await prisma.saasElectronicInvoice.create({
        data: {
          restaurantId: params.restaurantId,
          stripeInvoiceId: params.stripeInvoiceId,
          stripeCustomerId: params.stripeCustomerId,
          stripeEventId: params.stripeEventId,
          status: 'pending',
          fiscalRegime: params.mapped.regime,
          legalName: params.profile.legalName,
          vatNumber: params.profile.vatNumber,
          sdiRecipientCode: params.mapped.sdiRecipientCode,
          pec: params.mapped.pec,
          billingAddress: params.profile.address,
          netAmount: params.mapped.netAmount,
          taxAmount: params.mapped.taxAmount,
          grossAmount: params.mapped.grossAmount,
          taxRate: params.mapped.taxRate,
          vatNature: params.mapped.vatNature,
          currency: 'EUR',
        },
      })
      return true
    } catch (err: unknown) {
      if (
        err != null
        && typeof err === 'object'
        && 'code' in err
        && (err as { code: string }).code === 'P2002'
      ) {
        return false
      }
      throw err
    }
  }

  const reclaimed = await prisma.saasElectronicInvoice.updateMany({
    where: { stripeInvoiceId: params.stripeInvoiceId, status: 'failed' },
    data: {
      status: 'pending',
      stripeEventId: params.stripeEventId,
      arubaErrorCode: null,
      arubaErrorMessage: null,
      updatedAt: new Date(),
    },
  })
  return reclaimed.count > 0
}

async function persistInvoiceRecord(params: {
  restaurantId: string | null
  stripeInvoiceId: string
  stripeCustomerId: string | null
  stripeEventId: string
  profile: SaasCustomerFiscalProfile
  mapped: SaasMappedInvoice
  status: 'pending' | 'sent' | 'failed'
  arubaUploadFileName?: string
  arubaErrorCode?: string
  arubaErrorMessage?: string
}) {
  return prisma.saasElectronicInvoice.upsert({
    where: { stripeInvoiceId: params.stripeInvoiceId },
    create: {
      restaurantId: params.restaurantId,
      stripeInvoiceId: params.stripeInvoiceId,
      stripeCustomerId: params.stripeCustomerId,
      stripeEventId: params.stripeEventId,
      status: params.status,
      fiscalRegime: params.mapped.regime,
      legalName: params.profile.legalName,
      vatNumber: params.profile.vatNumber,
      sdiRecipientCode: params.mapped.sdiRecipientCode,
      pec: params.mapped.pec,
      billingAddress: params.profile.address,
      netAmount: params.mapped.netAmount,
      taxAmount: params.mapped.taxAmount,
      grossAmount: params.mapped.grossAmount,
      taxRate: params.mapped.taxRate,
      vatNature: params.mapped.vatNature,
      currency: 'EUR',
      arubaUploadFileName: params.arubaUploadFileName,
      arubaErrorCode: params.arubaErrorCode,
      arubaErrorMessage: params.arubaErrorMessage,
      sentAt: params.status === 'sent' ? new Date() : null,
    },
    update: {
      status: params.status,
      arubaUploadFileName: params.arubaUploadFileName,
      arubaErrorCode: params.arubaErrorCode,
      arubaErrorMessage: params.arubaErrorMessage,
      sentAt: params.status === 'sent' ? new Date() : undefined,
      updatedAt: new Date(),
    },
  })
}

/**
 * Gestisce invoice.paid / invoice.payment_succeeded:
 * estrae dati fiscali, mappa regime forfettario IT / export, invia XML ad Aruba.
 */
export async function handleStripeInvoicePaid(
  invoice: StripeInvoicePayload,
  stripeEventId: string,
): Promise<InvoicePaidResult> {
  if (!isSaasPlatformInvoice(invoice)) {
    console.info('[stripe-invoice] invoice.paid ignorato (non SaaS):', invoice.id)
    return { processed: false, reason: 'not_saas_invoice' }
  }

  const existing = await prisma.saasElectronicInvoice.findUnique({
    where: { stripeInvoiceId: invoice.id },
    select: { status: true },
  })

  if (existing?.status === 'sent') {
    console.info('[stripe-invoice] Fattura già emessa (idempotenza):', invoice.id)
    return { processed: true, stripeInvoiceId: invoice.id, status: 'skipped_duplicate' }
  }

  // Evita doppia submission Aruba se un altro worker sta già processando.
  if (existing?.status === 'pending') {
    console.info('[stripe-invoice] Fattura già in elaborazione:', invoice.id)
    return { processed: true, stripeInvoiceId: invoice.id, status: 'skipped_duplicate' }
  }

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  if (!customerId) {
    console.error('[stripe-invoice] invoice.paid senza customer:', invoice.id)
    return { processed: false, reason: 'missing_customer' }
  }

  const customer = await stripe.customers.retrieve(customerId, { expand: ['tax_ids'] }) as StripeCustomerPayload
  if (customer.deleted) {
    console.error('[stripe-invoice] Customer eliminato:', customerId)
    return { processed: false, reason: 'customer_deleted' }
  }

  const restaurantId = await resolveRestaurantId(invoice)

  if (restaurantId && customerId) {
    await prisma.restaurantSettings.updateMany({
      where: { restaurantId, stripeCustomerId: null },
      data: { stripeCustomerId: customerId },
    })
  }

  let profile: SaasCustomerFiscalProfile
  let mapped: SaasMappedInvoice

  try {
    profile = extractSaasCustomerFiscalProfile(customer, invoice)
    mapped = mapSaasInvoiceFiscalData(profile, invoice)
  } catch (err) {
    const message = err instanceof SaasFiscalDataError
      ? `${err.code}: ${err.message}`
      : err instanceof Error ? err.message : 'Fiscal mapping error'

    console.error('[stripe-invoice] Dati fiscali non validi', {
      invoiceId: invoice.id,
      customerId,
      restaurantId,
      error: message,
    })

    await persistInvoiceRecord({
      restaurantId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customerId,
      stripeEventId,
      profile: {
        legalName: customer.name ?? 'SCONOSCIUTO',
        vatNumber: '',
        address: { line1: '', city: '', postalCode: '', country: 'IT' },
      },
      mapped: {
        regime: 'IT_FORFETTARIO',
        netAmount: 0,
        taxAmount: 0,
        grossAmount: (invoice.amount_paid ?? 0) / 100,
        taxRate: 0,
        vatNature: 'N2.2',
        sdiRecipientCode: '0000000',
        recipientCodeType: 'SDI',
        virtualStampRequired: false,
        virtualStampAmount: 0,
      },
      status: 'failed',
      arubaErrorMessage: message,
    })

    return { processed: true, stripeInvoiceId: invoice.id, status: 'failed' }
  }

  if (hasTestFiscalData(profile)) {
    const errorMessage = 'Stripe customer metadata contiene dati di test/placeholder'
    console.error('[stripe-invoice] Blocco invio Aruba: dati fiscali non validi per produzione', {
      invoiceId: invoice.id,
      restaurantId,
      customerId,
      legalName: profile.legalName,
      vatNumber: profile.vatNumber,
      sdiRecipientCode: profile.sdiRecipientCode,
    })

    await persistInvoiceRecord({
      restaurantId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customerId,
      stripeEventId,
      profile,
      mapped,
      status: 'failed',
      arubaErrorMessage: errorMessage,
    })

    return { processed: true, stripeInvoiceId: invoice.id, status: 'failed' }
  }

  const invoiceNumber = invoice.number ?? `SAAS-${invoice.id.replace('in_', '').slice(0, 12).toUpperCase()}`
  const invoiceDate = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date()

  let xmlContent: string
  try {
    const issuer = loadSaasIssuerProfile()
    xmlContent = buildSaasFatturaPaXml({
      invoiceNumber,
      invoiceDate,
      customer: profile,
      mapped,
      issuer,
      description: 'Abbonamento mensile Aura Syncro — piattaforma gestionale ristoranti',
      currency: (invoice.currency ?? 'eur').toUpperCase(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'XML build failed'
    console.error('[stripe-invoice] Errore generazione XML:', message)

    await persistInvoiceRecord({
      restaurantId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customerId,
      stripeEventId,
      profile,
      mapped,
      status: 'failed',
      arubaErrorMessage: message,
    })

    return { processed: true, stripeInvoiceId: invoice.id, status: 'failed' }
  }

  console.info('[stripe-invoice] Invio fattura elettronica', {
    invoiceId: invoice.id,
    restaurantId,
    regime: mapped.regime,
    gross: mapped.grossAmount,
    sdi: mapped.sdiRecipientCode,
  })

  const claimed = await claimSaasInvoiceForProcessing({
    restaurantId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: customerId,
    stripeEventId,
    profile,
    mapped,
  })
  if (!claimed) {
    console.info('[stripe-invoice] Fattura già in elaborazione o emessa:', invoice.id)
    return { processed: true, stripeInvoiceId: invoice.id, status: 'skipped_duplicate' }
  }

  const arubaResult = await ArubaInvoiceService.submit(xmlContent)

  const finalStatus = arubaResult.success ? 'sent' : 'failed'

  await persistInvoiceRecord({
    restaurantId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: customerId,
    stripeEventId,
    profile,
    mapped,
    status: finalStatus,
    arubaUploadFileName: arubaResult.uploadFileName,
    arubaErrorCode: arubaResult.errorCode,
    arubaErrorMessage: arubaResult.errorMessage,
  })

  if (!arubaResult.success) {
    const retryable = arubaResult.errorMessage !== 'ARUBA_FE_DISABLED'
      && arubaResult.errorMessage !== 'ARUBA_FE_CREDENTIALS_MISSING'

    const sdiValidationError = isSdiValidationFailure(arubaResult.errorCode, arubaResult.errorMessage)
    if (process.env.NODE_ENV === 'production' && sdiValidationError) {
      console.error('[ALERT][ARUBA_SDI_VALIDATION]', {
        invoiceId: invoice.id,
        restaurantId,
        customerId,
        sdiRecipientCode: mapped.sdiRecipientCode,
        vatNumber: profile.vatNumber,
        legalName: profile.legalName,
        errorCode: arubaResult.errorCode,
        errorMessage: arubaResult.errorMessage,
        action: 'Intervento manuale immediato richiesto',
      })
    }

    console.error('[stripe-invoice] Invio Aruba fallito — intervento manuale richiesto', {
      invoiceId: invoice.id,
      restaurantId,
      customerId,
      errorCode: arubaResult.errorCode,
      errorMessage: arubaResult.errorMessage,
      retryable,
    })

    return {
      processed: true,
      stripeInvoiceId: invoice.id,
      status: 'failed',
      retryable,
    }
  }

  return { processed: true, stripeInvoiceId: invoice.id, status: 'sent' }
}
