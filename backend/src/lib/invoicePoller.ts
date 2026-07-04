import cron from 'node-cron'
import { prisma } from './prisma'
import { logger } from './logger'

export function startInvoicePoller() {
  // Ogni 30 secondi
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const pendingInvoices = await prisma.invoice.findMany({
        where: { statoSdi: 'sent', arubaUploadId: { not: null } }
      })

      for (const inv of pendingInvoices) {
        if (!inv.arubaUploadId) continue
        
        // Simula o implementa la chiamata di stato Aruba
        // E.g. const status = await ArubaInvoiceService.checkStatus(inv.arubaUploadId)
        
        // Mock comportamento: 90% delle volte passa a delivered, 10% rejected
        const rand = Math.random()
        let nuovoStato = 'sent'
        if (rand > 0.9) {
          nuovoStato = 'rejected'
        } else if (rand > 0.2) {
          nuovoStato = 'delivered'
        }

        if (nuovoStato !== 'sent') {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { statoSdi: nuovoStato }
          })
          logger.debug(`[SDI Poller] Fattura ${inv.documentNumber} → ${nuovoStato}`)
        }
      }
    } catch (err) {
      logger.error('[SDI Poller] Errore durante il polling fatture:', err)
    }
  })
}
