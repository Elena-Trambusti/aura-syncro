# ✨ Aura Syncro

> **Full-stack SaaS gestionale per ristoranti** — POS, cucina real-time, CRM, magazzino, marketing e AI predittiva in un'unica piattaforma.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

---

## Panoramica

**Aura Syncro** è un gestionale multi-tenant per ristoranti con:

| Area | Funzionalità |
|---|---|
| Operatività | Dashboard, POS/tavoli, ordini, menu, pagamenti, report base |
| Real-time | Socket.IO su tavoli, ordini, turni staff, waitlist |
| Growth | KDS, menu QR pubblico, prenotazioni, waitlist, analytics |
| Pro | CRM, fedeltà, marketing, AI predittiva, report fiscale |
| SaaS | Onboarding Stripe Premium, upgrade Pro, RBAC granulare, i18n (it/en/es/fr/de) |

---

## Architettura

```
aura-syncro/
├── backend/          # Express + Prisma + PostgreSQL + Socket.IO + Stripe
│   ├── prisma/schema.prisma
│   └── src/routes/   # auth, orders, menu, tables, staff, waitlist, checkout, webhooks…
├── frontend/         # React 19 + Vite + Tailwind + React Query + i18next
│   └── src/
│       ├── pages/    # Dashboard, Tavoli, CRM, Billing, Report Fiscal…
│       ├── hooks/    # useRealtimeInvalidation, usePredictiveAI
│       └── lib/      # accessTier, queryKeys (tenant-scoped cache)
└── landing/          # Landing page statica
```

**Deploy attuale:** backend su DigitalOcean, frontend su Vercel.

---

## Stack

| Layer | Tecnologie |
|---|---|
| Backend | Node.js 24, Express, Prisma, **PostgreSQL**, JWT, Zod, Stripe, Socket.IO |
| Frontend | React 19, Vite, Tailwind, TanStack Query, React Router, Recharts, Radix UI |
| Real-time | Socket.IO (invalidazione cache tenant via `useTenantQueryKey`) |

---

## Piani e accesso

| Tier | Accesso |
|---|---|
| **Free (registrato)** | Dashboard, Ordini, Menu, Pagamenti, Report — anteprima senza abbonamento |
| **Premium (Stripe €500 setup + €199/mo)** | Tutti i moduli inclusi: POS, CRM, AI, marketing, fedeltà, report fiscal, analytics |

Flusso checkout:
- `POST /api/checkout` → setup €500 + abbonamento €199/mo (tutto incluso)
- Webhook `POST /api/webhooks/stripe` attiva abbonamento e sblocca tutti i moduli

---

## Installazione locale

### Prerequisiti

- Node.js 18+
- PostgreSQL (locale o Supabase/Neon)

### Setup

```bash
git clone https://github.com/Elena-Trambusti/aura-syncro.git
cd aura-syncro

# Backend
cd backend
npm install
cp .env.example .env
# Compila DATABASE_URL, JWT_SECRET, Stripe…

npx prisma generate
npx prisma db push    # oppure: npx prisma migrate dev
npx tsx src/seed.ts   # dati demo

npm run dev

# Frontend (altro terminale)
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

Su Windows: `.\avvia-app.ps1` avvia backend + frontend insieme.

### Credenziali demo

| Campo | Valore |
|---|---|
| Email | `admin@demo.it` |
| Password | `admin123` |

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
| `ADMIN_API_KEY` | Endpoint admin (setup concierge, downgrade piano) |
| `PREMIUM_DEV_UNLOCK` | `true` in dev → bypass paywall Premium |
| `PRO_PLAN_DEV_UNLOCK` | `true` in dev → bypass paywall Pro |

### Frontend (`frontend/.env`)

| Variabile | Descrizione |
|---|---|
| `VITE_API_URL` | URL backend (es. `http://localhost:3001`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chiave pubblica Stripe |

---

## Database

Modelli principali: `Restaurant`, `User`, `Table`, `Order`, `MenuItem`, `Reservation`, `Customer`, `InventoryItem`, `Shift`, `WaitlistEntry`, `RestaurantSettings` (inclusi `stripeSubscriptionId`, `stripeProSubscriptionId`, `planTier`).

```bash
cd backend
npx prisma migrate dev      # sviluppo
npx prisma migrate deploy   # produzione
npx prisma studio           # UI esplorazione dati
```

---

## API principali

```
POST   /api/auth/login | /api/auth/register
GET    /api/analytics/dashboard
GET    /api/orders | PATCH /api/orders/:id/status
POST   /api/orders/public          # menu QR (guest)
GET    /api/tables
GET    /api/staff/shifts
GET    /api/waitlist
POST   /api/checkout               # Premium (€500 setup + €199/mo, tutto incluso)
POST   /api/webhooks/stripe
GET    /api/reports/fiscal         # Premium
GET    /api/ai/predictive          # Premium
```

---

## Licenza

Software proprietario — © 2026 Elena Trambusti. Vedere [LICENSE](./LICENSE).
