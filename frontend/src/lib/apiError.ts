import type { TFunction } from 'i18next'
import { resolvePaymentErrorMessage } from './paymentErrors'

export type ApiErrorPayload = {
  error?: string
  code?: string
}

const COMMON_CODE_PREFIXES = ['checkout.errors.', 'apiErrors.'] as const

/** Mappa `code` API → messaggio i18n (checkout + errori comuni). */
export function resolveApiErrorMessage(
  t: TFunction,
  payload?: ApiErrorPayload | null,
  fallbackKey = 'errors.serverError',
): string {
  const code = payload?.code
  if (code) {
    for (const prefix of COMMON_CODE_PREFIXES) {
      const key = `${prefix}${code}`
      const translated = t(key, { defaultValue: '' })
      if (translated) return translated
    }
  }
  if (payload?.error) return payload.error
  return t(fallbackKey)
}

/** Alias per errori pagamenti/checkout. */
export function resolveCheckoutErrorMessage(
  t: TFunction,
  payload?: ApiErrorPayload | null,
): string {
  return resolvePaymentErrorMessage(t, payload)
}
