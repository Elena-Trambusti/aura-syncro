# Aura Syncro — Test Suite

Suite di test automatici del monorepo. **Guida completa:** [`../docs/TESTING.md`](../docs/TESTING.md)

---

## Stack

| Tipo | Strumento | Cartella |
|---|---|---|
| Logica business / API / edge cases | **Vitest** | `tests/business-logic/` |
| Flusso browser (E2E) | **Playwright** | `frontend/e2e/` |
| Unit backend legacy | `tsx --test` | `backend/src/lib/*.test.ts` |

---

## Comandi (dalla root)

| Comando | Scope |
|---|---|
| `npm run test:vitest` | Tutta la suite Vitest |
| `npm run test:business` | Solo `tests/business-logic/` |
| `npm run test:api` | Tenant isolation + ordini + cassa (richiede backend :3001) |
| `npm run test:watch` | Vitest in modalità watch |
| `npm run test:unit` | Unit test legacy in `backend/src/**/*.test.ts` |
| `npm run test:e2e` | Playwright (`frontend/e2e/`) |
| `npm run test:all` | Vitest + Playwright |

Installazione browser Playwright (una tantum):

```bash
npm run test:e2e:install --prefix frontend
```

---

## Prerequisiti

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
cd backend && npx prisma generate
```

`backend/.env` minimo: `DATABASE_URL`, `JWT_SECRET`.

Tenant demo consigliati prima dei test API/E2E:

```bash
npm run db:seed --prefix backend
# oppure
npx tsx src/seed.ts   # da backend/
```

Credenziali demo: `admin@demo-it.com` / `admin123` (vedi [`../README.md`](../README.md)).

---

## Cosa copre la suite

### Business logic (`tests/business-logic/`)

- **cassa.test.ts** — split conto, incasso parziale, residuo matematico
- **tavoli.test.ts** — blocco tavolo FREE con ordine aperto
- **cucina-inventory.test.ts** — piatto esaurito, nessun ticket KDS fantasma
- **tenant-isolation.test.ts** — isolamento multi-tenant, header `X-Restaurant-Id`
- **order-api-edge-cases.test.ts** — validazione Zod, idempotency
- **checkout-cash-api.test.ts** — finalize carta/contanti, sessione cassa
- **integration-db.test.ts** — solo se `DATABASE_URL` è impostato

### E2E (`frontend/e2e/`)

- **order-flow.spec.ts** — login → tavoli → comanda → cucina
- **edge-cases.spec.ts** — carrello vuoto, triple-click invio
- **checkout-cash.spec.ts** — pagamento e pagina cassa

---

## CI

`.github/workflows/ci-tests.yml` — su ogni PR:

- Vitest + unit backend + typecheck backend/frontend
- Job separato: Playwright smoke su produzione

---

## Variabili utili

| Variabile | Uso |
|---|---|
| `E2E_EMAIL` / `E2E_PASSWORD` / `E2E_RESTAURANT_SLUG` | Credenziali Playwright |
| `PLAYWRIGHT_BASE_URL` | Default `http://localhost:5173` |
| `API_BASE_URL` | Default `http://localhost:3001` |
| `SKIP_API_TESTS=1` | Salta test HTTP (solo schema puri) |

---

## Manutenzione

- Dopo modifiche API ordini → aggiornare `order-api-edge-cases.test.ts`
- Dopo cambi UI modale comanda → verificare selettori in `frontend/e2e/`
- Prima di ogni release: `npm run test:all` verde in locale
