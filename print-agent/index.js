require('dotenv').config()
const { io } = require('socket.io-client')
const escpos = require('escpos')

// Aggiungiamo i provider (USB e Network) supportati
escpos.Network = require('escpos-network')
escpos.USB = require('escpos-usb')

const AURA_WS_URL = process.env.AURA_WS_URL || 'http://localhost:3001'
const AURA_RESTAURANT_ID = process.env.AURA_RESTAURANT_ID
const PRINTER_TYPE = process.env.PRINTER_TYPE || 'USB' // USB o NETWORK
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.100' // Solo se NETWORK
const PRINTER_PORT = process.env.PRINTER_PORT || 9100

if (!AURA_RESTAURANT_ID) {
  console.error('❌ ERRORE: Manca AURA_RESTAURANT_ID nel file .env')
  process.exit(1)
}

// 1. Configurazione connessione stampante
let device
try {
  if (PRINTER_TYPE === 'NETWORK') {
    device = new escpos.Network(PRINTER_IP, PRINTER_PORT)
  } else {
    // Trova la prima stampante USB disponibile
    device = new escpos.USB()
  }
} catch (e) {
  console.error('❌ ERRORE: Impossibile trovare o connettersi alla stampante.', e.message)
  console.error('Assicurati che sia accesa e collegata correttamente (o che l\'IP sia giusto).')
  // Continuiamo comunque in "simulazione" per permettere al WebSocket di connettersi
}

const printer = device ? new escpos.Printer(device) : null

// 2. Connessione WebSocket ad Aura Syncro
console.log(`🔌 Connessione al server Aura Syncro (${AURA_WS_URL})...`)
const socket = io(AURA_WS_URL, {
  auth: {
    // Per un setup enterprise in futuro useremmo un API key dedicata al Print Agent.
    // Qui simuliamo l'header usato dal frontend.
  },
  extraHeaders: {
    'X-Restaurant-Id': AURA_RESTAURANT_ID,
  },
  reconnection: true,
  reconnectionDelay: 5000,
  reconnectionDelayMax: 30000,
})

socket.on('connect', () => {
  console.log('✅ Print Agent connesso al server Aura Syncro! ID:', socket.id)
})

socket.on('disconnect', () => {
  console.warn('⚠️ Disconnesso dal server. Ritento...')
})

// 3. Gestione Stampa Scontrino Cliente (Pagamento completato)
socket.on('print:receipt', (data) => {
  console.log('🖨️  Ricevuto scontrino cliente:', data.order.id)
  if (!device || !printer) return console.log('⚠️ Nessuna stampante configurata.')

  device.open((err) => {
    if (err) {
      console.error('❌ Errore apertura stampante:', err)
      return
    }

    const { order } = data
    
    printer
      .font('a')
      .align('ct')
      .style('b')
      .size(2, 2)
      .text('AURA SYNCRO')
      .text('Ristorante Demo')
      .size(1, 1)
      .text('P.IVA: 00000000000')
      .text('--------------------------------')
      .align('lt')
      .text(`Ordine #${order.id.slice(-6).toUpperCase()} - Tavolo ${order.table?.number || 'Asporto'}`)
      .text(`Data: ${new Date().toLocaleString()}`)
      .text('--------------------------------')

    // Articoli
    order.items.forEach(item => {
      if (item.status !== 'CANCELLED') {
         const name = item.menuItem?.name || 'Articolo'
         const line = `${item.quantity}x ${name}`.padEnd(24) + `€${(item.unitPrice * item.quantity).toFixed(2)}`
         printer.text(line)
         if (item.modifiers && item.modifiers.length > 0) {
           item.modifiers.forEach(mod => {
             printer.text(`  + ${mod.name}`)
           })
         }
      }
    })

    printer
      .text('--------------------------------')
      .align('rt')
      .text(`Subtotale: €${order.subtotal?.toFixed(2)}`)
      .text(`Tasse: €${order.tax?.toFixed(2)}`)
      .size(2, 2)
      .text(`TOTALE: €${order.total?.toFixed(2)}`)
      .size(1, 1)
      .align('ct')
      .text('--------------------------------')
      .text('Grazie per la visita!')
      .text('Powered by Aura Syncro')
      .feed(4)
      .cut()
      .close()
  })
})

// 4. Gestione Stampa Comanda Cucina
socket.on('print:kitchen', (data) => {
  console.log('🖨️  Ricevuta comanda cucina per ordine:', data.order.id)
  if (!device || !printer) return console.log('⚠️ Nessuna stampante configurata.')

  device.open((err) => {
    if (err) {
      console.error('❌ Errore apertura stampante:', err)
      return
    }

    const { order, newItem } = data
    
    printer
      .font('a')
      .align('ct')
      .style('b')
      .size(2, 2)
      .text('COMANDA CUCINA')
      .size(1, 1)
      .text('--------------------------------')
      .align('lt')
      .size(2, 2)
      .text(`TAVOLO ${order.table?.number || 'ASPORTO'}`)
      .size(1, 1)
      .text(`Ora: ${new Date().toLocaleString()}`)
      .text('--------------------------------')

    // Stampa o l'intero ordine (se appena creato) o solo l'item nuovo (se aggiunto)
    const itemsToPrint = newItem ? [newItem] : order.items

    itemsToPrint.forEach(item => {
      if (item.status !== 'CANCELLED') {
         const name = item.menuItem?.name || 'Articolo'
         printer.size(1, 2).text(`${item.quantity}x ${name}`)
         if (item.modifiers && item.modifiers.length > 0) {
           item.modifiers.forEach(mod => {
             printer.size(1, 1).text(`  - ${mod.name}`)
           })
         }
         if (item.notes) {
           printer.size(1, 1).text(`  * NOTE: ${item.notes}`)
         }
      }
    })

    printer
      .feed(4)
      .cut()
      .close()
  })
})
