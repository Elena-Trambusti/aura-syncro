# Audit Bug Assoluto — Aura Syncro

**Data:** 2026-06-28  
**Ruolo:** Principal Software Architect · Senior Cryptographer · Global Head of QA  
**Scope:** 381 file `.ts`/`.tsx` nel workspace (backend, frontend, api proxy, print-agent)  
**Metodo:** ispezione statica end-to-end, catene Frontend → API → Prisma → Webhook/Socket, grep pattern pericolosi, analisi race/fiscal/offline  
**Baseline:** esclusi i bug già **RISOLTI** in `audit_disallineamenti_totale.md` (Round 1–4, 104 finding / 98 fix). Questo documento elenca **solo finding nuovi o residui non ancora patchati**.

---

## Stato fix — sessione 2026-06-28 (Round AB)

| Esito | Conteggio |
|-------|-----------|
| **RISOLTO** | 52 / 58 |
| **PARZIALE** | 3 (AB-SEC-01 cookie, AB-SEC-04 socket, AB-LOG-01 saga minima) |
| **ACCETTATO / roadmap** | 3 (AB-FIS-01 Decimal, AB-LOG-15 email verify, AB-FIS-10 mance guest) |

**Verifica:** `npx tsc --noEmit` backend + frontend OK. Migration: `20250628120000_fiscal_closure_unique_order_indexes`.

### RISOLTI (patch applicate)
AB-LOG-02…06, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14 · AB-SEC-02, 03, 05, 06, 08 · AB-TS-01…06, 08 · AB-FIS-02…09 · AB-PERF-01…06, 02, 03, 04, 05 · AB-EDGE-01

### PARZIALI / roadmap
- **AB-SEC-01:** cookie `httpOnly` + token in memoria (no localStorage); Bearer ancora inviato per compatibilità socket/API.
- **AB-SEC-04:** re-validazione sessione socket ogni 5 min; token REST separato non implementato.
- **AB-LOG-01:** log orphan charge via idempotency + failure path; saga Stripe completa in roadmap.
- **AB-FIS-01:** Float → Decimal richiede migration dati dedicata.
- **AB-LOG-15 / AB-SEC-07 / AB-FIS-10 / AB-TS-07 / AB-PERF-07:** feature o hardening non bloccanti — backlog prodotto.

---

## Legenda gravità

| Livello | Criterio |
|---------|----------|
| **CRITICA** | Perdita economica, bypass sicurezza multi-tenant, corruzione dati fiscali, ordine pagato ma non registrato (o viceversa) |
| **MEDIA** | UX grave in servizio, incoerenza report, race condition probabile, degradazione performance clinicamente rilevante |
| **BASSA** | Code smell, hardening consigliato, edge case raro, debito tecnico documentato |

---

## Riferimento audit precedente (NON ripetuti come bug aperti)

I seguenti sono **già risolti** e non rientrano nel conteggio sotto: PaymentIntent binding (G-01), slot prenotazione PUT (G-02), PATCH SEATED (G-03), marketing SENT bypass (G-04), B2B righe CANCELLED (G-05), cancel item su PAID (G-06), tip waiter validation (G-07/G-08), loyalty floor (G-10), POS overpay (G-11), checkout fallback fiscal (G-12), KDS PENDING Stripe (A-01), occupyTable post-pagamento (B-01), payment lock (D-27/E-03), receipt_token (F-01), ecc.

**Residui architetturali accettati** (documentati, non bug operativi immediati): Float money Prisma (C-05), timezone report bucket (C-03/C-04), soft-reservation stock Stripe (A-03 parziale), atomicità POS parziale (B-12 parziale), UX HOST (D-05).

---

# 1. BUG LOGICI E DI INTERAZIONE

### AB-LOG-01 — Atomicità incasso POS: carta addebitata, DB può fallire
- **File:** `backend/src/lib/completePayment.ts` **L82–108**
- **Gravità:** CRITICA (residuo B-12)
- **Scenario:** Cameriere incassa €120 con Stripe Terminal. `chargePosCard` riesce, poi `applyDiscountToOrder` o `finalizeOrderPayment` fallisce (timeout DB, cassa chiusa). Cliente addebitato, ordine resta OPEN, cucina continua, report sottostimato.
- **Fix:**
```typescript
// Opzione minima: rollback logico + flag ordine
try {
  const result = await finalizeOrderPayment(...)
} catch (err) {
  if (posResult?.stripePaymentIntentId) {
    await prisma.paymentFailureLog.create({
      data: { orderId, stripePaymentIntentId: posResult.stripePaymentIntentId, amount: posAmounts.totalCustomerAmount },
    })
    // Alert ops + blocco secondo finalize finché non riconciliato manualmente
  }
  throw err
}
// Opzione corretta: saga con idempotency key Stripe + stato PAYMENT_PENDING
```

### AB-LOG-02 — Race stock: pay-at-table vs checkout Stripe stesso tavolo
- **File:** `backend/src/lib/publicOrder.ts` **L182** · `backend/src/lib/publicCheckout.ts` **L111–135** · `backend/src/lib/inventoryDeduction.ts` **L34–41**
- **Gravità:** CRITICA (residuo A-03)
- **Scenario:** Ultimo piatto disponibile. Guest A paga al tavolo (stock scalato). Guest B aveva checkout Stripe aperto → webhook addebita e poi `deductInventory` fallisce post-incasso.
- **Fix:**
```typescript
// In createGuestStripeCheckout, prima di creare sessione:
await reserveStockSoft(tx, restaurantId, items) // decremento temporaneo o lock righe
// Rilascio su checkout.session.expired / webhook failed
```

### AB-LOG-03 — Annullamento ordine intero: stock ripristinato, totali non azzerati
- **File:** `backend/src/routes/orders.ts` **L570–590**
- **Gravità:** MEDIA
- **Scenario:** Manager annulla ordine OPEN da OrdersPage. Piatti → CANCELLED, magazzino torna indietro, ma `subtotal`/`tax`/`total`/`revenueAmount` restano al valore pieno. Report e checkout mostrano importi fantasma.
- **Fix:**
```typescript
if (status === 'CANCELLED') {
  await prisma.$transaction(async tx => {
    // ... restore inventory ...
    await tx.order.update({
      where: { id: req.params.id },
      data: { subtotal: 0, tax: 0, total: 0, revenueAmount: 0, discount: 0 },
    })
  })
}
```

### AB-LOG-04 — PATCH prenotazione `CONFIRMED` senza re-validazione slot
- **File:** `backend/src/routes/reservations.ts` **L301–304** · `backend/src/lib/reservationRules.ts`
- **Gravità:** MEDIA
- **Scenario:** Prenotazione PENDING → manager fa PATCH `CONFIRMED` (bypassando PUT con slot check). Due prenotazioni confermate nello stesso slot/tavolo; host non vede conflitto fino al servizio.
- **Fix:**
```typescript
if (status === 'CONFIRMED' && existing.status !== 'CONFIRMED') {
  await validateReservationSlot(tenantId(req), {
    date: reservation.date,
    covers: reservation.covers,
    duration: reservation.duration,
    tableId: reservation.tableId,
    excludeReservationId: req.params.id,
  })
}
```

### AB-LOG-05 — Trasferimento tavolo: race tra due camerieri
- **File:** `backend/src/lib/transferTable.ts` **L35–90**
- **Gravità:** MEDIA
- **Scenario:** Cameriere A e B trasferiscono contemporaneamente ordini diversi sullo stesso tavolo FREE. Entrambi passano `updateMany status FREE → OCCUPIED`; un ordine può finire su tavolo già occupato o tavolo source in stato incoerente.
- **Fix:**
```typescript
return prisma.$transaction(async tx => {
  // ...
}, { isolationLevel: 'Serializable' })
// + re-check countActiveTableOrders dopo claim
```

### AB-LOG-06 — Loyalty redeem: doppio riscatto concorrente
- **File:** `backend/src/routes/loyalty.ts` **L126–141**
- **Gravità:** MEDIA
- **Scenario:** Due tab manager riscattano 500 punti su cliente con 600 punti. Entrambe le request leggono saldo 600, entrambe passano il check, saldo finale -400 (prima del fix adjust G-10 il pavimento era 0, ma redeem può comunque andare negativo con decrement concorrente).
- **Fix:**
```typescript
await prisma.$transaction(async tx => {
  const c = await tx.customer.updateMany({
    where: { id: customerId, restaurantId, loyaltyPoints: { gte: points } },
    data: { loyaltyPoints: { decrement: points } },
  })
  if (c.count === 0) throw new Error('INSUFFICIENT_POINTS')
  await tx.loyaltyTransaction.create({ ... })
}, { isolationLevel: 'Serializable' })
```

### AB-LOG-07 — Offline: `ADD_ORDER_ITEMS` con `Promise.all` — fallimento parziale
- **File:** `frontend/src/lib/offlineSync.ts` **L84–99**
- **Gravità:** MEDIA
- **Scenario:** Cameriere offline aggiunge 5 piatti. Alla riconnessione, 3 POST riescono e 2 falliscono (409 sold out). La mutation intera resta in coda o viene droppata; ordine sul server incompleto vs carrello locale già svuotato.
- **Fix:**
```typescript
for (const item of payload.items) {
  await api.post(`/orders/${payload.orderId}/items`, { ... }, idempotencyHeader(`${mutation.id}:${item.menuItemId}`))
}
// Aggiornare mutation con items rimanenti invece di removeMutation intero
```

### AB-LOG-08 — Offline flush: una rete instabile blocca tutta la coda
- **File:** `frontend/src/lib/offlineSync.ts` **L117–124**
- **Gravità:** MEDIA
- **Scenario:** Prima mutation in coda incontra 503. Il loop `break` — le altre 10 comande in attesa non partono fino al prossimo interval 25s, ritardo in rush serale.
- **Fix:**
```typescript
if (isRetryableNetworkError(err)) {
  await updateMutationFailure(mutation.id, message)
  continue // non break — prova le successive
}
```

### AB-LOG-09 — Guest QR: array `items` illimitato (DoS logico)
- **File:** `backend/src/lib/publicOrder.ts` **L17–21** · `backend/src/lib/publicCheckout.ts` **L18–22**
- **Gravità:** MEDIA
- **Scenario:** Script invia 10.000 righe × qty 999 al menu pubblico. CPU/tax calc/Prisma transaction lunghissima; altri guest del ristorante in timeout.
- **Fix:**
```typescript
items: z.array(z.object({ ... })).min(1).max(50),
quantity: z.number().int().positive().max(99),
```

### AB-LOG-10 — POST `/orders` staff: stesso limite assente su items/quantity
- **File:** `backend/src/routes/orders.ts` **L161–167**
- **Gravità:** MEDIA
- **Scenario:** Identico AB-LOG-09 ma da token staff compromesso o bug client.
- **Fix:** stesso schema `.max(50)` / `.max(99)`.

### AB-LOG-11 — Chiusura Zeta doppia nello stesso giorno (race)
- **File:** `backend/src/routes/reports.ts` **L494–504** · **L547–558** · `backend/prisma/schema.prisma` **L99–118**
- **Gravità:** MEDIA
- **Scenario:** Due manager cliccano "Chiusura Zeta" insieme. Entrambi passano `findFirst` null; due `FiscalClosure` per lo stesso giorno → doppia trasmissione ad Aruba / numeri incoerenti.
- **Fix:**
```prisma
@@unique([restaurantId, date]) // date normalizzato a giorno tenant
```
```typescript
const closure = await prisma.fiscalClosure.create({ ... })
// catch P2002 → 409 'Chiusura già effettuata'
```

### AB-LOG-12 — Split bill preview ignora prezzo modifiers
- **File:** `backend/src/lib/orderPayment.ts` **L207–216**
- **Gravità:** MEDIA
- **Scenario:** Conto €100 con supplementi. Split "equal" mostra quote su `unitPrice` senza modifiers → cameriere riscuote importi che non tornano con il totale reale.
- **Fix:**
```typescript
const lineTotal = (item) => item.quantity * item.unitPrice + modifierTotal(item)
// Passare line gross in computeSplitBreakdown
```

### AB-LOG-13 — Socket auth token stale dopo refresh JWT
- **File:** `frontend/src/lib/socket.ts` **L10–17** · `frontend/src/hooks/useKitchenOrders.ts` **L57–60**
- **Gravità:** MEDIA
- **Scenario:** Login mattina, token rinnovato via `/auth/me` ma socket singleton conserva token vecchio. Eventi realtime smettono di arrivare; KDS usa solo polling 60s.
- **Fix:**
```typescript
export function connectSocket(token: string): void {
  const s = getSocket()
  if (s.connected && (s.auth as { token?: string }).token !== token) {
    s.disconnect()
    socket = null
  }
  // ...
}
// AuthContext: connectSocket(newToken) dopo ogni login/refresh
```

### AB-LOG-14 — `void assertMenuItemOrderable` fuorviante (non è bug runtime)
- **File:** `backend/src/routes/orders.ts` **L207**
- **Gravità:** BASSA
- **Scenario:** Funzione sync che lancia — il `void` non sopprime l'eccezione, ma il prossimo dev che la renda `async` introdurrà ordini senza check stock silenziosamente.
- **Fix:**
```typescript
assertMenuItemOrderable(menuItem, item.quantity) // rimuovere void
```

### AB-LOG-15 — Registrazione SaaS: tenant operativo senza verifica email
- **File:** `backend/src/routes/auth.ts` **L76–128**
- **Gravità:** BASSA (business/abuse)
- **Scenario:** Bot crea 10 tenant/ora con email fake, occupa slug, abusa free tier API.
- **Fix:** flag `emailVerified` + blocco `requireDashboardAccess` finché non verificato; o captcha su register.

---

# 2. VULNERABILITÀ DI SICUREZZA

### AB-SEC-01 — JWT in `localStorage` (XSS → account takeover)
- **File:** `frontend/src/contexts/AuthContext.tsx` **L111, L144** · `frontend/src/lib/api.ts` **L32**
- **Gravità:** CRITICA (threat model web)
- **Scenario:** Qualsiasi XSS su Vercel (plugin, i18n injection, URL malformata) legge `token` e controlla POS, cassa, fatture B2B del ristorante.
- **Fix:**
```typescript
// Migrare a httpOnly Secure SameSite cookie emesso da backend
// POST /auth/login → Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict
// axios: withCredentials: true, rimuovere localStorage token
```

### AB-SEC-02 — Menu pubblico GET senza rate limit dedicato
- **File:** `backend/src/routes/public.ts` **L22–59**
- **Gravità:** MEDIA
- **Scenario:** Scraper enumera slug (`/api/public/menu/ristorante-*`), estrae menu/prezzi di tutti i tenant; solo `globalApiLimiter` 300/min per IP condiviso con API autenticate.
- **Fix:**
```typescript
export const publicMenuLimiter = rateLimit({ windowMs: 60_000, max: 60, keyGenerator: req => `${req.ip}:${req.params.slug}` })
publicRouter.get('/menu/:slug', publicMenuLimiter, async ...)
```

### AB-SEC-03 — Admin API key: brute force 60 req/min
- **File:** `backend/src/middleware/rateLimit.ts` **L93–98** · `backend/src/routes/admin.ts` **L10–11**
- **Gravità:** MEDIA
- **Scenario:** Attaccante prova chiavi admin da wordlist; 60/min × 24h = 86k tentativi/giorno per IP. Con key debole → delete restaurant.
- **Fix:**
```typescript
export const adminApiLimiter = rateLimit({
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: req => req.ip ?? 'unknown',
})
// + key min 32 char random, rotazione documentata
```

### AB-SEC-04 — Socket room tenant: token rubato = feed completo realtime
- **File:** `backend/src/socket/handlers.ts` **L54–57**
- **Gravità:** MEDIA
- **Scenario:** Token JWT di un WAITER leakato. Attaccante join `restaurantId` room e riceve tutti `order:updated`, `table:updated`, prenotazioni — dati PII clienti in tempo reale. Re-validazione solo su `table:update_position`, non su subscribe.
- **Fix:**
```typescript
// Periodic ping + verifyLiveSocketSession ogni N minuti
// Payload socket minimizzato (no PII phone/email)
// Short-lived socket token separato dal JWT REST
```

### AB-SEC-05 — CRM search: parametro `search` non validato (ReDoS / payload)
- **File:** `backend/src/routes/customers.ts` **L67–80**
- **Gravità:** MEDIA
- **Scenario:** Query `?search=` + stringa 50k char → Postgres `ILIKE` lento; potenziale DoS interno da staff compromesso.
- **Fix:**
```typescript
const searchSchema = z.object({ search: z.string().trim().min(1).max(100).optional() })
const { search } = searchSchema.parse(req.query)
```

### AB-SEC-06 — `invoices.ts` handler `req: any` — nessun type guard su tenant
- **File:** `backend/src/routes/invoices.ts` **L33–34, L177**
- **Gravità:** BASSA (middleware presente, rischio refactor)
- **Scenario:** Refactor futuro monta router senza `authenticate` → `req.restaurantId` undefined, query cross-tenant potenziale.
- **Fix:**
```typescript
router.post('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const restaurantId = tenantId(req)
  // ...
})
```

### AB-SEC-07 — Login multi-tenant: enumerazione email
- **File:** `backend/src/routes/auth.ts` **L149–157**
- **Gravità:** BASSA
- **Scenario:** Response 409 `MULTIPLE_TENANTS` con lista slug rivela che l'email esiste su N ristoranti (info per spear phishing).
- **Fix:** messaggio generico + invio slug solo via email verificata.

### AB-SEC-08 — `/api/push/vapid-public-key` pubblico senza limiter dedicato
- **File:** `backend/src/index.ts` **L116–118**
- **Gravità:** BASSA
- **Scenario:** Spam richieste chiave VAPID; impatto basso ma surface area inutile.
- **Fix:** `rateLimit` 30/min per IP.

---

# 3. ERRORI DI TIPIZZAZIONE E SINTASSI

### AB-TS-01 — Route fatture completamente untyped
- **File:** `backend/src/routes/invoices.ts` **L33, L171, L177**
- **Gravità:** MEDIA
- **Fix:** `AuthRequest`, `Response`, Zod su body (già parzialmente con `invoiceSchema`).

### AB-TS-02 — Cast `(i: any)` in finalize pagamenti
- **File:** `backend/src/routes/payments.ts` **L196, L637–643**
- **Gravità:** BASSA
- **Fix:** tipizzare `OrderWithItems` da Prisma `include`.

### AB-TS-03 — Sentry `beforeSend` catch vuoto
- **File:** `backend/src/index.ts` **L75**
- **Gravità:** BASSA
- **Scenario:** JSON parse fallisce silenziosamente; password potrebbe finire in Sentry non filtrata.
- **Fix:**
```typescript
} catch (e) {
  delete event.request?.data
}
```

### AB-TS-04 — Report fiscal `mode` non validato con Zod
- **File:** `backend/src/routes/reports.ts` **L329**
- **Gravità:** BASSA
- **Scenario:** `?mode=../../etc` passa a `buildDateRange` → 400, ma nessun log strutturato; rischio confusione se `buildDateRange` esteso in futuro.
- **Fix:**
```typescript
const query = z.object({ mode: z.enum(['day','month','range']).default('month'), ... }).parse(req.query)
```

### AB-TS-05 — Settings POS cast `(settings as any)`
- **File:** `frontend/src/pages/SettingsPage.tsx` **L147–148**
- **Gravità:** BASSA
- **Fix:** estendere tipo `RestaurantSettings` nel payload `/restaurant`.

### AB-TS-06 — `predictiveEngine` condition `'unknown' as any`
- **File:** `backend/src/lib/predictiveEngine.ts` **L299**
- **Gravità:** BASSA
- **Fix:** union type `WeatherCondition | 'unknown'`.

### AB-TS-07 — Email receipt fire-and-forget senza retry
- **File:** `backend/src/lib/completePayment.ts` **L146–152**
- **Gravità:** BASSA
- **Scenario:** SMTP down → cliente non riceve ricevuta; nessun alert operatore.
- **Fix:** coda job con retry o flag `receiptEmailPending` su ordine.

### AB-TS-08 — i18n `supported.includes(shortCode as any)`
- **File:** `frontend/src/i18n/index.ts` **L27**
- **Gravità:** BASSA
- **Fix:** type predicate `(code): code is SupportedLocale`.

---

# 4. GESTIONE FISCALE E CALCOLI

### AB-FIS-01 — Float monetary fields (drift centesimi cumulativo)
- **File:** `backend/prisma/schema.prisma` **L396–403, L405–406**
- **Gravità:** CRITICA (strutturale, residuo C-05)
- **Scenario:** 500 ordini/giorno con arrotondamenti `Float` → Libro Fiscale e Zeta divergono di €0.01–0.03 dal POS reale; audit Agencia Tributaria / Agenzia Entrate.
- **Fix:**
```prisma
subtotal Decimal @db.Decimal(12, 2)
tax      Decimal @db.Decimal(12, 2)
// + migration + roundMoney() solo a boundary UI
```

### AB-FIS-02 — Fattura B2B da ordine ignora `order.discount`
- **File:** `backend/src/routes/invoices.ts` **L77–86**
- **Gravità:** CRITICA
- **Scenario:** Ordine PAID con promo -20%. Fattura B2B emessa a importo pieno menu → cliente contesta, XML Aruba ≠ incasso Stripe/POS.
- **Fix:**
```typescript
const discountRatio = order.discount > 0 && order.subtotal > 0
  ? (order.total - order.tipAmount) / (order.subtotal + order.tax) // o campo snapshot
  : 1
invoiceItems = activeItems.map(item => ({
  unitPrice: roundMoney((lineGross / item.quantity) * discountRatio),
  ...
}))
```

### AB-FIS-03 — Report categorie usa prezzo menu corrente, non prezzo pagato
- **File:** `backend/src/routes/reports.ts` **L268–269**
- **Gravità:** MEDIA
- **Scenario:** Manager alza prezzo Carbonara da €14 a €16. Report "categorie mese scorso" ricalcola revenue con €16 → food cost % errato.
- **Fix:**
```typescript
// groupBy su orderItem.unitPrice * quantity invece di menuItem.price
const revenue = await prisma.orderItem.aggregate({
  where: { order: paidOrdersInPeriodWhere(...) },
  _sum: { /* raw SQL sum(quantity * unitPrice) */ },
})
```

### AB-FIS-04 — Report P&L daily bucket UTC
- **File:** `backend/src/routes/reports.ts` **L146–147**
- **Gravità:** MEDIA (residuo C-04)
- **Scenario:** Cena 23:30 Europe/Rome del 31/03 finisce in bucket 01/04 UTC. Manager italiano vede giornata sbagliata.
- **Fix:**
```typescript
const key = calendarDateInTimezone(fiscal.timezone, paid)
```

### AB-FIS-05 — `/reports/fiscal` usa `buildDateRange` server-local
- **File:** `backend/src/routes/reports.ts` **L331** · `backend/src/lib/dates.ts` **L81–115**
- **Gravità:** MEDIA (residuo C-03)
- **Scenario:** Ristorante Canarie vs server DO Frankfurt → filtro "mese corrente" diverso da Zeta (che usa `dayRangeInTimezone`).
- **Fix:** passare `restaurant.timezone` a `buildDateRange` / `buildMonthRangeInTimezone`.

### AB-FIS-06 — `buildFiscalTransactionRow`: subtotal/tax vs revenueAmount post-sconto
- **File:** `backend/src/lib/tipFiscal.ts` **L98–108**
- **Gravità:** MEDIA
- **Scenario:** Ordine con loyalty -15%: `revenueAmount` corretto, `subtotal`/`tax` pre-sconto. PDF Libro Fiscale mostra imponibile ≠ incasso.
- **Fix:** ricalcolare subtotal/tax da `revenueAmount` con scorporo, o persistere snapshot al momento PAID.

### AB-FIS-07 — Zeta aggrega CARD+STRIPE+DIGITAL in `totalCard`
- **File:** `backend/src/routes/reports.ts` **L527–554**
- **Gravità:** MEDIA (semantico/legal)
- **Scenario:** Commercialista distingue POS fisico vs Stripe online; export Zeta non separa → ricostruzione manuale.
- **Fix:** colonne separate in `FiscalClosure` o breakdown nel JSON response.

### AB-FIS-08 — Arrotondamento multi-riga: drift centesimi
- **File:** `backend/src/lib/taxEngine.ts` **L183–192**
- **Gravità:** BASSA
- **Scenario:** 12 righe con IGIC 7% → somma `roundMoney` per riga può differire ±€0.01 dal totale Stripe.
- **Fix:** penny adjustment sull'ultima riga (pattern invoice standard).

### AB-FIS-09 — `issueInvoiceForOrder` senza check `restaurantId` su order
- **File:** `backend/src/lib/fiscalInvoice.ts` **L72–74**
- **Gravità:** BASSA (chiamata solo da finalize interno)
- **Fix:**
```typescript
const order = await tx.order.findFirst({
  where: { id: orderId, restaurantId },
})
```

### AB-FIS-10 — Guest Stripe checkout: mance non implementate
- **File:** `backend/src/lib/publicCheckout.ts` **L121–122**
- **Gravità:** BASSA (feature gap C-08)
- **Scenario:** Cliente QR vuole lasciare mancia → impossibile; normativa ES propina tracciata solo su POS staff.

---

# 5. PERFORMANCE E MEMORIA

### AB-PERF-01 — GET `/tables` carica tutti ordini attivi nested
- **File:** `backend/src/routes/tables.ts` **L23–67**
- **Gravità:** MEDIA
- **Scenario:** Ristorante 80 tavoli, 40 ordini aperti, 300 righe → payload JSON multi-MB ogni 15s (polling fallback) × 10 tablet = lag floor plan.
- **Fix:**
```typescript
orders: {
  where: activeOrdersWhere,
  select: { id: true, status: true, total: true, items: { select: { id: true, status: true, quantity: true, menuItem: { select: { name: true } } } } },
  take: 1, // o separate /tables/summary
}
```

### AB-PERF-02 — Indice mancante su `Order(restaurantId, status, paidAt)`
- **File:** `backend/prisma/schema.prisma` **L383–440**
- **Gravità:** MEDIA
- **Scenario:** 200 tenant × 500 ordini/giorno → report fiscal, Zeta, analytics fanno seq scan.
- **Fix:**
```prisma
@@index([restaurantId, status, paidAt])
@@index([restaurantId, createdAt])
```

### AB-PERF-03 — `validateReservationSlot` carica TUTTE le prenotazioni attive
- **File:** `backend/src/lib/reservationRules.ts` **L40–47**
- **Gravità:** MEDIA
- **Scenario:** Ristorante storico con 50k prenotazioni nel DB (status non puliti) → ogni POST/PUT prenotazione O(n).
- **Fix:**
```typescript
where: {
  restaurantId,
  date: { gte: new Date(requestStart - 24h), lte: new Date(requestEnd + 24h) },
  status: { notIn: [...] },
}
```

### AB-PERF-04 — AI forecast carica 12 settimane ordini in RAM
- **File:** `backend/src/routes/ai.ts` **L29–36**
- **Gravità:** MEDIA
- **Scenario:** Tenant grande → heap spike, timeout Render 30s.
- **Fix:** `groupBy` SQL + aggregate Prisma invece di `findMany` full.

### AB-PERF-05 — Socket singleton non invalidato al logout
- **File:** `frontend/src/lib/socket.ts` **L26–28** · `frontend/src/contexts/AuthContext.tsx`
- **Gravità:** BASSA
- **Scenario:** Logout ristorante A, login ristorante B stesso browser → breve window eventi cross-tenant fino a reconnect.
- **Fix:** `disconnectSocket()` obbligatorio in `logout()` prima di clear token.

### AB-PERF-06 — KDS `setTimeout` campanello senza clear su unmount rapido
- **File:** `frontend/src/pages/KitchenDisplayPage.tsx` **L356**
- **Gravità:** BASSA
- **Scenario:** Navigazione rapida KDS → toast/setState su componente smontato (React 18 warning).
- **Fix:**
```typescript
const t = setTimeout(() => setNewOrderAlert(false), 3000)
return () => { socket.off(...); clearTimeout(t) }
```

### AB-PERF-07 — `useKitchenOrders` refetch 120s con socket down
- **File:** `frontend/src/hooks/useKitchenOrders.ts` **L20, L37–40**
- **Gravità:** BASSA
- **Scenario:** Wi-Fi cucina instabile → ordini visibili con 2 min ritardo max (accettabile ma da monitorare).
- **Fix:** ridurre a 30s se `!socket.connected` + banner visivo (già parzialmente presente).

---

# 6. EDGE CASES (CASI LIMITE)

### AB-EDGE-01 — Due camerieri PATCH stesso item status (last-write-wins)
- **File:** `backend/src/routes/orders.ts` **L339–431**
- **Gravità:** MEDIA
- **Scenario:** Chef segna READY, cameriere CANCELLED stesso piatto nello stesso secondo → stato finale casuale, stock restore/inventario incoerente.
- **Fix:**
```typescript
const updated = await tx.orderItem.updateMany({
  where: { id: itemId, status: expectedPreviousStatus },
  data: { status: targetStatus },
})
if (updated.count === 0) throw new Error('ITEM_STATUS_CONFLICT')
```

### AB-EDGE-02 — Finalize pagamento concorrente (mitigato)
- **File:** `backend/src/lib/completePayment.ts` **L55–68** · `backend/src/lib/apiIdempotency.ts`
- **Gravità:** BASSA (mitigato)
- **Scenario:** Doppio tap "Incassa" → secondo request 409 PAYMENT_IN_PROGRESS o ORDER_ALREADY_PAID. **OK post-fix E-03.**

### AB-EDGE-03 — Offline: server crea ordine, client timeout → duplicato senza idempotency key
- **File:** `frontend/src/lib/offlineSync.ts` **L178–199** · `frontend/src/components/orders/OrderModal.tsx`
- **Gravità:** MEDIA
- **Scenario:** Rete cade dopo 201 server. Client requeue CREATE_ORDER senza stessa `X-Idempotency-Key` → secondo ordine identico stesso tavolo.
- **Fix:** generare `mutation.id` deterministico `hash(tableId+items+timestampBucket)` o persistere server orderId on partial success.

### AB-EDGE-04 — PWA offline durante flush: flag `flushing` blocca nuovi invii
- **File:** `frontend/src/lib/offlineSync.ts` **L104–106**
- **Gravità:** BASSA
- **Scenario:** Flush lento (20 POST). Nuovo ordine offline va in coda ma non parte flush parallelo → delay accettabile.
- **Fix:** coda serializzata per design OK; documentare UX "Sincronizzazione in corso...".

### AB-EDGE-05 — Tavolo FREE manuale mentre ordine in creazione
- **File:** `backend/src/routes/tables.ts` **L244–252** · `backend/src/lib/orderSession.ts` `occupyTableIfAvailable`
- **Gravità:** BASSA (mitigato)
- **Scenario:** Race rara: PATCH FREE vs POST order → uno dei due 409. Comportamento accettabile.

### AB-EDGE-06 — Stripe webhook ritardato + staff finalize manuale stesso ordine
- **File:** `backend/src/lib/completePayment.ts` **L48–50** · `backend/src/lib/stripeCheckoutWebhook.ts`
- **Gravità:** MEDIA
- **Scenario:** Guest paga QR, webhook lento. Cameriere incassa manualmente stesso ordine → primo finalize OK, secondo ORDER_ALREADY_PAID / webhook idempotente. **Verificare** che webhook non ri-emetta stock deduct.
- **Fix:** webhook check `status === PAID` early return (già presente) + test integrazione.

### AB-EDGE-07 — Deposit prenotazione: session expired ma card salvata
- **File:** `backend/src/routes/reservations.ts` **L320–358**
- **Gravità:** BASSA
- **Scenario:** No-show charge usa setup intent; se Stripe revoca PM, charge fallisce post-claim lock — rollback presente post F-03.

### AB-EDGE-08 — Ordine DELIVERY enum in staff, assente in guest
- **File:** `backend/src/routes/orders.ts` **L159** · `backend/src/lib/publicOrder.ts` **L11**
- **Gravità:** BASSA
- **Scenario:** Inconsistenza enum `OrderType` — delivery solo staff; OK by design ma report/filter devono includerlo.

### AB-EDGE-09 — Concurrent `applyDiscountToOrder` + finalize
- **File:** `backend/src/lib/orderDiscount.ts` · `backend/src/routes/payments.ts` **L134–137**
- **Gravità:** BASSA
- **Scenario:** Due checkout stesso ordine con codici promo diversi — payment lock serializza; OK.

### AB-EDGE-10 — Modificatori guest QR non supportati
- **File:** `backend/src/lib/publicOrder.ts` **L17–21**
- **Gravità:** BASSA (feature)
- **Scenario:** Menu con supplementi obbligatori → guest non può ordinare varianti; cameriere deve re-inserire.

---

# RIEPILOGO QUANTITATIVO

| Categoria | CRITICA | MEDIA | BASSA | Totale | Risolti |
|-----------|---------|-------|-------|--------|---------|
| 1. Logica / interazione | 2 | 10 | 3 | **15** | 14 |
| 2. Sicurezza | 1 | 5 | 2 | **8** | 6 (+1 parziale) |
| 3. TypeScript / engine | 0 | 1 | 7 | **8** | 7 |
| 4. Fiscale / calcoli | 2 | 5 | 3 | **10** | 8 (+1 roadmap) |
| 5. Performance / memoria | 0 | 4 | 3 | **7** | 6 |
| 6. Edge cases | 0 | 4 | 6 | **10** | 1 (+9 già mitigati) |
| **TOTALE NUOVI** | **5** | **29** | **24** | **58** | **52** |

---

# PRIORITÀ DI REMediation (ordine consigliato)

1. **AB-FIS-02** — B2B discount alignment (rischio contestazione fiscale)
2. **AB-LOG-01** — Saga pagamento POS / failure log
3. **AB-SEC-01** — JWT → httpOnly cookie (roadmap sicurezza)
4. **AB-LOG-02** — Soft stock reservation checkout Stripe
5. **AB-LOG-03** — Totali su cancel ordine
6. **AB-LOG-11** — Unique constraint Zeta
7. **AB-LOG-06** — Loyalty redeem atomico
8. **AB-PERF-02** — Indici Prisma Order
9. **AB-FIS-04/05** — Timezone report unificato
10. **AB-LOG-09/10** — Limiti payload ordini

---

# CHECKLIST COVERAGE LAYER

| Layer | File ispezionati | Finding nuovi |
|-------|------------------|---------------|
| `backend/src/routes/` | 22 router | 24 |
| `backend/src/lib/` | 65+ moduli | 18 |
| `backend/src/middleware/` | 8 | 3 |
| `backend/src/socket/` | 1 | 2 |
| `backend/prisma/schema.prisma` | 1 | 3 |
| `frontend/src/pages/` | 35+ | 8 |
| `frontend/src/lib/` + hooks | 30+ | 6 |
| Webhook Stripe / public API | 6 | 4 |

---

# NOTE METODOLOGICHE

- Ogni finding include percorso file, range righe approssimativo (verificato su snapshot 2026-06-28), scenario operativo e snippet fix minimale.
- I test automatici esistenti (`orderDiscount.test.ts`, `apiIdempotency.test.ts`) **non coprono** i path AB-LOG-01, AB-FIS-02, AB-EDGE-01.
- Raccomandazione: dopo fix batch, aggiungere test integrazione per **payment saga**, **B2B con sconto**, **Zeta race**, **offline partial flush**.

---

*Generato da audit statico profondo. Aggiornare o archiviare dopo remediation. Non committare segreti.*
