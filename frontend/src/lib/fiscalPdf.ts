import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FiscalPdfLabels } from './fiscalLabels'

export interface FiscalRow {
  fecha: string | Date | null
  orderId: string
  baseImponible: number
  tax: number
  revenueAmount: number
  tipAmount: number
  total: number
  paymentMethod?: string | null
  fiscalIntegrityHash?: string | null
}

export interface FiscalReportData {
  restaurant: { name: string; address?: string | null; taxId?: string | null }
  period: { start: string; end: string }
  rows: FiscalRow[]
  summary: {
    totalFacturadoNeto: number
    totalPropinas: number
    totalConciliacion: number
    transactionCount: number
    electronicTipsTotal?: number
    tipTaxStatus?: string
  }
}

const fmtEur = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

const toDateStr = (d: string | Date, locale: string, timeZone?: string) => {
  const date = typeof d === 'string' || d instanceof Date ? new Date(d) : new Date()
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

const fmtPeriod = (start: string, end: string, locale: string, timeZone?: string) => {
  const s = toDateStr(start, locale, timeZone)
  const e = toDateStr(end, locale, timeZone)
  return s === e ? s : `${s} — ${e}`
}

const fileDate = (start: string, timeZone?: string) => {
  if (timeZone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(start))
  }
  const iso = typeof start === 'string' ? start : new Date(start).toISOString()
  return iso.slice(0, 10)
}

export function generateFiscalPdf(
  data: FiscalReportData,
  labels: FiscalPdfLabels,
  options?: { timeZone?: string },
): void {
  if (!data.rows.length) {
    throw new Error(labels.noDataExport)
  }

  const { locale } = labels
  const timeZone = options?.timeZone
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const { restaurant, period, rows, summary } = data

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(labels.title(restaurant.name), pageW / 2, 18, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${labels.taxId}: ${restaurant.taxId || labels.taxIdPending}`, 14, 26)
  let metaY = 31
  if (restaurant.address) {
    doc.text(`${labels.address}: ${restaurant.address}`, 14, metaY)
    metaY += 5
  }
  doc.text(`${labels.period}: ${fmtPeriod(period.start, period.end, locale, timeZone)}`, 14, metaY)
  if (labels.taxRateLine) {
    metaY += 5
    doc.text(labels.taxRateLine, 14, metaY)
  }
  doc.text(
    `${labels.generated}: ${new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date())}`,
    pageW - 14,
    26,
    { align: 'right' },
  )

  autoTable(doc, {
    startY: metaY + 6,
    head: [labels.headers],
    body: rows.map(r => {
      const base = [
        r.fecha ? toDateStr(r.fecha, locale, timeZone) : '—',
        r.orderId.slice(-6).toUpperCase(),
        fmtEur(r.baseImponible, locale),
        fmtEur(r.tax, locale),
        fmtEur(r.revenueAmount, locale),
        fmtEur(r.tipAmount, locale),
        fmtEur(r.total, locale),
      ]
      if (labels.includePaymentMethod) {
        base.push(r.paymentMethod ?? '—')
      }
      if (labels.includeIntegrityHash) {
        const hash = r.fiscalIntegrityHash
        base.push(hash ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : '—')
      }
      return base
    }),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  let summaryStartY = docWithTable.lastAutoTable?.finalY ?? metaY + 6

  if (labels.tipsSectionTitle && summary.electronicTipsTotal != null) {
    summaryStartY += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(labels.tipsSectionTitle, 14, summaryStartY)
    summaryStartY += 4
  }

  const finalY = summaryStartY

  autoTable(doc, {
    startY: Math.min(finalY + 8, pageH - 48),
    body: [
      [labels.summaryNet, fmtEur(summary.totalFacturadoNeto, locale)],
      [labels.summaryTips, fmtEur(summary.totalPropinas, locale)],
      ...(summary.electronicTipsTotal != null && labels.summaryElectronicTips
        ? [[labels.summaryElectronicTips, fmtEur(summary.electronicTipsTotal, locale)]]
        : []),
      [labels.summaryReconciliation, fmtEur(summary.totalConciliacion, locale)],
    ],
    styles: { fontSize: 10, cellPadding: 3.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249] },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
    tableWidth: pageW / 2 - 14,
    margin: { left: pageW / 2, right: 14 },
  })

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text(labels.footer(summary.transactionCount), pageW / 2, pageH - 18, { align: 'center' })
  if (labels.complianceNotice) {
    doc.setFontSize(6)
    doc.setTextColor(90)
    const noticeLines = doc.splitTextToSize(labels.complianceNotice, pageW - 28)
    doc.text(noticeLines, pageW / 2, pageH - 12, { align: 'center' })
  }
  doc.setFontSize(6)
  doc.setTextColor(100)
  const disclaimerLines = doc.splitTextToSize(labels.legalDisclaimer, pageW - 28)
  doc.text(disclaimerLines, pageW / 2, pageH - 6, { align: 'center' })

  doc.save(`${labels.filenamePrefix}-${fileDate(period.start, timeZone)}.pdf`)
}
