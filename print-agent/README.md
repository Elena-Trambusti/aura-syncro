# Aura Syncro — Print Agent

Daemon locale per la stampa termica (scontrini di cortesia e comande cucina) su stampanti **ESC/POS** (Epson, Bixolon, ecc.) in rete o USB.

Il gestionale Aura Syncro è una **PWA cloud** (browser-based) e non può inviare comandi nativi ESC/POS alle stampanti della LAN. Il Print Agent resta in ascolto via **Socket.IO** e riceve i job di stampa dal backend.

Documentazione progetto: [`../README.md`](../README.md)

---

## Requisiti

- **Node.js 20+** sul PC/Mac/Raspberry collegato alla stampante o sulla stessa LAN
- Stampante ESC/POS (rete TCP porta 9100 o USB)
- (Opzionale) Zadig / driver libusb su Windows per USB diretto (vedi documentazione `escpos-usb`)

---

## Configurazione

1. Copia `.env.example` in `.env`
2. Compila le variabili:

| Variabile | Descrizione |
|---|---|
| `AURA_WS_URL` | URL backend (es. `https://api.aurasyncro.com` o `http://localhost:3001`) |
| `AURA_RESTAURANT_ID` | ID ristorante (DB o URL dashboard) |
| `PRINTER_TYPE` | `NETWORK` o `USB` |
| `PRINTER_IP` | IP stampante (solo `NETWORK`) |
| `PRINTER_PORT` | Porta TCP, default `9100` |

---

## Installazione e avvio

```bash
cd print-agent
npm install
npm start
```

In console: `✅ Print Agent connesso al server Aura Syncro!`

A questo punto gli ordini inviati dal gestionale (cucina / cortesia) vengono stampati automaticamente sulla stampante configurata.

---

## Deploy in sede

| Scenario | Raccomandazione |
|---|---|
| Ristorante con PC fisso | Avvio automatico all'accensione (Task Scheduler Windows, `systemd` Linux) |
| Raspberry Pi in cucina | Node LTS + `npm start` come servizio |
| Solo stampante di rete | Print Agent su qualsiasi dispositivo sulla stessa subnet |

Il Print Agent deve poter raggiungere sia il **backend Aura Syncro** (internet) sia la **stampante** (LAN).

---

## Troubleshooting

| Problema | Verifica |
|---|---|
| Non si connette al server | `AURA_WS_URL` corretto, firewall, `AURA_RESTAURANT_ID` valido |
| Stampa non parte | IP/porta stampante, ping da host Print Agent |
| USB non rilevata | Driver libusb / Zadig su Windows |
