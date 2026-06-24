# Aura Syncro — Ambito prodotto e setup POS

Documento per vendita onesta e onboarding concierge.

## Cosa include l'abbonamento (199€/mese + 500€ setup)

| Modulo | Stato | Note |
|--------|-------|------|
| Tavoli & comande | ✅ Produzione | Flusso sala completo |
| Schermo cucina (KDS) | ✅ Produzione | Realtime |
| Prenotazioni + depositi | ✅ Produzione | Stripe se configurato |
| Menu + ricette/magazzino | ✅ Produzione | Scalatura stock al pagamento |
| CRM clienti | ✅ Produzione | Auto-link da ordini |
| Report fiscale interno | ✅ Produzione | PDF/CSV per regime IT/ES |
| Fedeltà (punti + sconto tier) | ✅ Produzione | Sconto se cliente collegato all'ordine |
| Menu QR ordine ospite | ✅ Produzione | Disabilitabile con `GUEST_ORDERING_ENABLED=false` |
| Marketing email | ⚠️ Base | Campagne email; SMS non operativo |
| AI predittiva | ⚠️ Insights | Statistiche + meteo, non ML |
| Fatturazione elettronica SDI | ⚠️ Setup | Mock di default; live con env Aruba |

## POS fisico — modello per ristorante

**Non conoscete il POS del cliente prima del pagamento.** È normale.

Dopo la call di setup, quando il ristorante fornisce marca/modello/terminale, il team concierge configura via API admin:

```http
POST /api/admin/pos-config
X-Admin-Key: <ADMIN_API_KEY>

{
  "slug": "ristorante-cliente",
  "mode": "EXTERNAL",
  "posProviderLabel": "Nexi SmartPOS",
  "posTerminalId": "TPV-12345",
  "posSetupNotes": "Registratore in cassa, scontrino fiscale dal loro hardware"
}
```

### Modalità (`PosIntegrationMode`)

| Modalità | Quando usarla | Ricevuta fiscale legale |
|----------|---------------|-------------------------|
| `PENDING_SETUP` | Default post-pagamento | ❌ Non ancora — simulazione |
| `SIMULATION` | Demo / formazione | ❌ Solo test |
| `STRIPE_TERMINAL` | Stripe Terminal collegato | ✅ Via Stripe (se configurato) |
| `EXTERNAL` | Registratore di cassa del ristorante | ✅ **Dal loro POS** — Aura registra il gestionale |

Con `EXTERNAL`, Aura **non simula** l'addebito carta: registra che l'incasso è avvenuto sul terminale del cliente. La ricevuta fiscale legale è responsabilità del loro hardware certificato.

## Checklist concierge post-pagamento

1. `POST /api/admin/setup-complete` — sblocca dashboard (dopo menu + call)
2. `POST /api/admin/pos-config` — quando avete i dati del POS
3. Verificare regime fiscale in Impostazioni (IT / ES)
4. Configurare Aruba/SDI se richiesto (`ARUBA_FE_*` env)
5. Eseguire `npm run test:flow` sul tenant del cliente

## Demo commerciale

Tenant demo: `npm run db:seed-demo` → slug `aura-demo`

Script demo 15 min: vedi `docs/DEMO_SCRIPT.md`

## Cosa NON promettere in vendita

- POS carta “già collegato” prima del setup
- SDI/VeriFactu inviato automaticamente senza configurazione
- SMS marketing
- AI come machine learning
- Cashback % (non implementato)
