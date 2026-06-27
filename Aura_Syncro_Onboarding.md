# FILE 1: REQUISITI E RACCOLTA DATI CLIENTE
*(Questo modulo va inviato al ristoratore o compilato insieme durante il kick-off meeting commerciale)*

### 1.1 Anagrafica e Amministrazione
- [ ] Ragione Sociale e P.IVA / Codice Fiscale.
- [ ] Indirizzo fisico della sede operativa.
- [ ] Dati per la fatturazione elettronica (Codice Univoco / PEC).
- [ ] Account Stripe (Email di login o link di connessione Stripe Connect per attivazione pagamenti e penali No-Show).
- [ ] Credenziali Aruba SDI (se il piano prevede la fatturazione elettronica integrata al tavolo).

### 1.2 Struttura del Locale (Planimetria)
- [ ] Elenco delle Sale (es. Sala Interna, Dehor, Giardino).
- [ ] Mappa fisica dei tavoli per ciascuna sala con relative capienze (inviare PDF/JPEG della planimetria).
- [ ] Eventuale gestione di "Tavoli Unibili".

### 1.3 Menu e Listino
- [ ] Export del menu attuale (accettati CSV, Excel, XML, PDF).
- [ ] Suddivisione per categorie (es. Antipasti, Primi, Pizze, Bevande).
- [ ] Lista varianti e modificatori obbligatori/opzionali (es. Cottura Carne, Aggiunte Pizza, Senza Glutine).
- [ ] Gestione aliquote IVA applicabili (es. 10% per somministrazione, 22% per alcuni alcolici se applicabile localmente).

### 1.4 Hardware e Rete Esistente
- [ ] Presenza di una rete Wi-Fi dedicata ESCLUSIVAMENTE al gestionale (no rete ospiti).
- [ ] Modello e IP delle stampanti termiche esistenti (Verificare compatibilità ESC/POS, es. Epson, Bixolon).
- [ ] Inventario tablet/smartphone in dotazione ai camerieri (iOS/Android) e dispositivi in postazione cassa (Windows/Mac/iPad).

***

# FILE 2: CONFIGURAZIONE BACKOFFICE
*(Operazioni a carico dell'Admin o del team di setup di Aura Syncro, da eseguire prima di andare dal cliente)*

### 2.1 Creazione Tenant e Impostazioni Base
- [ ] Creazione del nuovo `RestaurantId` nel database di produzione (Supabase).
- [ ] Inserimento dei dati fiscali e di contatto nelle impostazioni del ristorante.
- [ ] Generazione della stringa di connessione (se necessaria) e validazione del piano abbonamento (Starter/Premium).

### 2.2 Setup Sala e Menu
- [ ] Costruzione del Floor Plan tramite l'editor visuale (drag-and-drop dei tavoli rispettando la planimetria).
- [ ] Importazione massiva o inserimento manuale del Menu.
- [ ] Configurazione delle Categorie e collegamento con le varianti/modificatori.
- [ ] Impostazione dell'ordine di uscita piatti (Course/Portate).

### 2.3 Gestione Staff (RBAC)
- [ ] Creazione account "Manager" / "Owner" (Accesso totale a fatturazione, analytics, ordini).
- [ ] Creazione account "Waiter" (Accesso solo presa ordini e mappa tavoli).
- [ ] Creazione account "Chef" (Accesso esclusivo alla vista Kitchen Display).
- [ ] Creazione account "Cashier" (Accesso agli incassi e chiusura Blind Drop).
- [ ] Assegnazione PIN/Password iniziali e forzatura cambio al primo accesso.

### 2.4 Setup Stampa (Print Agent Routing)
- [ ] Associazione delle categorie menu ai centri di produzione (es. "Pizze" -> Stampante Forno; "Bevande" -> Stampante Bar).

***

# FILE 3: DEPLOY E ATTIVAZIONE APPARATI
*(Operazioni sul campo, presso il ristorante)*

### 3.1 Networking e Print Agent (Postazione Cassa)
- [ ] Verifica connettività Wi-Fi/LAN (eseguire speed test e verificare latenza).
- [ ] Assegnazione Indirizzi IP Statici alle stampanti termiche tramite il router del locale.
- [ ] Installazione del modulo **Aura Print Agent** sul PC di Cassa (o Raspberry Pi).
- [ ] Configurazione del file `.env` locale:
  - `AURA_RESTAURANT_ID` = [ID assegnato al locale]
  - `PRINTER_TYPE` = NETWORK (o USB)
  - `PRINTER_IP` = [IP Statico Stampante]
- [ ] Avvio del servizio in auto-start (es. tramite PM2 o Servizio Windows) e verifica log `✅ Print Agent connesso`.

### 3.2 Attivazione PWA (Dispositivi Mobili)
- [ ] Tablet Cassa: Apertura di Aura Syncro su Chrome/Safari -> "Aggiungi a Schermata Home" (Installazione PWA in modalità Standalone).
- [ ] Dispositivi Camerieri (iPad/Android): Apertura URL -> Login con ruolo Waiter -> Aggiungi a Schermata Home.
- [ ] Dispositivo Cucina (Tablet/Monitor Touch): Apertura URL -> Login con ruolo Chef -> Aggiungi a Schermata Home.

### 3.3 Hardware Fiscale (POS)
- [ ] Sincronizzazione terminale Stripe Terminal (se previsto) tramite codice di paring nel backoffice.
- [ ] Verifica del collegamento al cassetto portamonete (tramite cavo RJ11 collegato alla stampante termica di cassa).

***

# FILE 4: GUIDA RAPIDA DI COLLAUDO (UAT)
*(User Acceptance Testing: Checklist di 5 minuti per validare l'installazione e dare le chiavi al cliente)*

### 4.1 Test Ordine e Flusso Cucina
- [ ] Aprire un tavolo dalla PWA del Cameriere.
- [ ] Inserire un antipasto, un primo e una bevanda con note/modificatori (es. "Senza Ghiaccio").
- [ ] Inviare l'ordine.
- [ ] **Esito Atteso 1:** Il tablet della Cucina mostra immediatamente la comanda in tempo reale (Socket.io).
- [ ] **Esito Atteso 2:** Il Print Agent stampa automaticamente le comande ai reparti corretti (Bar / Cucina).

### 4.2 Test Modifiche e Sincronizzazione
- [ ] Il cameriere riapre lo stesso tavolo e aggiunge un dolce.
- [ ] **Esito Atteso:** La cucina riceve solo il dolce (aggiornamento). La cassa vede l'importo del tavolo salire in tempo reale.

### 4.3 Test Incasso e Cassa
- [ ] Effettuare il "Checkout" dalla PWA di Cassa.
- [ ] Selezionare pagamento parziale o "Contanti".
- [ ] **Esito Atteso 1:** Stampa dello scontrino di cortesia/fiscale tramite Print Agent.
- [ ] **Esito Atteso 2:** Il cassetto portamonete si apre automaticamente (comando kick-out da ESC/POS).
- [ ] **Esito Atteso 3:** Il tavolo torna libero ("FREE") sulla mappa per i camerieri.

### 4.4 Test Chiusura Turno (Blind Drop)
- [ ] Aprire il modulo "Cassa" dal menu laterale.
- [ ] Inserire un prelievo fittizio (es. -10€ per spesa).
- [ ] Effettuare la "Chiusura Turno".
- [ ] **Esito Atteso:** Il gestionale rileva l'importo calcolato e lo confronta con il digitato del cassiere, registrando la sessione senza errori.

--- 

*Firma Tecnico Installatore: _______________________*  
*Firma Cliente (Accettazione): _______________________*  
*Data: ___/___/202_*
