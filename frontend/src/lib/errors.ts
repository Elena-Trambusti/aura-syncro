import axios from 'axios'
import i18n from '../i18n'

export function formatApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data as { error?: string } | undefined
    if (apiError?.error) return apiError.error

    if (err.response?.status === 503) {
      return i18n.t('errors.apiNotConfigured')
    }
    if (err.response?.status === 502) {
      return i18n.t('errors.backendUnreachable')
    }
    if (err.response?.status === 405) {
      return i18n.t('errors.apiBlocked')
    }
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return i18n.t('errors.networkError')
    }
  }

  return i18n.t('errors.invalidCredentials')
}
