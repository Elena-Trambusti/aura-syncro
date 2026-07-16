import { prisma } from './prisma'
import { runPredictiveAnalysis } from './predictiveAI'
import { sendTelegramMessage } from './telegramBot'
import { logger } from './logger'

// Variabile per tenere traccia se abbiamo già inviato il report oggi
let lastSentDay = -1

export async function runTelegramDailyAlerts() {
  const now = new Date()
  
  // Eseguiamo il controllo alle 09:00 del mattino (orario locale server)
  if (now.getHours() === 9 && now.getDate() !== lastSentDay) {
    lastSentDay = now.getDate()
    
    logger.info('[Telegram Scheduler] Avvio invio alert predittivi mattutini...')
    
    try {
      // Troviamo tutti i ristoranti che hanno collegato Telegram
      const settings = await prisma.restaurantSettings.findMany({
        where: {
          telegramChatId: { not: null }
        },
        include: { restaurant: true }
      })
      
      for (const setting of settings) {
        if (!setting.telegramChatId) continue
        
        try {
          const result = await runPredictiveAnalysis(setting.restaurantId)
          if (result.alerts.length === 0) continue // Niente da dire
          
          for (const alert of result.alerts) {
            let icon = '🔔'
            if (alert.severity === 'critical') icon = '🚨'
            if (alert.severity === 'opportunity') icon = '📈'
            if (alert.severity === 'optimization') icon = '💡'

            let text = `${icon} <b>AI Alert: ${setting.restaurant.name}</b>\n\n`
            if (alert.ruleId === 'RULE_STOCK_WEEKEND') {
              text += `<b>Rischio Esaurimento Scorte</b>\nNel weekend sono previsti molti coperti. La tua giacenza di <b>${alert.params.item}</b> (${alert.params.qty} ${alert.params.unit}) non basterà.\nConsiglio: Ordina almeno <b>${alert.params.orderQty} ${alert.params.unit}</b> extra.`
            } else if (alert.ruleId === 'RULE_WEATHER_REDUCTION') {
              text += `<b>Variazione Meteo (Pioggia)</b>\nÈ prevista pioggia. Ti suggerisco di ridurre la preparazione di <b>${alert.params.item}</b> del ${alert.params.pct}%.`
            } else if (alert.ruleId === 'RULE_DISH_GROWTH') {
              text += `<b>Trend Positivo</b>\nLe vendite del piatto <b>${alert.params.dish}</b> sono cresciute del ${alert.params.pct}%. Sfrutta l'occasione!`
            } else if (alert.ruleId === 'RULE_WASTE_RISK') {
              text += `<b>Rischio Spreco</b>\nHai <b>${alert.params.qty}</b> di <b>${alert.params.item}</b> ma la stima di consumo per i prossimi 7 giorni è solo ${alert.params.demand}.`
            } else {
              text += `Alert generico per ${alert.ruleId}`
            }
            
            await sendTelegramMessage(setting.telegramChatId, text)
            // Pausa per evitare i limiti di Telegram (30 messaggi al secondo massimo)
            await new Promise(r => setTimeout(r, 1000))
          }
        } catch (err) {
          logger.error(`[Telegram Scheduler] Errore calcolo per ${setting.restaurant.name}:`, err)
        }
      }
      
      logger.info('[Telegram Scheduler] Invio completato.')
    } catch (err) {
      logger.error('[Telegram Scheduler] Errore generale:', err)
    }
  }
}
