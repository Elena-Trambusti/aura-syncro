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
 */
export async function setTelegramWebhook(baseUrl: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  const webhookUrl = `${baseUrl}/api/public/telegram-webhook`
  
  try {
    const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    const response = await fetch(url)
    const data: any = await response.json()
    
    if (data.ok) {
      console.log(`[Telegram] Webhook registrato con successo: ${webhookUrl}`)
      return true
    } else {
      console.error('[Telegram] Errore registrazione Webhook:', data.description)
      return false
    }
  } catch (err) {
    console.error('[Telegram] Eccezione durante setWebhook:', err)
    return false
  }
}
