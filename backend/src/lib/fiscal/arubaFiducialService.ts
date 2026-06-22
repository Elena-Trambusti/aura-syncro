import { createHash } from 'node:crypto'

/**
 * Predisposizione integrazione Aruba Fiduciary / Fatturazione Elettronica (Italia).
 * Marca temporale qualificata + sigillo elettronico su PDF libro registro.
 *
 * In produzione: sostituire i mock con chiamate API Aruba usando certificato .p12
 * o credenziali remote (ARUBA_FIDUCIAL_* in env).
 */

export type ArubaAuthMode = 'p12' | 'api_credentials'

export type ArubaSealRequest = {
  restaurantId: string
  documentType: 'FISCAL_REGISTER_PDF'
  pdfBuffer: Buffer
  fiscalRegion: 'ITALIA' | 'SPAGNA_PENINSULA' | 'ISOLE_CANARIE'
  metadata?: Record<string, string>
}

export type ArubaSealResult = {
  sealed: boolean
  mode: 'mock' | 'live'
  timestampToken?: string
  sealedPdfBase64?: string
  sealId?: string
  error?: string
}

export type ArubaConfig = {
  enabled: boolean
  authMode: ArubaAuthMode
  apiBaseUrl: string
  p12Path?: string
  p12Password?: string
  apiUser?: string
  apiPassword?: string
}

export function loadArubaConfig(): ArubaConfig {
  const enabled = process.env.ARUBA_FIDUCIAL_ENABLED === 'true'
  const authMode: ArubaAuthMode =
    process.env.ARUBA_FIDUCIAL_AUTH_MODE === 'p12' ? 'p12' : 'api_credentials'

  return {
    enabled,
    authMode,
    apiBaseUrl: process.env.ARUBA_FIDUCIAL_API_URL ?? 'https://api.aruba.it/fiduciary/v1',
    p12Path: process.env.ARUBA_FIDUCIAL_P12_PATH,
    p12Password: process.env.ARUBA_FIDUCIAL_P12_PASSWORD,
    apiUser: process.env.ARUBA_FIDUCIAL_API_USER,
    apiPassword: process.env.ARUBA_FIDUCIAL_API_PASSWORD,
  }
}

async function authenticateWithP12(config: ArubaConfig): Promise<{ token: string; expiresIn: number }> {
  if (!config.p12Path) {
    throw new Error('ARUBA_P12_PATH_MISSING')
  }
  return {
    token: `mock_p12_token_${Buffer.from(config.p12Path).toString('base64url').slice(0, 16)}`,
    expiresIn: 3600,
  }
}

async function authenticateWithApiCredentials(config: ArubaConfig): Promise<{ token: string; expiresIn: number }> {
  if (!config.apiUser || !config.apiPassword) {
    throw new Error('ARUBA_API_CREDENTIALS_MISSING')
  }
  return {
    token: `mock_api_token_${config.apiUser}`,
    expiresIn: 3600,
  }
}

async function getArubaAccessToken(config: ArubaConfig): Promise<string> {
  const session = config.authMode === 'p12'
    ? await authenticateWithP12(config)
    : await authenticateWithApiCredentials(config)
  return session.token
}

function mockTimestampDigest(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32)
}

/**
 * Applica marca temporale e sigillo elettronico qualificato al PDF.
 * Mock: restituisce token fittizio; live: POST /seal (contratto Aruba da attivare).
 */
export async function sealFiscalPdf(request: ArubaSealRequest): Promise<ArubaSealResult> {
  const config = loadArubaConfig()

  if (!config.enabled) {
    return {
      sealed: false,
      mode: 'mock',
      error: 'ARUBA_FIDUCIAL_DISABLED',
    }
  }

  if (request.fiscalRegion !== 'ITALIA') {
    return {
      sealed: false,
      mode: 'mock',
      error: 'ARUBA_SEAL_ITALY_ONLY',
    }
  }

  try {
    const token = await getArubaAccessToken(config)
    const sealId = `ARUBA-MOCK-${Date.now()}-${request.restaurantId.slice(0, 8)}`
    const timestampToken = `TST-${mockTimestampDigest(request.pdfBuffer)}`

    console.info('[aruba-fiducial] Mock sigillo applicato', {
      sealId,
      apiBaseUrl: config.apiBaseUrl,
      tokenPrefix: token.slice(0, 12),
      bytes: request.pdfBuffer.length,
    })

    return {
      sealed: true,
      mode: 'mock',
      sealId,
      timestampToken,
      sealedPdfBase64: request.pdfBuffer.toString('base64'),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ARUBA_SEAL_FAILED'
    return { sealed: false, mode: 'mock', error: message }
  }
}
