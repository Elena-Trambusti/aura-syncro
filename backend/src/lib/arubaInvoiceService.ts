/**
 * Integrazione Aruba Fatturazione Elettronica — invio automatico XML a SDI.
 * Documentazione: https://fatturazioneelettronica.aruba.it/apidoc/v2/docs_EN.html
 *
 * Auth: POST {authUrl}/auth/signin (grant_type=password)
 * Invio: POST {apiUrl}/services/invoice/upload (XML base64 non firmato)
 */

export type ArubaFeConfig = {
  enabled: boolean
  authUrl: string
  apiUrl: string
  username: string
  password: string
  domain?: string
  credential?: string
}

export type ArubaUploadResult = {
  success: boolean
  mode: 'live' | 'mock' | 'disabled'
  uploadFileName?: string
  errorCode?: string
  errorMessage?: string
}

type ArubaTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

type CachedToken = {
  accessToken: string
  expiresAt: number
}

let tokenCache: CachedToken | null = null

export function loadArubaFeConfig(): ArubaFeConfig {
  return {
    enabled: process.env.ARUBA_FE_ENABLED === 'true',
    authUrl: process.env.ARUBA_FE_AUTH_URL?.trim() || 'https://auth.fatturazioneelettronica.aruba.it',
    apiUrl: process.env.ARUBA_FE_API_URL?.trim() || 'https://demows.fatturazioneelettronica.aruba.it',
    username: process.env.ARUBA_FE_USERNAME?.trim() || '',
    password: process.env.ARUBA_FE_PASSWORD?.trim() || '',
    domain: process.env.ARUBA_FE_DOMAIN?.trim(),
    credential: process.env.ARUBA_FE_CREDENTIAL?.trim(),
  }
}

export function isArubaFeConfigured(config: ArubaFeConfig = loadArubaFeConfig()): boolean {
  return config.enabled && !!config.username && !!config.password
}

async function fetchArubaToken(config: ArubaFeConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    username: config.username,
    password: config.password,
  })

  const response = await fetch(`${config.authUrl}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const payload = await response.json().catch(() => ({})) as ArubaTokenResponse & {
    error?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || response.statusText
    throw new Error(`ARUBA_AUTH_FAILED: ${detail}`)
  }

  const expiresIn = payload.expires_in ?? 3600
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  }

  return payload.access_token
}

function mockUploadResult(xmlContent: string): ArubaUploadResult {
  const suffix = Date.now().toString(36)
  return {
    success: true,
    mode: 'mock',
    uploadFileName: `IT_MOCK_${suffix}.xml`,
    errorMessage: `Mock upload (${xmlContent.length} bytes)`,
  }
}

/**
 * Invia fattura elettronica XML (non firmata) ad Aruba per trasmissione SDI.
 */
export async function submitElectronicInvoice(xmlContent: string): Promise<ArubaUploadResult> {
  const config = loadArubaFeConfig()

  if (!config.enabled) {
    console.info('[aruba-fe] Servizio disabilitato (ARUBA_FE_ENABLED=false)')
    return { success: false, mode: 'disabled', errorMessage: 'ARUBA_FE_DISABLED' }
  }

  if (!config.username || !config.password) {
    console.error('[aruba-fe] Credenziali mancanti (ARUBA_FE_USERNAME / ARUBA_FE_PASSWORD)')
    return { success: false, mode: 'disabled', errorMessage: 'ARUBA_FE_CREDENTIALS_MISSING' }
  }

  const isDemo = config.apiUrl.includes('demows.')
  if (isDemo && process.env.NODE_ENV === 'production') {
    console.warn('[aruba-fe] ATTENZIONE: endpoint demo in produzione — verifica ARUBA_FE_API_URL')
  }

  if (process.env.ARUBA_FE_MOCK_UPLOAD === 'true') {
    console.info('[aruba-fe] Mock upload attivo')
    return mockUploadResult(xmlContent)
  }

  try {
    const token = await fetchArubaToken(config)
    const dataFile = Buffer.from(xmlContent, 'utf-8').toString('base64')

    const requestBody: Record<string, string> = { dataFile }
    if (config.credential) requestBody.credential = config.credential
    if (config.domain) requestBody.domain = config.domain

    const response = await fetch(`${config.apiUrl}/services/invoice/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    })

    const result = await response.json().catch(() => ({})) as {
      errorCode?: string
      errorDescription?: string
      uploadFileName?: string
    }

    if (!response.ok || result.errorCode) {
      console.error('[aruba-fe] Upload fallito', {
        status: response.status,
        errorCode: result.errorCode,
        errorDescription: result.errorDescription,
      })
      return {
        success: false,
        mode: 'live',
        errorCode: result.errorCode || String(response.status),
        errorMessage: result.errorDescription || response.statusText,
      }
    }

    console.info('[aruba-fe] Fattura inviata', { uploadFileName: result.uploadFileName })

    return {
      success: true,
      mode: 'live',
      uploadFileName: result.uploadFileName,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ARUBA_UPLOAD_FAILED'
    console.error('[aruba-fe] Errore invio fattura:', message)
    return { success: false, mode: 'live', errorMessage: message }
  }
}

/** Alias esplicito richiesto dalla specifica */
export const ArubaInvoiceService = {
  loadConfig: loadArubaFeConfig,
  isConfigured: isArubaFeConfigured,
  submit: submitElectronicInvoice,
}
