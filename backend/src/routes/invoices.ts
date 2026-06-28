import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireRole } from '../middleware/auth'
import { generateB2BXml } from '../lib/b2bFatturaPaXml'
import { ArubaInvoiceService } from '../lib/arubaInvoiceService'
import { buildFiscalConfig, scorporoTaxFromGross, roundMoney } from '../lib/taxEngine'
import { allocateInvoiceNumber } from '../lib/fiscalInvoice'
import { getFiscalStrategyFromConfig } from '../lib/fiscal/strategies'
import { resolveRevenueAmount } from '../lib/fiscalAmounts'
import { tenantId } from '../lib/tenant'

const router = Router()

const invoiceSchema = z.object({
  orderId: z.string().optional(),
  clientePiva: z.string().optional(),
  clienteCodiceFiscale: z.string().optional(),
  clienteRagioneSociale: z.string(),
  clienteIndirizzo: z.string(),
  clienteCity: z.string().optional(),
  clienteZip: z.string().optional(),
  clienteProvince: z.string().optional(),
  clienteCountry: z.string().default('IT'),
  clienteSdiCode: z.string().optional(),
  clientePec: z.string().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    taxRate: z.number(),
  })).optional(),
})

router.post('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = tenantId(req)

  try {
    const data = invoiceSchema.parse(req.body)

    const settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId },
    })

    if (!settings || !settings.legalName || !settings.taxId || !settings.legalAddress) {
      res.status(400).json({ error: 'Dati fiscali ristorante incompleti' })
      return
    }

    const fiscal = buildFiscalConfig(settings)
    if (fiscal.countryCode !== 'IT') {
      res.status(400).json({ error: 'Fatturazione elettronica B2B disponibile solo per tenant Italia' })
      return
    }

    const strategy = getFiscalStrategyFromConfig(fiscal)
    const b2bPrefix = strategy.resolveInvoicePrefix(settings.invoicePrefix)
    const issuedAt = new Date()
    const defaultTaxRate = fiscal.taxRate

    let invoiceItems: Array<{
      description: string
      quantity: number
      unitPrice: number
      taxRate: number
    }>

    if (data.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: data.orderId, restaurantId, status: 'PAID' },
        include: {
          items: {
            include: { menuItem: true, modifiers: true },
          },
        },
      })
      if (!order) {
        res.status(404).json({ error: 'Ordine pagato non trovato per questo tenant' })
        return
      }
      const taxRate = order.taxRateApplied ?? defaultTaxRate
      invoiceItems = order.items.filter(item => item.status !== 'CANCELLED').map(item => {
        const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0)
        const lineGross = (item.unitPrice + modifierTotal) * item.quantity
        return {
          description: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: roundMoney(lineGross / item.quantity),
          taxRate,
        }
      })
      if (invoiceItems.length === 0) {
        res.status(400).json({ error: 'Nessuna riga fatturabile nell\'ordine' })
        return
      }

      const grossBeforeDiscount = invoiceItems.reduce(
        (s, i) => s + roundMoney(i.quantity * i.unitPrice),
        0,
      )
      const foodPaid = resolveRevenueAmount({
        revenueAmount: order.revenueAmount,
        total: order.total,
        subtotal: order.subtotal,
        tax: order.tax,
        tipAmount: order.tipAmount,
      })
      if (grossBeforeDiscount > 0 && foodPaid < grossBeforeDiscount - 0.01) {
        const ratio = foodPaid / grossBeforeDiscount
        invoiceItems = invoiceItems.map(i => ({
          ...i,
          unitPrice: roundMoney(i.unitPrice * ratio),
        }))
      }
    } else {
      if (!data.items?.length) {
        res.status(400).json({ error: 'Specificare orderId o items' })
        return
      }
      invoiceItems = data.items.map(item => ({
        ...item,
        taxRate: item.taxRate === defaultTaxRate ? item.taxRate : defaultTaxRate,
      }))
    }

    let totalGross = 0
    const mappedItems = invoiceItems.map(item => {
      const gross = roundMoney(item.quantity * item.unitPrice)
      const part = scorporoTaxFromGross(gross, item.taxRate)
      totalGross = roundMoney(totalGross + gross)
      const netUnit = item.quantity > 0 ? roundMoney(part.subtotal / item.quantity) : 0
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: netUnit,
        taxRate: item.taxRate,
        totalPrice: part.subtotal,
        grossTotal: gross,
      }
    })

    const invoice = await prisma.$transaction(async tx => {
      const allocated = await allocateInvoiceNumber(tx, restaurantId, issuedAt, b2bPrefix)

      const xml = generateB2BXml({
        documentNumber: allocated.documentNumber,
        issuedAt,
        issuerVat: settings.taxId!,
        issuerLegalName: settings.legalName!,
        issuerFiscalCode: settings.fiscalCode || undefined,
        issuerAddress: settings.legalAddress!,
        issuerCity: 'N/D',
        issuerZip: '00000',
        issuerProvince: 'ND',
        issuerCountry: settings.countryCode,
        clientVat: data.clientePiva,
        clientFiscalCode: data.clienteCodiceFiscale,
        clientLegalName: data.clienteRagioneSociale,
        clientAddress: data.clienteIndirizzo,
        clientCity: data.clienteCity,
        clientZip: data.clienteZip,
        clientProvince: data.clienteProvince,
        clientCountry: data.clienteCountry,
        clientSdiCode: data.clienteSdiCode,
        clientPec: data.clientePec,
        items: mappedItems,
      })

      const arubaRes = await ArubaInvoiceService.submit(xml)
      const statoSdi = arubaRes.success ? 'sent' : 'failed'

      const created = await tx.invoice.create({
        data: {
          restaurantId,
          orderId: data.orderId,
          documentNumber: allocated.documentNumber,
          prefix: allocated.prefix,
          fiscalYear: allocated.fiscalYear,
          sequence: allocated.sequence,
          clientePiva: data.clientePiva,
          clienteCodiceFiscale: data.clienteCodiceFiscale,
          clienteSdiCode: data.clienteSdiCode,
          clientePec: data.clientePec,
          clienteRagioneSociale: data.clienteRagioneSociale,
          clienteIndirizzo: data.clienteIndirizzo,
          importoTotale: totalGross,
          statoSdi,
          xmlBlob: xml,
          arubaUploadId: arubaRes.uploadFileName,
        },
      })

      return { invoice: created, arubaResponse: arubaRes }
    })

    res.json(invoice)
  } catch (error: unknown) {
    console.error('Invoice error:', error)
    const message = error instanceof Error ? error.message : 'Errore generazione fattura'
    res.status(400).json({ error: message })
  }
})

router.get('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = tenantId(req)
  const invoices = await prisma.invoice.findMany({
    where: {
      restaurantId,
      clienteRagioneSociale: { not: null },
    },
    orderBy: { issuedAt: 'desc' },
  })
  res.json(invoices)
})

export default router
