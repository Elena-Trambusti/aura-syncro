# Third-Party Notices — Aura Syncro

Aura Syncro è software proprietario (vedi `LICENSE`). Questo documento elenca le principali
dipendenze open source utilizzate in produzione e le relative licenze.

> Generato a scopo di compliance. Per l'elenco completo: `npx license-checker --production` in `frontend/` e `backend/`.

## Licenza del progetto

- **Aura Syncro (codice applicativo):** Licenza Proprietaria — © Elena Trambusti. Tutti i diritti riservati.

## Frontend (runtime / bundle produzione)

| Licenza | Esempi di pacchetti | Note commerciali |
|---------|---------------------|------------------|
| MIT | React, Vite, TanStack Query, Axios, Recharts, Socket.IO client | Uso in software proprietario consentito |
| Apache-2.0 | (transitive) | Uso in software proprietario consentito |
| ISC | (transitive) | Uso in software proprietario consentito |
| BSD-2/3-Clause | (transitive) | Uso in software proprietario consentito |
| MPL-2.0 | Workbox (via `vite-plugin-pwa`) | File MPL non modificati: compatibile con distribuzione proprietaria. Se si modificano file MPL, le modifiche vanno condivise |
| BlueOak-1.0.0 | (transitive) | Permissiva |

**DevDependencies non distribuite:** `sharp` / `libvips` (LGPL-3.0-or-later) — solo build asset PWA, non incluso nel bundle servito ai clienti.

## Backend (runtime produzione)

| Licenza | Esempi di pacchetti | Note |
|---------|---------------------|------|
| MIT | Express, bcryptjs, jsonwebtoken, socket.io, zod, nodemailer | OK |
| Apache-2.0 | @prisma/client, @sentry/node, Stripe SDK | OK |
| ISC | (transitive) | OK |

## Print Agent (opzionale, on-premise)

| Licenza | Pacchetti |
|---------|-----------|
| MIT | escpos, escpos-network, escpos-usb, socket.io-client, dotenv |

## Obblighi di attribuzione

Le licenze permissive (MIT, ISC, BSD, Apache-2.0) richiedono generalmente la conservazione del copyright notice
nei file sorgente delle dipendenze (già presente in `node_modules`) e, per Apache-2.0, eventuale NOTICE file.

**Nessuna dipendenza GPL/AGPL** è presente nel percorso di distribuzione produzione verificato a luglio 2026.

## Contatti

Per domande su licenze: elenatrambusti2024@gmail.com
