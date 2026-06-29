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
  return payload?.error ?? t('publicMenu.checkoutError')
}
