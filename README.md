# ✨ Aura Syncro

> **Full-stack SaaS gestionale per ristoranti** — POS, cucina real-time, CRM, magazzino, marketing e AI predittiva in un'unica piattaforma.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

---

## Panoramica

**Aura Syncro** è un gestionale multi-tenant per ristoranti con:

| Area | Funzionalità |
|---|---|
| Operatività | Dashboard, POS/tavoli, ordini, cassa, menu, pagamenti, report base |
| Real-time | Socket.IO su tavoli, ordini, turni staff, waitlist |
| Growth | KDS, menu QR pubblico, prenotazioni, waitlist, analytics |
| Premium | CRM, fedeltà, marketing, AI predittiva, report fiscale, fatturazione elettronica |
| SaaS | Onboarding Stripe Premium, RBAC granulare, i18n (it/en/es/fr/de + `es-cn` Canarie) |
| Mobile | PWA installabile, TWA Android (Play Store), offline sync, push notifications |

---

## Architettura monorepo

```
aura-syncro/
├── backend/           # Express + Prisma + PostgreSQL + Socket.IO + Stripe
│   ├── prisma/        # schema e migrations
│   ├── src/routes/    # auth, orders, menu, tables, cash, invoices, webhooks…
│   ├── src/lib/       # taxEngine, fiscal (IT/ES/Canarie), predictiveEngine
│   └── docs/          # PRODUCT_SCOPE, PRODUCTION_LIVE_CUTOVER, DEMO_SCRIPT
├── frontend/          # React 19 + Vite + Tailwind + React Query + i18next
│   ├── src/pages/     # Dashboard, Tavoli, CRM, Billing, Report Fiscal…
│   ├── src/lib/       # fiscalPdf, fiscalRegime, standaloneApp, nativeSafeArea
│   ├── e2e/           # Playwright (ordini, cassa, premium ops, edge cases)
│   └── docs/          # android-premium-qa-matrix.md
├── print-agent/       # Daemon locale ESC/POS per stampa termica da PWA cloud
├── tests/             # Vitest — business logic, tenant isolation, API edge cases
├── docs/              # TESTING.md, informativa ospiti
├── contratto/         # Template contratto, riepilogo PDF, email benvenuto
├── .do/               # DigitalOcean App Platform (app.yaml)
└── .github/           # CI (Vitest, typecheck, Playwright smoke)
```

**Deploy attuale**

| Componente | Piattaforma | Note |
|---|---|---|
| Frontend | **Vercel** | Proxy `/api` e Socket.IO verso backend DO (`frontend/vercel.json`) |
| Backend | **DigitalOcean App Platform** | `.do/app.yaml`, migrazioni in `npm start`, readiness `/api/health/ready` |
| Database | **PostgreSQL** | `DATABASE_URL` + `DIRECT_URL` (pooler + direct per migrations) |

**Checklist deploy backend (ordine obbligatorio):**

1. Push su `main` → DigitalOcean builda e avvia il service `api`
2. `npm start` esegue `node scripts/migrate-production.mjs` poi il server
3. **`DIRECT_URL` obbligatorio** sul service API (porta 5432, non pooler 6543)
4. **Elimina il job `prisma-migrate`** dalla dashboard DO se ancora presente (Components → Destroy) — bloccava i deploy
5. Verifica: `npm run verify:production` (critici: health + login)
6. Dopo deploy completo: `VERIFY_PRODUCTION_STRICT=1 npm run verify:production --prefix backend`
7. Se login fallisce con `printAgentToken` → controllare **Runtime logs** del service `api` (migrate all'avvio)

---

## Stack

| Layer | Tecnologie |
|---|---|
| Backend | Node.js 20+, Express, Prisma, PostgreSQL, JWT, Zod, Stripe, Socket.IO, Sentry |
| Frontend | React 19, Vite, Tailwind CSS 4, TanStack Query, React Router, Recharts, Radix UI, Sonner |
| Real-time | Socket.IO + invalidazione cache tenant (`useTenantQueryKey`) |
| PWA | `vite-plugin-pwa`, service worker (`sw.ts`), offline queue, Web Push (VAPID) |
| Android | TWA (`com.aurasyncro.twa`) — wrapper web, nessun progetto Gradle nel repo |
| Test | Vitest (`tests/`), Playwright (`frontend/e2e/`), `tsx --test` (unit backend legacy) |

---

## Regime fiscale multi-regione

Ogni ristorante ha in `RestaurantSettings`:

| Campo | Valori | Effetto |
|---|---|---|
| `countryCode` | `IT` \| `ES` | Paese operativo |
| `taxRegion` | `IT_MAIN` \| `ES_PENINSULA` \| `ES_CANARIAS` | IVA vs IGIC, etichette PDF |
| `taxRate`, `taxId`, `defaultLocale` | — | Calcoli e report |

- Calcoli centralizzati in `backend/src/lib/taxEngine.ts`
- PDF e dashboard: `frontend/src/lib/fiscalPdf.ts`, `fiscalRegime.ts`
- Fatturazione elettronica IT: integrazione Aruba/SDI (`invoices` routes)

---

## PWA e app Android (TWA)

| Asset / modulo | Ruolo |
|---|---|
| `frontend/public/manifest.json` | Manifest PWA (`display: standalone`, `start_url: /login?pwa=1`) |
| `frontend/public/.well-known/assetlinks.json` | Digital Asset Links per TWA Play Store |
| `frontend/src/lib/standaloneApp.ts` | Rileva shell PWA/TWA/WebView (`android-app://` referrer) |
| `frontend/src/lib/nativeSafeArea.ts` | Misura `--safe-top` / `--safe-bottom` quando `env()` è 0 in WebView |
| `frontend/src/index.css` | Variabili `--safe-top-pad` / `--safe-bottom-pad` per sidebar, header, toast Sonner |
| `frontend/docs/android-premium-qa-matrix.md` | Checklist QA pre-release su dispositivi reali |

**Safe area (notch / status bar / gesture nav):** sidebar, topbar, toast e profilo utente usano `calc(var(--safe-top) + 1rem)` — 1rem in browser, inset nativo + 1rem in app Android a tutto schermo.

---

## Piani e accesso

| Tier | Accesso |
|---|---|
| **Free (registrato)** | Dashboard, Ordini, Menu, Pagamenti, Report — anteprima senza abbonamento |
| **Premium (Stripe €500 setup + €199/mo)** | Tutti i moduli: POS, CRM, AI, marketing, fedeltà, report fiscal, analytics, cassa |

Flusso checkout:

- `POST /api/checkout` → setup €500 + abbonamento €199/mo
- Webhook `POST /api/webhooks/stripe` attiva abbonamento e sblocca tutti i moduli

---

## Go-To-Market pilota (onboarding guidato)

### Flusso cliente

1. **Landing** (`/`) → Registrazione (`/register`) con regime fiscale IT/ES/Canarie
2. **Anteprima gratuita** — dashboard, ordini, menu, report (tier `unsubscribed`)
3. **Pagamento** — `/dashboard/billing` → Stripe Checkout (€500 + €199/mo)
4. **Onboarding guidato** — `/dashboard/onboarding` (form Tally + call Calendly)
5. **Sblocco operativo** — operatore chiama `POST /api/admin/setup-complete` (o UI `/platform-admin`)

### Checklist operatore (primo cliente pagante)

```bash
# 1. Verifica Stripe Live
cd backend && npm run stripe:verify

# 2. Sincronizza webhook su DigitalOcean
npm run stripe:sync-webhooks

# 3. Dopo pagamento cliente: sblocca dashboard
curl -X POST https://<backend>/api/admin/setup-complete \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"<id>"}'
```

Oppure usa **Platform Admin** nel frontend (`/platform-admin`, chiave `ADMIN_API_KEY` in sessione).

### Documenti commerciali

| Percorso | Contenuto |
|---|---|
| `CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.md` | Contratto integrale v2.0 |
| `contratto/` | Riepilogo esecutivo HTML, template email benvenuto — vedi `contratto/README.md` |
| `Aura_Syncro_Onboarding.md` | Playbook onboarding concierge |

### Variabili produzione obbligatorie

| Variabile | Note |
|---|---|
| `STRIPE_PRICE_SETUP` | Price ID setup €500 |
| `STRIPE_PRICE_SUBSCRIPTION` | Price ID ricorrente €199/mo |
| `ADMIN_API_KEY` | Sblocco concierge + API admin |
| `BACKEND_URL` | Su Vercel, proxy `/api` → backend |
| `SMTP_*` | Reset password e notifiche email |
| `VAPID_*` | Web Push (opzionale ma consigliato in produzione) |

---

## Installazione locale

### Prerequisiti

- Node.js **20+**
- PostgreSQL (locale o Supabase/Neon)

### Setup

```bash
git clone https://github.com/Elena-Trambusti/aura-syncro.git
cd aura-syncro

# Dipendenze monorepo
npm install
npm install --prefix frontend
npm install --prefix backend

# Backend
cd backend
cp .env.example .env
# Compila DATABASE_URL, JWT_SECRET, Stripe…

npx prisma generate
npx prisma db push    # oppure: npx prisma migrate dev
npx tsx src/seed.ts   # tenant demo IT / ES / Canarie

npm run dev

# Frontend (altro terminale)
cd ../frontend
cp .env.example .env
npm run dev
```

Su Windows: `.\avvia-app.ps1` oppure `npm run dev` dalla root avvia backend + frontend insieme.

### Credenziali demo (seed)

| Tenant | Email | Password |
|---|---|---|
| Italia (`IT_MAIN`) | `admin@demo-it.com` | `admin123` |
| Spagna penisola | `admin@demo-es.com` | `admin123` |
| Canarie (`ES_CANARIAS`) | `admin@demo-es-cn.com` | `admin123` |

> L'alias `admin@demo.it` è ancora accettato per compatibilità.

---

## Test automatici

Guida completa: [`docs/TESTING.md`](./docs/TESTING.md)

```powershell
# Vitest — logica business + API (veloce)
npm run test:vitest
npm run test:business
npm run test:api          # richiede backend su :3001

# Playwright E2E (avvia automaticamente :3001 + :5173)
npm run test:e2e

# Suite completa
npm run test:all
```

CI (`.github/workflows/ci-tests.yml`) — su ogni PR:

- Vitest + unit backend + typecheck backend/frontend
- Playwright smoke su produzione (`aurasyncro.com`)
- Playwright E2E autenticato (PostgreSQL + seed demo in CI)
- Su push `main`: `production-health` (`npm run verify:production`)

Verifica manuale post-deploy (tutti gli endpoint):

```powershell
$env:VERIFY_PRODUCTION_STRICT="1"
npm run verify:production
```

---

## Print agent (stampa termica locale)

Il modulo `print-agent/` è un daemon Node che collega la PWA cloud a stampanti ESC/POS via WebSocket sulla rete locale del ristorante.

**Pairing:** in Impostazioni → Print Agent, genera il token e inseriscilo in `AURA_PRINT_TOKEN` (vedi `.env.example`).

Vedi [`print-agent/README.md`](./print-agent/README.md) per installazione e configurazione.

---

## Operazioni Premium (audit, go-live, compliance)

| Endpoint | Ruolo | Descrizione |
|---|---|---|
| `GET /api/health/ready` | Pubblico | Readiness probe — ping DB PostgreSQL |
| `GET /api/restaurant/onboarding-readiness` | OWNER/MANAGER | Checklist automatica prerequisiti servizio |
| `POST /api/restaurant/onboarding/go-live` | OWNER | Sblocco self-service dashboard operativa |
| `GET /api/restaurant/compliance-status` | OWNER/MANAGER | Score conformità fiscale/operativa |
| `GET/POST /api/restaurant/print-agent` | OWNER/MANAGER | Token pairing Print Agent |
| `GET /api/restaurant/audit-log` | OWNER | Trail audit pagamenti, sconti, tavoli, go-live |
| `POST /api/menu/import-csv` | menu.manage | Import bulk menu da CSV |
| `POST /api/tables/:id/claim` | tables.status | Lock tavolo per cameriere |
| `POST /api/tables/:id/release` | tables.status | Release lock tavolo |
| `GET /api/customers/:id/timeline` | CRM | Timeline visite e ordini cliente |

**Migrazione:** `npx prisma migrate deploy` in `backend/` applica la baseline `20250620000000_init`. Su DB produzione già popolato, `scripts/ensure-baseline-migration.ts` segna la baseline come applicata senza rieseguire SQL.

---

## Variabili d'ambiente

### Backend (`backend/.env`)

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | PostgreSQL (connection pooler) |
| `DIRECT_URL` | PostgreSQL direct (migrations) |
| `JWT_SECRET` | Secret firma JWT |
| `FRONTEND_URL` | Origini CORS (comma-separated). Produzione: `https://aurasyncro.com,https://www.aurasyncro.com` |
| `STRIPE_SECRET_KEY` | Chiave segreta Stripe |
| `STRIPE_WEBHOOK_SECRET` | Verifica webhook |
| `STRIPE_PRICE_SETUP` | Price ID setup una tantum (€500) |
| `STRIPE_PRICE_SUBSCRIPTION` | Price ID abbonamento mensile (€199) |
| `ADMIN_API_KEY` | Endpoint admin (setup concierge, downgrade piano) |
| `PREMIUM_DEV_UNLOCK` | `true` in dev → bypass paywall Premium |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push notifications |

### Frontend (`frontend/.env`)

| Variabile | Descrizione |
|---|---|
| `VITE_API_URL` | URL backend (es. `http://localhost:3001`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chiave pubblica Stripe |
| `BACKEND_URL` | URL backend per proxy Vercel (produzione) |

---

## Database

Modelli principali: `Restaurant`, `User`, `Table`, `Order`, `MenuItem`, `Reservation`, `Customer`, `InventoryItem`, `Shift`, `WaitlistEntry`, `RestaurantSettings` (regime fiscale, Stripe, `planTier`), floor plan, chiusure fiscali, onboarding intake.

```bash
cd backend
npx prisma migrate dev      # sviluppo
npx prisma migrate deploy   # produzione
npx prisma studio           # UI esplorazione dati
```

Script root utili: `npm run db:seed`, `npm run db:migrate`, `npm run db:studio`.

---

## API principali

```
GET    /api/health                        # liveness
GET    /api/health/ready                  # readiness (DB ping)
POST   /api/auth/login | /api/auth/register
GET    /api/public/menu/:slug           # menu QR (consultazione)
POST   /api/public/reservations         # prenotazioni + caparra
GET    /api/tables
POST   /api/tables/:id/claim            # lock cameriere
POST   /api/tables/:id/release          # release lock
GET    /api/orders
GET    /api/cash                        # cassa, chiusure, split checkout
GET    /api/staff/shifts
GET    /api/waitlist
POST   /api/checkout                    # Premium (€500 + €199/mo)
POST   /api/webhooks/stripe
GET    /api/reports/fiscal              # report fiscale multi-regione
GET    /api/invoices                    # fatturazione elettronica (IT)
GET    /api/ai/predictive               # AI predittiva
POST   /api/menu/import-csv             # import bulk menu
GET    /api/restaurant/compliance-status
POST   /api/restaurant/onboarding/go-live
GET    /api/restaurant/audit-log        # OWNER
GET    /api/customers/:id/timeline      # CRM timeline
POST   /api/admin/setup-complete        # sblocco concierge (ADMIN_API_KEY)
POST   /api/push/subscribe              # Web Push
```

---

## Documentazione

| Percorso | Contenuto |
|---|---|
| [`README.md`](./README.md) | Panoramica progetto (questo file) |
| [`docs/TESTING.md`](./docs/TESTING.md) | Guida completa test automatici |
| [`frontend/README.md`](./frontend/README.md) | Frontend React, PWA, safe-area, deploy Vercel |
| [`print-agent/README.md`](./print-agent/README.md) | Stampa termica ESC/POS locale |
| [`tests/README.md`](./tests/README.md) | Sintesi suite Vitest + Playwright |
| [`contratto/README.md`](./contratto/README.md) | Contratti, PDF, email benvenuto |
| [`Aura_Syncro_Onboarding.md`](./Aura_Syncro_Onboarding.md) | Playbook onboarding concierge |
| [`frontend/docs/android-premium-qa-matrix.md`](./frontend/docs/android-premium-qa-matrix.md) | QA pre-release Android |
| [`backend/docs/`](./backend/docs/) | PRODUCT_SCOPE, cutover produzione, demo script |

---

## Licenza

Software proprietario — © 2026 Elena Trambusti. Vedere [LICENSE](./LICENSE).
