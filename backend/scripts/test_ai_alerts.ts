import dotenv from 'dotenv'
dotenv.config()
import { prisma } from '../src/lib/prisma'
import { runPredictiveAnalysis } from '../src/lib/predictiveAI'
import { sendTelegramMessage } from '../src/lib/telegramBot'
import { getDayI18nKey } from '../src/lib/predictiveEngine'

async function main() {
  console.log('🤖 Avvio Test Simulazione AI Predittiva e Telegram...')

  // 1. Troviamo un ristorante per il test (prendiamo il primo disponibile)
  const restaurant = await prisma.restaurant.findFirst({
    include: { settings: true }
  })

  if (!restaurant) {
    console.error('❌ Nessun ristorante trovato nel DB.')
    process.exit(1)
  }

  console.log(`\n🏢 Ristorante selezionato: ${restaurant.name} (ID: ${restaurant.id})`)

  // Seleziona il telegramChatId salvato nel DB, OPPURE fai un override per il test usando il .env
  const chatId = restaurant.settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID

  if (!chatId) {
    console.log('\n⚠️ Nessun Chat ID Telegram trovato per questo ristorante.')
    console.log('Per testare in locale senza il Webhook, aggiungi TELEGRAM_CHAT_ID=tuo_id nel file .env')
    console.log('Puoi usare "npx tsx scripts/get_telegram_chat_id.ts" per scoprire il tuo ID.')
    process.exit(1)
  }

  console.log(`📱 Chat ID di destinazione: ${chatId}`)
  console.log('\n⏳ Calcolo delle previsioni AI in corso (potrebbe richiedere qualche secondo)...')

  try {
    // 2. Esegue il vero motore dell'Intelligenza Artificiale
    const result = await runPredictiveAnalysis(restaurant.id)

    console.log(`\n✅ Previsioni completate! Trovati ${result.alerts.length} Alert.`)

    if (result.alerts.length === 0) {
      console.log('Nessun alert generato oggi. Forzo un messaggio di test per verificare la connessione...')
      await sendTelegramMessage(chatId, `🤖 <b>Test Aura Syncro</b>\nLa connessione Telegram funziona perfettamente!\nOggi non ci sono allerte o suggerimenti dall'AI per il ristorante ${restaurant.name}.`)
      console.log('✅ Messaggio di test inviato su Telegram!')
      return
    }

    // 3. Formatta e invia ogni alert su Telegram
    for (const alert of result.alerts) {
      let icon = '🔔'
      if (alert.severity === 'critical') icon = '🚨'
      if (alert.severity === 'opportunity') icon = '📈'
      if (alert.severity === 'optimization') icon = '💡'

      // Creiamo un testo leggibile estraendo i parametri. 
      // (Nel sistema reale useremmo la libreria di traduzione i18n, qui la simuliamo in italiano)
      let text = `${icon} <b>AI Alert: ${restaurant.name}</b>\n\n`

      if (alert.ruleId === 'RULE_STOCK_WEEKEND') {
        text += `<b>Rischio Esaurimento Scorte</b>\nNel weekend sono previsti molti coperti. La tua giacenza di <b>${alert.params.item}</b> (${alert.params.qty} ${alert.params.unit}) non basterà.\nConsiglio: Ordina almeno <b>${alert.params.orderQty} ${alert.params.unit}</b> extra.`
      } 
      else if (alert.ruleId === 'RULE_WEATHER_REDUCTION') {
        text += `<b>Variazione Meteo (Pioggia)</b>\nÈ prevista pioggia. Ti suggerisco di ridurre la preparazione di <b>${alert.params.item}</b> del ${alert.params.pct}%.`
      }
      else if (alert.ruleId === 'RULE_DISH_GROWTH') {
        text += `<b>Trend Positivo</b>\nLe vendite del piatto <b>${alert.params.dish}</b> sono cresciute del ${alert.params.pct}%. Sfrutta l'occasione!`
      }
      else if (alert.ruleId === 'RULE_WASTE_RISK') {
        text += `<b>Rischio Spreco</b>\nHai <b>${alert.params.qty}</b> di <b>${alert.params.item}</b> ma la stima di consumo per i prossimi 7 giorni è solo ${alert.params.demand}.`
      }
      else {
        text += `Alert generico per ${alert.ruleId}`
      }

      console.log(`\n📤 Invio Alert [${alert.severity}]: ${alert.ruleId}...`)
      
      const success = await sendTelegramMessage(chatId, text)
      if (success) {
        console.log(`✅ Alert inviato con successo!`)
      } else {
        console.log(`❌ Errore nell'invio dell'alert.`)
      }

      // Piccola pausa per non spammare le API di Telegram
      await new Promise(r => setTimeout(r, 1000))
    }

    console.log('\n🎉 Test completato!')

  } catch (err) {
    console.error('❌ Errore durante l\'esecuzione:', err)
  }
}

main()
