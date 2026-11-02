import type { TFunction } from 'i18next'

type ApiErrorPayload = {
  error?: string
  code?: string
}

export function resolvePublicOrderErrorMessage(
  t: TFunction,
  payload?: ApiErrorPayload | null,
): string {
  const code = payload?.code
  if (code) {
    const key = `publicMenu.errors.${code}`
    const translated = t(key, { defaultValue: '' })
    if (translated) return translated
  }
  // Solo stringhe: un errore di piattaforma {code,message} in un toast manda in crash React
  if (typeof payload?.error === 'string' && payload.error) return payload.error
  return t('publicMenu.checkoutError')
}
