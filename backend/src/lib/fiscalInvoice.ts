import type { Prisma } from '@prisma/client'
import { buildFiscalConfig } from './taxEngine'
import { resolveRevenueAmount } from './fiscalAmounts'
import { getFiscalStrategyFromConfig } from './fiscal/strategies'
import type { FiscalRegion } from '@prisma/client'

/** Formato: FATT-2026-001 */
export function formatInvoiceDocumentNumber(
  prefix: string,
  fiscalYear: number,
  sequence: number,
): string {
  const safePrefix = prefix.trim().toUpperCase() || 'FATT'
  return `${safePrefix}-${fiscalYear}-${String(sequence).padStart(3, '0')}`
}

export type AllocatedInvoiceNumber = {
  prefix: string
  fiscalYear: number
  sequence: number
  documentNumber: string
}

/** Prefisso documenti di vendita POS (distinto da FatturaPA B2B). */
export function resolveSaleDocumentPrefix(fiscalRegion: FiscalRegion): string {
  if (fiscalRegion === 'ITALIA') return 'CORR'
  return 'T-'
}

/**
 * Alloca il prossimo numero progressivo per ristorante/anno (atomico in transazione).
 * @param prefixOverride Se impostato, usa questo prefisso (es. CORR vendita, FATT B2B).
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  issuedAt: Date,
  prefixOverride?: string,
): Promise<AllocatedInvoiceNumber> {
  const settings = await tx.restaurantSettings.findUnique({ where: { restaurantId } })
  const fiscal = buildFiscalConfig(settings)
  const strategy = getFiscalStrategyFromConfig(fiscal)
  const prefix = prefixOverride?.trim().toUpperCase()
    || strategy.resolveInvoicePrefix(settings?.invoicePrefix)
  const fiscalYear = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fiscal.timezone || 'Europe/Rome',
      year: 'numeric',
    }).format(issuedAt),
  ) || issuedAt.getFullYear()

  const row = await tx.fiscalSequence.upsert({
    where: { restaurantId_fiscalYear: { restaurantId, fiscalYear } },
    create: { restaurantId, fiscalYear, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  })

  const sequence = row.lastSequence
  return {
    prefix,
    fiscalYear,
    sequence,
    documentNumber: formatInvoiceDocumentNumber(prefix, fiscalYear, sequence),
  }
}

/** Crea documento di vendita collegato all'ordine pagato (idempotente se già esiste). */
export async function issueInvoiceForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
  issuedAt: Date,
) {
  const existing = await tx.invoice.findUnique({ where: { orderId } })
  if (existing) return existing

  const order = await tx.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { revenueAmount: true, total: true, subtotal: true, tax: true, fiscalRegionSnapshot: true },
  })
  if (!order) {
    throw new Error('ORDER_NOT_FOUND')
  }

  const settings = await tx.restaurantSettings.findUnique({ where: { restaurantId } })
  const fiscal = buildFiscalConfig(settings)
  const salePrefix = resolveSaleDocumentPrefix(
    order?.fiscalRegionSnapshot ?? fiscal.fiscalRegion,
  )
  const allocated = await allocateInvoiceNumber(tx, restaurantId, issuedAt, salePrefix)
  const importoTotale = order
    ? resolveRevenueAmount({
        revenueAmount: order.revenueAmount,
        total: order.total,
        subtotal: order.subtotal,
        tax: order.tax,
        tipAmount: 0,
      })
    : 0

  return tx.invoice.create({
    data: {
      restaurantId,
      orderId,
      documentNumber: allocated.documentNumber,
      prefix: allocated.prefix,
      fiscalYear: allocated.fiscalYear,
      sequence: allocated.sequence,
      issuedAt,
      importoTotale,
    },
  })
}

/** Copia dati fiscali dal cliente CRM allo snapshot ordine (se presente). */
export async function snapshotOrderBillingFromCustomer(
  tx: Prisma.TransactionClient,
  orderId: string,
  customerId: string | null | undefined,
) {
  if (!customerId) return

  const customer = await tx.customer.findUnique({ where: { id: customerId } })
  if (!customer) return

  const hasBilling =
    customer.taxId ||
    customer.fiscalCode ||
    customer.sdiRecipientCode ||
    customer.pec ||
    customer.name

  if (!hasBilling) return

  await tx.order.update({
    where: { id: orderId },
    data: {
      billingLegalName: customer.name,
      billingTaxId: customer.taxId,
      billingFiscalCode: customer.fiscalCode,
      billingSdiCode: customer.sdiRecipientCode,
      billingPec: customer.pec,
    },
  })
}
