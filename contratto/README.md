# Contratti e documenti commerciali — Aura Syncro

Hub per i materiali legali e commerciali del piano **Premium** (€500 setup + €199/mese + IVA).

Documentazione correlata:

| Documento | Percorso |
|---|---|
| README progetto | [`../README.md`](../README.md) |
| Playbook onboarding concierge | [`../Aura_Syncro_Onboarding.md`](../Aura_Syncro_Onboarding.md) |
| Contratto integrale v2.0 | [`../CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.md`](../CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.md) |

---

## File in questa cartella

| File | Descrizione |
|---|---|
| `CONTRATTO_RIEPILOGO_ESECUTIVO.html` | **Riepilogo 2 pagine** — apri in Chrome → Stampa → Salva come PDF |
| `EMAIL_TEMPLATE_BENVENUTO_CONTRATTO.md` | Template email post-pagamento con link firma e onboarding |

Il contratto integrale (testo giuridico completo) è nella root del repo: `CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.md`.

---

## Flusso commerciale (sintesi)

1. **Registrazione** — cliente crea account con regime fiscale IT / ES / Canarie
2. **Anteprima gratuita** — tier `unsubscribed` (dashboard, ordini, menu, report)
3. **Pagamento Stripe** — `/dashboard/billing` → setup €500 + abbonamento €199/mo
4. **Invio contratto** — email da `EMAIL_TEMPLATE_BENVENUTO_CONTRATTO.md` + PDF riepilogo o contratto integrale
5. **Onboarding guidato** — `/dashboard/onboarding` (Tally + Calendly), vedi `Aura_Syncro_Onboarding.md`
6. **Sblocco operativo** — `POST /api/admin/setup-complete` o UI `/platform-admin`

Finché non viene completato il setup concierge, il cliente resta sulla pagina Onboarding con sidebar limitata.

---

## Generare PDF in 2 minuti

1. Doppio click su `CONTRATTO_RIEPILOGO_ESECUTIVO.html`
2. Chrome → `Ctrl+P` → **Salva come PDF**
3. Per il contratto lungo: apri `../CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.md` in Word/Google Docs → Esporta PDF

---

## Firma consigliata

| Servizio | Uso |
|---|---|
| **YouSign** / **DocuSign** | B2B, audit trail, workflow remoto |
| **Aruba Sign** / **InfoCert** | Firma elettronica qualificata (Italia) |

---

## Archiviazione post-firma

Conservare per **10 anni**:

- PDF contratto firmato
- Ricevuta / fattura Stripe (setup + primo canone)
- Email di benvenuto inviata al cliente
- Eventuale verbale di collaudo UAT (fase 4 onboarding)

---

## Checklist operatore (dopo pagamento)

```bash
# Verifica Stripe Live
cd backend && npm run stripe:verify

# Sincronizza webhook produzione
npm run stripe:sync-webhooks

# Dopo onboarding completato: sblocca dashboard
curl -X POST https://<backend>/api/admin/setup-complete \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"<id>"}'
```

Variabili produzione obbligatorie: `STRIPE_PRICE_SETUP`, `STRIPE_PRICE_SUBSCRIPTION`, `ADMIN_API_KEY`, `SMTP_*` — vedi [`../README.md`](../README.md#variabili-produzione-obbligatorie).
