/**
 * Genera e scarica un file CSV
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const sep = ';'
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(sep) || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    headers.map(escape).join(sep),
    ...rows.map(row => row.map(escape).join(sep)),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Stampa scontrino in una finestra di stampa
 */
export function printReceipt(order: {
  id: string
  table?: { number: number }
  type: string
  createdAt: string
  items: Array<{ menuItem: { name: string }; quantity: number; unitPrice: number }>
  subtotal: number
  tax: number
  total: number
  revenueAmount?: number
  tipAmount?: number
  paymentMethod?: string
}, restaurantName: string, options?: { taxLabel?: string; locale?: string; tipLabel?: string }): void {
  const locale = options?.locale ?? 'it-IT'
  const taxLabel = options?.taxLabel ?? 'IVA'
  const tipLabel = options?.tipLabel ?? 'Mancia'
  const formatEur = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
  const formatDt = (d: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

  const foodTotal = order.revenueAmount ?? (order.subtotal + order.tax)
  const tip = order.tipAmount ?? Math.max(0, order.total - foodTotal)

  const PAYMENT_LABELS: Record<string, string> = { CASH: 'Contanti', CARD: 'Carta', VOUCHER: 'Voucher', DIGITAL: 'Digitale' }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Scontrino #${order.id.slice(-6).toUpperCase()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 100%; max-width: 100%; margin: 0 auto; padding: 16px; box-sizing: border-box; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .total-row { font-size: 14px; font-weight: bold; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    @media print { body { width: 300px; max-width: 300px; } @page { margin: 5mm; } }
  </style>
</head>
<body>
  <div class="center">
    <h1>${restaurantName}</h1>
    <p>${formatDt(order.createdAt)}</p>
    <p>${order.table ? `Tavolo ${order.table.number}` : order.type === 'TAKEAWAY' ? 'Asporto' : 'Delivery'}</p>
    <p>Ordine #${order.id.slice(-6).toUpperCase()}</p>
  </div>
  <div class="separator"></div>
  ${order.items.map(item => `
    <div class="row">
      <span>${item.quantity}x ${item.menuItem.name}</span>
      <span>${formatEur(item.unitPrice * item.quantity)}</span>
    </div>
  `).join('')}
  <div class="separator"></div>
  <div class="row"><span>Subtotale</span><span>${formatEur(order.subtotal)}</span></div>
  <div class="row"><span>${taxLabel}</span><span>${formatEur(order.tax)}</span></div>
  <div class="row"><span>Totale ristorante</span><span>${formatEur(foodTotal)}</span></div>
  ${tip > 0 ? `<div class="row"><span>${tipLabel}</span><span>${formatEur(tip)}</span></div>` : ''}
  <div class="separator"></div>
  <div class="row total-row"><span>TOTALE INCASSATO</span><span>${formatEur(order.total)}</span></div>
  ${order.paymentMethod ? `<div class="row"><span>Pagamento</span><span>${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</span></div>` : ''}
  <div class="separator"></div>
  <div class="center">
    <p>Grazie per la visita!</p>
    <p style="font-size:10px;margin-top:4px;">Powered by Aura Syncro</p>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }
}

/** Esporta lista ordini in PDF (jsPDF) */
export function downloadOrdersPdf(options: {
  filename: string
  title: string
  subtitle: string
  headers: string[]
  rows: (string | number)[][]
  locale?: string
}): void {
  const { filename, title, subtitle, headers, rows, locale = 'it-IT' } = options
  if (rows.length === 0) return

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, 14, 26)
  doc.text(
    new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date()),
    pageW - 14,
    18,
    { align: 'right' },
  )

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows.map(r => r.map(String)),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [26, 29, 38], textColor: [212, 175, 55] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  doc.save(filename)
}
