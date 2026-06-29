# Aura Syncro — Stato del Prodotto Premium
## Report Product Director · SaaS Business Analyst · Enterprise Solutions Architect

**Data analisi:** 29 giugno 2026  
**Posizionamento target:** Premium — €500 setup (una tantum) + €199/mese + IVA  
**Target cliente:** Ristoranti strutturati 50+ coperti, Italia + Spagna (IT_MAIN / ES_PENINSULA / ES_CANARIAS)  
**Metodo:** ispezione diretta del workspace (345+ file TS), audit interni (`audit_bug_assoluto.md` RZ-1→RZ-6), test automatici, smoke E2E su produzione DigitalOcean.

---

## Sintesi esecutiva (spietata)

Aura Syncro **non è un prototipo**: è un gestionale SaaS multitenant **ampio e funzionante**, con moduli operativi reali (tavoli, cucina, ordini, cassa, CRM, marketing, fiscale multi-regime, menu QR, Stripe).  
Tuttavia **non è ancora un prodotto Premium “chiavi in mano” vendibile domani senza concierge attivo** su ogni go-live.

| Dimensione | Voto onesto | Commento in una riga |
|------------|-------------|----------------------|
| **Copertura funzionale** | 7,5/10 | Molto codice, pochi moduli al 100% commerciale |
| **Affidabilità produzione** | 6,5/10 | E2E verde su CASH; fragilità su CARD/POS, istanza piccola, pochi test |
| **UX Premium coerente** | 7/10 | Dashboard executive dark/oro solida; KDS e guest cart fuori brand |
| **Sicurezza multitenant** | 8/10 | Modello JWT solido; gap di defense-in-depth e admin god-mode |
| **Scalabilità tecnica** | 6/10 | Prisma 6 stabile; query pesanti e indici mancanti su percorsi caldi |
| **Prontezza commerciale Premium** | **~74%** | Vendibile **solo** con onboarding concierge e limiti dichiarati |

---

# 1. COMPRENSIONE ED ESISTENZA DEI MODULI CORE

Legenda stati:
- **Pronto (100%)** — utilizzabile in servizio reale senza workaround per il target Premium
- **Incompleto (60–90%)** — core presente, gap visibili al cliente o al commercialista
- **Abbozzato (30–60%)** — API o UI parziali, valore marketing > valore operativo
- **Mancante** — non implementato o solo placeholder

---

## 1.1 Modulo Tavoli (mappa interattiva sala)

**Stato: Incompleto — ~87%**

### File chiave (esistono e sono cablati)
| Area | Percorso |
|------|----------|
| UI mappa | `frontend/src/pages/TablesPage.tsx` |
| Floor plan | `frontend/src/components/tables/TableFloorPlan.tsx` |
| Editor layout | `frontend/src/components/tables/FloorPlanEditor.tsx` |
| Aree | `frontend/src/components/tables/AreaManagerModal.tsx` |
| Comanda al tavolo | `frontend/src/components/orders/OrderModal.tsx` |
| API | `backend/src/routes/tables.ts` |
| Sessione tavolo | `backend/src/lib/orderSession.ts`, `transferTable.ts` |
| Realtime | `backend/src/socket/handlers.ts`, `frontend/src/hooks/useRealtimeInvalidation.ts` |

### Cosa funziona davvero
- Mappa cliccabile con stati FREE / OCCUPIED / RESERVED / CLEANING
- Drag-and-drop posizioni (`react-rnd`), salvataggio batch `PATCH /tables/positions`
- Apertura comanda, trasferimento tavolo, seat prenotazione → comanda
- Logica “ordine attivo” post-PAID se cucina non ha SERVED tutti i piatti
- RBAC: HOST non apre comande su tavoli liberi senza permesso (RZ5-01)
- Fallback polling 15s se socket down

### Cosa è abbozzato o incompleto
- **Performance:** `GET /tables` carica **tutti** gli ordini attivi nested per ogni tavolo (items + customer + loyalty). Su 40–60 tavoli in sabato sera → rischio lag (AB-PERF-01, ancora aperto)
- Socket `table:update_position` persiste lato server ma il FE salva solo via REST — sync multi-operatore assente
- Testo hard-coded “Gestisci Zone” in `TablesPage.tsx`
- Piano STARTER limita a 12 tavoli / 1 area — coerente commercialmente, ma va comunicato

### Cosa manca per il Premium
- Endpoint “summary” leggero per la mappa (1 ordine attivo per tavolo, no nested profondo)
- Sync posizioni realtime tra più dispositivi
- Test E2E sul flusso completo tavolo → ordine → incasso → liberazione

---

## 1.2 Schermo Cucina (KDS) in tempo reale

**Stato: Incompleto — ~90% operativo, ~65% Premium UX**

### File chiave
| Area | Percorso |
|------|----------|
| Pagina KDS | `frontend/src/pages/KitchenDisplayPage.tsx` (route `/cucina`, fuori `DashboardLayout`) |
| Hook dati | `frontend/src/hooks/useKitchenOrders.ts` |
| Logica colonne | `frontend/src/lib/kitchenOrders.ts` |
| API | `backend/src/routes/orders.ts` → `GET /orders/active` + `kitchenActiveOrdersWhere` |
| Socket | `order:created`, `order:updated` da orders/public/payments/webhook |

### Cosa funziona davvero
- Colonne Pending / Preparing / Ready, timer, avanzamento item (+1 porzione), dismiss → SERVED
- Vista aggregata piatti per tavolo
- Esclude ordini Stripe guest non ancora pagati dalla cucina
- Socket + fallback polling 30–60s
- Fix realtime post-refresh cookie (Round RX)

### Cosa è incompleto
- **Skin diversa** dal resto del prodotto Premium (slate/amber industriale, titolo “CUCINA” hard-coded)
- Nessuna stazione cucina (bar vs calda vs pasticceria)
- `print:kitchen` emesso ma integrazione stampante non verificata end-to-end
- Nessun suono/push dedicato oltre toast

### Cosa manca per il Premium
- Allineamento visivo executive (marmo/oro) mantenendo leggibilità a distanza
- Filtro per categoria/stazione
- SLA visivi (rosso dopo X minuti) — parzialmente presenti via timer ma non come policy configurabile

**Verdetto modulo:** il cuore operativo **regge il servizio**; l’imballaggio Premium **no**.

---

## 1.3 AI Predittiva Magazzino e Vendite

**Stato: Incompleto — ~72% (motore ~85%, prodotto commerciale ~60%)**

### File chiave
| Area | Percorso |
|------|----------|
| Pagina UI | `frontend/src/pages/AIPredictivePage.tsx` |
| Hook | `frontend/src/hooks/usePredictiveAI.ts` |
| Motore statistico | `backend/src/lib/predictiveEngine.ts` (+ test) |
| Orchestrazione | `backend/src/lib/predictiveAI.ts`, `weatherService.ts` (Open-Meteo) |
| API principale | `backend/src/routes/ai.ts` → `GET /ai/predictive` |
| API legacy (orfane) | stesso file: `/forecast`, `/reorder`, `/menu-matrix`, `/alerts`, `/summary` |
| Analytics KPI | `backend/src/lib/analyticsSummary.ts`, `routes/analytics.ts` |

### Cosa funziona davvero
- Forecast affluenza 7 giorni con fattori: storico ordini, giorno settimana, meteo, prenotazioni
- Alert rule-based (stock weekend, pioggia+pesce, crescita vendite) con `ruleId` i18n
- Integrazione inventario (BOM menu → ingredienti)
- Test unitari su regole (`predictiveEngine.test.ts`)
- Dashboard analytics timezone-aware (RZ4-01)

### Cosa è abbozzato / marketing > prodotto
- **Nessun LLM** — by design (`statistical_rules_v1/v2`); va comunicato come “motore predittivo”, non “AI generativa”
- 5 endpoint legacy in `ai.ts` **non consumati dal frontend** — duplicazione e debito tecnico
- `/ai/summary` carica **tutti** gli ordini del tenant senza finestra temporale → rischio performance
- Nessuna azione automatica (ordine fornitore, aggiustamento menu, notifica push magazzino)
- Testi suggestion hard-coded IT nelle route legacy

### Cosa manca per il Premium promesso in landing
- UI per reorder suggestions e matrice BCG (API esiste, pagina no)
- Widget predittivo in Dashboard (non solo pagina dedicata)
- Benchmark e spiegabilità per il ristoratore (“perché questo alert?”)
- Load test su ristorante con 12+ mesi di storico

**Verdetto:** vendibile come **“intelligence operativa v1”**, non come **“AI che ottimizza il magazzino da sola”**.

---

## 1.4 Libro Registro Fiscale + Mance + Aruba B2B

**Stato: Incompleto — ~83%**

### File chiave
| Area | Percorso |
|------|----------|
| Report UI | `frontend/src/pages/ReportFiscal.tsx` |
| PDF/label client | `frontend/src/lib/fiscalPdf.ts`, `fiscalLabels.ts`, `fiscalRegime.ts` |
| Motore tax | `backend/src/lib/taxEngine.ts` |
| Mance / righe fiscali | `backend/src/lib/tipFiscal.ts`, `fiscal/tipTracking.ts` |
| Strategie IT/ES | `backend/src/lib/fiscal/strategies/*` |
| Catena integrità SHA-256 | `backend/src/lib/fiscal/fiscalIntegrityChain.ts` |
| Finalize pagamento | `backend/src/lib/orderPayment.ts` |
| Report API | `backend/src/routes/reports.ts` (`/fiscal`, `/vat-breakdown`, `/zeta`) |
| Fattura vendita POS | `backend/src/lib/fiscalInvoice.ts` |
| Fatture B2B | `frontend/src/pages/InvoicesPage.tsx`, `backend/src/routes/invoices.ts` |
| XML FatturaPA | `backend/src/lib/b2bFatturaPaXml.ts` |
| Invio SDI Aruba | `backend/src/lib/arubaInvoiceService.ts` |
| Sigillo PDF Aruba | `backend/src/lib/fiscal/arubaFiducialService.ts` (**mock**) |

### Cosa funziona davvero
- Multi-regime: IT IVA, ES penisola IVA, Canarie IGIC — label e calcoli da `taxEngine`, non hard-coded in report
- Libro fiscale con export CSV + PDF, filtri giorno/mese/range in timezone tenant
- Catena SHA-256 scritta su ogni finalize (predisposizione VeriFactu / Ley Antifraude)
- Chiusura Zeta giornaliera (solo IT, PRO)
- Mance escluse da base imponibile; `electronicTipsTotal` esclude CASH (RZ5-03)
- Documento vendita POS (`CORR-` / `T-`) su ogni pagamento
- Fattura B2B: generazione XML, invio Aruba **live** se `ARUBA_FE_ENABLED=true` + credenziali
- Test: `tipFiscal`, `fiscalInvoice`, `fiscalIntegrityChain`, `fiscalStrategies`

### Cosa è incompleto / rischioso
- **Importi Float in Prisma** (C-05) — drift centesimi possibile su volumi alti; non da vendere come “audit-proof” senza roadmap Decimal
- **Aruba Fiduciary PDF seal** — sempre mock salvo contratto live; non collegato all’export PDF frontend
- **POS carta in produzione** — senza `POS_ALLOW_SIMULATION` o Stripe Terminal reale, finalize CARD → 402
- Righe fiscali post-sconto fedeltà: mitigazioni presenti ma complessità residua su ordini scontati
- Blocco VAT breakdown in `ReportFiscal.tsx` ancora in stile **light staff** (`bg-white`, `slate-50`) — incoerente Premium

### Cosa manca per il Premium fiscale
- Migration Decimal + test di regressione monetaria
- VeriFactu / trasmissione AEAT automatica (solo predisposizione catena)
- Sigillo qualificato su PDF libro registro in produzione
- Collaudo commercialista su 3 regimi con dati reali (non solo unit test)
- Mance su checkout guest QR (oggi `tipAmount: 0` fisso)

**Verdetto:** per un ristorante IT con commercialista affiancato **è utilizzabile**; per promessa “conformità rigorosa senza concierge” **non è pronto**.

---

## 1.5 Menu QR pubblico (clienti finali)

**Stato: Incompleto — ~78%**

### File chiave
| Area | Percorso |
|------|----------|
| Pagina menu | `frontend/src/pages/PublicMenuPage.tsx` |
| Carrello | `frontend/src/components/public/GuestCartDrawer.tsx`, `hooks/useGuestCart.ts` |
| Prenotazione pubblica | `frontend/src/pages/PublicReservationPage.tsx` |
| API | `backend/src/routes/public.ts` |
| Ordine guest | `backend/src/lib/publicOrder.ts` |
| Checkout Stripe | `backend/src/lib/publicCheckout.ts` |
| Policy | `backend/src/lib/guestOrderingPolicy.ts` |

### Cosa funziona davvero
- Menu per slug, branding, fiscal payload, stock/sold-out
- Ordine DINE_IN / TAKEAWAY, numero tavolo, note riga
- Stripe Checkout guest + Connect, idempotency `clientRequestId`, rollback su errore Stripe (RZ-01)
- Prenotazioni pubbliche + caparra Stripe opzionale
- Rate limiting per slug, whitelist route pubbliche FE

### Cosa è incompleto (gap prodotto serio)
- **Nessun supporto modificatori** su ordine QR — il cameriere POS sì, il guest no (RZ6-R01, AB-EDGE-10)
- Carrello guest in UI **chiara** (`bg-slate-50`) vs menu pubblico **dark Premium** — dissonanza
- Fallback fiscale hard-coded `{ taxRate: 10, taxName: 'IVA' }` se API incompleta
- Errori API spesso in italiano, non mappati i18n guest

### Cosa manca per il Premium
- Modificatori obbligatori su QR (stesso prezzo del POS)
- Mance guest
- Pay-at-table flow collaudato con Stripe Terminal reale
- Test E2E guest completo in CI

---

## 1.6 Altri moduli presenti (non richiesti esplicitamente ma rilevanti per il lancio)

| Modulo | Stato | Note |
|--------|-------|------|
| CRM / Loyalty | ~85% | CRM + tier + punti; marketing email funzionante (E2E verde) |
| Prenotazioni + Waitlist | ~88% | Slot validation, depositi Stripe, seat da tavolo |
| Cassa (cash register) | ~90% | Sessioni OPEN/CLOSE, movimenti; finalize CASH OK in prod |
| Magazzino / BOM | ~80% | Deduzione su pagamento; alert AI collegati |
| Marketing automation | ~75% | Campagne email; scheduler backend; no SMS/WhatsApp |
| Staff / permessi RBAC | ~90% | Matrice permessi granulare; qualche `requirePermission` mancante su PATCH ordine |
| Billing SaaS (Stripe sub) | ~70% | Webhook subscription, onboarding checklist + Calendly/Tally — **concierge manuale** |
| Offline queue (POS mobile) | ~75% | Tenant-scoped, idempotency; edge cases residui |
| Landing + registrazione | ~90% | Pricing €199+€500 allineato in `LandingPricing.tsx` |

---

# 2. COERENZA DELL'ESPERIENZA UTENTE PREMIUM

## 2.1 Design system reale (non quello delle `.cursorrules`)

Le `.cursorrules` citano ancora `bg-slate-50` per l’area di lavoro. **Il codice è migrato** a un sistema **dark executive**:

| Token / pattern | Evidenza |
|-----------------|----------|
| Oro brand | `--color-aura-gold`, `aura-gold`, landing `#C5A059` / `#D4AF37` |
| Sidebar marmo | `.premium-sidebar` + `marble-bg.png` |
| Shell dashboard | `DashboardLayout.tsx` — `bg-[#0A0A0E]`, glow oro |
| Card moduli | `premium-card`, `ExecutivePageShell`, `ExecutivePageHeader` |
| Landing luxury | `LandingPage`, `LandingHero`, `LandingPricing` — nero + oro + `lux-heading` |

**Conclusione:** la direzione Premium **esiste ed è applicata** alla maggior parte del back-office.

## 2.2 Schermate ancora “grezze” o non coordinate

| Schermata | Problema | Impatto percepito cliente Premium |
|-----------|----------|-----------------------------------|
| **KitchenDisplayPage** | Palette industriale slate/amber; fuori layout dashboard; “CUCINA” fisso | “Sembra un altro software” |
| **GuestCartDrawer** | Light `slate-50` su menu QR dark | Rottura immersione guest |
| **ReportFiscal** (blocco VAT) | `bg-white` / `slate-900` light | Unico modulo fiscale che sembra MVP |
| **CheckoutPage** | `premium-card` ok ma chip `bg-slate-900` e no executive header | Accettabile in servizio, non “wow” |
| **SettingsPage** | Controlli orphan `bg-slate-800` | Dettaglio minore |
| **OnboardingPage** | Checklist **manuale** (checkbox utente, non verifica sistema) | Percepito come “beta” se prometti chiavi in mano |

## 2.3 Landing vs Dashboard

| Aspetto | Landing | Dashboard operativa |
|---------|---------|---------------------|
| Palette | Nero puro, oro, shimmer CTA | Navy/ossidiana, oro, marmo |
| Tipografia | `lux-heading`, gold H1 | `text-pietra`, `text-fumo` |
| Coerenza | — | **~80% allineata** |

La landing **vende** un livello di rifinitura che il KDS e il guest cart **non mantengono**.

## 2.4 Verdetto UX Premium

**Pronto per demo commerciale:** sì (dashboard + landing).  
**Pronto per cliente che paga €500 e giudica ogni pixel:** **no** — servono 2–3 sprint di polish mirato (KDS, guest, fiscal VAT block, onboarding verificato).

---

# 3. RESILIENZA E SICUREZZA MULTI-TENANT

## 3.1 Modello di isolamento (come funziona)

```
Client → JWT (cookie aura_session o Bearer) → req.restaurantId
         ↓
X-Restaurant-Id header cross-checked ≠ JWT → 403
         ↓
Prisma queries con restaurantId / tenantWhere(req) / scopedWhere
         ↓
Socket.IO join(room = restaurantId) + re-validazione tokenVersion
```

**File di riferimento:** `backend/src/middleware/auth.ts`, `backend/src/lib/tenant.ts`, `frontend/src/lib/api.ts`, `backend/src/socket/handlers.ts`

## 3.2 Cosa è blindato

- Quasi tutte le route business: `authenticate` → `requireDashboardAccess` → spesso `requireProPlan` / `requirePermission`
- Login multi-tenant: richiede `restaurantSlug` se email su più tenant (no enumerazione nomi — RX-02)
- Public routes: resolve `Restaurant` by `slug`, poi tutti i write scoped a `restaurant.id`
- Stripe webhooks: tenant da metadata `restaurantId`
- Cookie httpOnly per sessione staff (JWT non in localStorage per API principali)

## 3.3 Gap reali (non catastrofici, ma da chiudere prima di decine di tenant)

| Gap | Rischio | Evidenza |
|-----|---------|----------|
| `findUnique({ id })` senza `restaurantId` in alcuni handler | Basso oggi, alto se copy-paste | `orders.ts`, `reservations.ts`, `ai.ts` |
| `/api/admin/*` con `ADMIN_API_KEY` | **Alto se key leak** — accesso cross-tenant by design | `backend/src/routes/admin.ts` |
| Menu pubblico per slug | Enumerazione slug, non leak dati altri tenant | Rate limit presente, monitoring assente |
| Errori 500 con `err.message` raw | Information disclosure minore | `errorHandler.ts`, vari `throw err` |
| Test sicurezza automatizzati | Nessuna suite OWASP/tenant fuzzing | Solo 37 unit test dominio |

## 3.4 Verdetto sicurezza

**Per 5–10 ristoranti pilota con onboarding controllato:** accettabile.  
**Per “blindato per centinaia di tenant senza supervisione”:** **non ancora** — serve hardening query pattern + audit admin + pen test leggero.

---

# 4. VELOCITÀ E CONFIGURAZIONE (PERFORMANCE)

## 4.1 Prisma e database

| Aspetto | Stato | Dettaglio |
|---------|-------|-----------|
| Versione | **Prisma 6.6.0** (client + CLI) | Stabile, non v7 — scelta corretta |
| DB | PostgreSQL (Supabase) | `DATABASE_URL` + `DIRECT_URL` per migrate |
| Pooling | Via PgBouncer (`?pgbouncer=true` in `.env.example`) | Nessun tuning `connection_limit` in codice |
| Build deploy | `prisma generate && migrate deploy && tsc` | Migrazioni versionate in repo |
| Singleton client | `backend/src/lib/prisma.ts` | OK per 1 istanza; attenzione se scale orizzontale |

## 4.2 Indici presenti vs mancanti

**Presenti (bene):**
- `Order`: `@@index([restaurantId, status, paidAt])`, `@@index([restaurantId, createdAt])`
- Vincolo Zeta: `@@unique([restaurantId, calendarDay])`

**Mancanti / deboli (onesto):**
- `OrderItem` — no indice su `orderId` (join pesanti report + cucina)
- `Reservation` — no `@@index([restaurantId, date])`
- `Shift` — no composite per P&L

## 4.3 Query a rischio con “decine di ristoranti”

| Percorso | Problema |
|----------|----------|
| `GET /tables` | Nested orders + items per ogni tavolo |
| `GET /reports/pl` | `orderItem.findMany` mese intero con BOM inventario |
| `GET /ai/summary` | Tutti gli ordini tenant, senza window |
| `predictiveAI.ts` | Parallel findMany 8 settimane + YoY |
| `POST /payments/finalize` | Transazione 20s con catena fiscale + invoice + stock — **ha causato OOM** su `basic-xs` con Sentry profiling (fix RZ5-06) |

## 4.4 Infrastruttura produzione attuale

| Parametro | Valore | Valutazione |
|-----------|--------|-------------|
| Host | DigitalOcean App Platform `basic-xs` | **1 vCPU / 512MB** — marginale per sabato sera |
| Istanze | `instance_count: 1` | Single point of failure |
| Region | `fra` | OK per IT |
| Health | `/api/health` | OK |
| E2E prod | `test:flow` verde (giugno 2026) | Solo smoke, non load test |
| Frontend | Vercel (da `.cursorrules`) | Separato dal API |

## 4.5 Verdetto performance

**Prisma è configurato in modo professionale e stabile.**  
**L’app non è dimensionata** per molti tenant concorrenti in carico senza: almeno `basic-s`, indici aggiuntivi, ottimizzazione `/tables` e `/reports/pl`, e load test.

---

# 5. MATRICE DI PRONTEZZA (READINESS MATRIX)

| Modulo / Funzionalità | Stato attuale | Cosa manca per renderlo “Premium” | Criticità |
|----------------------|---------------|-----------------------------------|-----------|
| **Mappa tavoli interattiva** | Incompleto (~87%) | Query leggera, sync posizioni realtime, i18n residui | Fase 2 (performance sabato) |
| **Comanda POS / OrderModal** | Pronto (~92%) | Offline edge cases, polish mobile | — |
| **KDS tempo reale** | Incompleto (~90% ops / ~65% UX) | Re-skin Premium, stazioni, stampa cucina E2E | Fase 2 (percezione brand) |
| **Checkout & incasso staff** | Incompleto (~85%) | POS carta reale o sim configurata in prod; idempotency key FE | **Bloccante** se cliente paga solo carta |
| **Cassa contanti** | Pronto (~90%) | — | — |
| **Libro registro fiscale** | Incompleto (~83%) | Decimal DB, collaudo commercialista, VAT UI Premium | Bloccante per claim “fiscale rigoroso” senza concierge |
| **Chiusura Zeta** | Pronto (~88%) | Trasmissione Aruba Zeta live collaudata | Fase 2 |
| **Fatturazione B2B Aruba SDI** | Incompleto (~75%) | Credenziali prod, poller SDI, test con commercialista | Bloccante solo per clienti B2B heavy |
| **Multi-regime IT/ES/Canarie** | Pronto (~90%) | Test di regressione cross-border automatizzati | — |
| **Menu QR pubblico** | Incompleto (~78%) | Modificatori, mance guest, UI carrello dark | **Bloccante** se QR è selling point |
| **AI predittiva** | Incompleto (~72%) | Azioni automatiche, widget dashboard, rimuovere API orfane | Fase 2 (aspettativa marketing) |
| **CRM + Loyalty** | Pronto (~85%) | Tier automatici più sofisticati | — |
| **Prenotazioni + waitlist** | Pronto (~88%) | — | — |
| **Marketing email** | Pronto (~80%) | SMS, A/B, analytics aperture | Fase 2 |
| **Magazzino / BOM** | Incompleto (~80%) | Soft-reservation stock, ordini fornitore | Fase 2 |
| **Onboarding €500 chiavi in mano** | Abbozzato (~50%) | Checklist verificata da sistema, wizard dati fiscali, POS setup guidato | **Bloccante** per promessa setup |
| **Billing SaaS €199/mese** | Incompleto (~70%) | Self-serve completo, dunning, fattura SaaS automatica | Fase 2 |
| **Sicurezza multitenant** | Pronto (~80%) | Defense-in-depth query, pen test, admin audit | Bloccante prima di scale >20 tenant |
| **Infrastruttura prod** | Incompleto (~65%) | Istanza più grande, 2+ replica, monitoring, load test | **Bloccante** sabato sera multi-cliente |
| **Test & QA** | Incompleto (~40%) | E2E Playwright, load test, fiscal golden files | Bloccante per “zero sorprese” |
| **UX coerente Premium** | Incompleto (~75%) | KDS, guest cart, ReportFiscal VAT | Fase 2 (percezione) |

---

# CONCLUSIONE FINALE DEL PRODUCT DIRECTOR

## Percentuale stimata di prontezza globale

### **~74%** verso il lancio Premium dichiarato (€500 + €199/mese)

Dettaglio ponderato:

| Area | Peso | Score | Contributo |
|------|------|-------|------------|
| Moduli operativi core (tavoli, ordini, cucina, cassa) | 30% | 88% | 26,4% |
| Fiscale & compliance | 20% | 78% | 15,6% |
| Guest / QR / Stripe | 15% | 72% | 10,8% |
| AI & analytics PRO | 10% | 70% | 7,0% |
| UX Premium coerente | 10% | 75% | 7,5% |
| Sicurezza & multitenant | 10% | 82% | 8,2% |
| Infra, test, onboarding commerciale | 5% | 58% | 2,9% |
| **Totale** | 100% | — | **~78%** aritmetico → **~74%** con penalità rischio sabato sera |

La penalità riflette: istanza piccola, POS carta non default in prod, onboarding manuale, copertura test bassa.

---

## “Se domani mattina un ristorante di fascia alta pagasse i €500 di setup, l’app reggerebbe il servizio del sabato sera?”

### Risposta: **CONDIZIONALE — sì solo con concierge in sala e limiti espliciti.**

### Scenario A — Go-live **con team Aura Syncro** (concierge, 2–3 giorni setup, POS contanti o Stripe Terminal configurato, `basic-s` o superiore, un solo ristorante per istanza DB):

**Sì, probabilmente regge.**  
Il flusso critico è stato validato in produzione: ordine → cassa aperta → finalize CASH → CRM → marketing (`test:flow` verde). Tavoli, KDS socket, prenotazioni e magazzino sono codice maturo.

### Scenario B — Cliente Premium **autonomo** subito dopo pagamento, 50+ coperti, sabato sera, mix carta+contanti, menu QR con varianti, aspettativa “AI ottimizza magazzino”:

**No, non reggerebbe l’aspettativa né tutti i picchi tecnici.**

Motivi concreti:

1. **Finalize CARD** in produzione fallisce senza `POS_ALLOW_SIMULATION` o Terminal reale — un ristorante che incassa solo POS carta **si ferma al pagamento**.
2. **Istanza `basic-xs`** ha già mostrato instabilità (OOM/504 su finalize prima del fix Sentry) — un sabato sera con 3 camerieri + KDS + socket **non è dimensionato**.
3. **Menu QR senza modificatori** — menu reale con opzioni non è paritario col POS.
4. **Onboarding** è checklist manuale + Calendly, non provisioning verificato — il ristoratore percepisce “software incompleto” non “chiavi in mano €500”.
5. **AI predittiva** non sostituisce il magazziniere — rischio delusione vs landing.
6. **Nessun load test** — `/tables` con 50 tavoli e ordini nested è un rischio latency misurato ma non mitigato.

---

## Raccomandazioni prioritarie (ordine Product Director)

### P0 — Prima di accettare pagamenti Premium senza presenza fisica
1. Upgrade infra → `basic-s` minimo + `POS_ALLOW_SIMULATION` o Stripe Terminal documentato per ogni go-live
2. Collaudo finalize CARD + CASH in checklist onboarding **automatica** (non checkbox manuale)
3. Fix performance `GET /tables` (summary endpoint)
4. Modificatori su menu QR **oppure** disabilitare selling QR “completo” in landing

### P1 — Entro 30 giorni dal primo cliente pagante
5. Re-skin KDS + GuestCartDrawer allineati al design system
6. Indici Prisma su `OrderItem`, `Reservation`
7. Suite E2E Playwright (tavolo → cucina → incasso → report fiscale)
8. Decimal migration roadmap con commercialista

### P2 — Differenziazione Premium vera
9. Azioni AI predittive (reorder suggerito applicabile)
10. VeriFactu / sigillo Aruba PDF live
11. Onboarding wizard dati fiscali + test connessione POS self-serve

---

## Dichiarazione finale

Aura Syncro è **oltre il MVP**: è un **gestionale ristorazione multitenant avanzato** con profondità rara per un prodotto indie/SMB.  
Non è ancora un **prodotto Premium autosufficiente** che giustifica €500 setup **senza** il servizio concierge promesso implicitamente dal prezzo.

**La strada più onesta verso il lancio:** vendere il Premium come **“software + onboarding concierge”** (come già suggerito da `isSetupComplete` e `OnboardingPage`), chiudere i P0 in 2–3 settimane, e **non** promettere sabato sera zero-touch fino a load test + POS carta certificati.

---

*Report generato da analisi workspace Aura Syncro — 29/06/2026. Fonti: codice sorgente, `audit_bug_assoluto.md` (RZ-6), `npm run test` (37/37), `npm run test:flow` produzione DO, `.do/app.yaml`, `schema.prisma`, ispezione UX cross-module.*
