# Aura Syncro — Guida Onboarding Concierge Premium

**Modello commerciale:** €500 setup (una tantum) + €199/mese + IVA  
**Promessa:** piattaforma SaaS + **setup chiavi in mano** con il team Aura Syncro (non autopilot).

Questo documento è la **checklist operativa** per te e il team: cosa succede dopo il pagamento, cosa chiedere al cliente, cosa configurare e come validare il go-live.

---

## Panoramica — Le 5 fasi

| Fase | Quando | Chi | Obiettivo |
|------|--------|-----|-----------|
| **0. Pagamento** | Giorno 0 | Cliente | Stripe attiva abbonamento Premium |
| **1. Kick-off** | Giorni 0–2 | Cliente + tu | Raccolta dati (modulo Tally + call Calendly) |
| **2. Backoffice** | Giorni 2–5 | Team Aura | Menu, tavoli, fiscale, staff, POS |
| **3. Sul campo** | Giorno setup | Team Aura + cliente | PWA, rete, stampanti, QR |
| **4. Collaudo** | Fine setup | Entrambi | Test UAT 15 min + firma accettazione |
| **5. Go-live** | Dopo collaudo | Team Aura | Sblocco dashboard + primo servizio |

**Regola d’oro:** finché non chiami `POST /api/admin/setup-complete`, il cliente vede solo la pagina **Onboarding** (sidebar bloccata). L’abbonamento può essere attivo, ma la dashboard operativa resta in attesa del concierge.

---

# FASE 0 — Subito dopo il pagamento (automatico + tu)

### Cosa fa il sistema
- [ ] Il cliente completa il checkout Stripe (setup + abbonamento) dalla landing.
- [ ] Viene creato il tenant (`Restaurant` + utente **OWNER**).
- [ ] `hasActiveSubscription` passa a `true` e `planTier` a `PRO`.
- [ ] Il cliente viene reindirizzato a `/onboarding?welcome=true` con toast di benvenuto.

### Cosa fai tu (entro 24h)
- [ ] Controlla la nuova iscrizione:
  ```http
  GET /api/admin/registrations?today=true
  X-Admin-Key: <ADMIN_API_KEY>
  ```
- [ ] Oppure elenco in attesa di sblocco:
  ```http
  GET /api/admin/pending-setup
  X-Admin-Key: <ADMIN_API_KEY>
  ```
- [ ] Invia email/messaggio di benvenuto con:
  - URL login: `https://aurasyncro.com/login`
  - Link modulo dati: **https://tally.so/r/WOQp1P**
  - Link call: **https://calendly.com/aurasyncro/30min**
- [ ] **Non** sbloccare ancora la dashboard: prima menu + call + configurazione.

### Cosa vede il cliente nell’app
- Pagina **Onboarding** con:
  - **Verifica automatica go-live** (6 controlli di sistema)
  - Checklist concierge (modulo + call)
  - Note sul POS fisico (“si configura dopo la call”)

---

# FILE 1 — REQUISITI E RACCOLTA DATI CLIENTE

*(Invia al ristoratore o compila insieme durante il kick-off. Il modulo Tally copre gran parte di questa sezione.)*

### 1.1 Anagrafica e amministrazione
- [ ] Ragione sociale e **P.IVA / NIF / CIF** (obbligatorio per report fiscale e QR guest).
- [ ] **Paese e regime fiscale:**
  - Italia → `IT_MAIN` (IVA, P.IVA)
  - Spagna penisola → `ES_PENINSULA` (IVA, NIF/CIF)
  - Isole Canarie → `ES_CANARIAS` (IGIC — regime diverso)
- [ ] Indirizzo sede operativa e timezone operativo (default Europa/Roma).
- [ ] Dati fatturazione elettronica B2B (se serve):
  - Italia: Codice Univoco SDI + PEC
  - Spagna: dati AEAT / VeriFactu (roadmap trasmissione automatica)
- [ ] Email e telefono referente operativo (owner/manager).
- [ ] **Stripe:** email account o conferma che useranno pagamenti guest/depositi su Stripe Aura (già integrato lato piattaforma; per Terminal serve call dedicata).

### 1.2 Aruba SDI / fatturazione elettronica (solo se richiesto nel contratto)
- [ ] Credenziali Aruba Fatturazione Elettronica (`ARUBA_FE_USERNAME`, `ARUBA_FE_PASSWORD`).
- [ ] Conferma se vogliono invio SDI **live** o solo report/PDF interni Aura (mock di default fino ad attivazione).
- [ ] Chiarire: **fattura B2B da Aura** ≠ scontrino fiscale al tavolo (quello resta sul POS del ristorante se `EXTERNAL`).

### 1.3 Struttura del locale (planimetria)
- [ ] Elenco sale (Sala interna, Dehor, Giardino…).
- [ ] Mappa tavoli con **numero** e **capienza** per sala (PDF/JPEG planimetria).
- [ ] Tavoli unibili (es. 12+14 → 26 posti).
- [ ] Orari servizio e turni (pranzo/cena) se diversi dal default.

### 1.4 Menu e listino
- [ ] Export menu (CSV, Excel, PDF, foto listino).
- [ ] Categorie (Antipasti, Primi, Pizze, Bevande…).
- [ ] Per ogni piatto: **prezzo lordo**, allergeni, tempo preparazione (opz.).
- [ ] **Modificatori/varianti** (cottura, aggiunte, senza glutine, extra…).
- [ ] Aliquote IVA per categoria se miste (es. 10% food, 22% alcuni alcolici in IT).
- [ ] Piatti esauribili / stagionali / menu del giorno.

### 1.5 Prenotazioni e politiche
- [ ] Capacità massima per fascia oraria.
- [ ] Deposito/no-show: vogliono acconto Stripe sulle prenotazioni?
- [ ] Politica cancellazione e reminder email.
- [ ] Lista d’attesa (waitlist) sì/no.

### 1.6 Fedeltà e CRM
- [ ] Programma punti: default Aura (Bronze / Silver / Gold) o personalizzazione tier.
- [ ] Sconti per livello (default Gold −10%).
- [ ] Raccolta email/telefono ospiti per marketing (GDPR: base giuridica e opt-in).

### 1.7 Menu QR e ordini ospite
- [ ] Vogliono **ordini dal QR** al tavolo? (default: **sì**, disabilitabile con env `GUEST_ORDERING_ENABLED=false`).
- [ ] Pagamento guest: **carta Stripe** e/o **ordine a tavolo** (cameriere incassa).
- [ ] Mance digitali sul QR sì/no.
- [ ] Dove appendere i QR (tavoli, ingresso, dehors) — usare **QR Builder** in app (`/qr`).

### 1.8 Hardware, rete e POS fisico
- [ ] Wi‑Fi **dedicato staff** (consigliato, separato dalla rete ospiti).
- [ ] Inventario dispositivi: tablet camerieri, iPad cassa, monitor cucina (KDS).
- [ ] **POS fisico / registratore di cassa:** marca, modello, dove si trova, chi emette lo scontrino fiscale legale.
- [ ] Stampanti termiche (modello, rete/USB, IP statici) — solo se usate con **Print Agent** (opzionale).
- [ ] Stripe Terminal: hanno hardware Stripe o vogliono solo registratore esistente?

### 1.9 Personale e ruoli
- [ ] Elenco utenti da creare con ruolo:
  - **OWNER** — titolare (tutto)
  - **MANAGER** — report, impostazioni, ordini
  - **WAITER** — tavoli e comande (mobile)
  - **CHEF** — solo Kitchen Display
  - **CASHIER** — incassi e cassa
- [ ] Email per ogni account; password temporanea + cambio al primo accesso.

---

# FILE 2 — CONFIGURAZIONE BACKOFFICE (team Aura)

*(Prima della visita in loco o in parallelo alla call di kick-off.)*

### 2.1 Tenant e abbonamento
- [ ] Verifica tenant in produzione (database Prisma su Supabase/Postgres — **non** creare manualmente se già registrato via Stripe).
- [ ] Conferma `hasActiveSubscription: true` e `planTier: PRO`.
- [ ] Annota `restaurantId`, `slug` e email OWNER (servono per API admin).

### 2.2 Impostazioni fiscali (Impostazioni → Ristorante)
- [ ] `countryCode` e `taxRegion` corretti (IT / ES penisola / ES Canarie).
- [ ] `taxId` (P.IVA / NIF) compilato.
- [ ] `taxRate` coerente col regime (il motore `taxEngine` centralizza i calcoli).
- [ ] `defaultLocale` (it-IT, es-ES, ecc.).

### 2.3 Verifica automatica go-live (6 controlli)

Controlla in app (pagina Onboarding) o via API:

```http
GET /api/restaurant/onboarding-readiness
Authorization: Bearer <token-owner>
```

| Controllo | Criterio |
|-----------|----------|
| `subscription` | Abbonamento Premium attivo |
| `menu` | ≥ 3 piatti disponibili |
| `tables` | ≥ 1 tavolo |
| `fiscal` | P.IVA/NIF + aliquota |
| `pos` | POS configurato **oppure** simulazione abilitata in produzione |
| `staff` | ≥ 1 utente |

`readyForService: true` quando subscription + menu + tables + fiscal + pos sono OK.

### 2.4 Setup sala e menu
- [ ] Floor plan nell’editor tavoli (drag-and-drop) rispettando planimetria.
- [ ] Import o inserimento menu (minimo 3 piatti per check automatico).
- [ ] Categorie, modificatori, ordine portate (course).
- [ ] Ricette/magazzino se cliente usa scalatura stock.

### 2.5 Staff (RBAC)
- [ ] Account OWNER (già esistente) + WAITER, CHEF, CASHIER come da elenco cliente.
- [ ] Permessi verificati: cameriere **non** vede report fiscale; chef **solo** KDS.

### 2.6 POS carta — configurazione concierge

**Default post-pagamento:** `PENDING_SETUP` (pagamenti carta in simulazione fino alla call).

Dopo la call, quando hai marca/modello:

```http
POST /api/admin/pos-config
X-Admin-Key: <ADMIN_API_KEY>
Content-Type: application/json

{
  "slug": "nome-ristorante",
  "mode": "EXTERNAL",
  "posProviderLabel": "Nexi SmartPOS",
  "posTerminalId": "TPV-12345",
  "posSetupNotes": "Scontrino fiscale dal registratore in cassa"
}
```

| Modalità | Quando usarla |
|----------|---------------|
| `PENDING_SETUP` | Appena pagato, in attesa dati POS |
| `SIMULATION` | Formazione / demo |
| `STRIPE_TERMINAL` | Stripe Terminal collegato |
| `EXTERNAL` | Registratore del ristorante — Aura registra solo il gestionale |

Con `EXTERNAL` la **ricevuta fiscale legale** esce dal loro hardware; Aura traccia incasso e report interni.

### 2.7 QR menu pubblico
- [ ] URL menu: `https://aurasyncro.com/menu/{slug}`
- [ ] Genera QR per tavolo da **QR Builder** (`/qr`) con parametro `?table=12` se ordine al tavolo.
- [ ] Verifica che i dati fiscali siano compilati (il carrello guest richiede `restaurant.fiscal`).

### 2.8 Fedeltà
- [ ] I tier default (Bronze/Silver/Gold) si creano al primo accesso al modulo fedeltà.
- [ ] Eventuale import clienti CRM pre-esistenti.

### 2.9 Marketing email
- [ ] Verifica SMTP piattaforma (`SMTP_*` su DigitalOcean).
- [ ] Test invio campagna su 1–2 email interne prima del go-live.

### 2.10 Stampa termica (opzionale — Print Agent)
- [ ] Se il cliente usa stampanti ESC/POS in LAN: preparare cartella `print-agent/` sul PC cassa.
- [ ] Configurare `.env` con `AURA_RESTAURANT_ID`, tipo stampante NETWORK/USB, IP statico.
- [ ] Avvio `npm start` e verifica log `✅ Print Agent connesso`.
- [ ] **Nota:** senza Print Agent, KDS e schermo cucina funzionano comunque; manca solo la stampa fisica automatica.

---

# FILE 3 — DEPLOY E ATTIVAZIONE SUL CAMPO

### 3.1 Rete
- [ ] Speed test Wi‑Fi in sala e in cucina (latenza < 100 ms ideale).
- [ ] IP statici alle stampanti di rete (se Print Agent).
- [ ] Tablet su rete staff, non guest isolato senza internet.

### 3.2 PWA — installazione dispositivi
- [ ] **Cassa:** Chrome/Edge → `aurasyncro.com` → Login → “Aggiungi a schermata Home”.
- [ ] **Camerieri:** stesso URL, login WAITER, PWA fullscreen.
- [ ] **Cucina:** tablet/monitor → login CHEF → `/kitchen` (Kitchen Display).
- [ ] Test rotazione schermo e luminosità sempre attiva.

### 3.3 Stampa cucina — due percorsi (scegliere uno o entrambi)

**A — Tablet Android Aura Syncro Mobile (consigliato in sala)**
- [ ] Installare l'app wrapper sul tablet cassa/cameriere.
- [ ] Impostazioni → **Hardware tablet**: pairing stampante Bluetooth/Wi‑Fi ESC/POS.
- [ ] Invio comanda → stampa cucina **locale** dal tablet (non richiede PC in LAN).

**B — Print Agent su PC (opzionale, legacy LAN)**
- [ ] Installazione Node.js + `print-agent` su PC cassa.
- [ ] Auto-start (PM2 o servizio Windows).
- [ ] Stampa prova comanda bar + cucina via Socket.IO.

### 3.4 POS fisico
- [ ] Admin: `POST /api/admin/pos-config` con `mode: EXTERNAL` (o altra modalità concordata).
- [ ] Tablet: Impostazioni → **Hardware tablet** → app POS installata + deep link (se supportato).
- [ ] Se `STRIPE_TERMINAL`: pairing dal backoffice Stripe.
- [ ] Se `EXTERNAL`: incasso carta **solo dal tablet Android** → app POS → conferma in Aura; il browser desktop non può chiudere conti carta.
- [ ] Cassetto contanti: kick-out via stampante ESC/POS se cablato.

### 3.5 QR fisici
- [ ] Stampa e plastificazione QR tavoli.
- [ ] Test scansione con telefono ospite (4G, non solo Wi‑Fi staff).

---

# FILE 4 — GUIDA RAPIDA DI COLLAUDO (UAT ~15 min)

### 4.1 Ordine sala + cucina
- [ ] Cameriere apre tavolo, inserisce antipasto + primo + bevanda con modificatore.
- [ ] Invia ordine.
- [ ] **Atteso:** KDS aggiornato in tempo reale (socket).
- [ ] **Atteso (se Print Agent):** stampa reparti corretti.

### 4.2 Modifica ordine
- [ ] Aggiunta dolce sullo stesso tavolo.
- [ ] **Atteso:** cucina vede solo il delta; totale tavolo aggiornato ovunque.

### 4.3 Incasso cassa
- [ ] Checkout → **Contanti** (cassa aperta).
- [ ] **Atteso:** ordine `PAID`, tavolo libero, movimento in libro fiscale interno.
- [ ] Ripeti con **Carta** (simulazione o POS reale secondo modalità configurata).

### 4.4 Ordine guest QR (se attivo)
- [ ] Scansione QR → menu → piatto con modificatore → pagamento Stripe **o** ordine a tavolo.
- [ ] **Atteso:** ordine in cucina; email ricevuta se checkout Stripe.

### 4.5 Fedeltà
- [ ] Ordine con cliente CRM collegato tier Gold.
- [ ] **Atteso:** sconto % applicato in creazione ordine.

### 4.6 Cassa — chiusura turno
- [ ] Prelievo fittizio, chiusura blind drop.
- [ ] **Atteso:** quadratura senza errori.

### 4.7 Report fiscale
- [ ] Scarica PDF/CSV report fiscale giornaliero.
- [ ] **Atteso:** terminologia corretta per regime (IVA / IGIC), mance escluse da imponibile.

### 4.8 Smoke tecnico (team Aura, opzionale)
```bash
cd backend && npm run test:flow
```
Deve completare: login → CASH → CARD → guest QR → CRM → marketing.

---

# FASE 5 — SBLOCCO GO-LIVE

### Quando sbloccare
Solo quando **tutti** questi sono veri:
- [ ] Modulo Tally compilato e menu caricato (≥ 3 piatti).
- [ ] Call di allineamento fatta.
- [ ] Controlli sistema verdi (o eccezioni documentate col cliente).
- [ ] UAT firmato.

### Comando sblocco dashboard
```http
POST /api/admin/setup-complete
X-Admin-Key: <ADMIN_API_KEY>
Content-Type: application/json

{ "slug": "nome-ristorante" }
```
Oppure: `restaurantId` o `ownerEmail`.

Il cliente passa da stato `onboarding` a **dashboard completa** (`isSetupComplete: true`).

### Emergenza — rimetti in onboarding
```http
POST /api/admin/setup-reset
X-Admin-Key: <ADMIN_API_KEY>
{ "slug": "nome-ristorante" }
```

### Dopo lo sblocco
- [ ] Breve formazione live (30 min): tavoli, KDS, cassa, prenotazioni.
- [ ] Lascia contatto supporto e orari.
- [ ] Monitora primo servizio (sabato sera se possibile in affiancamento).

---

# APPENDICE A — Script domande da fare al cliente

Usa queste domande nella **call Calendly** (30 min):

1. **“Chi emette lo scontrino fiscale legale oggi?”** → determina `EXTERNAL` vs `STRIPE_TERMINAL`.
2. **“Quanti coperti e quante sale?”** → floor plan.
3. **“I camerieri usano smartphone o tablet dedicati?”** → PWA.
4. **“Volete che gli ospiti ordinino dal QR senza chiamare il cameriere?”** → guest ordering.
5. **“Avete deposito sulle prenotazioni/no-show?”** → Stripe depositi.
6. **“Menu fisso o cambia spesso? Chi lo aggiorna?”** → formazione Menu.
7. **“Programma fedeltà attivo oggi? Come funziona?”** → tier.
8. **“Fattura elettronica B2B: usate Aruba o altro?”** → integrazione SDI.
9. **“Siete in Italia, Spagna penisola o Canarie?”** → regime fiscale (**critico**).
10. **“Quando volete andare live?”** → pianifica setup e UAT.

---

# APPENDICE B — Riferimenti tecnici rapidi

| Risorsa | URL / comando |
|---------|----------------|
| App produzione | https://aurasyncro.com |
| API backend | https://aura-syncro-s98ae.ondigitalocean.app/api |
| Health check | `GET /api/health` (include flag POS runtime) |
| Modulo onboarding cliente | https://tally.so/r/WOQp1P |
| Calendly call | https://calendly.com/aurasyncro/30min |
| Menu pubblico | `https://aurasyncro.com/menu/{slug}` |
| Scope prodotto | `backend/docs/PRODUCT_SCOPE.md` |
| Demo script vendita | `backend/docs/DEMO_SCRIPT.md` |
| Print Agent | `print-agent/README.md` |

### Variabili ambiente rilevanti (DigitalOcean)
- `POS_USE_SIMULATION` / `POS_ALLOW_SIMULATION` — pagamenti carta in demo fino a POS reale
- `GUEST_ORDERING_ENABLED` — default `true`; `false` disabilita ordini QR
- `ARUBA_FE_*` — fatturazione elettronica live (per tenant/contratto)
- `STRIPE_*` — pagamenti, abbonamenti, checkout guest

---

# APPENDICE C — Cosa NON promettere in vendita

- POS carta “già collegato” **prima** della call di setup.
- SDI / VeriFactu inviato automaticamente **senza** credenziali e configurazione.
- SMS marketing (non operativo).
- AI come machine learning predittivo (oggi: statistiche + meteo).
- Cashback % su fedeltà (non implementato).
- Print Agent obbligatorio (è opzionale; KDS funziona senza).

---

# APPENDICE D — Firma accettazione UAT

*Firma tecnico installatore: _______________________*  
*Firma cliente (accettazione): _______________________*  
*Data go-live: ___/___/202_*

---

*Ultimo aggiornamento: 29 giugno 2026 — allineato a produzione Premium (RZ-7).*
