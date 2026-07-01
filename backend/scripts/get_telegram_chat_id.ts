import dotenv from 'dotenv'
dotenv.config()

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('❌ ERRORE: Variabile TELEGRAM_BOT_TOKEN non trovata nel file .env')
    console.log('Assicurati di aver incollato la chiave di BotFather e aver salvato il file .env.')
    process.exit(1)
  }

  console.log('Cerco nuovi messaggi sul bot Telegram...')
  
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`
    const response = await fetch(url)
    const data = await response.json()

    if (!data.ok) {
      console.error('❌ Errore API Telegram:', data.description)
      process.exit(1)
    }

    if (data.result.length === 0) {
      console.log('⚠️ Nessun messaggio trovato.')
      console.log('Per favore apri l\'app di Telegram, vai nella chat del tuo bot, premi START o scrivigli un messaggio (es. "Ciao"), e poi riavvia questo script.')
      return
    }

    // Prende l'ultimo messaggio ricevuto
    const lastUpdate = data.result[data.result.length - 1]
    const chatId = lastUpdate.message?.chat?.id

    if (chatId) {
      const name = lastUpdate.message.chat.first_name || lastUpdate.message.chat.title || 'Utente'
      console.log(`\n✅ Messaggio ricevuto da: ${name}`)
      console.log(`\nIL TUO CHAT ID E': ${chatId}\n`)
      console.log(`Aggiungi questa riga al tuo file .env nel backend:\nTELEGRAM_CHAT_ID=${chatId}`)
    } else {
      console.log('Nessun chat_id decodificabile nell\'ultimo aggiornamento.')
    }
  } catch (error) {
    console.error('❌ Errore di rete:', error)
  }
}

main()
