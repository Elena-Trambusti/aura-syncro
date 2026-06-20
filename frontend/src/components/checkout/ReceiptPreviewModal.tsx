import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../lib/utils'
import { useFiscalRegime } from '../../contexts/AuthContext'
import { tRegime } from '../../lib/fiscalRegime'
import { X, Printer, Mail, CheckCircle2 } from 'lucide-react'

export interface CheckoutFinalizeResult {
  transactionId: string
  fiscal: {
    row: {
      baseImponible: number
      tax: number
      revenueAmount: number
      tipAmount: number
      total: number
      paymentMethod?: string | null
    }
  }
  order?: {
    id: string
    subtotal: number
    tax: number
    total: number
    revenueAmount?: number
    tipAmount?: number
    paymentMethod?: string
    table?: { number: number }
    type: string
    createdAt: string
    items: Array<{ menuItem: { name: string }; quantity: number; unitPrice: number }>
  }
  splitBreakdown?: {
    guests: Array<{ label: string; share: number }>
  }
  receipt?: { simulatedEmailSent?: boolean; emailTo?: string | null }
}

interface Props {
  result: CheckoutFinalizeResult
  restaurantName: string
  taxLabel: string
  onClose: () => void
  onPrint: () => void
  onEmail: () => void
}

export default function ReceiptPreviewModal({
  result,
  restaurantName,
  taxLabel,
  onClose,
  onPrint,
  onEmail,
}: Props) {
  const { t } = useTranslation()
  const fiscal = useFiscalRegime()
  const row = result.fiscal.row

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-900">{t('checkout.receiptTitle')}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-900">
            <p className="text-center text-sm font-bold">{restaurantName}</p>
            <p className="mt-1 text-center text-slate-500">{t('checkout.transactionId', { id: result.transactionId })}</p>
            <div className="my-3 border-t border-dashed border-slate-300" />
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>{tRegime(t, fiscal.taxRegion, 'table.taxableBase')}</span>
                <span>{formatCurrency(row.baseImponible)}</span>
              </div>
              <div className="flex justify-between">
                <span>{taxLabel}</span>
                <span>{formatCurrency(row.tax)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{tRegime(t, fiscal.taxRegion, 'table.restaurantTotal')}</span>
                <span>{formatCurrency(row.revenueAmount)}</span>
              </div>
              {row.tipAmount > 0 && (
                <div className="flex justify-between">
                  <span>{tRegime(t, fiscal.taxRegion, 'table.tip')}</span>
                  <span>{formatCurrency(row.tipAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-300 pt-2 font-bold">
                <span>{tRegime(t, fiscal.taxRegion, 'table.collectedTotal')}</span>
                <span>{formatCurrency(row.total)}</span>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-slate-500">
              {t('checkout.fiscalNote')}
            </p>
          </div>

          {result.splitBreakdown?.guests && result.splitBreakdown.guests.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{t('checkout.splitBreakdown')}</p>
              {result.splitBreakdown.guests.map(g => (
                <div key={g.label} className="flex justify-between py-1 text-sm text-slate-700">
                  <span>{g.label}</span>
                  <span>{formatCurrency(g.share)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onPrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            {t('checkout.simulatePrint')}
          </button>
          <button
            type="button"
            onClick={onEmail}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Mail className="h-4 w-4" />
            {t('checkout.simulateEmail')}
          </button>
        </div>
      </div>
    </div>
  )
}
