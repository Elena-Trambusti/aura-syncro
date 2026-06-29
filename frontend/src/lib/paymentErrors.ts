import type { TFunction } from 'i18next'

type PaymentErrorPayload = {
  error?: string
  code?: string
}

/** Mappa `code` API pagamenti → messaggio i18n (fallback su error server). */
export function resolvePaymentErrorMessage(
  t: TFunction,
  payload?: PaymentErrorPayload | null,
): string {
  const code = payload?.code
  if (code) {
    const key = `checkout.errors.${code}`
    const translated = t(key, { defaultValue: '' })
    if (translated) return translated
  }
  if (payload?.error) return payload.error
  return t('checkout.paymentError')
}

export function isPaymentAlreadyPaid(payload?: PaymentErrorPayload | null): boolean {
  const code = payload?.code
  if (code === 'ORDER_ALREADY_PAID') return true
  const msg = (payload?.error ?? '').toLowerCase()
  return msg.includes('già pagato') || msg.includes('already paid')
}

export function isPaymentInProgress(payload?: PaymentErrorPayload | null): boolean {
  return payload?.code === 'PAYMENT_IN_PROGRESS'
}
