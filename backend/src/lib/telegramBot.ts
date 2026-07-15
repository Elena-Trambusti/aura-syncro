import { createHmac, timingSafeEqual } from 'crypto'

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'AuraSyncroBot'

function pairingSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET || process.env.JWT_SECRET || null
}

/** First 16 hex chars of HMAC-SHA256(`telegram:${restaurantId}`, webhook/JWT secret). */
export function buildTelegramPairToken(restaurantId: string): string {
  const secret = pairingSecret()
  if (!secret) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET or JWT_SECRET required to build pair token')
  }
  return createHmac('sha256', secret)
    .update(`telegram:${restaurantId}`)
    .digest('hex')
    .slice(0, 16)
}

export function verifyTelegramPairToken(restaurantId: string, pairToken: string): boolean {
  try {
    const expected = buildTelegramPairToken(restaurantId)
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(String(pairToken || ''), 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Deep link: t.me/Bot?start=<restaurantId>_<pairToken> */
export function buildTelegramDeepLink(restaurantId: string): string {
  const token = buildTelegramPairToken(restaurantId)
  const payload = `${restaurantId}_${token}`
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(payload)}`
}

/** Constant-time compare of Telegram secret_token header vs TELEGRAM_WEBHOOK_SECRET. */
export function verifyTelegramWebhookSecret(headerValue: string | undefined): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(String(headerValue || ''), 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN non configurato nel file .env')
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Telegram] Errore invio messaggio:', errorData)
      return false
    }

    return true
  } catch (err) {
    console.error('[Telegram] Eccezione di rete:', err)
    return false
  }
}

/**
 * Registra il Webhook presso le API di Telegram in modo che Telegram invii gli eventi (es. messaggi /start)
 * al nostro backend. Chiamato all'avvio del server.
 * Passa secret_token da TELEGRAM_WEBHOOK_SECRET se presente.
 */
export async function setTelegramWebhook(baseUrl: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  const webhookUrl = `${baseUrl}/api/public/telegram-webhook`
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET

  try {
    const body: Record<string, string> = { url: webhookUrl }
    if (secretToken) {
      body.secret_token = secretToken
    } else {
      console.warn(
        '[Telegram] TELEGRAM_WEBHOOK_SECRET non impostato: webhook senza secret_token (solo non-production)',
      )
    }

    const url = `https://api.telegram.org/bot${token}/setWebhook`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as { ok?: boolean; description?: string }

    if (data.ok) {
      console.log(`[Telegram] Webhook registrato con successo: ${webhookUrl}`)
      return true
    }
    console.error('[Telegram] Errore registrazione Webhook:', data.description)
    return false
  } catch (err) {
    console.error('[Telegram] Eccezione durante setWebhook:', err)
    return false
  }
}
