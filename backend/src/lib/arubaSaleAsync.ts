import { prisma } from './prisma'
import { ArubaInvoiceService } from './arubaInvoiceService'
import { buildFiscalConfig } from './taxEngine'

/**
 * Invio Aruba / SDI in background — mai await nel percorso HTTP del POS.
 * Idempotente: salta se già inviato.
 */
export async function submitInvoiceToArubaBackground(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { restaurant: { include: { settings: true } } },
  })
  if (!invoice) return
  if (invoice.arubaUploadId || invoice.statoSdi === 'sent' || invoice.statoSdi === 'refunded') return

  const fiscal = buildFiscalConfig(invoice.restaurant.settings)
  if (fiscal.countryCode !== 'IT') return

  if (!ArubaInvoiceService.isConfigured()) {
    await prisma.invoice.updateMany({
      where: { id: invoiceId, arubaUploadId: null, statoSdi: { notIn: ['sent', 'refunded'] } },
      data: { statoSdi: 'local_only' },
    })
    return
  }

  if (!invoice.xmlBlob) {
    await prisma.invoice.updateMany({
      where: { id: invoiceId, arubaUploadId: null, statoSdi: { notIn: ['sent', 'refunded'] } },
      data: { statoSdi: 'local_only' },
    })
    return
  }

  // Claim atomico: evita doppio upload concorrente.
  const claimed = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      arubaUploadId: null,
      statoSdi: { notIn: ['sent', 'refunded', 'submitting'] },
    },
    data: { statoSdi: 'submitting' },
  })
  if (claimed.count === 0) return

  const arubaResult = await ArubaInvoiceService.submit(invoice.xmlBlob)
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      statoSdi: arubaResult.success ? 'sent' : 'failed',
      arubaUploadId: arubaResult.uploadFileName ?? undefined,
    },
  })

  if (!arubaResult.success) {
    console.error('[aruba-sale-async] Invio fallito', {
      invoiceId,
      error: arubaResult.errorMessage,
      code: arubaResult.errorCode,
    })
  }
}

export function scheduleArubaInvoiceSubmission(invoiceId: string): void {
  void submitInvoiceToArubaBackground(invoiceId).catch(err => {
    console.error('[aruba-sale-async] Errore background', invoiceId, err)
  })
}
