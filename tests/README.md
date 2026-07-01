# Aura Syncro — Test Suite

## Comandi

| Comando | Scope |
|---------|--------|
| `npm run test` | Tutta la suite (business + unit backend) |
| `npm run test:business` | Solo `/tests/business-logic` (soldi, tavoli, cucina) |
| `npm run test:unit` | Unit test in `backend/src/**/*.test.ts` |
| `npm run test:watch` | Vitest in modalità watch |
| `npm run test:e2e` | Playwright smoke (`frontend/e2e`) |

**CI GitHub Actions:** `.github/workflows/ci-tests.yml` — esegue Vitest + unit backend + typecheck su ogni PR.

## Split conto parziale (checkout)

- **Split + Contanti:** pulsante «Incassa quota» per ogni ospite; chiusura fiscale all'ultimo pagamento.
- **Split + Carta:** «Finalizza intero conto» in un unico passaggio.

## Prerequisiti

```bash
npm install                    # root — installa Vitest
npm install --prefix backend   # dipendenze backend + Prisma
cd backend && npx prisma generate
```

## Test di integrazione DB

`tests/business-logic/integration-db.test.ts` si esegue **solo** se `DATABASE_URL` è impostato.
Senza DB, i test unitari di dominio coprono comunque le invarianti critiche.

## Critical Business Tests

- **cassa.test.ts** — split 50€ al 50%, incasso parziale 25€, residuo matematico
- **tavoli.test.ts** — blocco FREE con ordine aperto (`TABLE_HAS_ACTIVE_ORDER`)
- **cucina-inventory.test.ts** — piatto esaurito, nessun ticket KDS fantasma
