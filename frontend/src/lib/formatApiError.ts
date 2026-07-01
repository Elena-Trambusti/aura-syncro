/**
 * Estrae messaggio errore API tradotto (i18n) da risposta axios/fetch.
 */
import type { TFunction } from 'i18next'
import { resolveApiErrorMessage, type ApiErrorPayload } from './apiError'

export function apiErrorPayload(err: unknown): ApiErrorPayload | null {
  if (!err || typeof err !== 'object') return null
  const data = (err as { response?: { data?: ApiErrorPayload } }).response?.data
  return data ?? null
}

export function formatApiError(t: TFunction, err: unknown, fallbackKey = 'errors.serverError'): string {
  return resolveApiErrorMessage(t, apiErrorPayload(err), fallbackKey)
}
