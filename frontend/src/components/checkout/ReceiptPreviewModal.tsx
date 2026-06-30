import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../lib/utils'
import { useFiscalRegime } from '../../contexts/AuthContext'
import { tRegime } from '../../lib/fiscalRegime'
import { X, Printer, Mail, CheckCircle2 } from 'lucide-react'
import { AuraDialog, AuraDialogFooter } from '@/components/ui/AuraDialog'

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
  receipt?: { emailSent?: boolean; emailTo?: string | null }
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
    <AuraDialog onClose={onClose} maxWidth="md" hideClose className="flex max-h-[90vh] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-bold text-pietra">{t('checkout.receiptTitle')}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-fumo hover:bg-white/[0.05]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-white/[0.08] bg-navy-surface/50 p-4 font-mono text-xs text-pietra">
            <p className="text-center text-sm font-bold">{restaurantName}</p>
            <p className="mt-1 text-center text-fumo">{t('checkout.transactionId', { id: result.transactionId })}</p>
            <div className="my-3 border-t border-dashed border-white/[0.1]" />
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
              <div className="flex justify-between border-t border-white/[0.1] pt-2 font-bold">
                <span>{tRegime(t, fiscal.taxRegion, 'table.collectedTotal')}</span>
                <span>{formatCurrency(row.total)}</span>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-fumo">
              {t('checkout.fiscalNote')}
            </p>
          </div>

          {result.splitBreakdown?.guests && result.splitBreakdown.guests.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-fumo">{t('checkout.splitBreakdown')}</p>
              {result.splitBreakdown.guests.map(g => (
                <div key={g.label} className="flex justify-between py-1 text-sm text-fumo">
                  <span>{g.label}</span>
                  <span>{formatCurrency(g.share)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      <AuraDialogFooter className="mt-0 flex gap-2 border-t border-white/[0.08] p-4 sm:flex-row">
        <button
          type="button"
          onClick={onPrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-3 text-sm font-semibold text-fumo hover:bg-white/[0.05]"
        >
          <Printer className="h-4 w-4" />
          {t('checkout.simulatePrint')}
        </button>
        <button
          type="button"
          onClick={onEmail}
          className="saas-btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm"
        >
          <Mail className="h-4 w-4" />
          {t('checkout.simulateEmail')}
        </button>
      </AuraDialogFooter>
    </AuraDialog>
  )
}
