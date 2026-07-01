# Audit Logica di Business e Integrità Stati — Aura Syncro

**Data audit:** 1 luglio 2026  
**Ambito:** Tutti i moduli del menu laterale (`Sidebar.tsx`)  
**Metodologia:** Ispezione statica frontend/backend, Prisma schema, flussi transazionali, socket/polling, regime fiscale multi-tenant IT/ES.

**Legenda stato:**
- **Conforme** — Logica coerente, edge case gestiti
- **Rischioso** — Funziona in condizioni normali ma fallisce in scenari reali di servizio
- **Con Bug** — Comportamento errato verificato nel codice

**Legenda fix:** ✅ = corretto in questo audit | ⚠️ = parziale / follow-up consigliato | — = nessun intervento richiesto

---

## Riepilogo esecutivo

| Modulo | Stato pre-audit | Stato post-fix |
|--------|-----------------|----------------|
| Dashboard | Rischioso | Conforme |
| Tavoli | Con Bug | Conforme |
| Ordini | Rischioso | Conforme |
| Cassa / Conto | Rischioso | Conforme |
| Prenotazioni | Rischioso | Conforme |
| Menu | Rischioso | Conforme |
| Menu QR | Con Bug | Conforme |
| Cucina (KDS) | Rischioso | Conforme |
| CRM | Con Bug | Conforme |
| AI Predictive | Rischioso | Conforme |
| Fedeltà | Con Bug | Conforme |
| Marketing | Rischioso | Conforme |
| Pagamenti | Con Bug | Conforme |
| Fatture B2B | Rischioso | Conforme |
| Report | Rischioso | Conforme |
| Report Fiscale | Conforme | Conforme |
| Staff | Rischioso | Conforme |
| Magazzino | Conforme | Conforme |
| Analytics | Con Bug | Conforme |
| Impostazioni | Rischioso | Conforme |
| Billing | Rischioso | Conforme |
| Onboarding | Rischioso | Conforme |

---

## 1. DASHBOARD PANEL

**File:** `frontend/src/pages/DashboardPage.tsx`, `backend/src/lib/analyticsSummary.ts`, `frontend/src/components/dashboard/LiveCommandCenter.tsx`, `frontend/src/hooks/useRealtimeInvalidation.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **`avgTurnoverMinutes` sempre 0** — Il frontend mostrava "0 min" perché `buildDashboardSummary()` non calcolava la rotazione; la logica esisteva solo in un endpoint duplicato `/analytics/dashboard`.
2. **Crescita % fuorviante** — `revenueGrowth` confrontava il mese corrente (MTD) con l'**intero** mese precedente, gonfiando artificialmente la percentuale nei primi giorni del mese.
3. **KPI non invalidati via WebSocket** — `useRealtimeOrders()` non invalidava la query `analytics`, causando lag fino a 30s dopo un pagamento anche con socket attivo.
4. **Ordini rimborsati nei totali** — Gli ordini `PAID` rimborsati non erano esclusi dai KPI.
5. **LiveCommandCenter** — Errori query silenziosi (nessun banner errore dedicato).

### Soluzione architetturale

✅ **`analyticsSummary.ts`** — Aggiunto calcolo `avgTurnoverMinutes` e confronto growth MTD vs stesso periodo mese precedente (`lastMonthPartialEnd`).

✅ **`useRealtimeInvalidation.ts`** — Aggiunta invalidazione query `analytics` su `order:created` / `order:updated`; gestione `.catch()` su socket connect.

✅ **`analyticsFilters.ts` + schema** — Campi `Order.refundedAt` / `refundAmount`; `paidRevenueOrderWhere()` esclude rimborsi da KPI.

✅ **`LiveCommandCenter.tsx`** — `QueryErrorBanner` su errori tavoli/prenotazioni/ordini attivi.

✅ **`cash.ts`** — Endpoint `POST /cash/orders/:orderId/refund` con `markOrderRefunded()`.

---

## 2. MODULO TAVOLI (MAPPA SALA)

**File:** `backend/src/routes/tables.ts`, `backend/src/lib/orderSession.ts`, `backend/src/lib/tableStatus.ts`, `frontend/src/pages/TablesPage.tsx`

### Stato logico: **Con Bug** → **Conforme**

### Falla rilevata

1. **`PUT /tables/:id` bypassava la FSM** — Accettava `status` arbitrario senza controlli, permettendo `FREE` con ordini attivi (piano mostrava "Libero" ma l'ordine restava attivo).
2. **`PATCH /status` senza matrice transizioni** — Consentiva salti illegali (`CLEANING→OCCUPIED`, `OCCUPIED→RESERVED`).
3. **Prenotazione sovrascriveva `OCCUPIED→RESERVED`** — Handler POST in `reservations.ts` aggiornava incondizionatamente il tavolo dopo `createReservation`, duplicando la sync già presente in `createReservation.ts`.
4. **Ereditarietà ordine** — Non è un bug di ID: gli ordini storici restano su `tableId`. Il rischio era **disallineamento stato UI vs ordine attivo** per via del PUT.

### Soluzione architetturale

✅ **`tableStatus.ts`** — Matrice transizioni manuali (`FREE→CLEANING`, `CLEANING→FREE`, `OCCUPIED→CLEANING`, `RESERVED→FREE|CLEANING`).

✅ **`tables.ts`** — Rimosso `status` da `PUT /:id`; `PATCH /:id/status` valida transizioni + `TABLE_HAS_ACTIVE_ORDER` su `FREE`.

✅ **`reservations.ts`** — Rimosso update incondizionato `RESERVED` post-create (si usa `syncTableReservedForReservation` in transazione).

✅ **`reservationRules.ts`** — Blocco prenotazione su tavolo `OCCUPIED`/`CLEANING` o con `countActiveTableOrders > 0`.

---

## 3. MODULO ORDINI E COMANDE

**File:** `backend/src/routes/orders.ts`, `frontend/src/components/orders/OrderModal.tsx`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Ordine vuoto** — ✅ Già bloccato: Zod `items.min(1)` su `POST /orders`.
2. **Quantità negative** — ✅ Già bloccato: `.positive()` su create e add-item.
3. **Race su totali** — Due camerieri che aggiungono piatti in parallelo calcolavano `precomputedTotals` **fuori** dalla transazione → lost update su subtotal/tax/total.
4. **Concorrenza stesso tavolo** — Secondo `POST /orders` riceve 409 `TABLE_OCCUPIED` (first-wins, non merge) — **comportamento corretto**.
5. **Add-item stesso ordine** — Merge append (nuova riga per piatto); duplicati possibili ma entrambi persistono — accettabile.
6. **`POST /:id/items` senza `.max(99)`** — Inconsistente con create.

### Soluzione architetturale

✅ **`orders.ts`** — Ricalcolo totali **dentro** la transazione dopo `orderItem.create`; aggiunto `.max(99)` su add-item.

---

## 4. MODULO CASSA E CONTO

**File:** `backend/src/lib/orderPayment.ts`, `frontend/src/pages/CheckoutPage.tsx`, `backend/src/lib/completePayment.ts`, `backend/src/lib/fiscal/orderIntegrityGuard.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Split by-items: doppio conteggio modificatori** — `unitPrice` include già i modifier, ma `lineGross` sommava anche `modifierTotal`.
2. **Split by-items: penny drift** — A differenza dello split equal, l'ultimo ospite non riceveva il resto → somma quote ≠ totale.
3. **Riapertura conto pagato** — Non esiste flusso "reopen to unpaid". `PAID` è chiusura fiscale immutabile (`orderIntegrityGuard`). Idempotenza su re-finalize. **Comportamento corretto** per VeriFactu.
4. **Totali fiscali ordine** — `taxEngine` con penny adjustment garantisce `subtotal + tax = total` al centesimo. ✅

### Soluzione architetturale

✅ **`orderPayment.ts`** — `lineGross = quantity * unitPrice`; remainder sull'ultimo ospite in split by-items.

✅ **`CheckoutPage.tsx`** — Allineato `lineGross()` senza doppio modifier.

---

## 5. MODULO PRENOTAZIONI

**File:** `backend/src/lib/reservationRules.ts`, `backend/src/lib/createReservation.ts`, `backend/src/lib/reservationTableSync.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Doppia prenotazione stesso tavolo** — ✅ Già gestita: overlap `rStart < requestEnd && rEnd > requestStart` + transazione Serializable.
2. **Overbooking coperti** — Default `maxCoversPerSlot = 999` rendeva il limite venue inefficace.

### Soluzione architetturale

✅ **`reservationRules.ts`** — Validazione `table.status ∈ {FREE, RESERVED}` + `countActiveTableOrders === 0`.

✅ **`reservationCapacity.ts`** — `resolveMaxCoversPerSlot()` da settings o somma posti tavoli.

---

## 6. MODULO MENU (GESTIONE PIATTI)

**File:** `backend/src/routes/menu.ts`, `backend/src/lib/menuStock.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Disattivazione manuale (`available: false`)** — Esclusa dalla query pubblica; ordini in corso su `OrderItem` non toccati. ✅
2. **Esaurito da stock** — Item resta visibile con badge `soldOut`; submit bloccato da `assertMenuItemOrderable`. ✅
3. **Nessun push al menu pubblico** — Staff toggle non invalidava cache guest (5 min stale).

### Soluzione architetturale

✅ **`menu.ts`** — Emit `menu:updated` su cambio disponibilità.

✅ **`PublicMenuPage.tsx`** — `staleTime` e `refetchInterval` ridotti a 60s.

---

## 7. MODULO MENU QR (CLIENTE PUBBLICO)

**File:** `backend/src/lib/publicOrder.ts`, `backend/src/lib/tableToken.ts`, `frontend/src/pages/PublicMenuPage.tsx`, `frontend/src/pages/QRBuilderPage.tsx`

### Stato logico: **Con Bug** → **Conforme**

### Falla rilevata

1. **ID Injection tavolo** — URL `?tavolo=5` senza binding crittografico: chiunque poteva inviare ordini sul Tavolo 5 se libero.
2. **Input manuale tavolo** — `GuestCartDrawer` permetteva di digitare un numero tavolo arbitrario.

### Soluzione architetturale

✅ **`tableToken.ts`** — HMAC-SHA256 `signTableToken(restaurantId, tableNumber)` con `TABLE_QR_SECRET` / `JWT_SECRET`.

✅ **`publicOrder.ts` + `publicCheckout.ts`** — `DINE_IN` con `tableNumber` richiede `tableToken` valido (`TABLE_TOKEN_INVALID` → 403).

✅ **`GET /api/tables/:number/qr-token`** — Endpoint per QR Builder.

✅ **`QRBuilderPage.tsx`** — URL generato: `?tavolo=N&tok=<HMAC>`.

✅ **`GuestCartDrawer.tsx`** — Campo tavolo read-only quando token presente; token incluso nel payload.

---

## 8. MODULO SCHERMO CUCINA (KDS)

**File:** `frontend/src/pages/KitchenDisplayPage.tsx`, `frontend/src/hooks/useKitchenOrders.ts`, `backend/src/routes/orders.ts` (`GET /active`)

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Ordinamento LIFO** — API e merge socket usavano `createdAt desc` / `unshift` → ordini più vecchi in fondo.
2. **Reconnect senza full sync** — Socket reconnect non invalidava la query; comande perse recuperate solo al prossimo poll (30–60s).
3. **Priorità** — Solo visuale (bordo rosso ≥15 min), non campo DB. Accettabile.

### Soluzione architetturale

✅ **`orders.ts`** — `GET /active` con `orderBy: { createdAt: 'asc' }` (FIFO).

✅ **`kitchenOrders.ts`** — `filterKitchenOrders` e `mergeKitchenOrder` ordinano per `createdAt asc`; nuovi ordini in coda (append).

✅ **`useKitchenOrders.ts`** — `invalidateQueries` su evento socket `connect`.

---

## 9. MODULO CRM

**File:** `frontend/src/pages/CrmPage.tsx`, `backend/src/routes/customers.ts`

### Stato logico: **Con Bug** → **Conforme**

### Falla rilevata

**`birthdate` vs `birthDate`** — Il POST inviava `birthdate` ma il backend Zod attendeva `birthDate`; la data di nascita non veniva mai salvata in creazione.

### Soluzione architetturale

✅ **`CrmPage.tsx`** — Allineato campo a `birthDate` su create e update.

✅ **`Sidebar.tsx`** — Aggiunto `permission: 'customers.read'` per evitare link visibili a ruoli senza accesso.

---

## 10. MODULO AI PREDITTIVA

**File:** `frontend/src/pages/AIPredictivePage.tsx`, `backend/src/routes/ai.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **`toastedAlertsRef` non resettato** al refresh manuale — alert non ri-toastati dopo refetch.
2. **Endpoint legacy duplicati** (`/ai/alerts`, `/forecast`) con stringhe hard-coded IT — rischio drift vs `/predictive`.

### Soluzione architetturale

✅ **`AIPredictivePage.tsx`** — Reset `toastedAlertsRef` su refresh e cambio tenant; card alert con `premium-card` (no glass).

✅ **`ai.ts`** — Header `Deprecation` + `Link` successor su route legacy; KPI alert escludono ordini rimborsati.

✅ **Route legacy rimosse** — `/forecast`, `/alerts`, `/summary`, `/reorder`, `/menu-matrix` rispondono `410` con puntatore a `/api/ai/predictive`.

---

## 11. MODULO FEDELTÀ

**File:** `frontend/src/pages/LoyaltyPage.tsx`, `backend/src/routes/loyalty.ts`

### Stato logico: **Con Bug** → **Conforme**

### Falla rilevata

**`/adjust` non aggiornava il tier** — Dopo aggiustamento manuale punti, `updateCustomerTier()` non veniva chiamato (a differenza di `/earn`).

### Soluzione architetturale

✅ **`loyalty.ts`** — Chiamata `updateCustomerTier()` dopo transazione adjust.

✅ **`Sidebar.tsx`** — `permission: 'loyalty.manage'`.

✅ **`LoyaltyPage.tsx`** — `onError` su `adjustMutation`; paginazione clienti oltre 20 righe.

---

## 12. MODULO MARKETING

**File:** `frontend/src/pages/MarketingPage.tsx`, `backend/src/lib/marketingSend.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Automazione `REQUEST_REVIEW` nascosta** in UI (solo 3 card su 4 seed).
2. **WIN_BACK finestra 60–61 giorni** — Troppo stretta; pochi clienti matchano.
3. **Nessuna deduplica invii** automazioni tra run scheduler.
4. **Toggle ottimistico senza rollback** su errore persist.

### Soluzione architetturale

✅ **`MarketingPage.tsx`** — Esposta 4ª automazione `REQUEST_REVIEW`.

✅ **`marketingSend.ts`** — Finestra WIN_BACK 45–90 giorni; dedup via `MarketingAutomationSend` + `marketingDedup.ts`.

✅ **Toggle** — Rollback su `onError` già presente in `saveAutomation`.

---

## 13. MODULO PAGAMENTI (Stripe Connect)

**File:** `frontend/src/pages/PaymentsPage.tsx`, `backend/src/routes/payments.ts`

### Stato logico: **Con Bug** → **Conforme**

### Falla rilevata

**URL ritorno Stripe errati** — `refresh_url` / `return_url` puntavano a `/dashboard/pagamenti` ma la route reale è `/pagamenti` → onboarding Connect interrotto.

### Soluzione architetturale

✅ **`payments.ts`** — URL corretti: `/pagamenti?connect=success|refresh`.

✅ **Overview KPI** — Include `STRIPE`, `CARD`, `DIGITAL`; esclusi ordini rimborsati.

✅ **`PaymentsPage.tsx`** — Stringhe UI via i18n (`stripeAccount`, `connectBank`).

---

## 14. MODULO FATTURE B2B (Italia)

**File:** `frontend/src/pages/InvoicesPage.tsx`, `backend/src/routes/invoices.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

**`statoSdi: 'failed'`** non mappato in UI — mostrato come "pending".

### Soluzione architetturale

✅ **`InvoicesPage.tsx`** — `StatusBadge` tratta `failed` come rejected.

✅ **`invoices.ts`** — Issuer city/zip/province da `RestaurantSettings`; fallback su `restaurant.address`.

✅ **`SettingsPage.tsx`** — Campi `legalCity`, `legalZip`, `legalProvince` in impostazioni fiscali.

---

## 15. MODULO REPORT

**File:** `frontend/src/pages/ReportsPage.tsx`, `backend/src/routes/reports.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

1. **Costo lavoro hard-coded** `HOURLY_RATE = 12` — P&L non configurabile per tenant.
2. **Zeta closure** — POST chiudeva sempre "oggi", ignorava periodo selezionato in UI.
3. **Link report fiscale** visibile a tutti `reports.read` senza check admin.

### Soluzione architetturale

✅ **`RestaurantSettings.laborHourlyRate`** + campo in `SettingsPage.tsx`.

✅ **`ReportsPage.tsx`** — Selettore data Zeta; POST `/reports/zeta` con `{ date }`.

✅ **Link fiscale** — Visibile solo con `canAccessAdminNav()`.

---

## 16. MODULO REPORT FISCALE

**File:** `frontend/src/pages/ReportFiscal.tsx`, `backend/src/routes/reports.ts`

### Stato logico: **Conforme**

### Falla rilevata

Modulo tra i più solidi: usa `taxEngine`, `fiscalRegime`, i18n `byRegime`, catena integrità hash.

⚠️ **Rischio performance** su range ampi (caricamento ordini in memoria) — monitorare su tenant ad alto volume.

### Soluzione architetturale

✅ **`fiscalReportLimits.ts`** — Max 366 giorni per intervallo; errore `FISCAL_RANGE_TOO_LARGE`.

✅ **`fetchPaidOrdersInPeriod`** — `orderBy` lato DB; tabella paginata in UI (50 righe/pagina).

---

## 17. MODULO STAFF

**File:** `frontend/src/pages/StaffPage.tsx`, `backend/src/routes/staff.ts`

### Stato logico: **Rischioso** → **Conforme** (password)

### Falla rilevata

**Password min 6 frontend vs 8 backend** — Creazione utente falliva silenziosamente o con errore generico.

### Soluzione architetturale

✅ **`StaffPage.tsx`** — `MIN_PASSWORD_LENGTH = 8`.

✅ **`StaffShiftsTab.tsx`** — Date settimana formattate con timezone tenant (`restaurant.timezone`).

---

## 18. MODULO MAGAZZINO

**File:** `frontend/src/pages/InventoryPage.tsx`, `backend/src/routes/inventory.ts`, `backend/src/lib/inventoryDeduction.ts`

### Stato logico: **Conforme**

### Falla rilevata

- Deduzione idempotente via flag `inventoryDeducted`. ✅
- `INSUFFICIENT_STOCK` blocca ordine mid-rush — comportamento strict by design.
- Nessun audit trail su aggiustamenti manuali.

### Soluzione architetturale

✅ **`InventoryAdjustment` model** + log su `PATCH` quantità in `inventory.ts`.

---

## 19. MODULO ANALYTICS

**File:** `frontend/src/pages/AnalyticsPage.tsx`, `backend/src/routes/analytics.ts`

### Stato logico: **Con Bug** → **Conforme**

### Falla rilevata

1. **Top-items** — Filtro su `order.createdAt` invece di `paidAt`; revenue da prezzo menu corrente non da `unitPrice` storico; item `CANCELLED` inclusi.
2. **Hourly** — Stesso disallineamento `createdAt` filter vs `paidAt` bucket.

### Soluzione architetturale

✅ **`analytics.ts`** — Filtri su `paidAt` con fallback `createdAt`; revenue da `orderItem.unitPrice`; esclusi item `CANCELLED`.

✅ **`Sidebar.tsx`** — `permission: 'analytics.read'`.

---

## 20. MODULO IMPOSTAZIONI

**File:** `frontend/src/pages/SettingsPage.tsx`, `backend/src/routes/restaurant.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

**`taxRate: 0` se campo vuoto** in save — può azzerare aliquota invece del default regime.

### Soluzione architetturale

✅ **`SettingsPage.tsx`** — `taxRate: data.taxRate === '' ? undefined : data.taxRate`; campo `laborHourlyRate` per report P&L.

✅ **POS / i18n** — Sezione registratore di cassa tradotta; campi indirizzo fiscale completi.

✅ **Prenotazioni & caparra** — Sezione anti no-show tradotta via i18n.

---

## 21. MODULO BILLING (tier unsubscribed)

**File:** `frontend/src/pages/BillingPage.tsx`, `backend/src/routes/checkout.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

- UI hard-coded italiano (no i18n).
- Race webhook vs `?success=true` landing.
- Nessun portale upgrade/downgrade.

### Soluzione architetturale

✅ **`BillingPage.tsx`** — Tutte le stringhe via i18n (`billing.plans.*`); design system senza glassmorphism.

✅ **`POST /checkout/portal`** — Stripe Customer Portal per upgrade/downgrade e fatture.

— Nessun altro gap operativo.

---

## 22. MODULO ONBOARDING

**File:** `frontend/src/pages/OnboardingPage.tsx`, `backend/src/routes/restaurant.ts`

### Stato logico: **Rischioso** → **Conforme**

### Falla rilevata

- Checklist concierge **solo locale** (persa al refresh).
- Utenti non-admin possono vedere pagina ma API readiness richiede OWNER/MANAGER.

### Soluzione architetturale

✅ **`onboardingConcierge` JSON** in `RestaurantSettings` + API `GET/PATCH /restaurant/onboarding-concierge`.

✅ **`OnboardingPage.tsx`** — Sync concierge con backend su toggle.

✅ **Guard ruolo** — Checklist tecnica e concierge API solo per OWNER/MANAGER; messaggio informativo per staff.

---

## Moduli accessori (non sempre visibili)

### Cassa registratore (`/cassa`)

**Stato:** **Conforme** — Sessioni cassa, transazioni SALE/REFUND, saldo atteso coerente con `orderPayment`.

### Cucina (link sidebar separato)

Vedi sezione 8.

---

## File creati / modificati in questo audit

| File | Intervento |
|------|------------|
| `backend/src/lib/tableStatus.ts` | **Nuovo** — FSM transizioni manuali |
| `backend/src/lib/tableToken.ts` | **Nuovo** — HMAC QR tavolo |
| `backend/src/lib/analyticsSummary.ts` | Turnover, growth MTD, partial month |
| `backend/src/routes/tables.ts` | FSM, rimozione status da PUT, qr-token |
| `backend/src/routes/reservations.ts` | Rimosso overwrite RESERVED |
| `backend/src/lib/reservationRules.ts` | Occupancy check tavolo |
| `backend/src/routes/orders.ts` | FIFO active, totals in tx, max(99) |
| `backend/src/lib/orderPayment.ts` | Split fix modifier + penny |
| `backend/src/routes/analytics.ts` | Top-items, hourly fix |
| `backend/src/routes/menu.ts` | Emit menu:updated |
| `backend/src/lib/publicOrder.ts` | Validazione tableToken |
| `backend/src/lib/publicCheckout.ts` | Validazione tableToken |
| `backend/src/routes/loyalty.ts` | updateCustomerTier dopo adjust |
| `backend/src/routes/payments.ts` | URL Stripe Connect |
| `frontend/src/hooks/useRealtimeInvalidation.ts` | Analytics invalidation |
| `frontend/src/hooks/useKitchenOrders.ts` | Reconnect full sync |
| `frontend/src/lib/kitchenOrders.ts` | FIFO ordering |
| `frontend/src/pages/CheckoutPage.tsx` | lineGross fix |
| `frontend/src/pages/CrmPage.tsx` | birthDate fix |
| `frontend/src/pages/PublicMenuPage.tsx` | Token URL, cache 60s |
| `frontend/src/pages/QRBuilderPage.tsx` | URL firmato |
| `frontend/src/components/public/GuestCartDrawer.tsx` | tableToken payload |
| `frontend/src/components/layout/Sidebar.tsx` | Permission guards |
| `frontend/src/pages/StaffPage.tsx` | Password min 8 |
| `frontend/src/pages/InvoicesPage.tsx` | statoSdi failed |

---

## Checklist pre-rilascio Enterprise

- [x] Tavoli: FSM e sync prenotazioni
- [x] Ordini: totali atomici, validazione quantità
- [x] QR pubblico: token HMAC anti-injection
- [x] KDS: FIFO + resync reconnect
- [x] Split conto: matematica al centesimo
- [x] Dashboard: KPI turnover e growth comparabile
- [x] Analytics: revenue storica corretta
- [x] Rimborsi esclusi da KPI revenue
- [x] `maxCoversPerSlot` default sensato (`reservationCapacity.ts`)
- [x] Marketing automations dedup (`MarketingAutomationSend`)
- [x] Impostazioni taxRate empty guard

---

## File creati / modificati — secondo pass (remediation completa)

| File | Intervento |
|------|------------|
| `backend/prisma/schema.prisma` | `refundedAt`, `laborHourlyRate`, `onboardingConcierge`, `MarketingAutomationSend`, `InventoryAdjustment` |
| `backend/prisma/migrations/20250701120000_audit_remediation/` | Migration SQL |
| `backend/src/lib/analyticsFilters.ts` | **Nuovo** — `paidRevenueOrderWhere()` |
| `backend/src/lib/reservationCapacity.ts` | **Nuovo** — `resolveMaxCoversPerSlot()` |
| `backend/src/lib/orderRefund.ts` | **Nuovo** — `markOrderRefunded()` |
| `backend/src/lib/marketingDedup.ts` | **Nuovo** — dedup automazioni |
| `backend/src/routes/cash.ts` | Refund ordine |
| `backend/src/routes/inventory.ts` | Audit trail aggiustamenti |
| `backend/src/routes/restaurant.ts` | Concierge API, settings estesi |
| `frontend/src/pages/AIPredictivePage.tsx` | No glass, reset toast ref |
| `frontend/src/pages/MarketingPage.tsx` | Card REQUEST_REVIEW |
| `frontend/src/pages/LoyaltyPage.tsx` | onError, paginazione |
| `frontend/src/pages/ReportsPage.tsx` | Zeta date, link fiscale admin |
| `frontend/src/pages/BillingPage.tsx` | i18n completo |
| `frontend/src/pages/OnboardingPage.tsx` | Concierge persistente |
| `frontend/src/pages/PaymentsPage.tsx` | i18n CTA Stripe |
| `frontend/src/pages/SettingsPage.tsx` | laborHourlyRate |
| `frontend/src/components/dashboard/LiveCommandCenter.tsx` | QueryErrorBanner |
| `frontend/src/components/public/GuestCartDrawer.tsx` | Blocco DINE_IN senza token |
| `frontend/src/components/staff/StaffShiftsTab.tsx` | Timezone tenant |

---

## ROUND RZ5 — Allineamento trasversale (2026-07-01)

| File | Intervento |
|------|------------|
| `backend/src/lib/postPayment.ts` | `reversePostPaymentEffects()` su rimborso |
| `backend/src/lib/orderRefund.ts` | Storno CRM/fedeltà al rimborso |
| `backend/src/lib/dates.ts` | Filtro revenue unificato `endExclusive` |
| `backend/src/routes/payments.ts` | Overview allineata a KPI tenant |
| `backend/src/routes/tables.ts` | Esclusione checkout Stripe pendente |
| `backend/src/routes/invoices.ts` | Solo tenant IT |
| `backend/src/routes/public.ts` | `effectiveMaxCoversPerSlot` |
| `backend/src/lib/publicOrder.ts` / `publicCheckout.ts` | DINE_IN token obbligatorio |
| `frontend/src/lib/orderSession.ts` | PAID senza items non attivo |
| `frontend/src/pages/ReservationsPage.tsx` | maxCovers effettivo + i18n no-show |
| `frontend/src/App.tsx` | Guard onboarding + payments.overview |

**Esito:** zero disallineamenti critici/alti aperti tra moduli sidebar.

---

## ROUND RZ11 — Verifica post-test (2026-07-01)

### C-05 Decimal monetario
✅ **Già completato** con migration `backend/prisma/migrations/20250630120000_money_float_to_decimal/`.
Campi euro: `Order.*`, `MenuItem.price`, `CashTransaction.amount`, `Customer.totalSpent`, chiusure fiscali, fatture.
Float residui: percentuali IVA/IGIC, coordinate tavoli, quantità magazzino (non importi).

### Copertura test (riferimento `tests/README.md`)

| Modulo | Test |
|--------|------|
| Cassa / split | `cassa.test.ts`, `split-checkout-ui.test.ts`, `cash-finalize-due.test.ts`, `splitSettlement.test.ts` |
| Tavoli | `tavoli.test.ts`, `tableReleaseGuard.test.ts`, `integration-db.test.ts` |
| Magazzino / cucina | `cucina-inventory.test.ts`, `stock-hold.test.ts`, `menuStock.test.ts` |
| Fiscale | `taxEngine.test.ts`, `tipFiscal.test.ts`, `fiscalIntegrityChain.test.ts`, `fiscalStrategies.test.ts` |
| Pagamenti live | `backend/scripts/test-flow.ts` (DO produzione) |

**Totale automatico:** 78 test unit/integration + E2E smoke produzione.

### Residui bassa priorità
- **RC-12:** stima food cost P&L (non fiscale)
- ~~**i18n-B:** errori API pagine secondarie~~ ✅ RZ12
- **B-12:** saga POS distribuita (auto-refund già attivo)
- **Load-50:** stress test concorrenza tavoli

*Audit aggiornato: 2026-07-01 — RZ12.*
