# Aura Syncro - Print Agent

Questo è il demone locale per la gestione della stampa termica (scontrini di cortesia e comande per cucina) su stampanti compatibili ESC/POS (es. Epson, Bixolon) in rete o USB.
Dato che il gestionale Aura Syncro è una Web App cloud (browser-based), non può inviare direttamente comandi nativi ESC/POS a stampanti locali. Questo Print Agent risolve il problema restando in ascolto tramite WebSocket.

## Requisiti
- Node.js installato (v16+) sul PC/Mac/Raspberry collegato alla stampante o connesso alla stessa LAN.
- (Opzionale) Zadig / driver libusb su Windows se si usa collegamento USB diretto (vedere documentazione `escpos-usb`).

## Configurazione
1. Copia il file `.env.example` in `.env` e inserisci l'ID del tuo ristorante.
2. Scegli se la stampante è USB o NETWORK e configura l'IP se necessario.

## Installazione e Avvio
```bash
npm install
npm start
```

Il terminale mostrerà "✅ Print Agent connesso al server Aura Syncro!". A questo punto puoi provare ad inviare un ordine dal tuo gestionale, e lo scontrino verrà stampato in automatico.
