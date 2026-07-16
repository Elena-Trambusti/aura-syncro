import cron from 'node-cron'
import { prisma } from './prisma'
import { logger } from './logger'
import { ArubaInvoiceService } from './arubaInvoiceService'
import { scheduleArubaInvoiceSubmission } from './arubaSaleAsync'

const SUBMITTING_STALE_MS = 10 * 60 * 1000

async function retryPendingB2BSubmissions(): Promise<number> {
  const stuck = await prisma.invoice.findMany({
    where: {
      statoSdi: { in: ['pending', 'failed', 'submitting'] },
      xmlBlob: { not: null },
    },
    select: { id: true, statoSdi: true, updatedAt: true },
    take: 20,
    orderBy: { updatedAt: 'asc' },
  })

  let scheduled = 0
  for (const inv of stuck) {
    if (inv.statoSdi === 'submitting') {
      const stale = inv.updatedAt.getTime() < Date.now() - SUBMITTING_STALE_MS
      if (!stale) continue
      await prisma.invoice.updateMany({
        where: { id: inv.id, statoSdi: 'submitting' },
        data: { statoSdi: 'pending' },
      })
    }
    scheduleArubaInvoiceSubmission(inv.id)
    scheduled += 1
  }
  return scheduled
}

async function pollSentInvoiceDeliveryStatuses(): Promise<number> {
  if (!ArubaInvoiceService.isConfigured()) return 0

  const pendingInvoices = await prisma.invoice.findMany({
    where: { statoSdi: 'sent', arubaUploadId: { not: null } },
    select: { id: true, arubaUploadId: true, documentNumber: true },
    take: 30,
    orderBy: { updatedAt: 'asc' },
  })

  let updated = 0
  for (const inv of pendingInvoices) {
    if (!inv.arubaUploadId) continue

    const statusResult = await ArubaInvoiceService.checkStatus(inv.arubaUploadId)
    if (statusResult.status !== 'delivered' && statusResult.status !== 'rejected') {
      continue
    }

    await prisma.invoice.updateMany({
      where: { id: inv.id, statoSdi: 'sent' },
      data: { statoSdi: statusResult.status },
    })
    logger.info(`[SDI Poller] Fattura ${inv.documentNumber} → ${statusResult.status}`)
    updated += 1
  }

  return updated
}

export async function runInvoicePollerCycle(): Promise<{ retried: number; deliveryUpdates: number }> {
  const retried = await retryPendingB2BSubmissions()
  const deliveryUpdates = await pollSentInvoiceDeliveryStatuses()
  return { retried, deliveryUpdates }
}

export function startInvoicePoller() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const result = await runInvoicePollerCycle()
      if (result.retried > 0 || result.deliveryUpdates > 0) {
        logger.debug('[SDI Poller] Ciclo completato', result)
      }
    } catch (err) {
      logger.error('[SDI Poller] Errore durante il polling fatture:', err)
    }
  })
}
