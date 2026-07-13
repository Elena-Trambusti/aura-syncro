# Guida test automatici — Aura Syncro

> Sintesi rapida: [`tests/README.md`](../tests/README.md) · Panoramica progetto: [`README.md`](../README.md)

Stack usato nel monorepo:

| Tipo | Strumento | Cartella |
|------|-----------|----------|
| Logica / API / edge cases | **Vitest** (equivalente moderno di Jest) | `tests/` |
| Flusso browser (E2E) | **Playwright** | `frontend/e2e/` |
| Unit backend legacy | `tsx --test` | `backend/src/lib/*.test.ts` |

> Nota: il progetto usa già **Vitest** invece di Jest. L’API (`describe`, `it`, `expect`) è quasi identica.

---

## 1. Installazione (una tantum)

Dalla **root** del progetto:

```powershell
cd "c:\Users\Elena\Documents\progetto per App Ristorante"

# Dipendenze root + frontend + backend
npm install
npm install --prefix frontend
npm install --prefix backend

# Browser per Playwright (Chromium / Edge)
npm run test:e2e:install --prefix frontend
```

Assicurati che `backend/.env` contenga almeno:

- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET` — segreto sessione

Per i tenant demo (consigliato prima dei test):

```powershell
npm run db:seed-demo --prefix backend
```

---

## 2. Comandi principali

### Test logici (Vitest) — veloci, senza browser

```powershell
# Tutta la suite business + integrazione
npm run test:vitest

# Solo cartella business-logic
npm run test:business

# Solo API (tenant + ordini) — richiede backend su :3001
npm run test:api

# Watch mode durante sviluppo
npm run test:watch
```

### Test E2E (Playwright) — simula utente reale

**Locale** (avvia automaticamente backend :3001 + frontend :5173):

```powershell
npm run test:e2e --prefix frontend
```

**Contro produzione** (solo smoke / attenzione ai dati):

```powershell
$env:PLAYWRIGHT_BASE_URL="https://www.aurasyncro.com"
$env:E2E_EMAIL="admin@demo-it.com"
$env:E2E_PASSWORD="admin123"
$env:E2E_RESTAURANT_SLUG="demo-it"
npm run test:e2e --prefix frontend
```

### Tutto insieme

```powershell
npm run test:all
```

### Report HTML Playwright (dopo un run fallito)

```powershell
npm run test:e2e:report --prefix frontend
```

---

## 3. Cosa copre ogni suite

### `frontend/e2e/order-flow.spec.ts`
- Login UI
- Apertura `/tavoli`
- Click tavolo sulla mappa
- Aggiunta piatto al carrello
- Invio in cucina
- Verifica assenza schermate nere / error boundary

### `frontend/e2e/edge-cases.spec.ts`
- Carrello vuoto → nessun pulsante “Invia in cucina”
- Triple-click rapido su Invia → UI stabile

### `tests/business-logic/tenant-isolation.test.ts`
- `scopedWhere` / `tenantWhere`
- Header `X-Restaurant-Id` errato → 403
- Tenant A non modifica tavolo tenant B → 404/403
- `tenantPrisma` forza `restaurantId` (con DB)

### `tests/business-logic/order-api-edge-cases.test.ts`
- Schema Zod: items vuoti / invalidi
- `POST /api/orders` items `[]` → 400
- Doppio POST stessa `X-Idempotency-Key` → cached o 409

### `tests/business-logic/checkout-cash-api.test.ts`
- Schema Zod finalize / apertura cassa
- `GET /api/payments/checkout/:orderId` → riepilogo
- `POST /api/payments/finalize` CARD → ordine `PAID`
- Secondo finalize → `alreadyPaid: true`
- CASH senza turno aperto → `409 CASH_SESSION_REQUIRED`
- `POST /api/cash/session/open` + doppia apertura → 400
- CASH con cassa aperta → incasso OK
- Idempotency su finalize

### `frontend/e2e/checkout-cash.spec.ts`
- Tavolo → comanda → “Vai al pagamento” → checkout carta → ricevuta
- `/cassa` carica senza error boundary (turno aperto o chiuso)

### `frontend/e2e/premium-ops.spec.ts`
- `/impostazioni` — checklist conformità fiscale e sezione Print Agent
- `/menu` — pulsante import CSV visibile
- `/dashboard/onboarding` — verifica go-live o checklist sistema
- Mobile — claim/release tavolo occupato dopo comanda inviata

### `tests/business-logic/premium-ops-api.test.ts`
- `GET /api/health/ready` — probe DB (DigitalOcean readiness)
- `GET /api/restaurant/compliance-status` — score e checks
- `GET /api/restaurant/onboarding-readiness` — prerequisiti go-live
- `POST /api/restaurant/onboarding/go-live` — sblocco dashboard (o `alreadyComplete`)
- `GET /api/restaurant/print-agent` — stato pairing
- `POST /api/menu/import-csv` — import piatto + validazione 400
- `POST /api/tables/:id/claim` e `/release` — lock cameriere
- `GET /api/restaurant/audit-log` — trail OWNER

### `tests/business-logic/menu-csv-import.test.ts`
- Parser CSV `parseMenuCsv` — header, righe, errori prezzo

---

## 4. Variabili d’ambiente utili

| Variabile | Uso |
|-----------|-----|
| `E2E_EMAIL` / `E2E_PASSWORD` / `E2E_RESTAURANT_SLUG` | Credenziali Playwright + API |
| `E2E_EMAIL_A` / `E2E_EMAIL_B` | Due tenant per test isolamento |
| `API_BASE_URL` | Default `http://localhost:3001` |
| `PLAYWRIGHT_BASE_URL` | Default locale `http://localhost:5173` |
| `SKIP_API_TESTS=1` | Salta test HTTP (solo schema puri) |

---

## 5. Eseguire in background (PowerShell)

```powershell
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd ''c:\Users\Elena\Documents\progetto per App Ristorante''; npm run test:all' -WindowStyle Minimized
```

Oppure solo E2E:

```powershell
npm run test:e2e --prefix frontend 2>&1 | Tee-Object -FilePath test-e2e.log
```

---

## 6. Manutenzione

- Dopo modifiche alle API ordini → aggiorna `order-api-edge-cases.test.ts` (schema Zod mirror).
- Dopo cambi UI modale comanda → verifica selettori in `frontend/e2e/`.
- Prima di ogni release: `npm run test:all` verde in locale.
